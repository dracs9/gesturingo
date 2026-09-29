/**
 * Holds a value until a new candidate has persisted for `holdMs`.
 * `update` returns the current stable value.
 */
export interface StableValue<T> {
  update(candidate: T, now: number): T;
  readonly value: T;
}

export function createStableValue<T>(initial: T, holdMs: number): StableValue<T> {
  let value = initial;
  let candidate = initial;
  let candidateSince = 0;

  return {
    update(next, now) {
      if (next === value) {
        candidate = value;
        return value;
      }
      if (next !== candidate) {
        candidate = next;
        candidateSince = now;
      }
      if (now - candidateSince >= holdMs) value = candidate;
      return value;
    },
    get value() {
      return value;
    },
  };
}
