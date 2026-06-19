'use strict';

/**
 * src/secrets.js
 *
 * Scans strings for high-risk secrets.
 * Returns an array of detected secret types.
 */

const SECRET_PATTERNS = {
  'AWS Access Key': /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
  'Stripe Secret Key': /sk_(?:live|test)_[0-9a-zA-Z]{24}/,
  'GitHub Token': /gh[pousr]_[A-Za-z0-9_]{36,}/,
  'Slack Token': /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/,
  'Generic API Key / Secret': /(?:api[_-]?key|secret|token|password)[\s]*[=:]\s*["'][a-zA-Z0-9_\-]{16,}["']/i
};

/**
 * @param {string} lineContent
 * @returns {string|null} The name of the secret type detected, or null.
 */
function detectSecret(lineContent) {
  for (const [name, regex] of Object.entries(SECRET_PATTERNS)) {
    if (regex.test(lineContent)) {
      return name;
    }
  }
  return null;
}

module.exports = { detectSecret };
