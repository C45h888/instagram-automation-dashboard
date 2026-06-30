/**
 * fsm/transport/rehydrate.ts
 *
 * Boot-time FSM state recovery. The local telemetry plane is empty
 * at boot; the FSM NEVER trusts local state across reboots. State is
 * reconstructed from the canonical Redis lineage ledger via the
 * transport's rehydrate() call.
 */

import type { DomainId } from '../contracts/domain';
import type { Transition } from '../contracts/transition';
import type { FsmTransport } from './redis';

export interface RehydrateResult {
  readonly domain: DomainId;
  readonly currentState: string;
  readonly transitionCount: number;
}

/** Read recent transitions for a domain and compute the rehydrated state. */
export async function rehydrateDomain(
  domain: DomainId,
  transport: FsmTransport,
  count: number = 1024,
): Promise<RehydrateResult> {
  const transitions = await transport.readLineage(domain, count);
  const currentState = transitions.length > 0
    ? transitions[transitions.length - 1].to_state
    : 'IDLE';
  return {
    domain,
    currentState,
    transitionCount: transitions.length,
  };
}

/** Helper used by tests to assert rehydrate ignores corrupt entries
 *  silently — the substrate already filters, but the FSM should also
 *  be defensive about malformed transition records. */
export function findLatestValidState(transitions: ReadonlyArray<Transition>): string {
  for (let i = transitions.length - 1; i >= 0; i -= 1) {
    const t = transitions[i];
    if (typeof t.to_state === 'string' && t.to_state.length > 0) {
      return t.to_state;
    }
  }
  return 'IDLE';
}