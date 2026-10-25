// Local-only verified-results store: everything lives in this browser's
// localStorage — no backend, no database. The evaluator pastes result codes
// one by one on the checker page; each verified payload is saved here and
// can later be exported as a single Excel sheet.
import type { FinalPayload } from "@/components/assessment/assessment-app";

export interface StoredResult {
  savedAt: string;
  payload: FinalPayload;
}

export const RESULTS_KEY = "icc-assessment-results-store";

export function loadResults(): StoredResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RESULTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r === "object" && r.payload) as StoredResult[];
  } catch {
    // unreadable/corrupt storage: start empty rather than crash the checker
    return [];
  }
}

// Upserts by attemptId so re-verifying the same code updates its row instead
// of duplicating it. Returns the new list; caller owns state updates.
export function saveResult(payload: FinalPayload, existing?: StoredResult[]): StoredResult[] {
  const list = existing ?? loadResults();
  const entry: StoredResult = { savedAt: new Date().toISOString(), payload };
  const next = list.filter((r) => r.payload.attemptId !== payload.attemptId);
  next.push(entry);
  persist(next);
  return next;
}

export function removeResult(attemptId: string, existing?: StoredResult[]): StoredResult[] {
  const list = existing ?? loadResults();
  const next = list.filter((r) => r.payload.attemptId !== attemptId);
  persist(next);
  return next;
}

export function clearResults(): void {
  persist([]);
}

function persist(list: StoredResult[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESULTS_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable: rows stay in memory for this session only
  }
}

const HEADERS = [
  "Attempt ID",
  "Name",
  "Email",
  "WhatsApp",
  "Submitted At",
  "Status",
  "Score",
  "Max Marks",
  "Cases Passed",
  "Cases Total",
  "Pass %",
  "Strikes",
  "Tab Switches",
  "Fullscreen Exits",
  "Paste Blocks",
  "Shortcut Blocks",
  "Camera Alerts",
] as const;

function countCases(p: FinalPayload) {
  const passed = p.perQuestion.reduce((s, q) => s + q.casesPassed, 0);
  const total = p.perQuestion.reduce((s, q) => s + q.casesTotal, 0);
  return { passed, total };
}

export function buildResultRows(results: StoredResult[]): (string | number)[][] {
  const rows: (string | number)[][] = [[...HEADERS]];
  for (const { payload: p } of results) {
    const { passed, total } = countCases(p);
    rows.push([
      p.attemptId,
      p.candidate.name,
      p.candidate.email,
      p.candidate.whatsapp,
      new Date(p.submittedAt).toLocaleString(),
      p.terminated ? "Terminated" : "Completed",
      p.totalMarks,
      p.maxMarks,
      passed,
      total,
      total > 0 ? Math.round((passed / total) * 100) : 0,
      p.violations.strikes,
      p.violations.tabSwitches,
      p.violations.fullscreenExits,
      p.violations.pasteBlocks,
      p.violations.shortcutBlocks,
      p.violations.cameraAlerts,
    ]);
  }
  return rows;
}

export function buildQuestionRows(results: StoredResult[]): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Attempt ID", "Name", "Question", "Level", "Language", "Cases Passed", "Cases Total", "Marks", "Max Marks"],
  ];
  for (const { payload: p } of results) {
    for (const q of p.perQuestion) {
      rows.push([
        p.attemptId,
        p.candidate.name,
        q.title,
        q.level,
        q.language,
        q.casesPassed,
        q.casesTotal,
        q.marks,
        q.maxMarks,
      ]);
    }
  }
  return rows;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
