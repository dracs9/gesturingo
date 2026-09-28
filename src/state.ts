import { letters, courses } from './data';

export const STORAGE_KEY = 'gesturingo.frontend.v1';
export type Preferences = {
  name: string;
  goal: number;
  sound: boolean;
  reducedMotion: boolean;
  hand: 'right' | 'left';
};
export type SessionRecord = {
  id: string;
  courseId: string;
  date: string;
  letters: string[];
  assisted: number;
  seconds: number;
};
export type Progress = {
  version: 1;
  mastered: string[];
  completedCourses: string[];
  history: SessionRecord[];
  preferences: Preferences;
};
export const defaults: Progress = {
  version: 1,
  mastered: [],
  completedCourses: [],
  history: [],
  preferences: { name: '', goal: 3, sound: false, reducedMotion: false, hand: 'right' },
};

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseProgress(raw: string | null): Progress {
  if (!raw) return structuredClone(defaults);
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1) return structuredClone(defaults);
    const knownLetters = new Set(letters.map((item) => item.id));
    const knownCourses = new Set<string>(courses.map((item) => item.id));
    const unique = (values: unknown, valid: Set<string>) =>
      Array.isArray(values)
        ? [
            ...new Set(
              values.filter((item): item is string => typeof item === 'string' && valid.has(item)),
            ),
          ]
        : [];
    const history = Array.isArray(value.history)
      ? value.history
          .filter(
            (item: SessionRecord) =>
              item &&
              typeof item.id === 'string' &&
              typeof item.courseId === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
              Array.isArray(item.letters) &&
              item.letters.length > 0 &&
              item.letters.every((letter) => knownLetters.has(letter)) &&
              Number.isFinite(item.seconds) &&
              item.seconds >= 0 &&
              Number.isInteger(item.assisted) &&
              item.assisted >= 0 &&
              item.assisted <= item.letters.length,
          )
          .slice(0, 100)
      : [];
    const prefs = value.preferences || {};
    return {
      version: 1,
      mastered: unique(value.mastered, knownLetters),
      completedCourses: unique(value.completedCourses, knownCourses),
      history,
      preferences: {
        name: typeof prefs.name === 'string' ? prefs.name.slice(0, 32) : '',
        goal: [3, 5, 10].includes(prefs.goal) ? prefs.goal : 3,
        sound: prefs.sound === true,
        reducedMotion: prefs.reducedMotion === true,
        hand: prefs.hand === 'left' ? 'left' : 'right',
      },
    };
  } catch {
    return structuredClone(defaults);
  }
}

export function completeSession(progress: Progress, record: SessionRecord): Progress {
  if (progress.history.some((item) => item.id === record.id)) return progress;
  const completedCourses = courses.some((course) => course.id === record.courseId)
    ? [...new Set([...progress.completedCourses, record.courseId])]
    : progress.completedCourses;
  return {
    ...progress,
    mastered: [...new Set([...progress.mastered, ...record.letters])],
    completedCourses,
    history: [record, ...progress.history].slice(0, 100),
  };
}

export function streak(history: SessionRecord[], now = new Date()): number {
  const dates = new Set(history.map((item) => item.date));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!dates.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.has(dayKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function minutes(seconds: number) {
  return seconds < 60
    ? `${Math.round(seconds)} сек`
    : `${Math.floor(seconds / 60)} мин ${Math.round(seconds % 60)} сек`;
}
