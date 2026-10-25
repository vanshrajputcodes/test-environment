export const APP = {
  durationMinutes: 150,
  marksPerQuestion: 30,
  marksPerTestCase: 6,
  maxMarks: 150,
  caseTimeoutMs: 8000,
  maxStrikes: 3,
  certificateThreshold: 0.5,
  // Result email goes ONLY here: To + CC below, nowhere else.
  evaluatorEmail: "resultsubmission@hackthefuture.co.in",
  evaluatorCcEmail: "hackthefuture.in@gmail.com",
  emailSubjectPrefix: "[ICC Assessment Result]",
};

export const LANGS = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "java", label: "Java" },
] as const;

export type LangId = (typeof LANGS)[number]["id"];
