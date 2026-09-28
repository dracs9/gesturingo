import { describe, expect, it } from 'vitest';
import {
  completeSession,
  dayKey,
  defaults,
  parseProgress,
  streak,
  type SessionRecord,
} from './state';

const record = (date: string, id = date): SessionRecord => ({
  id,
  date,
  courseId: 'first-signs',
  letters: ['L', 'V', 'Y'],
  assisted: 1,
  seconds: 72,
});

describe('progress recovery', () => {
  it('recovers from corrupt or outdated browser data', () => {
    expect(parseProgress('{broken')).toEqual(defaults);
    expect(parseProgress('{"version":99}')).toEqual(defaults);
  });
  it('filters invalid letters, duplicate completions and unsafe preference values', () => {
    const restored = parseProgress(
      JSON.stringify({
        version: 1,
        mastered: ['L', 'L', 'INVALID'],
        completedCourses: ['first-signs', 'first-signs', 'other'],
        history: [record('2026-09-28'), { ...record('2026-09-28'), seconds: -1 }],
        preferences: { name: 'a'.repeat(100), goal: 999, hand: 'anything', sound: 'yes' },
      }),
    );
    expect(restored.mastered).toEqual(['L']);
    expect(restored.completedCourses).toEqual(['first-signs']);
    expect(restored.history).toHaveLength(1);
    expect(restored.preferences).toMatchObject({ goal: 3, hand: 'right', sound: false });
    expect(restored.preferences.name).toHaveLength(32);
  });
});

describe('lesson completion', () => {
  it('does not double-award a repeated completion event', () => {
    const first = completeSession(structuredClone(defaults), record('2026-09-28', 'session-1'));
    const repeated = completeSession(first, record('2026-09-28', 'session-1'));
    expect(repeated).toBe(first);
    expect(repeated.mastered).toEqual(['L', 'V', 'Y']);
    expect(repeated.completedCourses).toEqual(['first-signs']);
    expect(repeated.history).toHaveLength(1);
  });
  it('a single-letter practice does not unlock a complete course', () => {
    const result = completeSession(structuredClone(defaults), {
      ...record('2026-09-28'),
      courseId: 'practice-L',
      letters: ['L'],
    });
    expect(result.mastered).toEqual(['L']);
    expect(result.completedCourses).toEqual([]);
  });
  it('repeating a course keeps unique letters while recording another practice', () => {
    const first = completeSession(structuredClone(defaults), record('2026-09-28', 'one'));
    const result = completeSession(first, record('2026-09-28', 'two'));
    expect(result.mastered).toHaveLength(3);
    expect(result.history).toHaveLength(2);
  });
});

describe('daily streak', () => {
  it('uses local calendar days and counts multiple sessions once per day', () => {
    const now = new Date(2026, 8, 28, 0, 1);
    expect(dayKey(now)).toBe('2026-09-28');
    expect(
      streak(
        [
          record('2026-09-28'),
          record('2026-09-28', 'again'),
          record('2026-09-27'),
          record('2026-09-26'),
        ],
        now,
      ),
    ).toBe(3);
  });
  it('keeps yesterday’s streak until the next practice and expires after a gap', () => {
    expect(streak([record('2026-09-27'), record('2026-09-26')], new Date(2026, 8, 28))).toBe(2);
    expect(streak([record('2026-09-26')], new Date(2026, 8, 28))).toBe(0);
  });
});
