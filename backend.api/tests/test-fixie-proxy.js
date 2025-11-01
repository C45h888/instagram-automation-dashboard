// backend.api/tests/test-fixie-proxy.js
/**
 * Comprehensive Fixie Proxy Integration Tests
 *
 * Tests all aspects of proxy functionality:
 * - Configuration validation
 * - Agent initialization
 * - Static IP detection
 * - Database connectivity
 * - HTTP request routing
 * - Performance metrics
 *
 * Run with: npm run proxy:test
 */

const {
  initializeFixieProxy,
  createProxiedHttpClient,
  validateProxyConnection,
  getProxyHealth,
  getProxyMetrics,
  resetMetrics
} = require('../config/fixie-proxy');

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper function for test logging
function logTest(name, passed, details = {}) {
  results.total++;

  if (passed) {
    results.passed++;
    console.log(`  ${colors.green}✅ ${name}${colors.reset}`);
  } else {
    results.failed++;
    console.log(`  ${colors.red}❌ ${name}${colors.reset}`);
  }

  // Log details if present
  if (Object.keys(details).length > 0) {
    const detailsStr = JSON.stringify(details, null, 2)
      .split('\n')
      .map(line => `     ${line}`)
      .join('\n');
    console.log(`${colors.cyan}${detailsStr}${colors.reset}`);
  }

  results.tests.push({ name, passed, details, timestamp: new Date().toISOString() });
}

// Header function
function printHeader(title) {
  console.log('\n' + colors.bright + colors.blue + '─'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.blue + title + colors.reset);
  console.log(colors.bright + colors.blue + '─'.repeat(70) + colors.reset + '\n');
}

// Section header function
function printSection(title) {
  console.log('\n' + colors.bright + colors.cyan + title + colors.reset + '\n');
}

// Main test function
async function runTests() {
  console.clear();
  printHeader('🧪 FIXIE PROXY INTEGRATION TEST SUITE');

  console.log(`${colors.bright}Test Configuration:${colors.reset}`);
  console.log(`  Node Version: ${process.version}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Proxy Enabled: ${process.env.USE_FIXIE_PROXY === 'true' ? 'YES' : 'NO'}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);

  // Reset metrics before testing
  resetMetrics();

  // ================================================================
  // TEST SUITE 1: Configuration & Initialization
  // ================================================================
  printSection('📋 Test Suite 1: Configuration & Initialization');

  // Test 1.1: Environment variables present
  const hasFixieUrl = !!process.env.FIXIE_URL;
  const hasFixieSocks = !!process.env.FIXIE_SOCKS_HOST;
  const hasStaticIPs = !!process.env.FIXIE_STATIC_IPS;

  logTest(
    'Environment variables configured',
    hasFixieUrl && hasFixieSocks && hasStaticIPs,
    {
      FIXIE_URL: hasFixieUrl ? 'Configured' : 'Missing',
      FIXIE_SOCKS_HOST: hasFixieSocks ? 'Configured' : 'Missing',
      FIXIE_STATIC_IPS: hasStaticIPs ? 'Configured' : 'Missing',
      USE_FIXIE_PROXY: process.env.USE_FIXIE_PROXY || 'Not set'
    }
  );

  // Test 1.2: Environment variables format
  if (hasStaticIPs) {
    const ips = process.env.FIXIE_STATIC_IPS.split(',').map(ip => ip.trim()).filter(Boolean);
    logTest(
      'Static IPs correctly formatted',
      ips.length > 0 && ips.every(ip => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)),
      {
        count: ips.length,
        ips: ips,
        valid: ips.length > 0 ? 'Yes' : 'No'
      }
    );
  }

  // Test 1.3: Timeout configuration
  const timeout = parseInt(process.env.PROXY_TIMEOUT || '30000', 10);
  logTest(
    'Timeout configuration valid',
    timeout > 0 && timeout <= 60000,
    {
      timeout: timeout + 'ms',
      valid: (timeout > 0 && timeout <= 60000) ? 'Yes' : 'No',
      range: '1-60000ms'
    }
  );

  // Test 1.4: Retry attempts configuration
  const retries = parseInt(process.env.PROXY_RETRY_ATTEMPTS || '3', 10);
  logTest(
    'Retry attempts configuration valid',
    retries > 0 && retries <= 5,
    {
      retries: retries,
      valid: (retries > 0 && retries <= 5) ? 'Yes' : 'No',
      range: '1-5'
    }
  );

  // Test 1.5: Proxy initialization
  try {
    const initResult = initializeFixieProxy();
    logTest(
      'Proxy initialization successful',
      initResult.success !== false,
      {
        enabled: initResult.enabled,
        reason: initResult.reason || 'Initialization completed',
        httpAgent: initResult.httpAgent || false,
        socksAgent: initResult.socksAgent || false
      }
    );
  } catch (error) {
    logTest(
      'Proxy initialization',
      false,
      { error: error.message, stack: error.stack }
    );
  }

  // Test 1.6: Proxy health check
  try {
    const health = getProxyHealth();
    logTest(
      'Proxy health check returns valid data',
      health && typeof health === 'object' && 'enabled' in health,
      {
        enabled: health.enabled,
        initialized: health.initialized,
        httpAgent: health.httpAgent,
        socksAgent: health.socksAgent,
        metricsPresent: !!health.metrics
      }
    );
  } catch (error) {
    logTest(
      'Proxy health check',
      false,
      { error: error.message }
    );
  }

  // ================================================================
  // TEST SUITE 2: Static IP Validation
  // ================================================================
  printSection('🌐 Test Suite 2: Static IP Validation');

  if (process.env.USE_FIXIE_PROXY === 'true') {
    // Test 2.1: IP detection
    try {
      console.log('  ⏳ Validating static IP connection...');
      const validation = await validateProxyConnection();

      logTest(
        'Static IP detection successful',
        validation.ip !== undefined,
        {
          detectedIP: validation.ip || 'Not detected',
          enabled: validation.enabled,
          valid: validation.valid
        }
      );

      // Test 2.2: IP matching
      if (validation.ip) {
        logTest(
          'Detected IP matches expected static IPs',
          validation.valid === true,
          {
            detected: validation.ip,
            expected: validation.staticIPs,
            match: validation.valid ? 'YES' : 'NO',
            reason: validation.reason
          }
        );
      }
    } catch (error) {
      logTest(
        'Static IP validation',
        false,
        { error: error.message }
      );
    }
  } else {
    logTest(
      'Static IP validation (skipped - proxy disabled)',
      true,
      { message: 'Enable proxy with USE_FIXIE_PROXY=true to test' }
    );
  }

  // ================================================================
  // TEST SUITE 3: HTTP Client Functionality
  // ================================================================
  printSection('🌍 Test Suite 3: HTTP Client Functionality');

  // Test 3.1: Proxied axios creation
  try {
    const axios = createProxiedHttpClient();
    logTest(
      'Proxied HTTP client created',
      axios && typeof axios.get === 'function' && typeof axios.post === 'function',
      {
        hasGetMethod: typeof axios.get === 'function',
        hasPostMethod: typeof axios.post === 'function',
        hasPutMethod: typeof axios.put === 'function',
        hasDeleteMethod: typeof axios.delete === 'function'
      }
    );

    // Test 3.2: External API call
    console.log('  ⏳ Testing external API call...');
    const startTime = Date.now();
    const response = await axios.get('https://api.ipify.org?format=json', {
      timeout: 10000
    });
    const responseTime = Date.now() - startTime;

    logTest(
      'External API call through proxy',
      response.status === 200 && response.data && response.data.ip,
      {
        status: response.status,
        ip: response.data?.ip || 'Not detected',
        responseTime: responseTime + 'ms',
        proxyActive: process.env.USE_FIXIE_PROXY === 'true' ? 'Yes' : 'No'
      }
    );

    // Test 3.3: Response time acceptable
    logTest(
      'Response time acceptable (< 3000ms)',
      responseTime < 3000,
      {
        responseTime: responseTime + 'ms',
        threshold: '3000ms',
        acceptable: responseTime < 3000 ? 'Yes' : 'No'
      }
    );

  } catch (error) {
    logTest(
      'HTTP client functionality',
      false,
      {
        error: error.message,
        code: error.code,
        timeout: error.code === 'ETIMEDOUT' ? 'Connection timed out' : 'Other error'
      }
    );
  }

  // ================================================================
  // TEST SUITE 4: Database Connectivity
  // ================================================================
  printSection('🗄️  Test Suite 4: Database Connectivity');

  try {
    const { initializeSupabase, checkHealth } = require('../config/supabase');

    // Test 4.1: Supabase initialization with proxy
    console.log('  ⏳ Initializing Supabase connection...');
    await initializeSupabase({ retryAttempts: 2, retryDelay: 1000 });

    logTest(
      'Supabase initialization with proxy',
      true,
      { message: 'Initialization completed successfully' }
    );

    // Test 4.2: Database health check
    console.log('  ⏳ Checking database health...');
    const dbStartTime = Date.now();
    const dbHealth = await checkHealth();
    const dbResponseTime = Date.now() - dbStartTime;

    logTest(
      'Database health check',
      dbHealth.healthy === true,
      {
        status: dbHealth.healthy ? 'Healthy' : 'Unhealthy',
        url: dbHealth.url,
        responseTime: dbResponseTime + 'ms',
        lastCheck: dbHealth.lastCheck
      }
    );

    // Test 4.3: Database response time
    // More lenient threshold for baseline (without proxy): < 500ms
    // Strict threshold when proxy enabled: < 200ms
    const dbThreshold = process.env.USE_FIXIE_PROXY === 'true' ? 200 : 500;
    const thresholdLabel = process.env.USE_FIXIE_PROXY === 'true' ? '< 200ms (with proxy)' : '< 500ms (baseline)';

    logTest(
      `Database response time acceptable (${thresholdLabel})`,
      dbResponseTime < dbThreshold,
      {
        responseTime: dbResponseTime + 'ms',
        threshold: dbThreshold + 'ms',
        mode: process.env.USE_FIXIE_PROXY === 'true' ? 'Proxy enabled' : 'Baseline (no proxy)',
        acceptable: dbResponseTime < dbThreshold ? 'Yes' : 'No'
      }
    );

  } catch (error) {
    logTest(
      'Database connectivity',
      false,
      {
        error: error.message,
        module: 'supabase',
        action: 'Check if Supabase module exists and is properly configured'
      }
    );
  }

  // ================================================================
  // TEST SUITE 5: Performance & Metrics
  // ================================================================
  printSection('⚡ Test Suite 5: Performance & Metrics');

  // Test 5.1: Metrics collection
  try {
    const metrics = getProxyMetrics();
    logTest(
      'Metrics collection active',
      metrics && metrics.performance && typeof metrics.performance.totalRequests !== 'undefined',
      {
        totalRequests: metrics.performance?.totalRequests || 0,
        failedRequests: metrics.performance?.failedRequests || 0,
        successRate: metrics.performance?.successRate || 'N/A',
        avgResponseTime: metrics.performance?.averageResponseTime || 'N/A'
      }
    );

    // Test 5.2: Response time acceptable
    const avgTimeStr = metrics.performance?.averageResponseTime || '0ms';
    const avgTime = parseInt(avgTimeStr) || 0;

    if (metrics.performance?.totalRequests > 0) {
      logTest(
        'Average response time acceptable (< 5000ms)',
        avgTime < 5000,
        {
          avgResponseTime: avgTimeStr,
          threshold: '5000ms',
          acceptable: avgTime < 5000 ? 'Yes' : 'No',
          totalRequests: metrics.performance.totalRequests
        }
      );

      // Test 5.3: Success rate acceptable
      const successRateStr = metrics.performance?.successRate || '0%';
      const successRate = parseFloat(successRateStr) || 0;

      logTest(
        'Success rate acceptable (> 95%)',
        successRate > 95,
        {
          successRate: successRateStr,
          threshold: '95%',
          acceptable: successRate > 95 ? 'Yes' : 'No'
        }
      );
    } else {
      logTest(
        'Performance metrics (no requests made yet)',
        true,
        { message: 'No requests to measure - normal for fresh start' }
      );
    }

  } catch (error) {
    logTest(
      'Performance metrics',
      false,
      { error: error.message }
    );
  }

  // Test 5.4: Memory usage check
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

  logTest(
    'Memory usage acceptable (< 512MB)',
    heapUsedMB < 512,
    {
      heapUsed: heapUsedMB + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      threshold: '512MB'
    }
  );

  // ================================================================
  // FINAL RESULTS
  // ================================================================
  printHeader('📊 TEST RESULTS SUMMARY');

  const successRate = ((results.passed / results.total) * 100).toFixed(2);

  console.log(`${colors.bright}Total Tests:${colors.reset}    ${results.total}`);
  console.log(`${colors.green}${colors.bright}Passed:${colors.reset}         ${results.passed} ✅`);
  console.log(`${colors.red}${colors.bright}Failed:${colors.reset}         ${results.failed} ❌`);
  console.log(`${colors.bright}Success Rate:${colors.reset}   ${successRate}%`);

  if (results.failed > 0) {
    console.log('\n' + colors.red + colors.bright + '❌ SOME TESTS FAILED' + colors.reset);
    console.log('\n' + colors.bright + 'Failed Tests:' + colors.reset);
    results.tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`  ${colors.red}• ${t.name}${colors.reset}`);
        if (t.details && Object.keys(t.details).length > 0) {
          const detailsStr = JSON.stringify(t.details, null, 2)
            .split('\n')
            .map(line => `    ${line}`)
            .join('\n');
          console.log(colors.yellow + detailsStr + colors.reset);
        }
      });

    console.log('\n' + colors.yellow + '💡 Troubleshooting Tips:' + colors.reset);
    console.log('  1. Check environment variables in .env file');
    console.log('  2. Verify Fixie credentials are correct');
    console.log('  3. Ensure Supabase is accessible');
    console.log('  4. Review error details above');
    console.log('  5. Check logs in backend.api/logs/\n');

    process.exit(1);
  } else {
    console.log('\n' + colors.green + colors.bright + '🎉 ALL TESTS PASSED!' + colors.reset);
    console.log(colors.green + '✅ Ready for production deployment' + colors.reset + '\n');

    // Save test results
    const testReport = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      proxyEnabled: process.env.USE_FIXIE_PROXY === 'true',
      summary: {
        total: results.total,
        passed: results.passed,
        failed: results.failed,
        successRate: successRate + '%'
      },
      tests: results.tests
    };

    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(__dirname, '../logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(logsDir, 'proxy-test-results.json'),
      JSON.stringify(testReport, null, 2)
    );

    console.log(colors.cyan + '📄 Test report saved to: logs/proxy-test-results.json' + colors.reset + '\n');

    process.exit(0);
  }
}

// Run the test suite
if (require.main === module) {
  runTests().catch(error => {
    console.error(colors.red + colors.bright + '\n❌ TEST SUITE CRASHED' + colors.reset);
    console.error(colors.red + error.stack + colors.reset);
    process.exit(1);
  });
}

module.exports = { runTests };
