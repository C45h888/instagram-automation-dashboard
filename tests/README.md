# Instagram Automation Dashboard - E2E Tests

This directory contains end-to-end tests for the Instagram Automation Dashboard using Playwright.

## Directory Structure

```
tests/
├── e2e/                    # End-to-end test specs
│   ├── login.spec.ts       # Login page tests
│   └── dashboard.spec.ts   # Dashboard page tests
├── fixtures/               # Mock data and test fixtures
│   └── mock-data.ts        # Mock API responses and data
├── utils/                  # Test utilities and helpers
│   └── auth-helpers.ts     # Authentication helper functions
└── README.md              # This file
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- Playwright browsers installed (`npm run test` will auto-install on first run)

### Installation

Browsers are already installed. If you need to reinstall:

```bash
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests with UI mode (recommended for development)
```bash
npm run test:ui
```

### Run tests in headed mode (see the browser)
```bash
npm run test:headed
```

### Run specific test suites
```bash
npm run test:login        # Login page tests only
npm run test:dashboard    # Dashboard page tests only
```

### Run tests in specific browsers
```bash
npm run test:chromium     # Chrome/Edge only
npm run test:firefox      # Firefox only
npm run test:webkit       # Safari only
npm run test:mobile       # Mobile viewports only
```

### Debug mode (step through tests)
```bash
npm run test:debug
```

### Generate test code interactively
```bash
npm run test:codegen
```

## Test Reports

After running tests, view the HTML report:

```bash
npm run test:report
```

Reports are generated in `playwright-report/` directory.

## Writing Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### Using Auth Helpers

```typescript
import { setupAuthState, clearAuthState } from '../utils/auth-helpers';

test('authenticated test', async ({ page }) => {
  // Set up authentication
  await setupAuthState(page);
  await page.goto('/dashboard');

  // Your test assertions
});
```

### Using Mock Data

```typescript
import { mockInstagramProfile, mockAPIResponses } from '../fixtures/mock-data';

test('test with mock API', async ({ page }) => {
  // Intercept API calls
  await page.route('**/api/instagram/profile', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify(mockAPIResponses['/api/instagram/profile'])
    });
  });

  // Your test
});
```

## Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Mock external APIs** to avoid flaky tests
3. **Test user flows**, not implementation details
4. **Keep tests independent** - each test should set up its own state
5. **Use page objects** for complex pages (add to `utils/` directory)
6. **Run tests in CI/CD** before deploying

## Coverage Areas

### Login Page Tests
- ✅ UI rendering and branding
- ✅ Consent checkbox functionality
- ✅ Facebook OAuth flow
- ✅ Instagram OAuth flow
- ✅ Permission disclosure accordion
- ✅ Error handling and validation
- ✅ Accessibility (ARIA labels, keyboard navigation)
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Admin portal access

### Dashboard Page Tests
- ✅ Authentication and protected routes
- ✅ Dashboard header and metrics
- ✅ Real-time updates panel
- ✅ Quick actions functionality
- ✅ Instagram profile display
- ✅ Performance charts
- ✅ Activity feed
- ✅ Recent media grid
- ✅ Error handling
- ✅ Responsive design
- ✅ Performance benchmarks

## CI/CD Integration

Tests are configured to run in CI environments with:
- 2 retries on failure
- Single worker (no parallel execution)
- Screenshots and videos on failure
- JSON test results output

## Troubleshooting

### Tests failing locally?
1. Make sure dev server is running: `npm run dev`
2. Clear browser cache and storage
3. Check if ports 5173 and 3001 are available

### Browsers not installed?
```bash
npx playwright install --with-deps
```

### Need to update Playwright?
```bash
npm install -D @playwright/test@latest
npx playwright install
```

## MCP Server Configuration

The Playwright MCP server is configured in:
- `.mcp-config.json` - Project-level MCP configuration
- `.vscode/mcp-servers.json` - VS Code MCP integration

This allows AI assistants to help write and debug tests using the Playwright MCP server.

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright MCP Server](https://github.com/microsoft/playwright-mcp)
