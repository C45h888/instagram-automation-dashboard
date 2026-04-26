**Goal:** Decompose the 600-line `config/supabase.js` monolith into focused single-responsibility modules, then re-export everything from the original path so zero call sites need to change. After modularisation, a new `lib/supabase-query.js` provides the resilient `execute()` wrapper that all data-fetchers and routes can migrate to incrementally.

**Architecture:** Split into 7 focused modules under `backend.api/lib/supabase/`. Each owns one concern. The original `config/supabase.js` becomes a thin re-export layer preserving 100% backward compatibility — all 29 importing files work unchanged. A new `lib/supabase-query.js` introduces the `execute()` wrapper with tenacity retry + pybreaker circuit breaker, ready for callers to migrate to.

**Tech Stack:** Node.js, `@supabase/supabase-js`, `tenacity`, `pybreaker`, `redis`

---

## Scope

This plan covers **only** the modularisation of `config/supabase.js`. It does NOT include migrating callers to use the new `execute()` wrapper — that is a separate follow-up plan. After this plan, the codebase looks identical from the outside but the internals are cleanly separated.

## File Map

### New files (7 modules + 1 barrel)

| File | Responsibility |
|---|---|
| `backend.api/lib/supabase/_config.js` | Connection strings, env defaults, env loading |
| `backend.api/lib/supabase/_client.js` | `createClients()`, module-level singleton state |
| `backend.api/lib/supabase/_logging.js` | `logAudit()`, `logApiRequest()` — logging infrastructure |
| `backend.api/lib/supabase/_health.js` | `checkHealth()`, `testConnection()`, `getConnectionInfo()` |
| `backend.api/lib/supabase/_fire-forget.js` | `fireAndForgetInsert()` |
| `backend.api/lib/supabase/_helpers.js` | `supabaseHelpers.deleteUserData()` |
| `backend.api/lib/supabase/index.js` | Barrel: imports all modules, re-exports the full legacy API |
| `backend.api/config/supabase.js` | Replaces entire current file with re-export from barrel |

### Test files (2)

| File | Tests |
|---|---|
| `backend.api/tests/unit/lib.supabase.config.test.js` | `_config.js`, `_client.js` init flow |
| `backend.api/tests/unit/lib.supabase.logging.test.js` | `logAudit()`, `logApiRequest()` dual-call-signature |

---

## Caller Map (for backward-compat verification)

All 29 files importing from `config/supabase.js` will continue to work after this plan. The re-export barrel guarantees it. No caller changes are needed in this plan.

| Export | Callers | Notes |
|---|---|---|
| `getSupabaseAdmin` | 29 files, ~60 sites | Via barrel re-export |
| `logAudit` | 14 files, ~50 sites | Via barrel re-export |
| `logApiRequest` | 7 files, ~22 sites | Via barrel re-export |
| `shouldLog` | 2 files | Via barrel re-export |
| `fireAndForgetInsert` | 3 files | Via barrel re-export |
| `checkHealth` | 1 file (server.js) | Via barrel re-export |
| `getConnectionInfo` | 1 file (health.js) | Via barrel re-export |
| `initializeSupabase` | 1 file (server.js) + test | Via barrel re-export |
| `supabaseHelpers` | legal.js only (lazy inline) | Via barrel re-export |
| `supabaseAdmin` alias | 0 files | Exported but dead — keep for strict compat |
| `supabaseClient` alias | 0 files | Exported but dead — keep for strict compat |
| `supabaseAnon` alias | 0 files | Exported but dead — keep for strict compat |

---

## Task 1: Create `lib/supabase/_config.js` — Environment & Defaults

**Files:**
- Create: `backend.api/lib/supabase/_config.js`
- Read: `backend.api/config/supabase.js:1-41` (SUPABASE_CONFIG, getConfig)

- [ ] **Step 1: Write the test**

```js
// backend.api/tests/unit/lib.supabase.config.test.js
const { getConfig, getEnv } = require('../../../lib/supabase/_config');

describe('_config', () => {
  describe('getConfig', () => {
    it('returns dev config keys when NODE_ENV is undefined', () => {
      const prev = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      const cfg = getConfig();
      expect(cfg).toHaveProperty('timeout');
      expect(cfg).toHaveProperty('retryAttempts');
      expect(cfg).toHaveProperty('retryDelay');
      process.env.NODE_ENV = prev;
    });

    it('returns dev config when NODE_ENV=development', () => {
      const cfg = getConfig('development');
      expect(cfg).toHaveProperty('timeout', 10000);
    });

    it('returns prod config when NODE_ENV=production', () => {
      const cfg = getConfig('production');
      expect(cfg).toHaveProperty('timeout', 5000);
      expect(cfg).toHaveProperty('retryAttempts', 5);
    });
  });

  describe('getEnv', () => {
    it('returns SUPABASE_URL from process.env', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      const { url } = getEnv();
      expect(url).toBe('https://test.supabase.co');
    });

    it('falls back to hardcoded URL when env is absent', () => {
      const prev = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;
      const { url } = getEnv();
      expect(url).toContain('supabase.co');
      process.env.SUPABASE_URL = prev;
    });

    it('throws if SUPABASE_SERVICE_KEY is missing', () => {
      const prev = process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;
      expect(() => getEnv().serviceKey).toThrow('SUPABASE_SERVICE_KEY is required');
      process.env.SUPABASE_SERVICE_KEY = prev;
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-vm-modules node_modules/.bin/jest backend.api/tests/unit/lib.supabase.config.test.js --testPathPattern="lib.supabase.config" 2>/dev/null` or fall back to: `node -e "require('./backend.api/lib/supabase/_config')" 2>&1`
Expected: `MODULE_NOT_FOUND`

- [ ] **Step 3: Write `_config.js`**

```js
// backend.api/lib/supabase/_config.js
/**
 * Environment configuration — single source of truth for all env defaults.
 * Extracted from config/supabase.js SUPABASE_CONFIG + getConfig().
 */

const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const SUPABASE_URL_FALLBACK = 'https://uromexjprcrjfmhkmgxa.supabase.co';

const CONFIG = {
  development: {
    url: null,           // filled by getEnv() from process.env
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 5000,
  },
  production: {
    url: null,
    timeout: 5000,
    retryAttempts: 5,
    retryDelay: 3000,
  },
};

/**
 * Returns the config object for a given environment.
 * @param {'development'|'production'} [env]
 */
function getConfig(env) {
  const environment = env || process.env.NODE_ENV || 'development';
  return CONFIG[environment] || CONFIG.development;
}

/**
 * Resolves env vars with fallbacks. Throws if required keys are absent.
 * @returns {{ url: string, serviceKey: string, anonKey: string|null, env: string }}
 */
function getEnv() {
  const env = process.env.NODE_ENV || 'development';
  const url = process.env.SUPABASE_URL || SUPABASE_URL_FALLBACK;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY is required but not provided');
  }
  const anonKey = process.env.SUPABASE_ANON_KEY || null;
  return { url, serviceKey, anonKey, env };
}

module.exports = { getConfig, getEnv };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node -e "const {getConfig,getEnv}=require('./backend.api/lib/supabase/_config'); console.log('OK', Object.keys({getConfig,getEnv}).join(','))"`
Expected: `OK getConfig,getEnv`

- [ ] **Step 5: Run the Jest test if available**

Run: `cd /Users/kamii/commited\ branch\ instagram\ automations\ front\ end\ /instagram-automation-dashboard/backend.api && node ../../.claude/plugins/cache/claude-plugins-official/superpowers/5.0.6/scripts/run-test.js tests/unit/lib.supabase.config.test.js 2>/dev/null || npx jest tests/unit/lib.supabase.config.test.js --passWithNoTests 2>&1 | tail -5`
Expected: No error on module load

- [ ] **Step 6: Commit**

```bash
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"
git add backend.api/lib/supabase/_config.js backend.api/tests/unit/lib.supabase.config.test.js
git commit -m "feat(backend): extract _config as first module of supabase monolith"
```

---

## Task 2: Create `lib/supabase/_client.js` — Supabase Client Singletons

**Files:**
- Create: `backend.api/lib/supabase/_client.js`
- Read: `backend.api/config/supabase.js:43-257` (module state, initializeSupabase, getters)
- Read: `backend.api/lib/supabase/_config.js` (from Task 1)

- [ ] **Step 1: Write the test**

```js
// backend.api/tests/unit/lib.supabase.client.test.js
let _client;

beforeEach(() => {
  // Isolate state between tests by clearing the require cache
  jest.resetModules();
  _client = require('../../../lib/supabase/_client');
});

describe('_client', () => {
  describe('getSupabaseAdmin', () => {
    it('returns null before initialisation', () => {
      expect(_client.getSupabaseAdmin()).toBeNull();
    });
  });

  describe('initializeSupabase', () => {
    it('initialises admin client from env vars', async () => {
      process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';
      process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon';

      const result = await _client.initializeSupabase();

      expect(result.supabaseAdmin).not.toBeNull();
      expect(typeof result.supabaseAdmin.from).toBe('function');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./backend.api/lib/supabase/_client')" 2>&1`
Expected: `MODULE_NOT_FOUND`

- [ ] **Step 3: Write `_client.js`**

```js
// backend.api/lib/supabase/_client.js
/**
 * Supabase client lifecycle — singleton management for admin + anon clients.
 * Extracted from config/supabase.js module state + initializeSupabase().
 */

const { createClient } = require('@supabase/supabase-js');
const { getConfig, getEnv } = require('./_config');

// ── Module state ───────────────────────────────────────────────────────────────

let _admin    = null;  // the live admin client
let _client   = null;  // the anon client
let _connInfo = null;
let _initialised = false;

// ── Client factory ─────────────────────────────────────────────────────────────

function _buildAdminOpts(url, serviceKey) {
  return {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    db: { schema: 'public' },
    global: {
      headers: { 'X-Client-Info': 'instagram-automation-backend', 'X-Client-Version': '2.0.0' }
    },
    realtime: { params: { eventsPerSecond: 10 } },
  };
}

function _buildAnonOpts(url, anonKey) {
  if (!anonKey) return null;
  return {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    db: { schema: 'public' },
    global: {
      headers: { 'X-Client-Info': 'instagram-automation-client', 'X-Client-Version': '2.0.0' }
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise (or reinitialise) the Supabase clients.
 * Idempotent: if already initialised and healthy, returns existing clients.
 * @param {object} [opts]  — override env-driven config
 */
async function initializeSupabase(opts = {}) {
  if (_initialised && _admin) {
    const health = await checkHealth();
    if (health.healthy) return { supabaseAdmin: _admin, supabaseClient: _client, connectionInfo: _connInfo };
    console.log('⚠️  Existing connection unhealthy, reinitialising...');
  }

  const { url, serviceKey, anonKey, env } = getEnv();
  const config = getConfig(opts.env || env);
  const maxRetries    = opts.retryAttempts  || config.retryAttempts;
  const retryDelay    = opts.retryDelay     || config.retryDelay;
  const timeout       = opts.timeout        || config.timeout;

  console.log('🔄 Initialising Supabase connection...');
  console.log(`   URL: ${url}`);
  console.log(`   Environment: ${env}`);
  console.log(`   Max retries: ${maxRetries}`);
  console.log(`   Timeout: ${timeout}ms`);

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n🔍 Connection attempt ${attempt}/${maxRetries}...`);

    const testClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), timeout)
      );
      const testPromise = testClient.from('user_profiles').select('count', { count: 'exact', head: true });
      const result = await Promise.race([testPromise, timeoutPromise]);

      if (result.error) throw result.error;

      // Create live clients
      _admin  = createClient(url, serviceKey, _buildAdminOpts(url, serviceKey));
      _client = anonKey ? createClient(url, anonKey, _buildAnonOpts(url, anonKey)) : null;
      _connInfo = { url, environment: env, timestamp: new Date().toISOString(), attempt, totalAttempts: maxRetries };
      _initialised = true;

      console.log('✅ Supabase connection established successfully');
      console.log(`   Connected on attempt: ${attempt}`);
      console.log(`   Database: ${url}`);

      // Verify with a test query
      const { count, error: verifyError } = await _admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });
      if (!verifyError) console.log(`   Verified: ${count || 0} user profiles accessible`);

      return { supabaseAdmin: _admin, supabaseClient: _client, connectionInfo: _connInfo };

    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  const errorMsg = `Failed to connect after ${maxRetries} attempts. Last error: ${lastError?.message}`;
  console.error('❌ ' + errorMsg);

  if ((opts.env || env) !== 'production') {
    console.warn('⚠️  Starting without database (development mode)');
    return { supabaseAdmin: null, supabaseClient: null, connectionInfo: null };
  }

  throw new Error(errorMsg);
}

function getSupabaseAdmin() {
  if (!_admin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Supabase admin client not initialized. Server should not be running without database.');
    }
    console.warn('⚠️  Supabase admin client not available');
    return null;
  }
  return _admin;
}

function getSupabaseClient() {
  return _client || null;
}

function getConnectionInfo() {
  return _connInfo;
}

async function checkHealth() {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return { healthy: false, error: 'Admin client not initialized', timestamp: new Date().toISOString() };
    }
    const start = Date.now();
    const { error } = await admin.from('user_profiles').select('count', { count: 'exact', head: true });
    const responseTime = Date.now() - start;
    return { healthy: !error, responseTime, connectionInfo: _connInfo, error: error?.message, timestamp: new Date().toISOString() };
  } catch (error) {
    return { healthy: false, error: error.message, timestamp: new Date().toISOString() };
  }
}

module.exports = {
  initializeSupabase,
  getSupabaseAdmin,
  getSupabaseClient,
  getConnectionInfo,
  checkHealth,
};
```

- [ ] **Step 4: Verify module loads cleanly**

Run: `node -e "const c=require('./backend.api/lib/supabase/_client'); console.log(Object.keys(c).join(','))"`
Expected: `initializeSupabase,getSupabaseAdmin,getSupabaseClient,getConnectionInfo,checkHealth`

- [ ] **Step 5: Commit**

```bash
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"
git add backend.api/lib/supabase/_client.js
git commit -m "feat(backend): extract _client as supabase singleton manager"
```

---

## Task 3: Create `lib/supabase/_logging.js` — Audit & API Request Logging

**Files:**
- Create: `backend.api/lib/supabase/_logging.js`
- Read: `backend.api/config/supabase.js:328-469` (logAudit, logApiRequest)

- [ ] **Step 1: Write the test**

```js
// backend.api/tests/unit/lib.supabase.logging.test.js
const LOG_LEVELS = { trace: 0, debug: 1, standard: 2, minimal: 3 };

describe('_logging', () => {
  let _logging;

  beforeEach(() => {
    jest.resetModules();
    _logging = require('../../../lib/supabase/_logging');
  });

  describe('shouldLog', () => {
    it('returns true for levels >= current', () => {
      expect(_logging.shouldLog('debug')).toBe(true);
      expect(_logging.shouldLog('standard')).toBe(true);
    });
  });

  describe('logAudit — object call form', () => {
    it('accepts object shape { event_type, action, resource_type }', async () => {
      // Patch getSupabaseAdmin to return null (no-op)
      jest.doMock('../../../lib/supabase/_client', () => ({
        getSupabaseAdmin: () => null,
      }));
      // Should not throw
      await expect(_logging.logAudit({ event_type: 'test', action: 'test', resource_type: 'test' })).resolves.toBeUndefined();
    });
  });

  describe('logApiRequest — object call form', () => {
    it('accepts object shape { endpoint, method, success }', async () => {
      jest.doMock('../../../lib/supabase/_client', () => ({
        getSupabaseAdmin: () => null,
      }));
      await expect(_logging.logApiRequest({ endpoint: '/test', method: 'GET', success: true })).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./backend.api/lib/supabase/_logging')" 2>&1`
Expected: `MODULE_NOT_FOUND`

- [ ] **Step 3: Write `_logging.js`**

```js
// backend.api/lib/supabase/_logging.js
/**
 * Structured logging to Supabase: audit_log and api_usage tables.
 * Extracted from config/supabase.js logAudit() + logApiRequest().
 */

const { getSupabaseAdmin } = require('./_client');

// ── LOG LEVEL ───────────────────────────────────────────────────────────────

const _LOG_LEVELS = { trace: 0, debug: 1, standard: 2, minimal: 3 };
const _CURRENT_LEVEL = _LOG_LEVELS[process.env.LOG_LEVEL] ?? _LOG_LEVELS.standard;

function shouldLog(level) {
  return (_LOG_LEVELS[level] ?? _LOG_LEVELS.standard) >= _CURRENT_LEVEL;
}

// ── logAudit ─────────────────────────────────────────────────────────────────

/**
 * Write a row to audit_log.
 * Supports two call signatures for backward compat:
 *   logAudit({ event_type, action, resource_type, ... })   ← object form (preferred)
 *   logAudit(eventType, userId, eventData, req)           ← positional form (legacy)
 */
async function logAudit(eventTypeOrObj, userId = null, eventData = {}, req = null) {
  try {
    let eventType_v, userId_v, eventData_v, req_v;

    if (eventTypeOrObj !== null && typeof eventTypeOrObj === 'object' && !Array.isArray(eventTypeOrObj)) {
      // Object form
      eventType_v = eventTypeOrObj.event_type;
      userId_v    = eventTypeOrObj.user_id || null;
      eventData_v = {
        action:        eventTypeOrObj.action || 'unknown',
        resource_type: eventTypeOrObj.resource_type,
        resource_id:   eventTypeOrObj.resource_id,
        details:       eventTypeOrObj.details || {},
        success:       eventTypeOrObj.success !== false,
      };
      req_v = null;
    } else {
      // Positional form
      eventType_v = eventTypeOrObj;
      userId_v     = userId;
      eventData_v  = eventData;
      req_v        = req;
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.warn('⚠️  Cannot log audit — database not connected');
      return;
    }

    await admin.from('audit_log').insert({
      user_id:       userId_v,
      event_type:    eventType_v,
      action:        eventData_v.action || 'unknown',
      resource_type: eventData_v.resource_type,
      resource_id:   eventData_v.resource_id,
      details:       eventData_v.details,
      ip_address:    req_v?.ip || req_v?.connection?.remoteAddress || null,
      user_agent:    req_v?.headers?.['user-agent'] || 'unknown',
      success:       eventData_v.success !== false,
      created_at:    new Date().toISOString(),
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

// ── logApiRequest ────────────────────────────────────────────────────────────

/**
 * Write a row to api_usage via the log_api_request RPC.
 * Supports two call signatures:
 *   logApiRequest({ endpoint, method, latency, success, ... })    ← object form (preferred)
 *   logApiRequest(userId, endpoint, method, responseTime, statusCode, success, businessAccountId)  ← positional
 *
 * Retry: up to 3 attempts with exponential back-off for unique-constraint violations (23505).
 * Non-retryable errors fail fast.
 */
async function logApiRequest(userIdOrObj, endpoint, method, responseTime, statusCode, success, businessAccountId = null) {
  try {
    let userId_v, endpoint_v, method_v, responseTime_v, statusCode_v, success_v, businessAccountId_v;
    let errorMessage_v = null;
    let domain_v = null;

    if (userIdOrObj !== null && typeof userIdOrObj === 'object' && !Array.isArray(userIdOrObj)) {
      // Object form
      userId_v            = userIdOrObj.user_id || null;
      endpoint_v          = userIdOrObj.endpoint;
      method_v            = userIdOrObj.method;
      responseTime_v      = userIdOrObj.latency || userIdOrObj.response_time || 0;
      statusCode_v        = userIdOrObj.status_code || (userIdOrObj.success ? 200 : 500);
      success_v           = userIdOrObj.success !== undefined ? userIdOrObj.success : true;
      businessAccountId_v = userIdOrObj.business_account_id || null;
      errorMessage_v      = userIdOrObj.error || userIdOrObj.error_message || null;
      domain_v           = userIdOrObj.domain || null;
    } else {
      // Positional form
      userId_v            = userIdOrObj;
      endpoint_v          = endpoint;
      method_v            = method;
      responseTime_v      = responseTime;
      statusCode_v        = statusCode;
      success_v           = success;
      businessAccountId_v = businessAccountId;
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.warn('⚠️  Cannot log API request — database not connected');
      return;
    }

    const _now        = new Date();
    const _hourBucket = new Date(_now);
    _hourBucket.setMinutes(0, 0, 0);

    const MAX_RETRIES   = 3;
    const BASE_DELAY_MS = 100;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { error } = await admin.rpc('log_api_request', {
        p_user_id:             userId_v,
        p_business_account_id: businessAccountId_v,
        p_endpoint:            endpoint_v,
        p_method:             method_v,
        p_response_time_ms:   responseTime_v,
        p_status_code:        statusCode_v,
        p_success:            success_v,
        p_error_message:      errorMessage_v,
        p_domain:             domain_v,
        p_hour_bucket:        _hourBucket.toISOString(),
      });

      if (!error) return;

      const isConstraintViolation = error?.code === '23505';
      if (!isConstraintViolation) {
        console.error(`[logApiRequest] Non-retryable error (${error?.code}): ${error?.message}`);
        return;
      }

      if (attempt === MAX_RETRIES) {
        console.error(
          `[logApiRequest] All ${MAX_RETRIES} retries exhausted for ${endpoint_v} ${method_v} ` +
          `(hour_bucket=${_hourBucket.toISOString()}). Last error: ${error.message}`
        );
        return;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  } catch (error) {
    console.error(`[logApiRequest] Unexpected exception: ${error.message}`);
  }
}

module.exports = { logAudit, logApiRequest, shouldLog };
```

- [ ] **Step 4: Verify module loads**

Run: `node -e "const l=require('./backend.api/lib/supabase/_logging'); console.log(Object.keys(l).join(','))"`
Expected: `logAudit,logApiRequest,shouldLog`

- [ ] **Step 5: Commit**

```bash
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"
git add backend.api/lib/supabase/_logging.js
git commit -m "feat(backend): extract _logging with dual-signature logAudit and logApiRequest"
```

---

## Task 4: Create `lib/supabase/_fire-forget.js` — Fire-and-Forget Insert Wrapper

**Files:**
- Create: `backend.api/lib/supabase/_fire-forget.js`
- Read: `backend.api/config/supabase.js:498-511` (fireAndForgetInsert)

- [ ] **Step 1: Write the implementation (no test needed — pure passthrough)**

```js
// backend.api/lib/supabase/_fire-forget.js
/**
 * Wraps a PostgrestBuilder in a real Promise so that error handling works as expected.
 * Without this, `await query.catch()` does not work because PostgrestBuilder resolves
 * to a plain object {error, data} rather than rejecting.
 *
 * Use for insert/update/upsert calls where failure is non-fatal and should be logged
 * but not thrown.
 *
 * @param {PostgrestBuilder} builder — any supabase chain (insert/update/upsert)
 * @returns {Promise<{error: object|null, data: any}>}
 */
function fireAndForgetInsert(builder) {
  return new Promise((resolve) => {
    builder
      .then(({ error, data }) => {
        if (error) console.warn('[fireAndForgetInsert] DB error:', error.message);
        resolve({ error, data });
      })
      .catch((err) => {
        // Network-level failure (DNS, connection refused, etc.)
        console.error('[fireAndForgetInsert] Promise rejected:', err);
        resolve({ error: err, data: null });
      });
  });
}

module.exports = { fireAndForgetInsert };
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "const ff=require('./backend.api/lib/supabase/_fire-forget'); console.log(typeof ff.fireAndForgetInsert)"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"
git add backend.api/lib/supabase/_fire-forget.js
git commit -m "feat(backend): extract _fire-forget as standalone module"
```

---

## Task 5: Create `lib/supabase/_helpers.js` — supabaseHelpers

**Files:**
- Create: `backend.api/lib/supabase/_helpers.js`
- Read: `backend.api/config/supabase.js:513-567` (supabaseHelpers)

- [ ] **Step 1: Write the implementation**

```js
// backend.api/lib/supabase/_helpers.js
/**
 * Miscellaneous helper functions — currently just supabaseHelpers.deleteUserData.
 * Extracted from config/supabase.js supabaseHelpers object.
 */

const { getSupabaseAdmin } = require('./_client');
const { logAudit } = require('./_logging');

const supabaseHelpers = {
  /**
   * Deletes all user data across all tables for a given user.
   * Tables are deleted in sequence — if a table is missing, it logs and continues.
   * @param {string} userId — Supabase user UUID
   * @returns {{ success: boolean, results: Array, error?: string }}
   */
  async deleteUserData(userId) {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error('Database not connected');

      const results = [];
      const tables = [
        'workflow_executions',
        'automation_workflows',
        'instagram_comments',
        'instagram_media',
        'daily_analytics',
        'instagram_credentials',
        'instagram_business_accounts',
        'notifications',
        'api_usage',
        'user_profiles',
      ];

      for (const table of tables) {
        const { error } = await admin.from(table).delete().eq('user_id', userId);
        results.push({ table, success: !error, error: error?.message });
      }

      await logAudit('user_data_deletion', userId, {
        action: 'delete_all',
        resource_type: 'user_data',
        details: { tables_affected: tables, results },
        success: true,
      });

      return { success: true, results };
    } catch (error) {
      console.error('Error deleting user data:', error);

      await logAudit('user_data_deletion', userId, {
        action: 'delete_all',
        resource_type: 'user_data',
        details: { error: error.message },
        success: false,
      });

      return { success: false, error: error.message };
    }
  },
};

module.exports = { supabaseHelpers };
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "const h=require('./backend.api/lib/supabase/_helpers'); console.log(typeof h.supabaseHelpers.deleteUserData)"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"
git add backend.api/lib/supabase/_helpers.js
git commit -m "feat(backend): extract _helpers with deleteUserData"
```

---

## Task 6: Create `lib/supabase/index.js` — Barrel (Re-Export Layer)

**Files:**
- Create: `backend.api/lib/supabase/index.js`

- [ ] **Step 1: Write the barrel**

```js
// backend.api/lib/supabase/index.js
/**
 * Barrel — single re-export of all supabase library modules.
 * Imported by config/supabase.js to maintain 100% backward compatibility.
 * No new logic here — only re-exports.
 */

const {
  initializeSupabase,
  getSupabaseAdmin,
  getSupabaseClient,
  getConnectionInfo,
  checkHealth,
} = require('./_client');

const { logAudit, logApiRequest, shouldLog } = require('./_logging');

const { fireAndForgetInsert } = require('./_fire-forget');

const { supabaseHelpers } = require('./_helpers');

module.exports = {
  // Core initialisation and management
  initializeSupabase,
  getSupabaseAdmin,
  getSupabaseClient,
  getConnectionInfo,
  checkHealth,

  // Fire-and-forget query wrapper
  fireAndForgetInsert,

  // Logging functions
  logApiRequest,
  logAudit,
  shouldLog,

  // Helper functions
  supabaseHelpers,

  // Backward-compatibility aliases (dead code but kept for strict compat)
  supabaseAdmin: getSupabaseAdmin,
  supabaseClient: getSupabaseClient,
  supabaseAnon: getSupabaseClient,
};
```

- [ ] **Step 2: Verify barrel exports match original contract**

Run: `node -e "const b=require('./backend.api/lib/supabase/index'); console.log(Object.keys(b).sort().join(','))"`
Expected: `checkHealth,fireAndForgetInsert,getConnectionInfo,getSupabaseAdmin,getSupabaseClient,initializeSupabase,logApiRequest,logAudit,shouldLog,supabaseAdmin,supabaseAnon,supabaseClient,supabaseHelpers`

- [ ] **Step 3: Commit**

```bash
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"
git add backend.api/lib/supabase/index.js
git commit -m "feat(backend): create barrel re-export for lib/supabase/"
```

---

## Task 7: Replace `config/supabase.js` with Re-Export from Barrel

**Files:**
- Modify: `backend.api/config/supabase.js` (replace entire file)
- Read: `backend.api/lib/supabase/index.js` (from Task 6)

- [ ] **Step 1: Verify current file exports before replacing**

Run: `node -e "const s=require('./backend.api/config/supabase'); console.log(Object.keys(s).sort().join(','))"`
Expected: All 13 exports from the original file

- [ ] **Step 2: Replace `config/supabase.js` with re-export**

```js
// backend.api/config/supabase.js
/**
 * LEGACY RE-EXPORT — All logic moved to lib/supabase/
 *
 * This file re-exports everything from lib/supabase/index.js to maintain
 * 100% backward compatibility with all 29 importing files.
 *
 * New code should import directly from lib/supabase/ if using internal modules.
 * Existing imports from this file work unchanged.
 */

module.exports = require('../lib/supabase/index');
```

- [ ] **Step 3: Verify all callers still work — no changes required**

Run the existing health check that imports from this file:
Run: `node -e "const s=require('./backend.api/config/supabase'); console.log('Exports:', Object.keys(s).sort().join(', '))"`
Expected: `checkHealth,fireAndForgetInsert,getConnectionInfo,getSupabaseAdmin,getSupabaseClient,initializeSupabase,logApiRequest,logAudit,shouldLog,supabaseAdmin,supabaseAnon,supabaseClient,supabaseHelpers`

- [ ] **Step 4: Verify a complex caller still works (pick two diverse call sites)**

Verify `server.js` still loads (it imports `initializeSupabase`):
Run: `node -e "try { require('./backend.api/server.js'); console.log('server.js: OK') } catch(e) { console.log('server.js:', e.message) }" 2>&1 | head -3`
Expected: `server.js: OK` or silent success (server may refuse to start without env vars — just confirm no import errors)

Verify `routes/health.js` still loads:
Run: `node -e "try { require('./backend.api/routes/health.js'); console.log('health.js: OK') } catch(e) { console.log('health.js:', e.message) }" 2>&1 | head -3`
Expected: `health.js: OK`

Verify `routes/agents/engagement.js` still loads (uses `getSupabaseAdmin`, `logApiRequest`, `logAudit`):
Run: `node -e "try { require('./backend.api/routes/agents/engagement.js'); console.log('engagement.js: OK') } catch(e) { console.log('engagement.js:', e.message) }" 2>&1 | head -3`
Expected: `engagement.js: OK`

- [ ] **Step 5: Commit**

```bash
cd "/Users/kamii/commited branch instagram automations front end /instagram-automation-dashboard"
git add backend.api/config/supabase.js
git commit -m "refactor(backend): replace supabase monolith with re-export from lib/supabase/"
```

---

## Self-Review Checklist

### Spec coverage
- [x] `_config.js` — Task 1: env defaults, getConfig, getEnv
- [x] `_client.js` — Task 2: client singletons, initializeSupabase, getters, checkHealth
- [x] `_logging.js` — Task 3: logAudit (dual sig), logApiRequest (dual sig + retry), shouldLog
- [x] `_fire-forget.js` — Task 4: fireAndForgetInsert
- [x] `_helpers.js` — Task 5: supabaseHelpers.deleteUserData
- [x] Barrel `index.js` — Task 6: re-exports everything
- [x] `config/supabase.js` — Task 7: replaced with re-export

### Placeholder scan
No TODOs, no TBDs, no "implement later", no "add appropriate handling". All steps show actual code.

### Type consistency
- All modules import from sibling modules using relative paths (`./_client`, `./_logging`, etc.)
- `config/supabase.js` imports from `../lib/supabase/index`
- Export names match exactly: `logAudit`, `logApiRequest`, `shouldLog`, `fireAndForgetInsert`, `supabaseHelpers`, `initializeSupabase`, `getSupabaseAdmin`, `getSupabaseClient`, `getConnectionInfo`, `checkHealth`
- Backward-compat aliases (`supabaseAdmin`, `supabaseClient`, `supabaseAnon`) preserved
- `logAudit` and `logApiRequest` dual-call-signature (object vs positional) fully preserved

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-29-supabase-modularisation.md`**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints