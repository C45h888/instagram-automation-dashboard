/**
 * substrates/redis/index.ts
 *
 * Redis transport substrate — semantically blind adapter over the
 * kernel-owned Redis socket.
 *
 * Direction: fsm/ → substrates/redis/, NEVER substrates → fsm/.
 *
 * This substrate knows nothing about FSM, domains, substates, or
 * governance. It exposes typed intent → typed receipt methods.
 * Domain semantics live in the FSM; transport lives here.
 *
 * Errors thrown by the underlying IPC commands are caught and mapped
 * to `RedisSubstrateError` so the FSM can decide whether to surface
 * DEGRADED or treat it as terminal.
 */

export * from './types';
export * from './errors';
export { RedisSubstrate } from './substrate';