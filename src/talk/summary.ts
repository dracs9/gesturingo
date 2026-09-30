import type { HintLogEntry } from "../recognition/letters/practice";
import type { Message } from "./conversationStore";

/** Prefix of the lesson id that practises given letters («Потренировать эти жесты»). */
export const PRACTICE_PREFIX = "practice-";

export interface ConversationSummary {
  /** Messages sent in signs / by the hearing person (voice or typed). */
  signed: number;
  heard: number;
  hints: number;
  cancels: number;
  deletes: number;
  /** Gestures that needed hints most often, as shown to the user. */
  needHelp: { gesture: string; hints: number }[];
  /** Letters among them that have a lesson (phrases are not taught in lessons). */
  practice: string[];
}

/**
 * The talk summary (docs/TRANSLATOR_SPEC.md §8). `displayName` turns a recognition label into what the
 * user saw (a phrase label → its text); `isLetter` tells which gestures can be practised in a lesson.
 */
export function summarizeConversation(
  input: { messages: readonly Message[]; hintLog: readonly HintLogEntry[]; cancels: number; deletes: number },
  displayName: (label: string) => string,
  isLetter: (label: string) => boolean,
  top = 4,
): ConversationSummary {
  const counts = new Map<string, number>();
  for (const h of input.hintLog) {
    if (!h.letter) continue;
    counts.set(h.letter, (counts.get(h.letter) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    signed: input.messages.filter((m) => m.side === "signer").length,
    heard: input.messages.filter((m) => m.side === "listener").length,
    hints: input.hintLog.length,
    cancels: input.cancels,
    deletes: input.deletes,
    needHelp: ranked.slice(0, top).map(([label, hints]) => ({ gesture: displayName(label), hints })),
    practice: ranked.map(([label]) => label).filter(isLetter).slice(0, top),
  };
}

/** Lesson id that practises exactly these letters. */
export function practiceLessonId(letters: readonly string[]): string {
  return `${PRACTICE_PREFIX}${letters.join("")}`;
}

/** Letters of a practice lesson id, or null if it is not one. */
export function practiceLetters(lessonId: string): string[] | null {
  return lessonId.startsWith(PRACTICE_PREFIX) ? Array.from(lessonId.slice(PRACTICE_PREFIX.length)) : null;
}
