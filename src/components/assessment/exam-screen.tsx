import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  Play,
  Send,
  ShieldAlert,
  Timer,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { examDurationMs } from "@/lib/assessment/attempt";
import { APP, LANGS, type LangId } from "@/lib/assessment/config";
import { templateFor, type Question } from "@/lib/assessment/questions";
import { runQuestion } from "@/lib/assessment/runner-client";
import type { CaseResult } from "@/lib/assessment/worker-protocol";
import { useFaceProctor } from "@/hooks/use-face-proctor";
import { useProctor, type ProctorState } from "@/hooks/use-proctor";

export interface FinalQuestionResult {
  id: string;
  title: string;
  level: "easy" | "medium";
  language: string;
  marks: number;
  maxMarks: number;
  casesPassed: number;
  casesTotal: number;
  code: string;
}

export interface Candidate {
  name: string;
  email: string;
  whatsapp: string;
}

export interface FinishData {
  perQuestion: FinalQuestionResult[];
  terminated: boolean;
  proctor: ProctorState;
}

interface ExamScreenProps {
  candidate: Candidate;
  attemptId: string;
  questions: Question[];
  onFinish: (data: FinishData) => void;
}

interface QRun {
  lang: LangId;
  code: string;
  results: CaseResult[];
  status: string;
}

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function emptyResults(n: number): CaseResult[] {
  return Array.from({ length: n }, () => ({
    passed: false,
    actual: null,
    error: null,
    durationMs: 0,
  }));
}

export function ExamScreen({ candidate, questions, onFinish }: ExamScreenProps) {
  const [examActive, setExamActive] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lang, setLang] = useState<LangId>("javascript");
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<Record<string, QRun>>({});
  const [runningQid, setRunningQid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(examDurationMs);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [resultsHeight, setResultsHeight] = useState(220);

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = resultsHeight;
    const onMove = (ev: PointerEvent) => {
      const max = Math.max(160, window.innerHeight * 0.65);
      setResultsHeight(Math.min(max, Math.max(110, startH + (startY - ev.clientY))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "row-resize";
  };

  const submittingRef = useRef(false);
  const doSubmitRef = useRef<(terminated: boolean) => void>(() => {});
  const lastToasted = useRef(0);

  const question = questions[activeIdx]!;
  const currentCode = useMemo(
    () => codeMap[`${question.id}|${lang}`] ?? templateFor(question, lang),
    [codeMap, question, lang],
  );

  // ---- proctoring ----
  const { proctor, logViolation } = useProctor(examActive, () => doSubmitRef.current(true));
  const { videoRef, camStatus, camStatusText } = useFaceProctor(examActive, (type) =>
    logViolation(type, false),
  );

  const strikesBefore = useRef(0);
  useEffect(() => {
    const evs = proctor.events;
    if (evs.length === 0) return;
    const last = evs[evs.length - 1]!;
    if (last.at === lastToasted.current) return;
    lastToasted.current = last.at;
    const increased = proctor.strikes > strikesBefore.current;
    strikesBefore.current = proctor.strikes;
    toast.warning(last.label, {
      description: increased
        ? `Strike ${proctor.strikes}/${APP.maxStrikes} — the assessment ends automatically after ${APP.maxStrikes} strikes.`
        : "Recorded in your proctoring report. This is a warning, not a strike.",
    });
  }, [proctor.events, proctor.strikes]);

  // ---- timer ----
  useEffect(() => {
    if (!examActive) return;
    const deadline = Date.now() + examDurationMs;
    const iv = window.setInterval(() => {
      const rem = deadline - Date.now();
      setRemainingMs(Math.max(0, rem));
      if (rem <= 0) {
        clearInterval(iv);
        doSubmitRef.current(false);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [examActive]);

  const buildRequest = useCallback(
    (q: Question, l: LangId, code: string) => ({
      lang: l,
      code,
      fnName: q.fnName,
      params: q.params,
      returnType: q.returnType,
      orderInsensitive: !!q.orderInsensitive,
      cases: q.cases.map((c) => ({ args: c.args, expected: c.expected })),
    }),
    [],
  );

  const doRun = useCallback(
    async (q: Question, l: LangId, code: string) => {
      if (runningQid || submittingRef.current) return;
      setRunningQid(q.id);
      setRuns((prev) => ({
        ...prev,
        [q.id]: { lang: l, code, results: emptyResults(q.cases.length), status: "Starting…" },
      }));
      try {
        await runQuestion(
          buildRequest(q, l, code),
          (text) =>
            setRuns((prev) => {
              const run = prev[q.id];
              if (!run) return prev;
              return { ...prev, [q.id]: { ...run, status: text } };
            }),
          (i, r) =>
            setRuns((prev) => {
              const run = prev[q.id];
              if (!run) return prev;
              const results = [...run.results];
              results[i] = r;
              return { ...prev, [q.id]: { ...run, results } };
            }),
        );
      } finally {
        setRunningQid(null);
      }
    },
    [buildRequest, runningQid],
  );

  const doSubmit = useCallback(
    async (terminated: boolean) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      const perQuestion: FinalQuestionResult[] = [];
      for (const q of questions) {
        const cur = runs[q.id];
        const l = cur?.lang ?? lang;
        const code = codeMap[`${q.id}|${l}`] ?? templateFor(q, l);
        let results: CaseResult[] | null = cur && cur.code === code ? cur.results : null;
        if (!results) {
          results = await runQuestion(buildRequest(q, l, code));
        }
        const passed = results.filter((r) => r.passed).length;
        perQuestion.push({
          id: q.id,
          title: q.title,
          level: q.level,
          language: l,
          marks: passed * APP.marksPerTestCase,
          maxMarks: APP.marksPerQuestion,
          casesPassed: passed,
          casesTotal: q.cases.length,
          code,
        });
      }
      onFinish({ perQuestion, terminated, proctor });
    },
    [buildRequest, codeMap, lang, onFinish, proctor, questions, runs],
  );
  doSubmitRef.current = doSubmit;

  const liveMarks = Object.values(runs).reduce(
    (sum, run) => sum + run.results.filter((r) => r.passed).length * APP.marksPerTestCase,
    0,
  );

  const startExam = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* fullscreen may be blocked; proctor hook will record the violation */
    }
    setExamActive(true);
  };

  const setCode = (value: string) => {
    setCodeMap((prev) => ({ ...prev, [`${question.id}|${lang}`]: value }));
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = currentCode.slice(0, start) + "  " + currentCode.slice(end);
      setCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };

  const activeRun = runs[question.id];
  const lowTime = remainingMs < 10 * 60 * 1000;

  if (!examActive) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-lg border bg-card p-8 text-center shadow-xl">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">You&apos;re ready to begin</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The assessment runs in strict fullscreen with camera proctoring. Leaving fullscreen,
            switching tabs, or using copy/paste shortcuts records a strike — {APP.maxStrikes}{" "}
            strikes end your attempt. You have {APP.durationMinutes} minutes for{" "}
            {questions.length} problems worth {APP.maxMarks} marks.
          </p>
          <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-xs text-muted-foreground">
            <li>• 3 easy + 2 medium problems, 30 marks each, 6 marks per test case.</li>
            <li>• 5 test cases per problem (2 sample, 3 hidden).</li>
            <li>• Your answers are evaluated and submitted automatically at time-up.</li>
          </ul>
          <Button size="lg" className="mt-6 w-full" onClick={startExam}>
            Enter fullscreen &amp; start the timer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-screen flex-col no-select">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">ICC DSA Round</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            · {candidate.name}
          </span>
        </div>
        <div
          className={`ml-2 flex items-center gap-2 rounded-md border px-3 py-1 font-code text-sm ${
            lowTime ? "border-destructive/60 text-destructive" : "text-foreground"
          }`}
        >
          <Timer className="h-4 w-4" />
          {fmtTime(remainingMs)}
        </div>
        <div className="flex items-center gap-1.5" title={`Strikes: ${proctor.strikes}/${APP.maxStrikes}`}>
          {Array.from({ length: APP.maxStrikes }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                i < proctor.strikes ? "bg-destructive" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <Badge variant="secondary" className="font-code">
          {liveMarks} / {APP.maxMarks} marks
        </Badge>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowEndConfirm(true)} disabled={submitting}>
            <Send className="mr-1 h-3.5 w-3.5" />
            Finish &amp; submit
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr]">
        {/* Left: questions */}
        <aside className="flex min-h-0 flex-col border-r bg-sidebar">
          <div className="flex gap-1 border-b p-2">
            {questions.map((q, i) => {
              const run = runs[q.id];
              const passed = run ? run.results.filter((r) => r.passed).length : 0;
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveIdx(i)}
                  className={`flex-1 rounded-md border px-2 py-2 text-center text-xs transition-colors ${
                    i === activeIdx
                      ? "border-primary/60 bg-accent"
                      : "hover:bg-accent/60"
                  }`}
                >
                  <div className="font-semibold">Q{i + 1}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {q.level === "easy" ? "Easy" : "Med"}
                  </div>
                  {run && (
                    <div
                      className={`mt-0.5 text-[10px] font-code ${
                        passed === q.cases.length ? "text-success" : "text-warning"
                      }`}
                    >
                      {passed}/{q.cases.length}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold tracking-tight">{question.title}</h3>
              <Badge variant={question.level === "easy" ? "secondary" : "default"}>
                {question.level === "easy" ? "Easy" : "Medium"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {question.statement}
            </p>
            <div className="mt-4 rounded-md border bg-code-bg p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Function signature
              </div>
              <code className="font-code text-xs text-primary">
                {question.fnName}({question.params.map((p) => p.name).join(", ")})
              </code>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sample test cases
              </div>
              <ul className="space-y-2">
                {question.cases
                  .filter((c) => !c.hidden)
                  .map((c, i) => (
                    <li key={i} className="rounded-md border p-2 font-code text-xs">
                      <div className="text-muted-foreground">Input: {JSON.stringify(c.args)}</div>
                      <div className="text-muted-foreground">Output: {JSON.stringify(c.expected)}</div>
                    </li>
                  ))}
              </ul>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Hidden test cases are used for final scoring. Each passed case earns{" "}
              {APP.marksPerTestCase} marks.
            </p>
          </div>
        </aside>

        {/* Right: editor + results */}
        <main className="flex min-h-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-3 border-b px-3">
            <span className="text-xs text-muted-foreground">Language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as LangId)}
              className="h-7 rounded-md border bg-secondary px-2 text-xs text-secondary-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              className="ml-2"
              disabled={!!runningQid || submitting}
              onClick={() => doRun(question, lang, currentCode)}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              {runningQid === question.id ? "Evaluating…" : "Run all test cases"}
            </Button>
            {runningQid === question.id && activeRun && (
              <span className="font-code text-xs text-muted-foreground">{activeRun.status}</span>
            )}
          </div>

          <textarea
            value={currentCode}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            spellCheck={false}
            autoComplete="off"
            className="min-h-0 flex-1 resize-none border-b bg-code-bg p-4 font-code text-[13px] leading-relaxed text-foreground outline-none"
          />

          {/* Drag to resize the results pane */}
          <div
            onPointerDown={startResize}
            className="flex h-2.5 shrink-0 cursor-row-resize items-center justify-center bg-card"
            title="Drag to resize the results panel"
          >
            <div className="h-0.5 w-12 rounded-full bg-muted-foreground/40 transition-colors hover:bg-muted-foreground/70" />
          </div>

          <div
            className="shrink-0 overflow-y-auto p-3"
            style={{ height: `${resultsHeight}px` }}
          >
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Results
            </div>
            {!activeRun && (
              <p className="text-sm text-muted-foreground">
                Run your code to see test case results. Cases are re-evaluated automatically at
                submission.
              </p>
            )}
            {activeRun && (
              <ul className="space-y-1.5">
                {question.cases.map((c, i) => {
                  const r = activeRun.results[i]!;
                  const pending = runningQid === question.id && !r.error && !r.passed && r.durationMs === 0;
                  return (
                    <li key={i} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center gap-2">
                        {r.passed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <span className="font-medium">Case {i + 1}</span>
                        {c.hidden ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Eye className="h-3 w-3" /> Hidden
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Sample
                          </Badge>
                        )}
                        {r.durationMs > 0 && (
                          <span className="font-code text-[10px] text-muted-foreground">
                            {r.durationMs} ms
                          </span>
                        )}
                        {pending && <span className="text-[10px] text-muted-foreground">running…</span>}
                      </div>
                      {!c.hidden && (
                        <div className="mt-1 font-code text-[11px] text-muted-foreground">
                          <div>Expected: {JSON.stringify(c.expected)}</div>
                          {r.actual !== null && !r.passed && <div>Actual: {r.actual}</div>}
                        </div>
                      )}
                      {r.error && (
                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-code text-[11px] text-destructive">
                          {r.error}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </main>
      </div>

      {/* Floating camera preview */}
      <div className="fixed bottom-4 right-4 z-40 w-44 overflow-hidden rounded-lg border-2 bg-card shadow-xl">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="aspect-[4/3] w-full scale-x-[-1] object-cover"
        />
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              camStatus === "ok"
                ? "bg-success"
                : camStatus === "warn" || camStatus === "error"
                  ? "bg-destructive"
                  : "bg-warning"
            }`}
          />
          <span className="truncate text-[10px] text-muted-foreground">{camStatusText}</span>
        </div>
      </div>

      {/* Submit confirm */}
      {showEndConfirm && !submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <div className="mb-2 flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-warning" />
              <h3 className="font-semibold tracking-tight">Finish and submit?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Unrun answers are evaluated automatically. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowEndConfirm(false)}>
                Keep working
              </Button>
              <Button size="sm" onClick={() => doSubmit(false)}>
                Submit now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluating overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium">Evaluating your answers securely…</p>
            <p className="mt-1 text-xs text-muted-foreground">Please keep this tab open.</p>
          </div>
        </div>
      )}
    </div>
  );
}
