/// <reference lib="webworker" />
import { resultsEqual } from "../harness";
import type { RunRequest, WorkerOut } from "../worker-protocol";

const ctx = self as unknown as Worker;
const post = (m: WorkerOut) => ctx.postMessage(m);

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodide: any = null;

async function getPyodide(): Promise<any> {
  if (!pyodide) {
    post({ type: "status", text: "Preparing Python environment…" });
    const mod = await import(/* @vite-ignore */ PYODIDE_URL);
    pyodide = await mod.loadPyodide();
  }
  return pyodide;
}

ctx.onmessage = async (ev: MessageEvent<RunRequest>) => {
  const req = ev.data;
  let py: any;
  try {
    py = await getPyodide();
  } catch (e) {
    for (let i = 0; i < req.cases.length; i++) {
      post({
        type: "case",
        index: i,
        passed: false,
        actual: null,
        error: "Python runtime could not be loaded. Check your connection and try again.",
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
      const script = `${req.code}\n__icc_result = __import__("json").dumps(${req.fnName}(*__import__("json").loads(${JSON.stringify(
        JSON.stringify(c.args),
      )})))`;
      py.runPython(script);
      actual = JSON.parse(py.globals.get("__icc_result") as string);
    } catch (e) {
      error = e instanceof Error ? e.message.replace(/\n+/g, " ").slice(0, 500) : String(e);
    }
    const durationMs = Math.round(performance.now() - t0);
    post({
      type: "case",
      index: i,
      passed: error === null && resultsEqual(actual, c.expected, req.orderInsensitive),
      actual: error === null ? JSON.stringify(actual) ?? "undefined" : null,
      error,
      durationMs,
    });
  }
  post({ type: "done" });
};
