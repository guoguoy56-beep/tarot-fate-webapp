export const MAX_READING_QUESTION_CHARACTERS = 500;
export const MAX_READING_REQUEST_BYTES = 4 * 1024;

export function normalizeReadingQuestion(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function countReadingQuestionCharacters(value: string) {
  return Array.from(value).length;
}
