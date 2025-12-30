# Authentication Mode Configuration Guide

**Version**: 1.0.0
**Last Updated**: 2025-01-22
**Status**: Production Ready
**Compliance**: Meta Platform Terms (February 2025)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Modes](#authentication-modes)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Strategies](#deployment-strategies)
5. [Meta App Review Preparation](#meta-app-review-preparation)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)
8. [Security Best Practices](#security-best-practices)

---

## Overview

The Instagram Automation Dashboard supports **three authentication modes** for maximum flexibility across development, staging, and production environments.

### Architecture
```
┌─────────────────────────────────────────┐
│   Environment Variable (VITE_AUTH_MODE) │
│                                         │
│    'facebook' | 'instagram' | 'both'   │
└─────────────┬───────────────────────────┘
              │
              ├──────────┬──────────┬─────────
              ▼          ▼          ▼
         Facebook    Instagram    Both
          Only         Only      Methods
```

### Key Features

- **Non-Destructive**: Both authentication flows preserved
- **Environment-Driven**: Behavior controlled via environment variable only
- **Zero Downtime Switching**: Change modes without code deployment
- **A/B Testing Ready**: Support user preference testing
- **Meta Compliant**: Facebook-only mode meets all Meta requirements

---

## Authentication Modes

### Mode 1: Facebook Login Only

**Configuration:**
```bash
VITE_AUTH_MODE=facebook
```

**Use Cases:**
- ✅ Meta app review submission
- ✅ Production deployment (after approval)
- ✅ Screencast recording for Meta
- ✅ Meta compliance demonstrations

**User Experience:**
```
┌─────────────────────────────────────┐
│  📹 FACEBOOK LOGIN BUTTON BELOW     │
├─────────────────────────────────────┤
│                                     │
│  [f] Continue with Facebook         │
│       (Official Facebook Blue)      │
│                                     │
├─────────────────────────────────────┤
│  ☝️ FACEBOOK LOGIN BUTTON ABOVE     │
├─────────────────────────────────────┤
│  ℹ️ Why Facebook Login?             │
│  Instagram Business accounts are    │
│  connected through Facebook...      │
└─────────────────────────────────────┘
```

**Characteristics:**
- Only Facebook button visible
- Yellow attention boxes for Meta reviewers
- Meta compliance notices
- User education included
- Instagram button hidden

---

### Mode 2: Instagram Login Only (Legacy)

**Configuration:**
```bash
VITE_AUTH_MODE=instagram
```

**Use Cases:**
- ✅ Existing user support
- ✅ Backward compatibility testing
- ✅ Pre-approval development
- ✅ Legacy system maintenance

**User Experience:**
```
┌─────────────────────────────────────┐
│                                     │
│  [📷] Continue with Instagram       │
│      (Pink/Orange Gradient)         │
│                                     │
└─────────────────────────────────────┘
```

**Characteristics:**
- Only Instagram button visible
- Original styling preserved
- No Meta compliance elements
- Facebook button hidden
- Existing flow unchanged

---

### Mode 3: Both Methods (Development)

**Configuration:**
```bash
VITE_AUTH_MODE=both
```

**Use Cases:**
- ✅ Local development
- ✅ A/B testing authentication methods
- ✅ User preference research
- ✅ Comprehensive testing

**User Experience:**
```
┌─────────────────────────────────────┐
│  📹 FACEBOOK LOGIN BUTTON BELOW     │
├─────────────────────────────────────┤
│                                     │
│  [f] Continue with Facebook         │
│                                     │
├─────────────────────────────────────┤
│  ☝️ FACEBOOK LOGIN BUTTON ABOVE     │
├─────────────────────────────────────┤
│              OR                     │
├─────────────────────────────────────┤
│  Legacy Authentication Method       │
│                                     │
│  [📷] Continue with Instagram       │
│                                     │
└─────────────────────────────────────┘
```

**Characteristics:**
- Both buttons visible
- Facebook button prioritized (top)
- Clear separation with "OR" divider
- Independent functionality
- Full testing coverage

---

## Environment Configuration

### Development Environment

**File:** `.env`
```bash
# Development Configuration
NODE_ENV=development
VITE_AUTH_MODE=both

# Meta App (Development/Test App)
VITE_META_APP_ID=123456789012345
VITE_META_APP_SECRET=dev_secret_placeholder

# Optional: Local callback override
# VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback
```

**Setup Steps:**
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Replace placeholder values with your Meta test app credentials
3. Set `VITE_AUTH_MODE=both` for full testing
4. Restart dev server:
   ```bash
   npm run dev
   ```
5. Navigate to `/login` to verify

---

### Staging Environment

**File:** `.env.staging` (or deployment platform env vars)
```bash
# Staging Configuration
NODE_ENV=staging
VITE_AUTH_MODE=both

# Meta App (Staging App or Test Mode)
VITE_META_APP_ID=123456789_staging
VITE_META_APP_SECRET=staging_secret

# Staging callback URL
VITE_OAUTH_REDIRECT_URI=https://staging.yourdomain.com/auth/callback
```

**Setup Steps:**
1. Create staging Meta app or use test mode
2. Configure callback URL in Meta Developer Console
3. Deploy with staging credentials
4. Test both authentication flows
5. Verify error handling and edge cases

---

### Production Environment

**File:** `.env.production` or deployment platform env vars
```bash
# Production Configuration
NODE_ENV=production
VITE_AUTH_MODE=facebook  # ⚠️ CRITICAL: Facebook only for Meta compliance

# Meta App (Production App - APPROVED)
VITE_META_APP_ID=YOUR_PRODUCTION_APP_ID
VITE_META_APP_SECRET=YOUR_PRODUCTION_SECRET

# Production callback URL
VITE_OAUTH_REDIRECT_URI=https://instagram-backend.888intelligenceautomation.in/auth/callback
```

**Setup Steps:**

1. **Before Deployment:**
   - Verify Meta app is approved for production
   - Set `VITE_AUTH_MODE=facebook`
   - Use production app credentials
   - Configure production callback URL in Meta Console

2. **Deployment:**
   ```bash
   # Build production bundle
   npm run build

   # Verify environment variables loaded
   npm run preview

   # Deploy to production hosting
   # (Render, Vercel, Netlify, etc.)
   ```

3. **Post-Deployment Verification:**
   - Test Facebook login end-to-end
   - Verify OAuth callback handling
   - Check all permissions requested correctly
   - Monitor authentication errors

---

## Deployment Strategies

### Strategy 1: Meta Review Deployment

**Timeline:** Before submitting to Meta for review

**Process Flow:**
```
Development → Set mode=facebook → Build → Deploy → Record Screencast → Submit to Meta
```

**Checklist:**
- [ ] Set `VITE_AUTH_MODE=facebook` in production
- [ ] Verify only Facebook button visible
- [ ] Test authentication flow completely
- [ ] Clear browser cache before recording
- [ ] Record screencast per Meta requirements
- [ ] Submit with use case documentation

---

### Strategy 2: Post-Approval Deployment

**Timeline:** After Meta approves your app

**Option A: Keep Facebook Only**
```bash
# Maintain Meta compliance
VITE_AUTH_MODE=facebook
```
**Benefits:** Simplest, full compliance, clear UX

**Option B: Enable Both Methods**
```bash
# Provide user choice
VITE_AUTH_MODE=both
```
**Benefits:** User flexibility, A/B testing, gradual migration

**Option C: Gradual Rollout**
```bash
# Week 1-2: Facebook only
VITE_AUTH_MODE=facebook

# Week 3-4: Both methods, monitor analytics
VITE_AUTH_MODE=both

# Week 5+: Decide based on user preference data
VITE_AUTH_MODE=facebook  # or 'both'
```

---

### Strategy 3: Feature Flag Integration (Advanced)

For per-user control:
```typescript
// src/pages/Login.tsx
const getUserAuthMode = () => {
  // Check user preference from database
  const userPreference = user?.settings?.preferredAuthMethod;

  // Check A/B test segment
  const abTestSegment = getABTestSegment(user?.id);

  // Check feature flag
  const featureFlag = getFeatureFlag('dual-auth-enabled');

  // Fallback to environment variable
  const envMode = import.meta.env.VITE_AUTH_MODE || 'both';

  return userPreference || abTestSegment ||
         (featureFlag ? 'both' : 'facebook') ||
         envMode;
};
```

---

## Meta App Review Preparation

### Pre-Submission Checklist

#### Environment Configuration
- [ ] `VITE_AUTH_MODE=facebook` set in production
- [ ] Production Meta App ID configured
- [ ] Production callback URL configured
- [ ] All environment variables validated

#### Meta Developer Console
- [ ] App submitted for review
- [ ] All required permissions requested:
  - `instagram_basic`
  - `instagram_manage_comments`
  - `instagram_manage_insights`
  - `instagram_manage_messages`
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_metadata`
- [ ] Privacy Policy URL added
- [ ] Terms of Service URL added
- [ ] Data Deletion callback URL configured
- [ ] Valid OAuth redirect URIs listed
- [ ] App icon uploaded (1024x1024px)
- [ ] App category selected

#### Application Testing
- [ ] Facebook login works end-to-end
- [ ] OAuth callback handling functional
- [ ] Permission dialogs display correctly
- [ ] Error handling tested
- [ ] Loading states working
- [ ] User education displays
- [ ] Meta compliance notices visible

#### Screencast Preparation
- [ ] Production environment deployed
- [ ] Clear browser cache and cookies
- [ ] Test login flow once before recording
- [ ] Screen recording software configured
- [ ] Audio narration prepared (if required)
- [ ] Recording length under 8 minutes
- [ ] Video quality HD (1080p minimum)

---

### Screencast Script Template

```
[0:00-0:30] Introduction
"Hello, I'm demonstrating the authentication flow for
[Your App Name]. This application uses Facebook Login to
securely connect Instagram Business accounts for automation."

[0:30-1:30] Facebook Login Demonstration
[Navigate to /login page]
"Here you can see the Facebook Login button using official
Facebook branding. Notice the clear user education explaining
why Facebook Login is required for Instagram Business accounts."

[Click Facebook Login button]
"When users click 'Continue with Facebook', they're redirected
to Facebook's OAuth authorization page..."

[Show permission dialog]
"Facebook requests the necessary Instagram Business permissions..."

[Complete OAuth flow]
"After authorization, users are redirected back with access
to their Instagram Business account."

[1:30-3:00] Permission Usage Demonstrations
[Show each permission in action]
- instagram_basic: Profile information display
- instagram_manage_comments: Comment management dashboard
- instagram_manage_insights: Analytics charts
- instagram_manage_messages: DM inbox with 24-hour window

[3:00-3:30] Data Deletion
[Navigate to data deletion page]
"Users can request complete data deletion at any time
through the privacy dashboard..."

[3:30-4:00] Conclusion
"This demonstrates full compliance with Meta's Platform Terms
including Facebook Login, proper permission usage, and
data deletion capabilities."
```

---

## Troubleshooting

### Issue 1: Facebook Button Not Appearing

**Symptoms:**
- Only Instagram button shows when `VITE_AUTH_MODE=facebook`
- Page renders but no Facebook button

**Diagnosis:**
```bash
# Check browser console
# Should see: "🔐 Authentication Mode: facebook"
# Should see: "  - Facebook Login: ✅"
```

**Solutions:**

1. **Verify environment variable:**
   ```bash
   # Check .env file
   cat .env | grep VITE_AUTH_MODE
   ```

2. **Restart dev server** (environment variables require restart):
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

3. **Clear browser cache:**
   - Chrome/Edge: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
   - Firefox: `Ctrl+F5`

4. **Check for typos:**
   ```bash
   # ✅ Correct
   VITE_AUTH_MODE=facebook

   # ❌ Incorrect (will default to 'both')
   VITE_AUTH_MODE=facbook  # typo
   AUTH_MODE=facebook  # missing VITE_ prefix
   ```

---

### Issue 2: OAuth Redirect Fails

**Symptoms:**
- Redirected to Facebook but error after authorization
- "redirect_uri_mismatch" error

**Diagnosis:**
- Redirect URI in code doesn't match Meta Developer Console

**Solutions:**

1. **Check Meta Developer Console:**
   - Navigate to: Settings → Basic → App Domains
   - Navigate to: Facebook Login → Settings → Valid OAuth Redirect URIs

2. **Verify environment variable:**
   ```bash
   # Should match Meta Console exactly
   VITE_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/callback
   ```

3. **Add all possible URIs to Meta Console:**
   ```
   https://yourdomain.com/auth/callback
   https://www.yourdomain.com/auth/callback
   http://localhost:5173/auth/callback  # for development
   ```

---

### Issue 3: "META_APP_ID not configured" Error

**Symptoms:**
- Click Facebook button shows error message
- Console: "META_APP_ID not configured"

**Diagnosis:**
- Environment variable not set or using placeholder value

**Solutions:**

1. **Set real App ID:**
   ```bash
   # Replace placeholder in .env
   VITE_META_APP_ID=123456789012345  # your actual ID
   ```

2. **Restart dev server:**
   ```bash
   npm run dev
   ```

3. **Verify variable loaded:**
   ```typescript
   console.log('App ID:', import.meta.env.VITE_META_APP_ID);
   ```

---

### Issue 4: Mode Changes Not Reflecting

**Symptoms:**
- Changed `VITE_AUTH_MODE` but UI unchanged

**Root Cause:**
- Vite environment variables loaded at build/startup time
- Browser cache may have old version

**Solutions:**

1. **Development:**
   ```bash
   # Stop dev server (Ctrl+C)
   npm run dev  # Restart
   ```

2. **Production:**
   ```bash
   npm run build  # Rebuild with new env vars
   npm run preview  # Test new build
   ```

3. **Hard refresh browser:**
   - Chrome: `Ctrl+Shift+R` (`Cmd+Shift+R` on Mac)
   - Clear all cache in browser settings

---

## Advanced Configuration

### Per-Environment Deployment

Use deployment platform features for environment-specific config:

#### Render.com
```yaml
# render.yaml
services:
  - type: web
    name: instagram-automation
    env: node
    buildCommand: npm run build
    startCommand: npm run preview
    envVars:
      - key: VITE_AUTH_MODE
        value: facebook
      - key: VITE_META_APP_ID
        sync: false  # Set in Render dashboard
```

#### Vercel
```json
{
  "build": {
    "env": {
      "VITE_AUTH_MODE": "facebook",
      "VITE_META_APP_ID": "@meta-app-id"
    }
  }
}
```

#### Netlify
```toml
# netlify.toml
[build.environment]
  VITE_AUTH_MODE = "facebook"
  VITE_META_APP_ID = "123456789"
```

---

### Analytics Integration

Track authentication method usage:

```typescript
// src/pages/Login.tsx
const handleFacebookLogin = async () => {
  // Track attempt
  analytics.track('auth_method_selected', {
    method: 'facebook',
    mode: authMode,
    timestamp: Date.now(),
    page: '/login'
  });

  try {
    // ... OAuth flow

    // Track success
    analytics.track('auth_success', {
      method: 'facebook',
      duration_ms: Date.now() - startTime
    });
  } catch (error) {
    // Track failure
    analytics.track('auth_failure', {
      method: 'facebook',
      error: error.message
    });
  }
};
```

**Analysis Queries:**
```sql
-- User preference analysis
SELECT
  auth_method,
  COUNT(*) as usage_count,
  AVG(duration_ms) as avg_duration
FROM auth_events
WHERE event = 'auth_success'
GROUP BY auth_method;

-- Conversion rate by method
SELECT
  auth_method,
  COUNT(CASE WHEN event = 'auth_success' THEN 1 END) * 100.0 /
  COUNT(*) as success_rate
FROM auth_events
GROUP BY auth_method;
```

---

## Security Best Practices

### Environment Variable Management

1. **Never Commit Secrets:**
   ```bash
   # .gitignore should include:
   .env
   .env.local
   .env.production
   .env.*.local
   ```

2. **Use Secrets Managers:**
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Render Environment Variables (encrypted at rest)

3. **Rotate Credentials Regularly:**
   - Change Meta App Secret every 90 days
   - Update across all environments
   - Test after rotation

4. **Principle of Least Privilege:**
   - Development: Use test app credentials
   - Staging: Use staging app (limited permissions)
   - Production: Use approved app only

---

### OAuth Security

1. **State Parameter Validation:**
   ```typescript
   // Always include nonce in state
   const state = btoa(JSON.stringify({
     timestamp: Date.now(),
     nonce: crypto.randomUUID(),
     returnUrl: from
   }));
   ```

2. **HTTPS Enforcement:**
   - All production OAuth must use HTTPS
   - HTTP only acceptable for localhost development

3. **Token Storage:**
   - Store OAuth tokens securely (httpOnly cookies or secure storage)
   - Never expose in localStorage (XSS vulnerable)
   - Implement token expiration handling

---

## Migration Guide

### From Instagram OAuth to Facebook Login

If migrating existing users:

1. **Communication Plan:**
   - Email users 2 weeks before migration
   - Explain Facebook Login requirement
   - Provide migration deadline

2. **Gradual Rollout:**
   ```bash
   # Week 1: Enable both, Facebook first
   VITE_AUTH_MODE=both

   # Week 2-3: Monitor usage, encourage Facebook
   # [Show banner: "Switch to Facebook Login for better experience"]

   # Week 4: Facebook only
   VITE_AUTH_MODE=facebook
   ```

3. **Data Migration:**
   ```sql
   -- Mark users needing re-authentication
   UPDATE users
   SET needs_reauth = true,
       auth_method = 'instagram'
   WHERE auth_method = 'instagram';
   ```

---

## Support & Resources

### Internal Resources
- **Code:** `src/pages/Login.tsx`
- **Types:** `src/vite-env.d.ts`
- **Environment:** `.env.example`

### External Resources
- [Meta Developer Documentation](https://developers.facebook.com/docs)
- [Facebook Login Guide](https://developers.facebook.com/docs/facebook-login)
- [Instagram Business API](https://developers.facebook.com/docs/instagram-api)
- [OAuth 2.0 Specification](https://oauth.net/2/)

### Getting Help
- **Technical Issues:** Create GitHub issue with "auth" label
- **Meta Review Questions:** Contact Meta Developer Support
- **Security Concerns:** Email security@888intelligence.com

---

## Configuration Quick Reference

### Common Scenarios

| Scenario | VITE_AUTH_MODE | Use Case |
|----------|----------------|----------|
| Local Development | `both` | Test all features |
| Meta Review | `facebook` | Compliance demo |
| Production (Pre-approval) | `facebook` | Safe default |
| Production (Post-approval) | `both` or `facebook` | User choice or simplicity |
| Legacy Support | `instagram` | Backward compatibility |

### Environment Variable Reference

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `VITE_AUTH_MODE` | No | `both` | `facebook` |
| `VITE_META_APP_ID` | Yes (for FB auth) | - | `123456789012345` |
| `VITE_META_APP_SECRET` | Yes (backend) | - | `abc123...` |
| `VITE_OAUTH_REDIRECT_URI` | No | `{origin}/auth/callback` | `https://api.example.com/auth/callback` |

---

## Changelog

### Version 1.0.0 (2025-01-22)
- Initial documentation
- All three authentication modes documented
- Deployment strategies defined
- Troubleshooting guide added
- Security best practices included

---

**Document Version:** 1.0.0
**Last Review:** 2025-01-22
**Next Review:** 2025-04-22
**Maintained By:** Engineering Team @ 888Intelligence
