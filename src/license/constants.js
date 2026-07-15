'use strict';

const os = require('os');
const path = require('path');

const GUMROAD_PRODUCT_ID = 'lzozc';
const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
const GUMROAD_PURCHASE_URL = 'https://kyalovibes.gumroad.com/l/lzozc';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days grace if network fails

const CACHE_DIR = path.join(os.homedir(), '.scopelock'); // keeping .scopelock for backward compatibility or we can change to .driftlock
const CACHE_FILE = 'license.json'; // relative to CACHE_DIR

const TIER_HIERARCHY = {
  free: 0,
  pro: 1,
  team: 2
};

const COMMAND_TIERS = {
  // ── Free (no license required) ────────────────────────────────────────────
  lock:    'free',
  unlock:  'free',
  // Account management — always free
  login:   'free',
  logout:  'free',
  whoami:  'free',

  // ── Pro (requires Pro or Team license) ────────────────────────────────────
  init:    'pro',
  seal:    'pro',
  trust:   'pro',
  status:  'pro',
  save:    'pro',
  restore: 'pro',
  impact:  'pro',
  context: 'pro',
  guard:   'pro',
  scout:   'pro',
  audit:   'pro',
  godmode: 'pro',

  // ── Team (requires Team license) ──────────────────────────────────────────
  unseal:  'team',
};

module.exports = {
  GUMROAD_PRODUCT_ID,
  GUMROAD_VERIFY_URL,
  GUMROAD_PURCHASE_URL,
  CACHE_TTL_MS,
  GRACE_PERIOD_MS,
  CACHE_DIR,
  CACHE_FILE,
  TIER_HIERARCHY,
  COMMAND_TIERS
};
