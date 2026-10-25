/// <reference lib="webworker" />
import { resultsEqual } from "../harness";
import type { RunRequest, WorkerOut } from "../worker-protocol";

const ctx = self as unknown as Worker;
const post = (m: WorkerOut) => ctx.postMessage(m);

ctx.onmessage = async (ev: MessageEvent<RunRequest>) => {
  const req = ev.data;
  let fn: ((...args: unknown[]) => unknown) | null = null;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function(`${req.code}\n;return ${req.fnName};`)() as (...args: unknown[]) => unknown;
  } catch (e) {
    post({ type: "status", text: "Code did not compile" });
    for (let i = 0; i < req.cases.length; i++) {
      post({
        type: "case",
        index: i,
        passed: false,
        actual: null,
        error: `Code error: ${e instanceof Error ? e.message : String(e)}`,
        durationMs: 0,
      });
    }
    post({ type: "done" });
    return;
  }
  if (typeof fn !== "function") {
    for (let i = 0; i < req.cases.length; i++) {
      post({
        type: "case",
        index: i,
        passed: false,
        actual: null,
        error: `Function ${req.fnName} not found. Keep the provided function name.`,
        durationMs: 0,
      });
    }
    post({ type: "done" });
    return;
  }
  for (let i = 0; i < req.cases.length; i++) {
    const c = req.cases[i]!;
    const t0 = performance.now();
    let actual: unknown;
    let error: string | null = null;
    try {
      actual = fn(...c.args);
    } catch (e) {
      error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    const durationMs = Math.round(performance.now() - t0);
    let passed = false;
    if (error === null) passed = resultsEqual(actual, c.expected, req.orderInsensitive);
    post({
      type: "case",
      index: i,
      passed,
      actual: error === null ? JSON.stringify(actual) ?? "undefined" : null,
      error,
      durationMs,
    });
  }
  post({ type: "done" });
};
