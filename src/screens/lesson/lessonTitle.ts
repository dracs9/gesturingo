import { lessonNumber } from "../../data/lessons";
import { strings } from "../../data/strings.ru";
import { REVIEW_LESSON_ID } from "../../store/progressLogic";

export function lessonTitle(lessonId: string): string {
  return lessonId === REVIEW_LESSON_ID ? strings.review.title : strings.lesson.title(lessonNumber(lessonId));
}
