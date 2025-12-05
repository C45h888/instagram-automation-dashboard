THE CORE PHILOSOPHY SHIFT
We are abandoning the "Prototype" approach. Previously, we simulated features (like N8N workflows or analytics) to look impressive. This caused a rejection because the reviewer saw through the facade.

The New Rule:

If the application displays a number, a post, or a status, it MUST come from the Meta Graph API.

Banned: PermissionDemoService, mockData.ts, setTimeout simulations, hardcoded "10k followers."

Required: Live network requests to backend.api which proxy to graph.facebook.com.

If a feature is "hard" to implement (like video uploading), we do not fake it. We implement the simplest working version (e.g., image-only publishing) rather than a broken "complex" version.

2. THE "MASTER KEY" STRATEGY (Identity Context)
We are bypassing the "Test User" limitation by using the App Administrator account.

Admin Email: kamran@888intelligence.org

Facebook User ID: 61578110124514

Role: Administrator (Full Graph API Access in Dev Mode).

Implication for You (The Coding Agent): You do not need to handle "Edge Cases" where data is missing because the app isn't live. Assume the user HAS permission. If the API returns data, display it. If it errors, display the error. Do not fallback to fake data to "save the UI." The UI should break if the API fails, so we know to fix the backend.

3. SCOPE-BY-SCOPE IMPLEMENTATION MANDATES
You are required to wire up the following features to Real Endpoints immediately:

A. Authentication (pages_show_list)
Goal: The user must click "Continue with Facebook" and see the actual Facebook Page name they manage in the Dashboard.

Requirement: Refactor instagram-tokens.js to fetch the Instagram ID inside the GET /me/accounts call. Remove pages_manage_metadata entirely.

B. Analytics (read_insights)
Goal: The "Analytics" page must show the exact Reach and Impressions count of the linked test page (even if it's "5").

Action:

Purge: Delete src/services/permissionDemoService.ts usage in useContentAnalytics.

Wire: Call GET /api/instagram/insights/:id. Map the response directly to the Chart component.

C. Content Publishing (pages_manage_posts)
Goal: When I click "Publish," the image must appear on instagram.com/888_test_account.

Action:

Frontend: The CreatePostModal must send a valid HTTPS URL (use the Stock Library feature) to the backend.

Backend: The /create-post endpoint must execute the 2-step Graph API flow (Create Container -> Media Publish).

Feedback: The "Success" toast should only trigger after the backend returns 200 OK.

D. UGC Management (pages_read_user_content)
Goal: If I tag the test page from my personal account, it appears in the "UGC" tab.

Action: Wire useVisitorPosts to GET /api/instagram/visitor-posts. Ensure the VisitorPostCard renders the real media_url and caption from the API.

4. VERIFICATION STANDARD ("The Reality Check")
Before marking any task complete, you must verify:

Network Trace: Does the browser show a request to localhost:3001/api/...?

Payload: Does the response contain live IDs (e.g., 1784...) instead of mock_id_123?

UI: Does the Dashboard "Connected Account" match the name of the Admin's test page?

Instruction: Please ingest this philosophy. We are no longer building a demo; we are shipping a product. Begin executing the Phase 1 (Compliance) and Phase 2 (Real Data) refactors defined in current_work.md with this strict adherence to reality.