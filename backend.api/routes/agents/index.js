// backend.api/routes/agents/index.js
// Barrel — combines all domain sub-routers into one exportable router.
// Authentication is applied by the parent (routes/agent-proxy.js), not here.

const express = require('express');
const router = express.Router();

router.use(require('./ugc'));
router.use(require('./engagement'));
router.use(require('./publishing'));
router.use(require('./analytics'));
router.use(require('./oversight'));

module.exports = router;
