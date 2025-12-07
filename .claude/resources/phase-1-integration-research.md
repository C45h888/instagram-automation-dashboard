# Phase 1 Integration Research Document
## Pre-Implementation Analysis for Instagram API Hooks

**Created**: 2025-12-05
**Purpose**: Complete technical analysis before implementing Phase 1 hook updates
**Target**: Update all hooks to use real Meta Graph API v23.0

---

## 📊 Executive Summary

### What Works ✅
- Frontend hooks are already production-ready (no demo mode)
- Backend API endpoints exist and are functional
- Environment variables properly configured
- TypeScript strict mode enabled
- OAuth flow successfully stores Instagram Business Account ID

### What Needs Fixing ❌
- **Authentication Mismatch**: Hooks don't pass required backend parameters
- **Graph API Version**: Currently v18.0, needs update to v23.0
- **Missing Hook Integration**: Hooks don't use `useInstagramAccount` for IDs

---

## 🔍 Research Findings

### 1. Auth Store Structure Analysis

**File**: [src/stores/authStore.ts](src/stores/authStore.ts)

**Available Properties**:
```typescript
interface User {
  id: string;                    // ✅ Available (Supabase user UUID)
  username: string;              // ✅ Available
  email?: string;                // ✅ Available
  permissions: string[];         // ✅ Available
  role?: 'user' | 'admin';      // ✅ Available
  instagramConnected?: boolean;  // ✅ Available
}

interface AuthState {
  user: User | null;             // ✅ Available
  token: string | null;          // ✅ Available (user access token)
  session: Session | null;       // ✅ Available
  isAuthenticated: boolean;      // ✅ Available
}
```

**Missing Properties**:
- ❌ `businessAccountId` (database UUID)
- ❌ `instagramBusinessId` (Meta's account ID)

**Solution**: Use `useInstagramAccount` hook to retrieve these IDs

---

### 2. Instagram Account ID Retrieval

**File**: [src/hooks/useInstagramAccount.ts](src/hooks/useInstagramAccount.ts)

**Purpose**: Fetches Instagram Business Account data from Supabase

**Returns**:
```typescript
interface UseInstagramAccountResult {
  accounts: InstagramBusinessAccount[];
  businessAccountId: string | null;      // UUID for backend token retrieval
  instagramBusinessId: string | null;    // Meta's ID for API :accountId param
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
```

**Data Flow**:
```
1. OAuth Flow (Login.tsx)
   ↓
2. Backend /api/instagram/exchange-token
   ↓
3. Stores in Supabase: instagram_business_accounts table
   ↓
4. useInstagramAccount hook fetches from Supabase
   ↓
5. Returns businessAccountId (UUID) + instagramBusinessId (Meta ID)
```

**Database Table**: `instagram_business_accounts`
- `id` → businessAccountId (UUID for backend queries)
- `instagram_business_id` → instagramBusinessId (for Graph API)
- `user_id` → Links to auth user
- `page_id` → Facebook Page ID
- `page_name` → Page display name

---

### 3. Backend API Requirements

**File**: [backend.api/routes/instagram-api.js](backend.api/routes/instagram-api.js)

**All endpoints require TWO query parameters**:

| Parameter | Type | Purpose | Example |
|-----------|------|---------|---------|
| `userId` | UUID | Supabase user ID for token lookup | `a1b2c3d4-...` |
| `businessAccountId` | UUID | Database ID for account record | `e5f6g7h8-...` |

**Example Endpoint**:
```javascript
GET /api/instagram/media/:accountId?userId=<uuid>&businessAccountId=<uuid>

// :accountId = instagramBusinessId (Meta's ID like "17841...")
// userId = authStore.user.id
// businessAccountId = useInstagramAccount().businessAccountId
```

**Backend Token Retrieval**:
```javascript
// backend.api/services/instagram-tokens.js
async function retrievePageToken(userId, businessAccountId) {
  // 1. Query Supabase: instagram_credentials table
  // 2. Decrypt stored page access token
  // 3. Return decrypted token for Graph API calls
}
```

---

### 4. Graph API Version Analysis

**Current Version**: v18.0
**Required Version**: v23.0 (from Meta Developer Dashboard)

**Files to Update**:

| File | Current | New | Line |
|------|---------|-----|------|
| `backend.api/routes/instagram-api.js` | v18.0 | v23.0 | 309, 542, 588 |
| `src/hooks/useFacebookSDK.ts` | v21.0 | v23.0 | 58 |
| All backend Graph API calls | v18.0 | v23.0 | Multiple |

**Impact**:
- ✅ Better API features
- ✅ Latest permissions model
- ⚠️ May have breaking changes (needs testing)

---

### 5. Environment Variables Audit

**File**: [.env.development](.env.development)

**Confirmed Variables**:
```bash
✅ VITE_API_BASE_URL=https://instagram-backend.888intelligenceautomation.in
✅ VITE_META_APP_ID=1449604936071207
✅ VITE_META_APP_SECRET=c9107cf010ca5bcf82236c71455fdc21
✅ VITE_SUPABASE_URL=https://uromexjprcrjfmhkmgxa.supabase.co
✅ VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Backend URLs**:
- Development: `http://localhost:3001`
- Production: `https://instagram-backend.888intelligenceautomation.in`

---

### 6. TypeScript Configuration

**File**: [tsconfig.json](tsconfig.json)

**Key Settings**:
```json
{
  "compilerOptions": {
    "target": "ES2022",              // ✅ Modern JS
    "lib": ["ES2022", "DOM"],        // ✅ Latest APIs
    "strict": true,                  // ✅ Type safety
    "moduleResolution": "bundler",   // ✅ Vite optimized
    "jsx": "react-jsx"               // ✅ React 18+
  }
}
```

**Impact on Hooks**:
- Must use explicit types
- No `any` allowed without explicit cast
- Strict null checks enabled
- Full IntelliSense support

---

### 7. Hooks Requiring Updates

**All hooks with API calls**:

| Hook | File | Current State | Needs Update |
|------|------|---------------|--------------|
| `useContentAnalytics` | [src/hooks/useContentAnalytics.ts](src/hooks/useContentAnalytics.ts) | Calls API but missing params | ✅ YES |
| `useVisitorPosts` | [src/hooks/useVisitorPosts.ts](src/hooks/useVisitorPosts.ts) | Calls API but missing params | ✅ YES |
| `useComments` | [src/hooks/useComments.ts](src/hooks/useComments.ts) | Calls API but missing params | ✅ YES |
| `useInstagramProfile` | [src/hooks/useInstagramProfile.ts](src/hooks/useInstagramProfile.ts) | Calls API but missing params | ✅ YES |
| `useDMInbox` | [src/hooks/useDMInbox.ts](src/hooks/useDMInbox.ts) | Calls API but missing params | ✅ YES |
| `useInstagramAccount` | [src/hooks/useInstagramAccount.ts](src/hooks/useInstagramAccount.ts) | ✅ Already correct | ❌ NO |
| `useFacebookSDK` | [src/hooks/useFacebookSDK.ts](src/hooks/useFacebookSDK.ts) | Version v21.0 | Update to v23.0 |

---

## 🔧 Required Changes Per Hook

### Common Pattern for All Hooks

**Before (Current - Broken)**:
```typescript
const { token } = useAuthStore();

const response = await fetch(
  `/api/instagram/media/${businessAccountId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**After (Fixed)**:
```typescript
const { user } = useAuthStore();
const { businessAccountId, instagramBusinessId } = useInstagramAccount();

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const response = await fetch(
  `${apiBaseUrl}/api/instagram/media/${instagramBusinessId}?userId=${user?.id}&businessAccountId=${businessAccountId}`,
  {
    headers: {
      'Content-Type': 'application/json'
    }
  }
);
```

**Key Differences**:
1. ✅ Add `useInstagramAccount()` hook
2. ✅ Use `VITE_API_BASE_URL` from env
3. ✅ Add `userId` query param
4. ✅ Add `businessAccountId` query param
5. ✅ Remove Authorization header (backend retrieves token internally)
6. ✅ Use `instagramBusinessId` for `:accountId` param

---

## 📝 Implementation Checklist

### Phase 1.1: useContentAnalytics
- [ ] Import `useInstagramAccount` hook
- [ ] Get `businessAccountId` and `instagramBusinessId`
- [ ] Get `user.id` from `useAuthStore`
- [ ] Update API URL with `VITE_API_BASE_URL`
- [ ] Add query parameters: `userId` and `businessAccountId`
- [ ] Remove Authorization header
- [ ] Update Graph API version references to v23.0
- [ ] Test with real data

### Phase 1.2: useVisitorPosts
- [ ] Same as 1.1
- [ ] Verify endpoint: `/api/instagram/visitor-posts`
- [ ] Test UGC data retrieval

### Phase 1.3: useComments
- [ ] Same as 1.1
- [ ] Handle both media-specific and general comments
- [ ] Test comment replies

### Phase 1.4: useInstagramProfile
- [ ] Same as 1.1
- [ ] Verify profile data structure
- [ ] Test follower count display

### Phase 1.5: useDMInbox
- [ ] Same as 1.1
- [ ] Verify conversations endpoint
- [ ] Test message sending

### Backend Updates
- [ ] Update all Graph API calls from v18.0 to v23.0
- [ ] File: `backend.api/routes/instagram-api.js`
- [ ] Lines: 309, 542, 588, 752
- [ ] Test each endpoint after update

### Testing
- [ ] Start backend: `cd backend.api && npm start`
- [ ] Start frontend: `npm run dev`
- [ ] Complete OAuth flow
- [ ] Navigate to each page
- [ ] Verify Network tab shows correct requests
- [ ] Verify real data displays (or proper error messages)
- [ ] Check console for errors

---

## 🎯 Success Criteria

### Technical
1. ✅ All hooks make successful API calls
2. ✅ Backend receives userId + businessAccountId parameters
3. ✅ Backend retrieves encrypted tokens successfully
4. ✅ Graph API v23.0 calls succeed
5. ✅ Real data displayed in UI (or proper error messages)
6. ✅ No mock data displayed anywhere
7. ✅ No demo mode references found

### User Experience
1. ✅ OAuth flow connects Instagram account
2. ✅ Dashboard shows real Instagram data
3. ✅ Analytics page shows real metrics
4. ✅ Content page shows real media
5. ✅ Comments show real comment data
6. ✅ If API fails, error message is clear and actionable

### Meta Compliance
1. ✅ Using latest Graph API version (v23.0)
2. ✅ All permissions properly requested
3. ✅ Real data displayed in screencast
4. ✅ No "coming soon" placeholders
5. ✅ No mock/demo data shown

---

## 🚨 Potential Issues & Mitigations

### Issue 1: Missing Instagram Business Account
**Symptom**: `useInstagramAccount` returns `null`
**Cause**: User completed OAuth but account not stored
**Fix**: Verify `/api/instagram/exchange-token` stores data correctly

### Issue 2: Token Retrieval Fails
**Symptom**: Backend returns 401 "Token retrieval failed"
**Cause**: Missing record in `instagram_credentials` table
**Fix**: Check OAuth flow stores encrypted token

### Issue 3: Graph API Errors
**Symptom**: 400/403 errors from Meta
**Cause**: Invalid permissions or outdated API version
**Fix**: Verify v23.0 compatibility, check permissions

### Issue 4: CORS Errors
**Symptom**: Blocked by CORS policy
**Cause**: Frontend calling wrong backend URL
**Fix**: Verify `VITE_API_BASE_URL` is correct

---

## 📚 Key File References

| Category | File | Purpose |
|----------|------|---------|
| **Hooks** | `src/hooks/useInstagramAccount.ts` | Get businessAccountId |
| | `src/hooks/useContentAnalytics.ts` | Media analytics |
| | `src/hooks/useVisitorPosts.ts` | UGC content |
| | `src/hooks/useComments.ts` | Comment management |
| | `src/hooks/useInstagramProfile.ts` | Profile data |
| | `src/hooks/useDMInbox.ts` | Direct messages |
| **Backend** | `backend.api/routes/instagram-api.js` | All API endpoints |
| | `backend.api/services/instagram-tokens.js` | Token retrieval |
| **Config** | `.env.development` | Environment vars |
| | `tsconfig.json` | TypeScript config |
| | `vite.config.ts` | Build config |
| **Auth** | `src/stores/authStore.ts` | User auth state |
| | `src/pages/Login.tsx` | OAuth flow |

---

## 📌 Next Steps

1. ✅ **This Document Complete** - Research phase done
2. ⏭️ **Update Graph API Version** - Change v18.0 → v23.0
3. ⏭️ **Update First Hook** - Start with useContentAnalytics
4. ⏭️ **Test End-to-End** - Verify with real account
5. ⏭️ **Repeat for Other Hooks** - Apply same pattern
6. ⏭️ **Final Testing** - All pages with real data

---

**Research Status**: ✅ COMPLETE
**Ready to Implement**: YES
**Confidence Level**: 95%
**Next Action**: Update Graph API version to v23.0

