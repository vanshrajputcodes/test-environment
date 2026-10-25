/// <reference lib="webworker" />
import { WASI, OpenFile, File, ConsoleStdout } from "@bjorn3/browser_wasi_shim";
import { buildCHarness, buildCppHarness, resultsEqual } from "../harness";
import type { RunRequest, WorkerOut } from "../worker-protocol";

const ctx = self as unknown as Worker;
const post = (m: WorkerOut) => ctx.postMessage(m);

const CLANG_URL = "https://cdn.jsdelivr.net/npm/@yowasp/clang/gen/bundle.js";
const OUT = "prog.wasm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clangCommands: any = null;

async function getClang(): Promise<any> {
  if (!clangCommands) {
    post({ type: "status", text: "Preparing compiler…" });
    const mod = await import(/* @vite-ignore */ CLANG_URL);
    clangCommands = mod.commands;
  }
  return clangCommands;
}

ctx.onmessage = async (ev: MessageEvent<RunRequest>) => {
  const req = ev.data;
  const qMeta = {
    fnName: req.fnName,
    params: req.params,
    returnType: req.returnType,
  };
  const isCpp = req.lang === "cpp";
  const srcName = isCpp ? "main.cc" : "main.c";
  const fullSrc = isCpp ? buildCppHarness(qMeta, req.code) : buildCHarness(qMeta, req.code);

  let wasmBytes: Uint8Array | null = null;
  let stderrText = "";
  try {
    const commands = await getClang();
    post({ type: "status", text: "Compiling your code…" });
    const files = await commands[isCpp ? "clang++" : "clang"](
      [srcName, "-o", OUT, "-fno-exceptions"],
      // sources must be bytes: the runtime decodes string entries and crashes
      { [srcName]: new TextEncoder().encode(fullSrc), [OUT]: new Uint8Array(0) },
      {
        decodeASCII: true,
        stderr: (bytes: unknown) => {
          // yowasp delivers stderr chunks as strings, bytes, or null (flush)
          if (bytes == null) return;
          stderrText += typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes as Uint8Array);
        },
      },
    );
    const out = files?.[OUT];
    if (!(out instanceof Uint8Array) || out.length === 0) {
      throw new Error(stderrText.trim().slice(-1200) || "Compilation produced no output.");
    }
    wasmBytes = out;
  } catch (e) {
    const base = e instanceof Error && e.message ? e.message : "Compilation failed for an unknown reason.";
    const msg = stderrText.trim() ? `${base}\n${stderrText.trim().slice(-800)}` : base;
    for (let i = 0; i < req.cases.length; i++) {
      post({
        type: "case",
        index: i,
        passed: false,
        actual: null,
        error: `Compile error:\n${msg}`,
        durationMs: 0,
      });
    }
    post({ type: "done" });
    return;
  }

  let module: WebAssembly.Module;
  try {
    module = await WebAssembly.compile((wasmBytes as Uint8Array).slice().buffer as ArrayBuffer);
  } catch {
    for (let i = 0; i < req.cases.length; i++) {
      post({ type: "case", index: i, passed: false, actual: null, error: "Compiled program is invalid.", durationMs: 0 });
    }
    post({ type: "done" });
    return;
  }

  for (let i = 0; i < req.cases.length; i++) {
    const c = req.cases[i]!;
    const t0 = performance.now();
    let actual: unknown;
    let error: string | null = null;
    const outLines: string[] = [];
    const errLines: string[] = [];
    try {
      const fds = [
        new OpenFile(new File(new Uint8Array(0))),
        ConsoleStdout.lineBuffered((line: string) => outLines.push(line)),
        ConsoleStdout.lineBuffered((line: string) => errLines.push(line)),
      ];
      const wasi = new WASI(["main", ...c.args.map((a) => JSON.stringify(a))], [], fds);
      const inst = await WebAssembly.instantiate(module, {
        wasi_snapshot_preview1: wasi.wasiImport,
      });
      wasi.start(
        inst as unknown as { exports: { memory: WebAssembly.Memory; _start: () => unknown } },
      );
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (typeof code !== "number") {
        error = `Runtime error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    const durationMs = Math.round(performance.now() - t0);
    if (error === null) {
      const text = outLines.join("\n").trim();
      try {
        actual = JSON.parse(text);
      } catch {
        error = `Program did not print a valid result.${errLines.length ? " " + errLines.join(" ").slice(0, 300) : ""}`;
      }
    }
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
