import { lessonNumber } from "../../data/lessons";
import { strings } from "../../data/strings.ru";
import { REVIEW_LESSON_ID } from "../../store/progressLogic";
import { PRACTICE_PREFIX } from "../../talk/summary";

export function lessonTitle(lessonId: string): string {
  if (lessonId === REVIEW_LESSON_ID) return strings.review.title;
  if (lessonId.startsWith(PRACTICE_PREFIX)) return strings.talkSummary.practiceTitle;
  return strings.lesson.title(lessonNumber(lessonId));
}
