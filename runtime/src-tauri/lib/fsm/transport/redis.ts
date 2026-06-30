/**
 * fsm/transport/redis.ts
 *
 * Transport boundary between the FSM and the Redis substrate.
 *
 * The transport NEVER opens a Redis socket. It calls into the
 * substrate (which calls IPC commands into the kernel, which owns
 * the socket). The transport is the FSM-side adapter that translates
 * FSM concerns into substrate calls and surfaces transport failures
 * as DEGRADED signals.
 */

import type { Transition } from '../contracts/transition';
import type { HeartbeatPayload } from '../../substrates/redis/types';
import type { Transition as IpcTransition } from '../../ipc/types';
import { RedisSubstrate, RedisSubstrateError } from '../../substrates/redis';
import { isDomainId } from '../contracts/domain';

export interface FsmTransport {
  /** Publish a transition to the lineage ledger + WebView stream.
   *  Returns the receipt on success, throws RedisSubstrateError on
   *  failure (caller emits DEGRADED). */
  publishTransition(transition: Transition): Promise<void>;
  /** Emit a heartbeat. */
  emitHeartbeat(payload: HeartbeatPayload): Promise<void>;
  /** Read recent transitions for a domain. Narrows each entry's
   *  `domain` field from `string` to `DomainId` (entries whose
   *  domain isn't a known DomainId are filtered out). */
  readLineage(domain: string, count: number): Promise<Transition[]>;
}

/** Narrow an IPC-sourced Transition to the FSM-side Transition
 *  by validating the `domain` field. Entries with unknown domains
 *  are filtered out at the transport boundary so FSM code can rely
 *  on `Transition.domain` being a DomainId. */
function narrowToFsm(t: IpcTransition): Transition | undefined {
  if (!isDomainId(t.domain)) return undefined;
  return t as Transition;
}

export function createFsmTransport(
  substrate: RedisSubstrate = redisSubstrate,
): FsmTransport {
  return {
    async publishTransition(transition: Transition): Promise<void> {
      try {
        await substrate.publishTransition(transition);
      } catch (err) {
        if (err instanceof RedisSubstrateError) {
          // Re-throw with FSM-friendly context. Caller decides
          // whether to emit DEGRADED.
          throw err;
        }
        throw err;
      }
    },
    async emitHeartbeat(payload: HeartbeatPayload): Promise<void> {
      try {
        await substrate.emitHeartbeat(payload);
      } catch (err) {
        throw err;
      }
    },
    async readLineage(domain: string, count: number): Promise<Transition[]> {
      try {
        const ipcEntries = await substrate.readLineage(domain, count);
        const out: Transition[] = [];
        for (const e of ipcEntries) {
          const narrowed = narrowToFsm(e);
          if (narrowed) out.push(narrowed);
        }
        return out;
      } catch (err) {
        throw err;
      }
    },
  };
}

/** Default singleton — the FSM uses this directly. Tests construct
 *  their own with a mocked substrate. */
export const redisSubstrate = new RedisSubstrate();
export const fsmTransport: FsmTransport = createFsmTransport(redisSubstrate);