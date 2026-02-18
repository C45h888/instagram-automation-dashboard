DLQ Auth Failure Alerting — Codebase Audit Report
1. What Exists Today
Error categorization is implemented. The queue worker at queue_worker.py:322-329 accepts error_category with 'auth_failure' as a documented value. The backend response body drives this — see queue_worker.py:172-173 where retryable and error_category are parsed from the HTTP error response JSON.

Non-retryable fast path works. When retryable=False (as it would be for auth_failure), the job goes straight to DLQ at queue_worker.py:348-353 — no retry budget consumed. This is correct behavior.

DLQ persistence is dual-write. OutboundQueue.move_to_dlq() at outbound_queue.py:303-341 writes to both Redis sorted set (outbound:dlq) and Supabase (outbound_queue_jobs with status="dlq"). The Supabase write is the permanent record.

DLQ inspection endpoints exist. queue_routes.py:35-44 exposes GET /queue/dlq (auth required) and POST /queue/retry-dlq for manual re-enqueue. The DLQ is queryable from the dashboard today.

Audit log captures DLQ events. At queue_worker.py:362-377, every DLQ move logs to audit_log with event_type="outbound_job_dlq", including error_category and business_account_id.

Metrics track DLQ depth. OUTBOUND_QUEUE_DLQ counter at metrics.py:223 and OUTBOUND_QUEUE_DEPTH gauge with queue="dlq" label at outbound_queue.py:401.

2. What's Missing (The Gaps)
Gap	Impact	Severity
No system_alerts table	No durable alerting mechanism exists. system_alerts is not referenced anywhere in the codebase.	High
No is_connected = false on auth failure	The account keeps being picked up by all schedulers. get_active_business_accounts() at supabase_service.py:496 filters on is_connected=True — but nothing ever sets it to false on auth failure.	Critical
No auth-failure-specific handling in _on_failure()	The method treats all non-retryable errors identically at queue_worker.py:346-379. There's no if error_category == 'auth_failure': branch to trigger account disconnection or alerting.	High
DLQ retry blindly re-enqueues auth failures	POST /queue/retry-dlq at queue_routes.py:47-103 resets all DLQ jobs to pending without checking whether the underlying auth issue is resolved. Auth-failure jobs will immediately fail again.	Medium
No cascade prevention	Once one job hits auth failure, all subsequent jobs for that business_account_id continue being dispatched, fail instantly, and flood the DLQ. Nothing pauses the account.	Critical
No frontend notification	No toast, banner, or alert surface exists. The only visibility is GET /queue/dlq which returns raw JSON — no filtering by error_category or business_account_id.	Medium
3. The Cascade Problem — Traced in Code
Here's the exact failure cascade:

Backend returns {"retryable": false, "error_category": "auth_failure"} for an expired IG token
queue_worker.py:348-353 sends job to DLQ — correct
But is_connected stays true in instagram_business_accounts
All schedulers (engagement_monitor, content_scheduler, ugc_discovery, analytics_reports) continue generating work for this account because get_active_business_accounts() at supabase_service.py:496 still returns it
New jobs are enqueued, dispatched, and immediately fail with auth_failure → DLQ
DLQ fills with one account's jobs. Nobody is notified.
4. What the Code Needs
Based on the gaps mapped above, the minimal changes would be:

In _on_failure() (queue_worker.py:346) — after the DLQ write for non-retryable jobs, add an auth_failure-specific branch that:

Sets is_connected = false on the business account in Supabase
Writes to a system_alerts table (new table, needs migration)
Logs a distinct audit event (e.g., event_type="auth_failure_detected")
In retry_dlq (queue_routes.py:47) — check whether the account's is_connected has been restored before re-enqueuing auth-failure jobs.

In get_dlq (queue_routes.py:35) — add optional ?error_category=auth_failure and ?business_account_id= query filters so the dashboard can surface targeted alerts.

5. Existing Infrastructure That Can Be Leveraged
SupabaseService._execute_query() — circuit-broken DB writes, ready to use for system_alerts inserts
SupabaseService.log_decision() — audit logging already called from _on_failure(), pattern can be extended
get_active_business_accounts() already filters on is_connected=True — flipping this flag is the single most impactful change to stop the cascade
Redis is available for real-time "account blacklist" if you want sub-second cascade prevention before the Supabase write propagates