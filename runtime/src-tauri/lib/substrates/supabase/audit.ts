/**
 * substrates/supabase/audit.ts
 *
 * Audit log substrate. Every domain-level mutation that needs an audit trail
 * emits through this. Writes to the `audit_log` table.
 *
 * Failure mode: audit emission errors are logged but never thrown. A failing
 * audit MUST NOT block a business mutation. The caller has already committed
 * the mutation; the audit is best-effort.
 */

import { supabase } from './client';
import type { Database } from './database.types';
import { recordSupabaseCall } from './emissions';

type Json = Database['public']['Tables']['audit_log']['Insert']['details'];

export interface AuditEventOptions {
  userId?: string | null;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  success?: boolean;
}

export const logAuditEvent = async (
  eventType: string,
  action: string,
  details?: unknown,
  options: AuditEventOptions = {},
): Promise<void> => {
  const t0 = Date.now();
  try {
    const detailPayload: Json =
      details === undefined || details === null
        ? null
        : (details as Json);

    const auditEntry = {
      user_id: options.userId || null,
      event_type: eventType,
      action: action,
      resource_type: options.resourceType || null,
      resource_id: options.resourceId || null,
      details: detailPayload,
      ip_address: options.ipAddress || 'web-client',
      user_agent:
        options.userAgent ||
        (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
      success: options.success !== false,
      error_message: options.errorMessage || null,
    };

    const { error } = await supabase.from('audit_log').insert([auditEntry]);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Audit log error:', error);
      recordSupabaseCall({
        op: 'audit_log',
        success: false,
        latency_ms: Date.now() - t0,
        error_kind: error.message,
      });
    } else {
      recordSupabaseCall({
        op: 'audit_log',
        success: true,
        latency_ms: Date.now() - t0,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to log audit event:', err);
    recordSupabaseCall({
      op: 'audit_log',
      success: false,
      latency_ms: Date.now() - t0,
      error_kind: String(err),
    });
  }
};
