import { describe, it, expect, beforeEach } from "vitest";
import {
  RESULTS_KEY,
  loadResults,
  saveResult,
  removeResult,
  clearResults,
  buildResultRows,
  buildQuestionRows,
} from "@/lib/assessment/results-store";
import type { FinalPayload } from "@/components/assessment/assessment-app";

function makePayload(over: Partial<FinalPayload> = {}): FinalPayload {
  return {
    attemptId: "a1b2c3d4-1111-2222-3333-444455556666",
    candidate: { name: "Priya Sharma", email: "priya@example.com", whatsapp: "9876543210" },
    submittedAt: "2026-10-25T10:00:00.000Z",
    terminated: false,
    totalMarks: 90,
    maxMarks: 150,
    perQuestion: [
      {
        id: "easy-1",
        title: "Two Sum",
        level: "easy",
        language: "javascript",
        casesPassed: 5,
        casesTotal: 5,
        marks: 30,
        maxMarks: 30,
        code: "console.log(1)",
      },
      {
        id: "med-1",
        title: "LRU Cache",
        level: "medium",
        language: "python",
        casesPassed: 4,
        casesTotal: 5,
        marks: 24,
        maxMarks: 30,
        code: "print(1)",
      },
    ],
    violations: {
      strikes: 0,
      tabSwitches: 1,
      fullscreenExits: 0,
      pasteBlocks: 2,
      shortcutBlocks: 0,
      cameraAlerts: 1,
      log: [],
    },
    ...over,
  };
}

describe("local results store (no database)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves verified results into localStorage under the fixed key", () => {
    const p = makePayload();
    saveResult(p);
    const raw = localStorage.getItem(RESULTS_KEY);
    expect(raw).not.toBeNull();
    expect(loadResults()).toHaveLength(1);
    expect(loadResults()[0]!.payload.candidate.name).toBe("Priya Sharma");
  });

  it("keeps one row per attempt: re-verifying updates instead of duplicating", () => {
    saveResult(makePayload({ totalMarks: 80 }));
    saveResult(makePayload({ totalMarks: 90 }));
    const list = loadResults();
    expect(list).toHaveLength(1);
    expect(list[0]!.payload.totalMarks).toBe(90);
  });

  it("stores multiple candidates in order", () => {
    saveResult(makePayload());
    saveResult(makePayload({ attemptId: "zzzz9999-1111-2222-3333-444455556666", candidate: { name: "Ravi Kumar", email: "ravi@example.com", whatsapp: "9123456780" } }));
    const list = loadResults();
    expect(list).toHaveLength(2);
    expect(list[1]!.payload.candidate.name).toBe("Ravi Kumar");
  });

  it("removes a single result and clears everything", () => {
    saveResult(makePayload());
    saveResult(makePayload({ attemptId: "zzzz9999-1111-2222-3333-444455556666" }));
    removeResult("zzzz9999-1111-2222-3333-444455556666");
    expect(loadResults()).toHaveLength(1);
    clearResults();
    expect(loadResults()).toHaveLength(0);
    expect(localStorage.getItem(RESULTS_KEY)).toBe("[]");
  });

  it("excel rows carry the candidate's score and proctoring counts", () => {
    const rows = buildResultRows([{ savedAt: "2026-10-25T10:05:00.000Z", payload: makePayload() }]);
    expect(rows).toHaveLength(2); // header + 1 candidate
    const header = rows[0] as string[];
    expect(header[0]).toBe("Attempt ID");
    expect(header).toContain("Score");
    const row = rows[1]!;
    expect(row[0]).toBe("a1b2c3d4-1111-2222-3333-444455556666");
    expect(row[1]).toBe("Priya Sharma");
    expect(row[6]).toBe(90); // Score
    expect(row[11]).toBe(0); // Strikes
    expect(row[12]).toBe(1); // Tab Switches
    expect(row[14]).toBe(2); // Paste Blocks
    expect(row[10]).toBe(90); // Pass % = 9/10 cases
  });

  it("question sheet has one row per question with marks", () => {
    const rows = buildQuestionRows([{ savedAt: "2026-10-25T10:05:00.000Z", payload: makePayload() }]);
    expect(rows).toHaveLength(3); // header + 2 questions
    const qRow = rows[2]!;
    expect(qRow[2]).toBe("LRU Cache");
    expect(qRow[5]).toBe(4); // cases passed
    expect(qRow[7]).toBe(24); // marks
  });
});
