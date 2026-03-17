// backend.api/helpers/data-fetchers/base.js
// Shared wiring for all domain fetcher modules.
// Each domain file requires only this file instead of importing 5+ things individually.
//
// IMPORTANT: Do NOT add route logic here. This file is infrastructure only.

const axios = require('axios');
const { getSupabaseAdmin, logApiRequest } = require('../../config/supabase');
const {
  resolveAccountCredentials,
  categorizeIgError,
  ensureMediaRecord,
  syncHashtagsFromCaptions,
  GRAPH_API_BASE,
} = require('../agent-helpers');
const { mapRawPostToUgcContent } = require('../ugc-field-map');

// ============================================
// PER-DOMAIN LOGGER
// ============================================

/**
 * Tags an api_usage log row with a domain identifier.
 * Enables instant domain-scoped failure queries:
 *   SELECT * FROM api_usage WHERE domain = 'ugc' AND success = false ORDER BY created_at DESC
 *
 * @param {'messaging'|'ugc'|'media'|'account'} domain
 * @param {Object} payload  - Same shape as logApiRequest: { endpoint, method, business_account_id, ... }
 */
async function logWithDomain(domain, payload) {
  return logApiRequest({ ...payload, domain }).catch(() => {});
}

module.exports = {
  axios,
  getSupabaseAdmin,
  resolveAccountCredentials,
  categorizeIgError,
  ensureMediaRecord,
  syncHashtagsFromCaptions,
  mapRawPostToUgcContent,
  GRAPH_API_BASE,
  logWithDomain,
};
