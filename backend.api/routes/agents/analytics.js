// backend.api/routes/agents/analytics.js
// Analytics/Insights endpoints: /insights, /account-insights, /media-insights

const express = require('express');
const router = express.Router();
const { handleInsightsRequest } = require('../../helpers/agent-helpers');

// ============================================
// ENDPOINT 5: GET /insights (Analytics Reports)
// ============================================

/**
 * Gets account or media insights for analytics reports.
 * Used by: Analytics reports scheduler (scheduler/analytics_reports.py)
 */
router.get('/insights', (req, res) => handleInsightsRequest(req, res, Date.now(), null));

// ============================================
// ENDPOINT 5A: GET /account-insights
// ============================================

/**
 * Account-level insights alias matching agent naming convention.
 * Agent calls: GET /account-insights?business_account_id=X&since=Y&until=Z
 * Used by: analytics_tools.py fetch_account_insights()
 */
router.get('/account-insights', (req, res) => handleInsightsRequest(req, res, Date.now(), 'account'));

// ============================================
// ENDPOINT 5B: GET /media-insights
// ============================================

/**
 * Media-level insights alias matching agent naming convention.
 * Agent calls: GET /media-insights?business_account_id=X&since=Y&until=Z
 * Used by: analytics_tools.py fetch_media_insights()
 */
router.get('/media-insights', (req, res) => handleInsightsRequest(req, res, Date.now(), 'media'));

module.exports = router;
