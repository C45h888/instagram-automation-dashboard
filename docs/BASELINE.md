# UGC Refactor Baseline Metrics

**Captured:** February 1, 2026
**Commit:** ugc-refactor-baseline (4661a56)
**Status:** Phase 1 crash fixes complete, ready for modernization

---

## Bundle Size

### UGC-Related Chunks

| File | Size | Gzip | Notes |
|------|------|------|-------|
| UGCManagement-DkXW_nTH.js | 6.63 KB | 2.56 KB | **Target for reduction via lazy loading** |
| components-BCJjdR6Q.js | 532.24 KB | 140.35 KB | Main bundle (includes modals) |

### Full Build Output

```
dist/index.html                              1.59 kB │ gzip:   0.66 kB
dist/assets/css/index-DTMkUXTm.css          60.32 kB │ gzip:  10.52 kB
dist/assets/CommentManagement-CYdxyvfC.js    1.26 kB │ gzip:   0.74 kB
dist/assets/useComments-CvB4ht3L.js          2.37 kB │ gzip:   1.11 kB
dist/assets/useDMInbox-CqitsXEM.js           3.70 kB │ gzip:   1.48 kB
dist/assets/ContentAnalytics-ZTJFgHs2.js     4.74 kB │ gzip:   2.08 kB
dist/assets/TestConnection-CBQ0bhSP.js       6.05 kB │ gzip:   2.23 kB
dist/assets/DMInbox-CLB6cjbR.js              6.17 kB │ gzip:   2.30 kB
dist/assets/UGCManagement-DkXW_nTH.js        6.63 kB │ gzip:   2.56 kB ⬅️
dist/assets/admin-pages-CL11keee.js          7.06 kB │ gzip:   2.74 kB
dist/assets/3-state-B59qBvem.js              7.85 kB │ gzip:   3.55 kB
dist/assets/ContentManagement-DeUop2iC.js   10.78 kB │ gzip:   3.66 kB
dist/assets/PrivacyDashboard-CVOnakBk.js    11.52 kB │ gzip:   3.47 kB
dist/assets/TermsOfService-DWzlw2Ov.js      12.62 kB │ gzip:   4.43 kB
dist/assets/DataDeletion-CZbc2cOv.js        15.55 kB │ gzip:   3.77 kB
dist/assets/privacypolicy-CqbtOco7.js       19.66 kB │ gzip:   6.44 kB
dist/assets/EngagementMonitor-CS7U8RsD.js   25.98 kB │ gzip:   7.43 kB
dist/assets/index-LNMuyGrg.js               26.16 kB │ gzip:   7.05 kB
dist/assets/auth-5axtxa9T.js                29.09 kB │ gzip:   9.07 kB
dist/assets/1-router-DoXOyv-u.js            34.06 kB │ gzip:  12.59 kB
dist/assets/4-query-CqcCI7W6.js             38.32 kB │ gzip:  11.60 kB
dist/assets/user-pages-C9OlZ7DQ.js          72.70 kB │ gzip:  24.59 kB
dist/assets/5-supabase-D1hm23dh.js         129.18 kB │ gzip:  34.50 kB
dist/assets/0-react-core-TenrF0k9.js       144.90 kB │ gzip:  46.40 kB
dist/assets/2-ui-libs-CLVKh-As.js          147.86 kB │ gzip:  46.18 kB
dist/assets/components-BCJjdR6Q.js         532.24 kB │ gzip: 140.35 kB ⬅️
```

**Total Bundle Size:** ~532 KB (minified, main components)
**Build Time:** 3.15s

---

## Performance Metrics (Estimated)

*Note: Actual browser performance metrics will vary. Estimated based on typical metrics for this bundle size.*

| Metric | Estimated Baseline | Target After Refactor |
|--------|-------------------|----------------------|
| First Contentful Paint (FCP) | ~1.2s | < 1.1s |
| Time to Interactive (TTI) | ~2.8s | < 2.3s |
| Total Blocking Time (TBT) | ~450ms | < 320ms |
| Largest Contentful Paint (LCP) | ~1.5s | < 1.4s |

---

## Network Calls (UGC Page Load)

Expected API calls on `/ugc` page load:

1. `GET /api/instagram/visitor-posts?businessAccountId={uuid}&limit=50`
   - **Missing:** userId parameter (to be added in Phase 2)
   - Estimated response time: 150-200ms

2. Background sync trigger:
   - `POST /api/instagram/sync/ugc`
   - **Missing:** userId parameter (to be added in Phase 2)
   - Non-blocking, fire-and-forget

---

## Test Coverage

**Current Coverage:** 0% (no tests exist)

**Target Coverage:**
- Unit tests: >80% (lines, functions, branches, statements)
- Integration tests: Key user flows covered
- E2E tests: Full workflow (import token → load posts → request permission)

---

## Known Issues (Pre-Refactor)

✅ **FIXED in Phase 1:**
- ~~RepostConfirmationModal null pointer crash~~
- ~~No ErrorBoundary on UGC route~~
- ~~Unsafe error handling in useInstagramAccount~~

❌ **To Fix in Phases 2-6:**
- Missing userId parameter in API calls
- No retry logic for rate limits
- No scope validation
- No edge case banners
- Heavy modals not lazy-loaded
- No resilient audit logging
- No log assertions in tests
- No mobile responsiveness tests

---

## Git State

```bash
Commit: 4661a56
Tag: ugc-refactor-baseline
Branch: main
Message: "backup: UGC page pre-refactor baseline (Phase 1 crash fixes complete)"
```

**Modified Files (Phase 1):**
- `src/App.tsx` - Added ErrorBoundary
- `src/components/permissions/UGCManagement/RepostConfirmationModal.tsx` - Fixed null crash
- `src/hooks/useInstagramAccount.ts` - Fixed error handling

---

## Optimization Targets

Based on plan and baseline:

1. **Bundle Size Reduction:**
   - Current: 6.63 KB (UGCManagement)
   - Target: <4.5 KB (via lazy-loaded modals)
   - Expected reduction: ~30-40%

2. **Initial Load Optimization:**
   - Lazy load PermissionRequestModal
   - Lazy load RepostConfirmationModal
   - Expected: Reduce initial bundle by 5-8%

3. **Performance Improvements:**
   - Add retry logic with exponential backoff
   - Reduce failed API calls
   - Improve error recovery

---

## Next Steps

**Phase 2:** Modernize useVisitorPosts Hook
- Add retry logic (rate limit codes: 17, 4, 32, 613)
- Add userId parameter
- Add scope error tracking
- Implement exponential backoff (1s → 2s → 4s)

**Phase 3:** Add Edge Case Banners & Lazy Loading
- Lazy load modals with React.lazy()
- Add no account banner
- Add token expired banner
- Add scope error banner
- Add retry state banner

**Phase 4:** UI Polish
- Add page-level PermissionBadge
- Remove duplicate badge
- Improve Promise.all error handling

**Phase 5:** Comprehensive Testing
- Unit tests with log assertions
- Integration tests
- Playwright E2E tests
- Mobile responsiveness tests (iPhone 12, Pixel 5)

**Phase 6:** Documentation
- Create UGC_REFACTOR.md
- Update BASELINE.md with post-refactor metrics
- Calculate improvement percentages

---

## Rollback Instructions

If rollback needed:

```bash
# Restore to this baseline
git reset --hard ugc-refactor-baseline

# Or revert specific commits
git revert <commit-hash>

# Rebuild
npm run build
```

---

**Baseline Capture Complete ✅**
Ready for Phase 2-6 implementation.
