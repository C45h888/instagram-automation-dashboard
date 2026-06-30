/**
 * fsm/contracts/domain.ts
 *
 * DomainId — the canonical names of every domain the FSM governs.
 * Pass 1 governance scope (per FSM-GSC-2 §4.2):
 *   - analytics-reports
 *   - scheduled-posts
 *
 * Other domains (alerts, activity-feed, attribution, queue-monitor,
 * health, consent, privacy, business-accounts, dev-admin) are
 * scheduled for later passes; their DomainId values are reserved
 * here as a closed set so transitions can't reference unknown
 * domains at compile time.
 */

export type DomainId =
  | 'analytics-reports'
  | 'scheduled-posts'
  // Reserved for future passes; not used in Pass 1.
  | 'alerts'
  | 'activity-feed'
  | 'attribution'
  | 'queue-monitor'
  | 'health'
  | 'consent'
  | 'privacy'
  | 'business-accounts'
  | 'dev-admin';

/** Domains actively governed in Pass 1. */
export const PASS1_DOMAINS: ReadonlyArray<DomainId> = [
  'analytics-reports',
  'scheduled-posts',
] as const;

/** Type guard — true when a string is a known DomainId. */
export function isDomainId(s: string): s is DomainId {
  return (PASS1_DOMAINS as ReadonlyArray<string>).includes(s) ||
    [
      'alerts',
      'activity-feed',
      'attribution',
      'queue-monitor',
      'health',
      'consent',
      'privacy',
      'business-accounts',
      'dev-admin',
    ].includes(s);
}