'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const constants = require('./constants');

let _cacheDir = constants.CACHE_DIR;
let _httpClient = defaultHttpClient;

function setTestOverrides(opts = {}) {
  if (opts.cacheDir) _cacheDir = opts.cacheDir;
  if (opts.httpClient) _httpClient = opts.httpClient;
}

function getCachePath() {
  return path.join(_cacheDir, constants.CACHE_FILE);
}

function readCache() {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeCache(data) {
  if (!fs.existsSync(_cacheDir)) {
    fs.mkdirSync(_cacheDir, { recursive: true });
  }
  const cachePath = getCachePath();
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function clearCache() {
  const cachePath = getCachePath();
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
}

function maskKey(key) {
  if (!key || key.length < 16) return '****-****-****-****';
  const parts = key.split('-');
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-****-****`;
  }
  return key.substring(0, 8) + '...';
}

function resolveTier(variants) {
  if (!variants || typeof variants !== 'object') return 'free';
  const values = Object.values(variants).map(v => typeof v === 'string' ? v.toLowerCase() : '');
  
  if (values.some(v => v.includes('team'))) return 'team';
  if (values.some(v => v.includes('pro'))) return 'pro';
  
  return 'free'; // fallback if they buy a tier we don't recognize
}

function defaultHttpClient(url, data) {
  return new Promise((resolve, reject) => {
    const dataStr = new URLSearchParams(data).toString();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(dataStr)
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Malformed response from Gumroad'));
        }
      });
    });

    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function verifyWithGumroad(licenseKey) {
  try {
    const data = await _httpClient(constants.GUMROAD_VERIFY_URL, {
      product_id: constants.GUMROAD_PRODUCT_ID,
      license_key: licenseKey,
      increment_uses_count: 'false'
    });

    if (!data || data.success === false) {
      return { ok: false, reason: data?.message || 'Invalid license key.' };
    }

    const p = data.purchase;
    if (p.refunded) return { ok: false, reason: 'License was refunded.' };
    if (p.disputed) return { ok: false, reason: 'License was disputed.' };
    if (p.subscription_cancelled_at) return { ok: false, reason: 'Subscription cancelled.' };
    if (p.subscription_failed_at) return { ok: false, reason: 'Subscription payment failed.' };

    const tier = resolveTier(p.variants);

    return { ok: true, tier };
  } catch (err) {
    return { ok: false, networkError: true, reason: 'Failed to connect to Gumroad API. Check your internet connection.' };
  }
}

async function login(licenseKey) {
  const result = await verifyWithGumroad(licenseKey);
  if (!result.ok) {
    return result; // return reason to caller
  }

  const cacheData = {
    license_key: licenseKey,
    tier: result.tier,
    verified_at: Date.now(),
    status: 'valid'
  };

  writeCache(cacheData);

  return { 
    ok: true, 
    tier: result.tier,
    masked_key: maskKey(licenseKey)
  };
}

function logout() {
  clearCache();
}

async function checkAccess(commandName) {
  if (process.env.DRIFTLOCK_SKIP_LICENSE_CHECK) {
    return { licensed: true, tier: 'team' };
  }

  const requiredTier = constants.COMMAND_TIERS[commandName] || 'free';
  if (requiredTier === 'free') {
    return { licensed: true, tier: 'free' };
  }

  const cache = readCache();
  if (!cache || cache.status !== 'valid') {
    return { 
      licensed: false, 
      reason: 'No valid license found. Run `driftlock login <key>`.',
      purchaseUrl: constants.GUMROAD_PURCHASE_URL
    };
  }

  const now = Date.now();
  const age = now - cache.verified_at;

  if (age > constants.CACHE_TTL_MS) {
    // TTL expired, re-verify
    const result = await verifyWithGumroad(cache.license_key);
    
    if (result.ok) {
      cache.verified_at = now;
      cache.tier = result.tier;
      writeCache(cache);
    } else if (result.networkError) {
      // Graceful degradation
      if (age > constants.CACHE_TTL_MS + constants.GRACE_PERIOD_MS) {
        return {
          licensed: false,
          reason: 'License verification is too far out of date and network is unreachable.',
          purchaseUrl: constants.GUMROAD_PURCHASE_URL
        };
      } else {
        // Warn but allow (let CLI handle warning if needed)
        // We'll modify cache verified_at slightly so we don't spam requests, but keep it past TTL
        cache.verified_at = now - constants.CACHE_TTL_MS + (60 * 60 * 1000); // 1 hour buffer
        writeCache(cache);
        result.networkWarning = true;
      }
    } else {
      // Explicitly invalid now
      clearCache();
      return {
        licensed: false,
        reason: `License is no longer valid: ${result.reason}`,
        purchaseUrl: constants.GUMROAD_PURCHASE_URL
      };
    }
  }

  const currentTierLevel = constants.TIER_HIERARCHY[cache.tier] || 0;
  const requiredTierLevel = constants.TIER_HIERARCHY[requiredTier] || 0;

  if (currentTierLevel < requiredTierLevel) {
    return {
      licensed: false,
      reason: `'${commandName}' requires ${requiredTier} tier, but your license is ${cache.tier}.`,
      requiredTier,
      purchaseUrl: constants.GUMROAD_PURCHASE_URL
    };
  }

  return { licensed: true, tier: cache.tier };
}

function whoami() {
  const cache = readCache();
  if (!cache || cache.status !== 'valid') {
    return { status: 'unlicensed' };
  }

  const now = Date.now();
  const nextCheckAt = new Date(cache.verified_at + constants.CACHE_TTL_MS);

  return {
    status: cache.status,
    tier: cache.tier,
    verifiedAt: new Date(cache.verified_at).toISOString(),
    nextCheckAt: nextCheckAt.toISOString(),
    masked_key: maskKey(cache.license_key),
    isStale: now > cache.verified_at + constants.CACHE_TTL_MS
  };
}

module.exports = {
  login,
  logout,
  checkAccess,
  whoami,
  setTestOverrides
};
