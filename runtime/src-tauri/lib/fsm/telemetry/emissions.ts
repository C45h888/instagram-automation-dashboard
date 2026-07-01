/**
 * fsm/telemetry/emissions.ts
 *
 * The single recording helper every emissions.ts file uses.
 * Wraps `LocalTelemetryPlane.recordTransition` with the canonical
 * LineageEntry shape and a monotonic-per-domain entry id.
 *
 * Direction: emissions.ts files → fsm/telemetry/emissions.ts.
 * fsm/telemetry/ does not depend on emissions.ts.
 */

import { LocalTelemetryPlane } from './plane';
import type { LineageEntry } from '../contracts/lineage-entry';
import type { DomainId } from '../contracts/domain';

/** Get the global plane singleton. Initialised lazily on first call
 *  from `installEmissionsPlane` at app boot. Tests construct their
 *  own plane and pass it in via `setEmissionsPlane`. */
let _plane: LocalTelemetryPlane | null = null;

export function installEmissionsPlane(plane: LocalTelemetryPlane): void {
  _plane = plane;
}

export function setEmissionsPlane(plane: LocalTelemetryPlane | null): void {
  _plane = plane;
}

export function getEmissionsPlane(): LocalTelemetryPlane {
  if (!_plane) {
    // Lazy default — used during tests and at boot before the FsmKernel
    // is constructed. Capacity 1024 per FSM spec.
    _plane = new LocalTelemetryPlane();
  }
  return _plane;
}

/** Canonical "record one call" helper. Fire-and-forget; never throws.
 *  The plane is the FSM's local projection (per FSM-GSC-1 §4). */
export function recordEmission(args: {
  domain: DomainId;
  fromState: string;
  toState: string;
  event: string;
  payload?: Record<string, unknown>;
}): void {
  const plane = getEmissionsPlane();
  const entryId = plane.nextEntryId(args.domain);
  const now = Date.now();
  const entry: LineageEntry = {
    entryId,
    transition: {
      transition_id: crypto.randomUUID(),
      correlation_id: getCorrelationId(),
      domain: args.domain,
      from_state: args.fromState,
      to_state: args.toState,
      event: args.event,
      payload: args.payload ?? null,
      occurred_at_epoch_ms: now,
    },
    bufferedAtEpochMs: now,
  };
  plane.recordTransition(entry);
}

/** Per-boot correlation id. Defaults to a stable placeholder until
 *  the FsmKernel wires the real runtime_get_correlation_id value. */
let _correlationId = 'uninitialised';

export function setEmissionCorrelationId(cid: string): void {
  _correlationId = cid;
}

function getCorrelationId(): string {
  return _correlationId;
}