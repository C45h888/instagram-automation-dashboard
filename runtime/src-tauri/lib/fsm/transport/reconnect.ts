/**
 * fsm/transport/reconnect.ts
 *
 * Heartbeat-driven DEGRADED observation. The FSM periodically emits
 * a heartbeat via the transport. If a heartbeat fails, the FSM
 * surfaces DEGRADED on the affected envelope; once heartbeats succeed
 * again, DEGRADED clears.
 *
 * This module owns the heartbeat scheduler and the health latch.
 * The FSM state machines observe the latch via callbacks.
 */

import type { HeartbeatPayload } from '../../substrates/redis/types';
import type { FsmTransport } from './redis';

export type HealthListener = (healthy: boolean, reason?: string) => void;

/** Default heartbeat interval. Spec value 2 seconds. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 2000;

export interface HeartbeatMonitor {
  /** Start emitting heartbeats for a domain at the configured interval. */
  start(domain: string, correlationId: string): void;
  /** Stop emitting heartbeats and clear the interval. */
  stop(): void;
  /** True when the last heartbeat succeeded. False after a failure
   *  until a subsequent success. */
  isHealthy(): boolean;
  /** Reason for the most recent failure, if any. */
  lastFailureReason(): string | undefined;
  /** Subscribe to health changes. */
  subscribe(listener: HealthListener): () => void;
}

class HeartbeatMonitorImpl implements HeartbeatMonitor {
  private readonly intervalMs: number;
  private readonly transport: FsmTransport;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private healthy = true;
  private lastFailure: string | undefined;
  private listeners: Set<HealthListener> = new Set();
  private domain: string | undefined;
  private correlationId: string | undefined;

  constructor(transport: FsmTransport, intervalMs: number = DEFAULT_HEARTBEAT_INTERVAL_MS) {
    if (intervalMs <= 0) {
      throw new Error(`HeartbeatMonitor interval must be > 0, got ${intervalMs}`);
    }
    this.transport = transport;
    this.intervalMs = intervalMs;
  }

  start(domain: string, correlationId: string): void {
    this.stop();
    this.domain = domain;
    this.correlationId = correlationId;
    // Fire one immediately so the latch starts in a known state.
    void this.tick();
    this.intervalId = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.domain = undefined;
    this.correlationId = undefined;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  lastFailureReason(): string | undefined {
    return this.lastFailure;
  }

  subscribe(listener: HealthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async tick(): Promise<void> {
    if (!this.domain || !this.correlationId) return;
    const payload: HeartbeatPayload = {
      correlation_id: this.correlationId,
      domain: this.domain,
      state: 'HEARTBEAT',
      observed_at_epoch_ms: Date.now(),
    };
    try {
      await this.transport.emitHeartbeat(payload);
      this.setHealthy(true);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.setHealthy(false, reason);
    }
  }

  private setHealthy(healthy: boolean, reason?: string): void {
    if (this.healthy === healthy && this.lastFailure === reason) return;
    this.healthy = healthy;
    this.lastFailure = healthy ? undefined : reason;
    for (const l of this.listeners) l(healthy, reason);
  }
}

export interface CreateHeartbeatMonitorOptions {
  intervalMs?: number;
}

export function createHeartbeatMonitor(
  transport: FsmTransport,
  opts: CreateHeartbeatMonitorOptions = {},
): HeartbeatMonitor {
  return new HeartbeatMonitorImpl(transport, opts.intervalMs);
}