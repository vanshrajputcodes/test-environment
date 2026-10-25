import { APP, type LangId } from "./config";
import type { CaseResult, RunRequest, WorkerOut } from "./worker-protocol";
import JsWorker from "./workers/js.worker?worker";
import PythonWorker from "./workers/python.worker?worker";
import CppWorker from "./workers/cpp.worker?worker";
import JavaWorker from "./workers/java.worker?worker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WORKER_FILE: Record<LangId, any> = {
  javascript: JsWorker,
  python: PythonWorker,
  cpp: CppWorker,
  c: CppWorker,
  java: JavaWorker,
};

function timeoutResult(): CaseResult {
  return {
    passed: false,
    actual: null,
    error: `Time limit exceeded (${APP.caseTimeoutMs / 1000}s per test case).`,
    durationMs: APP.caseTimeoutMs,
  };
}

export async function runQuestion(
  req: RunRequest,
  onStatus?: (text: string) => void,
  onCase?: (index: number, result: CaseResult) => void,
): Promise<CaseResult[]> {
  const WorkerFactory = WORKER_FILE[req.lang];
  const worker = new WorkerFactory();
  return new Promise<CaseResult[]>((resolve) => {
    const results: CaseResult[] = req.cases.map(() => ({ ...timeoutResult() }));
    let nextIndex = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (timer) clearTimeout(timer);
      worker.terminate();
      resolve(results);
    };

    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(finish, APP.caseTimeoutMs + 2000);
    };

    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const m = ev.data;
      if (m.type === "status") {
        onStatus?.(m.text);
        return;
      }
      if (m.type === "case") {
        const r: CaseResult = {
          passed: m.passed,
          actual: m.actual,
          error: m.error,
          durationMs: m.durationMs,
        };
        if (m.index >= nextIndex) {
          for (let i = nextIndex; i < m.index; i++) {
            const tr = timeoutResult();
            results[i] = tr;
            onCase?.(i, tr);
          }
          nextIndex = m.index + 1;
        }
        results[m.index] = r;
        onCase?.(m.index, r);
        arm();
        return;
      }
      if (m.type === "done") finish();
    };
    worker.onerror = () => {
      for (let i = nextIndex; i < results.length; i++) {
        const tr: CaseResult = {
          passed: false,
          actual: null,
          error: "The evaluation environment crashed. Try running again.",
          durationMs: 0,
        };
        results[i] = tr;
        onCase?.(i, tr);
      }
      finish();
    };

    arm();
    worker.postMessage(req);
  });
}
