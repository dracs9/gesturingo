import type { LessonResult } from "../../store/lessonRun";
import { XP_PER_STAR } from "../../store/progressLogic";

export interface LessonSummary {
  stars: number;
  maxStars: number;
  /** 0..100: stars earned out of the maximum. */
  accuracy: number;
  hints: number;
  xp: number;
  /** Most frequent hints, most common first. */
  topErrors: Array<{ hintCode: string; count: number }>;
}

export function summarizeLesson(result: LessonResult, topN = 3): LessonSummary {
  const stars = result.letters.reduce((sum, l) => sum + l.stars, 0);
  const maxStars = result.letters.length * 3;
  const counts = new Map<string, number>();
  for (const { hintCode } of result.hintLog) counts.set(hintCode, (counts.get(hintCode) ?? 0) + 1);
  const topErrors = [...counts.entries()]
    .map(([hintCode, count]) => ({ hintCode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return {
    stars,
    maxStars,
    accuracy: maxStars > 0 ? Math.round((stars / maxStars) * 100) : 0,
    hints: result.hintLog.length,
    xp: stars * XP_PER_STAR,
    topErrors,
  };
}
