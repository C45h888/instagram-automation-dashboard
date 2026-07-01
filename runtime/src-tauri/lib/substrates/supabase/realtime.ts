/**
 * substrates/supabase/realtime.ts
 *
 * Postgres Changes realtime subscription substrate. Returns a disposable
 * handle that controllers use to bind and unbind subscriptions.
 *
 * Usage pattern (controllers consume this):
 *
 *   const handle = subscribeToTable('system_alerts', (payload) => {
 *     slot.setState(prev => ({ alerts: [payload.new as SystemAlert, ...prev.alerts] }));
 *   }, `business_account_id=eq.${accountId}`);
 *
 *   dispose.add(() => handle.unsubscribe());
 *
 * Channels are named with a timestamp suffix so multiple subscriptions to
 * the same table coexist without collision.
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './client';
import type { Database } from './database.types';
import { recordSupabaseCall } from './emissions';

export interface SubscriptionOptions {
  onError?: (error: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export const subscribeToTable = <
  T extends keyof Database['public']['Tables'],
>(
  table: T,
  callback: (
    payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
  ) => void,
  filter?: string,
  options: SubscriptionOptions = {},
): RealtimeSubscription => {
  const t0 = Date.now();
  const channelName = `${String(table)}-changes-${Date.now()}`;

  let channel;
  try {
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table as string,
          filter,
        },
        (
          payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
        ) => {
          try {
            callback(payload);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Subscription callback error for ${table}:`, error);
            options.onError?.(error);
          }
        },
      )
      .subscribe((status) => {
        switch (status) {
          case 'SUBSCRIBED':
            // eslint-disable-next-line no-console
            console.log(`📡 Subscribed to ${table} changes`);
            recordSupabaseCall({
              op: 'realtime_subscribe',
              channel: channelName,
              table: String(table),
              success: true,
              latency_ms: Date.now() - t0,
            });
            options.onConnect?.();
            break;
          case 'CHANNEL_ERROR':
            // eslint-disable-next-line no-console
            console.error(`❌ Subscription error for ${table}`);
            recordSupabaseCall({
              op: 'realtime_subscribe',
              channel: channelName,
              table: String(table),
              success: false,
              latency_ms: Date.now() - t0,
              error_kind: 'CHANNEL_ERROR',
            });
            options.onError?.(new Error(`Subscription failed for ${table}`));
            break;
          case 'CLOSED':
            // eslint-disable-next-line no-console
            console.log(`🔌 Subscription to ${table} closed`);
            recordSupabaseCall({
              op: 'realtime_unsubscribe',
              channel: channelName,
              table: String(table),
              success: true,
              latency_ms: Date.now() - t0,
            });
            options.onDisconnect?.();
            break;
        }
      });
  } catch (e) {
    recordSupabaseCall({
      op: 'realtime_subscribe',
      channel: channelName,
      table: String(table),
      success: false,
      latency_ms: Date.now() - t0,
      error_kind: String(e),
    });
    throw e;
  }

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
};

export const subscribeToUserWorkflows = (
  userId: string,
  callback: (
    payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
  ) => void,
): RealtimeSubscription => {
  return subscribeToTable(
    'automation_workflows',
    callback,
    `user_id=eq.${userId}`,
  );
};

export const subscribeToWorkflowExecutions = (
  workflowId: string,
  callback: (
    payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
  ) => void,
): RealtimeSubscription => {
  return subscribeToTable(
    'workflow_executions',
    callback,
    `workflow_id=eq.${workflowId}`,
  );
};
