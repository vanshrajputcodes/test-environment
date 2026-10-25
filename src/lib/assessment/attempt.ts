import { QUESTIONS, type Question } from "./questions";
import { APP } from "./config";

export interface Attempt {
  attemptId: string;
  questions: Question[];
  startedAt: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function createAttempt(): Attempt {
  const easy = shuffle(QUESTIONS.filter((q) => q.level === "easy")).slice(0, 3);
  const medium = shuffle(QUESTIONS.filter((q) => q.level === "medium")).slice(0, 2);
  return {
    attemptId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    questions: shuffle([...easy, ...medium]),
    startedAt: Date.now(),
  };
}

export const maxMarks = APP.maxMarks;
export const marksPerQuestion = APP.marksPerQuestion;
export const marksPerTestCase = APP.marksPerTestCase;
export const examDurationMs = APP.durationMinutes * 60 * 1000;
