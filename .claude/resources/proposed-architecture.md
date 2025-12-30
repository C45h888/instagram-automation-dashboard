OPTION 1: NATIVE SUPABASE OAUTH (DEEP DIVE)
New Architecture Diagram

┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTION 1: NATIVE SUPABASE OAUTH                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  FRONTEND (React/Vite) - MODIFIED                                    │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  Components:                                                          │  │
│  │  ├─ Login.tsx - SIMPLIFIED (200 lines, down from 528)               │  │
│  │  │  ├─ ❌ DELETE: handleFacebookLogin() - old SDK flow              │  │
│  │  │  ├─ ✅ NEW: handleSupabaseOAuth() - 20 lines                     │  │
│  │  │  │   await supabase.auth.signInWithOAuth({                       │  │
│  │  │  │     provider: 'facebook',                                     │  │
│  │  │  │     options: {                                                │  │
│  │  │  │       redirectTo: `${window.location.origin}/auth/callback`,  │  │
│  │  │  │       scopes: 'instagram_basic,instagram_manage_insights,...' │  │
│  │  │  │     }                                                          │  │
│  │  │  │   })                                                           │  │
│  │  │  └─ ❌ DELETE: logConsent() - moved to callback                  │  │
│  │  │                                                                    │  │
│  │  ├─ FacebookCallback.tsx - REFACTORED (100 lines)                   │  │
│  │  │  ├─ ✅ MODIFY: Use exchangeCodeForSession()                      │  │
│  │  │  ├─ ✅ NEW: Extract provider_token from session                  │  │
│  │  │  ├─ ✅ NEW: Call /api/instagram/exchange-token                   │  │
│  │  │  └─ ✅ NEW: persistConsent() logic                               │  │
│  │  │                                                                    │  │
│  │  ├─ ❌ DELETE: AuthCallback.tsx - duplicate, not needed             │  │
│  │  └─ ✅ KEEP: AdminLogin.tsx - unchanged                             │  │
│  │                                                                       │  │
│  │  Hooks:                                                               │  │
│  │  ├─ ❌ DELETE: useFacebookSDK.ts - No longer needed                 │  │
│  │  │   (Can optionally keep for non-auth FB features like sharing)   │  │
│  │  └─ ✅ NEW: useSupabaseAuth.ts - Session management (optional)     │  │
│  │                                                                       │  │
│  │  State Management:                                                    │  │
│  │  └─ authStore.ts - MINOR CHANGES                                     │  │
│  │     ├─ ✅ KEEP: All existing state structure                        │  │
│  │     ├─ ✅ MODIFY: checkSession() - simplified                       │  │
│  │     └─ ✅ REMOVE: Custom login() logic, use Supabase directly      │  │
│  │                                                                       │  │
│  │  Supabase Client:                                                     │  │
│  │  └─ supabaseClient.ts - NO CHANGES                                  │  │
│  │     └─ Same configuration, same usage                               │  │
│  │                                                                       │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│              ❶ User clicks "Continue with Facebook"                        │
│              │                                                              │
│              ▼                                                              │
│  ┌────────────────────────────────────────────────┐                        │
│  │ supabase.auth.signInWithOAuth({                │                        │
│  │   provider: 'facebook',                        │                        │
│  │   options: {                                   │                        │
│  │     redirectTo: '/auth/callback',              │                        │
│  │     scopes: 'instagram_basic,...'              │                        │
│  │   }                                            │                        │
│  │ })                                             │                        │
│  └────────────┬───────────────────────────────────┘                        │
│               │                                                             │
│               │ ❷ Supabase SDK builds OAuth URL                            │
│               │   https://graph.facebook.com/oauth/authorize?              │
│               │   client_id=YOUR_APP_ID&                                   │
│               │   redirect_uri=https://PROJECT.supabase.co/auth/v1/...&   │
│               │   scope=instagram_basic,...&                               │
│               │   state=CSRF_TOKEN                                         │
│               │                                                             │
│               │ ❸ Browser redirects to Facebook                            │
│               │                                                             │
│               ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  FACEBOOK OAUTH DIALOG                                               │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  ❹ User sees Facebook login screen                                   │  │
│  │  ❺ User grants permissions                                           │  │
│  │  ❻ Facebook redirects to Supabase callback:                         │  │
│  │     https://PROJECT.supabase.co/auth/v1/callback?                    │  │
│  │     code=ABC123...&state=CSRF_TOKEN                                  │  │
│  │                                                                       │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  SUPABASE AUTH SERVICE (Managed by Supabase)                         │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  ❼ Supabase receives authorization code                             │  │
│  │                                                                       │  │
│  │  ❽ Exchange code for Facebook access token                          │  │
│  │     POST https://graph.facebook.com/oauth/access_token               │  │
│  │     {                                                                 │  │
│  │       code: "ABC123...",                                             │  │
│  │       client_id: YOUR_APP_ID,                                        │  │
│  │       client_secret: YOUR_APP_SECRET,                                │  │
│  │       redirect_uri: "..."                                            │  │
│  │     }                                                                 │  │
│  │     Returns: { access_token: "EAAUma..." }                           │  │
│  │                                                                       │  │
│  │  ❹ Fetch user data from Facebook                                    │  │
│  │     GET https://graph.facebook.com/me?access_token=...               │  │
│  │     Returns: { id, name, email, picture }                            │  │
│  │                                                                       │  │
│  │  ❿ Parse Facebook user data                                         │  │
│  │     ✅ Uses Supabase's internal Facebook integration                │  │
│  │     ✅ NOT using signInWithIdToken() - different code path!         │  │
│  │     ✅ Properly handles Facebook's OAuth response format            │  │
│  │                                                                       │  │
│  │  ⓫ Create/update user in auth.users                                 │  │
│  │     INSERT INTO auth.users (id, email, ...)                          │  │
│  │     VALUES (gen_random_uuid(), 'user@email.com', ...)               │  │
│  │     ON CONFLICT (email) DO UPDATE                                    │  │
│  │                                                                       │  │
│  │  ⓬ Generate session tokens                                           │  │
│  │     {                                                                 │  │
│  │       access_token: "eyJhbGc...",  // Supabase JWT                  │  │
│  │       refresh_token: "v1::...",     // Supabase refresh             │  │
│  │       expires_in: 3600,                                              │  │
│  │       provider_token: "EAAUma...",  // Facebook access token        │  │
│  │       provider_refresh_token: null  // Facebook doesn't provide     │  │
│  │     }                                                                 │  │
│  │                                                                       │  │
│  │  ⓭ Store provider_token in auth.identities table                    │  │
│  │     INSERT INTO auth.identities (                                    │  │
│  │       user_id, provider, provider_id,                                │  │
│  │       identity_data, provider_token  ← STORED HERE                  │  │
│  │     )                                                                 │  │
│  │                                                                       │  │
│  │  ⓮ Redirect to your callback URL with session info                  │  │
│  │     https://yourapp.com/auth/callback#                               │  │
│  │     access_token=eyJhbGc...&                                         │  │
│  │     refresh_token=v1::...&                                           │  │
│  │     provider_token=EAAUma...                                         │  │
│  │                                                                       │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  FRONTEND: FacebookCallback.tsx                                      │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  ⓯ Parse URL hash parameters                                         │  │
│  │     const hashParams = new URLSearchParams(                          │  │
│  │       window.location.hash.substring(1)                              │  │
│  │     )                                                                 │  │
│  │     const access_token = hashParams.get('access_token')             │  │
│  │     const refresh_token = hashParams.get('refresh_token')           │  │
│  │                                                                       │  │
│  │  ⓰ Set session in Supabase client                                   │  │
│  │     const { data, error } = await supabase.auth.setSession({        │  │
│  │       access_token,                                                  │  │
│  │       refresh_token                                                  │  │
│  │     })                                                                │  │
│  │     ✅ Session now established client-side                          │  │
│  │                                                                       │  │
│  │  ⓱ Get current session to extract provider_token                    │  │
│  │     const { data: { session } } = await supabase.auth.getSession()  │  │
│  │     const provider_token = session.provider_token                    │  │
│  │     const user = session.user                                        │  │
│  │                                                                       │  │
│  │  ⓲ Exchange Facebook token for Instagram page token                 │  │
│  │     POST /api/instagram/exchange-token {                             │  │
│  │       userAccessToken: provider_token,                               │  │
│  │       userId: user.id  // UUID from Supabase                        │  │
│  │     }                                                                 │  │
│  │                                                                       │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  BACKEND API - INSTAGRAM ONLY                                        │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  Routes:                                                              │  │
│  │  ├─ ❌ DELETED: /api/auth/facebook/callback                          │  │
│  │  ├─ ❌ DELETED: /api/auth/facebook/token                             │  │
│  │  │                                                                    │  │
│  │  └─ ✅ KEEP: instagram-api.js (unchanged)                           │  │
│  │     └─ POST /api/instagram/exchange-token                            │  │
│  │        ├─ Verify user token with Facebook                           │  │
│  │        ├─ Get /me/accounts (pages)                                   │  │
│  │        ├─ Auto-discover Instagram Business Account                  │  │
│  │        ├─ Extract page access token                                 │  │
│  │        ├─ Encrypt and store in database                             │  │
│  │        └─ Return businessAccountId                                   │  │
│  │                                                                       │  │
│  │  ⓳ Exchange token flow (UNCHANGED)                                   │  │
│  │     ✅ Same as before                                                │  │
│  │     ✅ Uses existing services/instagram-tokens.js                    │  │
│  │                                                                       │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ⓴ Frontend: Update authStore                                              │
│     ├─ setBusinessAccount({ businessAccountId, ... })                      │
│     ├─ persistConsent(userId)                                              │
│     └─ navigate('/dashboard')                                              │
│                                                                             │
│  ✅ COMPLETE - User authenticated + Instagram connected                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
OPTION 2: ADMIN API + MAGIC LINK PATTERN (DEEP DIVE)
New Architecture Diagram

┌─────────────────────────────────────────────────────────────────────────────┐
│                  OPTION 2: ADMIN GENERATELINK PATTERN                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  FRONTEND (React/Vite) - MINIMAL CHANGES                             │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  Components:                                                          │  │
│  │  ├─ Login.tsx - MINOR MODIFICATIONS (528 → 520 lines)               │  │
│  │  │  ├─ ✅ KEEP: handleFacebookLogin() - same SDK flow               │  │
│  │  │  │  └─ Still calls FB.login() for popup UX                       │  │
│  │  │  ├─ ✅ MODIFY: Backend endpoint response handling                │  │
│  │  │  │  └─ Expects { access_token, refresh_token } now              │  │
│  │  │  └─ ✅ KEEP: All consent logic unchanged                         │  │
│  │  │                                                                    │  │
│  │  ├─ ✅ KEEP: FacebookCallback.tsx - NOT USED (SDK flow only)        │  │
│  │  ├─ ❌ DELETE: AuthCallback.tsx - still dead code                   │  │
│  │  └─ ✅ KEEP: AdminLogin.tsx - unchanged                             │  │
│  │                                                                       │  │
│  │  Hooks:                                                               │  │
│  │  └─ ✅ KEEP: useFacebookSDK.ts - STILL NEEDED                        │  │
│  │     └─ Required for FB.login() popup functionality                  │  │
│  │                                                                       │  │
│  │  State Management:                                                    │  │
│  │  └─ authStore.ts - NO CHANGES                                        │  │
│  │     └─ Works exactly the same                                        │  │
│  │                                                                       │  │
│  │  Supabase Client:                                                     │  │
│  │  └─ supabaseClient.ts - NO CHANGES                                  │  │
│  │                                                                       │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│              ❶ User clicks "Continue with Facebook"                        │
│              ❷ FB.login() → Popup dialog → { accessToken }                │
│              ❸ POST /api/auth/facebook/token { accessToken }              │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  BACKEND API (Express.js) - REFACTORED AUTH ENDPOINT                 │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  Routes:                                                              │  │
│  │  └─ auth.js - MODIFIED (423 → 350 lines)                            │  │
│  │     ├─ ❌ DELETE: POST /api/auth/facebook/callback                   │  │
│  │     │  └─ No longer needed (SDK-only flow)                           │  │
│  │     │                                                                 │  │
│  │     └─ ✅ REFACTOR: POST /api/auth/facebook/token                    │  │
│  │        ├─ ❌ REMOVE: signInWithIdToken() call                        │  │
│  │        └─ ✅ ADD: Admin API session creation                         │  │
│  │                                                                       │  │
│  │  NEW IMPLEMENTATION:                                                  │  │
│  │  ──────────────────────────────────────────────────────────────────  │  │
│  │                                                                       │  │
│  │  router.post('/facebook/token', async (req, res) => {               │  │
│  │    const { accessToken } = req.body;                                 │  │
│  │                                                                       │  │
│  │    try {                                                             │  │
│  │      // ❹ STEP 1: Verify token with Facebook (UNCHANGED)            │  │
│  │      const userResponse = await fetch(                               │  │
│  │        `https://graph.facebook.com/v23.0/me?` +                      │  │
│  │        `fields=id,name,email,picture&access_token=${accessToken}`   │  │
│  │      );                                                               │  │
│  │      const facebookUser = await userResponse.json();                 │  │
│  │      // Returns: { id, name, email, picture }                       │  │
│  │                                                                       │  │
│  │      // ❺ STEP 2: Create/find user with admin API                   │  │
│  │      const { data: existingUser, error: lookupError } =              │  │
│  │        await supabaseAdmin.auth.admin.listUsers();                   │  │
│  │                                                                       │  │
│  │      let user;                                                        │  │
│  │      const existing = existingUser?.users.find(                      │  │
│  │        u => u.email === facebookUser.email                           │  │
│  │      );                                                               │  │
│  │                                                                       │  │
│  │      if (existing) {                                                 │  │
│  │        user = existing;                                              │  │
│  │      } else {                                                        │  │
│  │        // Create new user                                            │  │
│  │        const { data: newUser, error: createError } =                 │  │
│  │          await supabaseAdmin.auth.admin.createUser({                 │  │
│  │            email: facebookUser.email,                                │  │
│  │            email_confirm: true,  // Auto-confirm                     │  │
│  │            user_metadata: {                                          │  │
│  │              facebook_id: facebookUser.id,                           │  │
│  │              full_name: facebookUser.name,                           │  │
│  │              avatar_url: facebookUser.picture?.data?.url            │  │
│  │            }                                                          │  │
│  │          });                                                          │  │
│  │        user = newUser.user;                                          │  │
│  │      }                                                                │  │
│  │                                                                       │  │
│  │      // ❻ STEP 3: Generate magic link token                         │  │
│  │      const { data: linkData, error: linkError } =                    │  │
│  │        await supabaseAdmin.auth.admin.generateLink({                 │  │
│  │          type: 'magiclink',                                          │  │
│  │          email: facebookUser.email,                                  │  │
│  │          options: {                                                  │  │
│  │            redirectTo: 'http://localhost:5173/auth/callback'        │  │
│  │          }                                                            │  │
│  │        });                                                            │  │
│  │      // Returns: {                                                   │  │
│  │      //   properties: {                                              │  │
│  │      //     action_link: "...",                                      │  │
│  │      //     email_otp: "123456",                                     │  │
│  │      //     hashed_token: "abc123...",                               │  │
│  │      //     redirect_to: "...",                                      │  │
│  │      //     verification_type: "magiclink"                           │  │
│  │      //   },                                                          │  │
│  │      //   user: { id, email, ... }                                   │  │
│  │      // }                                                             │  │
│  │                                                                       │  │
│  │      // ❼ STEP 4: Verify OTP to create session                      │  │
│  │      const { data: sessionData, error: verifyError } =               │  │
│  │        await supabaseAdmin.auth.verifyOtp({                          │  │
│  │          type: 'email',                                              │  │
│  │          email: facebookUser.email,                                  │  │
│  │          token: linkData.properties.email_otp                        │  │
│  │        });                                                            │  │
│  │      // This creates a REAL session!                                │  │
│  │      // Returns: {                                                   │  │
│  │      //   session: {                                                 │  │
│  │      //     access_token: "eyJhbGc...",                              │  │
│  │      //     refresh_token: "v1::...",                                │  │
│  │      //     expires_in: 3600,                                        │  │
│  │      //     token_type: "bearer"                                     │  │
│  │      //   },                                                          │  │
│  │      //   user: { id, email, ... }                                   │  │
│  │      // }                                                             │  │
│  │                                                                       │  │
│  │      // ❽ STEP 5: Store user profile (dual-ID mapping)              │  │
│  │      await supabaseAdmin.from('user_profiles').upsert({             │  │
│  │        user_id: user.id,                                             │  │
│  │        facebook_id: facebookUser.id,                                 │  │
│  │        email: facebookUser.email,                                    │  │
│  │        full_name: facebookUser.name,                                 │  │
│  │        avatar_url: facebookUser.picture?.data?.url,                 │  │
│  │        instagram_connected: false                                    │  │
│  │      });                                                              │  │
│  │                                                                       │  │
│  │      // ❾ STEP 6: Return session to frontend                        │  │
│  │      return res.status(200).json({                                   │  │
│  │        success: true,                                                │  │
│  │        session: {                                                    │  │
│  │          access_token: sessionData.session.access_token,            │  │
│  │          refresh_token: sessionData.session.refresh_token,          │  │
│  │          expires_in: sessionData.session.expires_in,                │  │
│  │          expires_at: sessionData.session.expires_at                 │  │
│  │        },                                                             │  │
│  │        user: {                                                       │  │
│  │          id: user.id,                                                │  │
│  │          facebook_id: facebookUser.id,                               │  │
│  │          email: facebookUser.email,                                  │  │
│  │          name: facebookUser.name                                     │  │
│  │        },                                                             │  │
│  │        provider_token: accessToken  // Facebook token               │  │
│  │      });                                                              │  │
│  │                                                                       │  │
│  │    } catch (error) {                                                 │  │
│  │      return res.status(500).json({                                   │  │
│  │        success: false,                                               │  │
│  │        error: error.message                                          │  │
│  │      });                                                              │  │
│  │    }                                                                  │  │
│  │  });                                                                  │  │
│  │                                                                       │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│                              │ Returns: { session, user, provider_token }  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  FRONTEND: Login.tsx (Same as before)                                │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  ⓫ Set session in Supabase client                                   │  │
│  │     await supabase.auth.setSession({                                 │  │
│  │       access_token: authData.session.access_token,                   │  │
│  │       refresh_token: authData.session.refresh_token                  │  │
│  │     });                                                               │  │
│  │                                                                       │  │
│  │  ⓬ Complete handshake (Instagram token exchange)                    │  │
│  │     await completeHandshake(                                         │  │
│  │       authData.provider_token,  // Facebook token                    │  │
│  │       authData.user.id          // Supabase UUID                     │  │
│  │     );                                                                │  │
│  │                                                                       │  │
│  │  ⓭ Update authStore                                                  │  │
│  │     login(user, access_token);                                       │  │
│  │                                                                       │  │
│  │  ⓮ Navigate to dashboard                                             │  │
│  │     ✅ COMPLETE                                                      │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  KEY DIFFERENCE FROM CURRENT:                                               │
│  Backend uses admin.generateLink() + verifyOtp() instead of               │
│  signInWithIdToken() - this bypasses the broken Facebook parser           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
Code Changes Required for Option 2

┌─────────────────────────────────────────────────────────────────────────────┐
│                   DETAILED CODE CHANGES - OPTION 2                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FILES TO DELETE:                                                           │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ❌ backend.api/routes/auth.js - /facebook/callback endpoint only          │
│     └─ Delete lines 26-227 (OAuth callback code)                          │
│     └─ Keep lines 253-420 (SDK token endpoint - to be refactored)         │
│                                                                             │
│  ❌ src/pages/AuthCallback.tsx - still dead code                           │
│                                                                             │
│                                                                             │
│  FILES TO MODIFY:                                                           │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ✏️  backend.api/routes/auth.js - REFACTOR SDK TOKEN ENDPOINT              │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │ REPLACE lines 305-315 (signInWithIdToken call):                    │   │
│  │                                                                     │   │
│  │ // ❌ DELETE THIS:                                                  │   │
│  │ const { data: authData, error: authError } =                        │   │
│  │   await supabaseAdmin.auth.signInWithIdToken({                      │   │
│  │     provider: 'facebook',                                           │   │
│  │     token: accessToken                                              │   │
│  │   });                                                                │   │
│  │                                                                     │   │
│  │ // ✅ REPLACE WITH THIS:                                            │   │
│  │                                                                     │   │
│  │ // Find or create user                                              │   │
│  │ const { data: users } = await supabaseAdmin.auth.admin.listUsers({│   │
│  │   filter: `email.eq.${facebookUser.email}`                         │   │
│  │ });                                                                  │   │
│  │                                                                     │   │
│  │ let user;                                                            │   │
│  │ if (users && users.users.length > 0) {                             │   │
│  │   user = users.users[0];                                            │   │
│  │ } else {                                                            │   │
│  │   const { data: newUser, error: createError } =                     │   │
│  │     await supabaseAdmin.auth.admin.createUser({                     │   │
│  │       email: facebookUser.email,                                    │   │
│  │       email_confirm: true,                                          │   │
│  │       user_metadata: {                                              │   │
│  │         facebook_id: facebookUser.id,                               │   │
│  │         full_name: facebookUser.name,                               │   │
│  │         avatar_url: facebookUser.picture?.data?.url || null        │   │
│  │       }                                                              │   │
│  │     });                                                              │   │
│  │                                                                     │   │
│  │   if (createError) {                                                │   │
│  │     console.error('❌ Failed to create user:', createError);        │   │
│  │     return res.status(500).json({                                   │   │
│  │       success: false,                                               │   │
│  │       error: 'Failed to create user',                               │   │
│  │       details: createError                                          │   │
│  │     });                                                              │   │
│  │   }                                                                  │   │
│  │   user = newUser.user;                                              │   │
│  │ }                                                                    │   │
│  │                                                                     │   │
│  │ // Generate magic link                                              │   │
│  │ const { data: linkData, error: linkError } =                        │   │
│  │   await supabaseAdmin.auth.admin.generateLink({                     │   │
│  │     type: 'magiclink',                                              │   │
│  │     email: facebookUser.email                                       │   │
│  │   });                                                                │   │
│  │                                                                     │   │
│  │ if (linkError) {                                                    │   │
│  │   console.error('❌ Failed to generate link:', linkError);          │   │
│  │   return res.status(500).json({                                     │   │
│  │     success: false,                                                 │   │
│  │     error: 'Failed to generate authentication link',               │   │
│  │     details: linkError                                              │   │
│  │   });                                                                │   │
│  │ }                                                                    │   │
│  │                                                                     │   │
│  │ // Verify OTP to create session                                     │   │
│  │ const { data: sessionData, error: verifyError } =                   │   │
│  │   await supabaseAdmin.auth.verifyOtp({                              │   │
│  │     type: 'email',                                                  │   │
│  │     email: facebookUser.email,                                      │   │
│  │     token: linkData.properties.email_otp                            │   │
│  │   });                                                                │   │
│  │                                                                     │   │
│  │ if (verifyError || !sessionData.session) {                          │   │
│  │   console.error('❌ Failed to verify OTP:', verifyError);           │   │
│  │   return res.status(500).json({                                     │   │
│  │     success: false,                                                 │   │
│  │     error: 'Failed to create session',                              │   │
│  │     details: verifyError                                            │   │
│  │   });                                                                │   │
│  │ }                                                                    │   │
│  │                                                                     │   │
│  │ const supabaseUserId = user.id;                                     │   │
│  │ const authData = {                                                  │   │
│  │   user: sessionData.user,                                           │   │
│  │   session: sessionData.session                                      │   │
│  │ };                                                                   │   │
│  │                                                                     │   │
│  │ // Rest of code unchanged (upsert profile, return response)        │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ✏️  src/pages/Login.tsx - MINOR CHANGE                                    │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │ No structural changes needed!                                       │   │
│  │                                                                     │   │
│  │ The response format from backend is the same:                       │   │
│  │ {                                                                   │   │
│  │   success: true,                                                    │   │
│  │   session: { access_token, refresh_token, ... },                   │   │
│  │   user: { id, facebook_id, email, name },                          │   │
│  │   provider_token: "EAAUmaHNHe..."                                   │   │
│  │ }                                                                    │   │
│  │                                                                     │   │
│  │ Frontend code already handles this correctly!                       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                                                             │
│  FILES TO KEEP (NO CHANGES):                                                │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ✅ src/hooks/useFacebookSDK.ts - REQUIRED for popup                       │
│  ✅ backend.api/routes/instagram-api.js - No changes                       │
│  ✅ backend.api/services/instagram-tokens.js - No changes                  │
│  ✅ src/stores/authStore.ts - No changes                                   │
│  ✅ All Instagram components - No changes                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
Token Storage: Option 2

┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOKEN STORAGE - OPTION 2                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  SUPABASE DATABASE                                                   │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  auth.users                                                           │  │
│  │  ├─ id (UUID): "generated-by-createUser"                             │  │
│  │  ├─ email: "user@example.com"                                        │  │
│  │  ├─ email_confirmed_at: "2025-01-..." ← Auto-confirmed              │  │
│  │  ├─ user_metadata: {                                                 │  │
│  │  │    facebook_id: "122098096448937004",                             │  │
│  │  │    full_name: "User Name",                                        │  │
│  │  │    avatar_url: "https://..."                                      │  │
│  │  │  }                                                                 │  │
│  │  └─ encrypted_password: null (no password set)                       │  │
│  │                                                                       │  │
│  │  auth.sessions (created by verifyOtp)                                │  │
│  │  ├─ id: "session-uuid..."                                            │  │
│  │  ├─ user_id: "user-uuid..."                                          │  │
│  │  └─ expires_at: "2025-01-..."                                        │  │
│  │                                                                       │  │
│  │  ⚠️ auth.identities - NOT CREATED                                    │  │
│  │  └─ This table is only populated for OAuth flows                     │  │
│  │     Since we're using generateLink, no identity record               │  │
│  │     Facebook ID stored in user_metadata instead                      │  │
│  │                                                                       │  │
│  │  public.user_profiles                                                 │  │
│  │  ├─ user_id: "user-uuid..."                                          │  │
│  │  ├─ facebook_id: "122098096448937004"                                │  │
│  │  ├─ email: "user@example.com"                                        │  │
│  │  └─ instagram_connected: true (after exchange)                       │  │
│  │                                                                       │  │
│  │  public.instagram_credentials                                         │  │
│  │  ├─ user_id: "user-uuid..."                                          │  │
│  │  ├─ access_token_encrypted: "encrypted-page-token..."               │  │
│  │  └─ expires_at: "2025-03-..."                                        │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  KEY DIFFERENCE:                                                            │
│  - No auth.identities record (manually created user, not OAuth)            │
│  - Facebook ID stored in user_metadata and user_profiles                   │
│  - Session created via magic link verification, not OAuth                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
OPTION 3: HYBRID (SDK + SUPABASE OAUTH)
Architecture Diagram

┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTION 3: HYBRID APPROACH                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONCEPT: Use FB SDK for permission request, then Supabase OAuth for auth  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  FRONTEND - TWO-STEP PROCESS                                         │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  STEP 1: FB SDK Permission Request (Popup)                           │  │
│  │  ──────────────────────────────────────────────────────────────────  │  │
│  │  const handleFacebookLogin = async () => {                           │  │
│  │    // Use FB SDK to show permissions dialog                          │  │
│  │    const fbResponse = await FB.login(scopes);                        │  │
│  │                                                                       │  │
│  │    if (fbResponse.status === 'connected') {                          │  │
│  │      // User granted permissions in popup                            │  │
│  │      const grantedScopes = fbResponse.authResponse.grantedScopes;    │  │
│  │                                                                       │  │
│  │      // Store granted scopes                                         │  │
│  │      sessionStorage.setItem('fb_scopes', grantedScopes);             │  │
│  │                                                                       │  │
│  │      // STEP 2: Now use Supabase OAuth for actual auth              │  │
│  │      await supabase.auth.signInWithOAuth({                           │  │
│  │        provider: 'facebook',                                         │  │
│  │        options: {                                                    │  │
│  │          redirectTo: '/auth/callback',                               │  │
│  │          scopes: grantedScopes  // Use same scopes                  │  │
│  │        }                                                              │  │
│  │      });                                                              │  │
│  │      // This redirects to Facebook OAuth                             │  │
│  │      // User will see they already granted permissions               │  │
│  │      // Facebook skips permission dialog (already approved)          │  │
│  │    }                                                                  │  │
│  │  };                                                                   │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│                   User sees TWO interactions:                               │
│                   1. FB SDK popup (permissions)                             │
│                   2. OAuth redirect (auth - but instant if cached)          │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  FACEBOOK BEHAVIOR                                                   │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  If user already granted permissions via SDK:                        │  │
│  │  ├─ OAuth redirect shows briefly                                     │  │
│  │  ├─ Facebook recognizes existing grant                               │  │
│  │  ├─ Skips permission dialog                                          │  │
│  │  └─ Redirects back to app immediately                                │  │
│  │                                                                       │  │
│  │  ⚠️ PROBLEM: This behavior is inconsistent                           │  │
│  │  └─ Sometimes Facebook cache expires                                 │  │
│  │     └─ User sees permission dialog TWICE (confusing!)                │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  CALLBACK (Same as Option 1)                                         │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  Supabase creates session → returns to /auth/callback                │  │
│  │  Frontend extracts provider_token                                     │  │
│  │  Calls Instagram token exchange                                       │  │
│  │  ✅ Complete                                                          │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  PROBLEMS WITH THIS APPROACH:                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  1. ❌ Confusing UX - Two steps for one login                              │
│  2. ❌ Inconsistent behavior - depends on Facebook cache                   │
│  3. ❌ More complex code - two different flows to maintain                 │
│  4. ❌ Requires both FB SDK AND Supabase OAuth                             │
│  5. ❌ No significant benefit over Option 1                                │
│  6. ❌ Debugging nightmare - which step failed?                            │
│                                                                             │
│  WHY NOT RECOMMENDED:                                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  - If you want popup UX → Use Option 2 (pure SDK)                          │
│  - If you want standard OAuth → Use Option 1 (pure Supabase)               │
│  - Hybrid approach gives worst of both worlds                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
