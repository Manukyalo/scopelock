'use strict';

const fs = require('fs');
const path = require('path');
const gateway = require('../src/license/gateway');

// Test utilities
function assert(condition, message) {
  if (!condition) {
    console.error(`\n  FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓  ${message}`);
}

async function runTests() {
  console.log('\n--- License Gateway Tests ---');
  
  const testDir = path.join(__dirname, 'tmp_license');
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  
  // Set up dependency injection for tests
  let mockHttpClient;
  gateway.setTestOverrides({
    cacheDir: testDir,
    httpClient: (url, data) => mockHttpClient(url, data)
  });

  // Test 1: Valid Pro license
  mockHttpClient = async () => ({
    success: true,
    purchase: {
      variants: { Tier: 'Pro' }
    }
  });
  
  let loginResult = await gateway.login('VALID-KEY-1234-5678');
  assert(loginResult.ok === true, 'Login succeeds for valid key');
  assert(loginResult.tier === 'pro', 'Tier resolved to pro');
  assert(loginResult.masked_key === 'VALID-KEY-****-****', 'Key is masked properly');
  
  let access = await gateway.checkAccess('scout');
  assert(access.licensed === true, 'checkAccess returns licensed for pro command (scout)');

  // Test 2: Valid Team license
  mockHttpClient = async () => ({
    success: true,
    purchase: {
      variants: { Plan: 'Team Yearly' }
    }
  });
  loginResult = await gateway.login('TEAM-KEY-1234');
  assert(loginResult.tier === 'team', 'Tier resolved to team using substring match');
  
  // Test 3: Cached access within TTL
  mockHttpClient = async () => ({ success: false }); // Should not be called
  access = await gateway.checkAccess('scout');
  assert(access.licensed === true, 'Uses cache within TTL');

  // Test 4: Refunded license
  mockHttpClient = async () => ({
    success: true,
    purchase: { refunded: true, variants: { Tier: 'Pro' } }
  });
  loginResult = await gateway.login('REFUNDED-KEY');
  assert(loginResult.ok === false, 'Login fails for refunded key');
  assert(loginResult.reason.includes('refunded'), 'Reason indicates refund');

  // Test 5: Network failure during login
  mockHttpClient = async () => { throw new Error('Network down'); };
  loginResult = await gateway.login('KEY');
  assert(loginResult.ok === false, 'Login handles network failure');
  assert(loginResult.networkError === true, 'Flags network error');

  // Test 6: Network failure during re-verify (grace period fallback)
  // Manually manipulate cache to be past TTL
  const cachePath = path.join(testDir, 'license.json');
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  cache.verified_at = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago (past 7 day TTL)
  fs.writeFileSync(cachePath, JSON.stringify(cache));
  
  mockHttpClient = async () => { throw new Error('Network down'); };
  access = await gateway.checkAccess('scout');
  assert(access.licensed === true, 'Graceful degradation fallback works for network failure');

  // Test 7: Cache expired completely past grace period
  cache.verified_at = Date.now() - (12 * 24 * 60 * 60 * 1000); // 12 days ago (past 7+3 day grace period)
  fs.writeFileSync(cachePath, JSON.stringify(cache));
  access = await gateway.checkAccess('scout');
  assert(access.licensed === false, 'Access revoked after grace period expires');
  
  // Test 8: Tier hierarchy checking
  // Login as Pro
  mockHttpClient = async () => ({
    success: true,
    purchase: { variants: { Tier: 'Pro' } }
  });
  await gateway.login('PRO-KEY');
  
  access = await gateway.checkAccess('unseal');
  assert(access.licensed === false, 'Pro tier denied access to Team command');
  assert(access.reason.includes('requires team tier'), 'Clear tier requirement message');

  // Test 9: whoami output
  const status = gateway.whoami();
  assert(status.status === 'valid', 'whoami reports valid status');
  assert(status.tier === 'pro', 'whoami reports correct tier');
  assert(status.masked_key === '****-****-****-****', 'whoami masks short keys correctly');

  // Test 10: Logout clears cache
  gateway.logout();
  assert(!fs.existsSync(cachePath), 'logout deletes cache file');
  const loggedOutStatus = gateway.whoami();
  assert(loggedOutStatus.status === 'unlicensed', 'whoami shows unlicensed after logout');

  // Cleanup
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\n✅ License Gateway Tests passed.\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
