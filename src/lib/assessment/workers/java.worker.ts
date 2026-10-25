/// <reference lib="webworker" />
import type { RunRequest, WorkerOut } from "../worker-protocol";

const ctx = self as unknown as Worker;
const post = (m: WorkerOut) => ctx.postMessage(m);

// Best-effort Java -> JavaScript transpiler for a restricted DSA subset.
function transpileJava(src: string, fnName: string): string {
  let s = src;
  const classIdx = s.search(/\bclass\s+\w+/);
  if (classIdx >= 0) {
    const open = s.indexOf("{", classIdx);
    const close = s.lastIndexOf("}");
    if (open >= 0 && close > open) s = s.slice(open + 1, close);
  }
  s = s.replace(/@Override/g, "");
  s = s.replace(/\b(public|private|protected|static|final)\b/g, "");
  s = s.replace(/System\.out\.println/g, "console.log");
  s = s.replace(/Integer\.MAX_VALUE/g, "2147483647");
  s = s.replace(/Integer\.MIN_VALUE/g, "-2147483648");
  s = s.replace(/Integer\.parseInt/g, "parseInt");
  s = s.replace(/Arrays\.asList\(([^()]*)\)/g, "[$1]");
  s = s.replace(/Arrays\.sort\((\w+)\)/g, "$1.sort((a, b) => a - b)");
  s = s.replace(/Arrays\.fill\((\w+)\s*,\s*([^()]+)\)/g, "$1.fill($2)");
  s = s.replace(/new\s+HashMap\s*(<[^>]*>)?\s*\(\s*\)/g, "new Map()");
  s = s.replace(/(\w+)\.put\(([^,()]+)\s*,\s*([^()]+)\)/g, "$1.set($2, $3)");
  s = s.replace(/(\w+)\.containsKey\(([^()]+)\)/g, "$1.has($2)");
  s = s.replace(/(\w+)\.getOrDefault\(([^,()]+)\s*,\s*([^()]+)\)/g, "($1.has($2) ? $1.get($2) : $3)");
  s = s.replace(/new\s+ArrayList\s*(<[^>]*>)?\s*\(\s*\)/g, "[]");
  s = s.replace(/List\s*<[\w\s<>,]*>\s+([A-Za-z_]\w*)\s*([=;])/g, "var $1$2");
  s = s.replace(/\b(int|long|double|float|boolean|char|String)\[\]\s+([A-Za-z_]\w*)\s*([=;])/g, "var $2$3");
  s = s.replace(/\b(int|long|double|float|boolean|char|String)\[\]\[\]\s+([A-Za-z_]\w*)\s*([=;])/g, "var $2$3");
  s = s.replace(/\b(int|long|double|float|boolean|char|String)\s+([A-Za-z_]\w*)\s*([=;,)])/g, "var $2$3");
  s = s.replace(/new\s+int\s*\[\s*\]\s*\{([^{}]*)\}/g, "[$1]");
  s = s.replace(/new\s+int\s*\[([^\]]+)\]\s*\[([^\]]+)\]/g, "Array.from({length: $1}, () => new Array($2).fill(0))");
  s = s.replace(/new\s+int\s*\[([^\]]+)\](?!\[)/g, "new Array($1).fill(0)");
  s = s.replace(/\.length\(\)/g, ".length");
  s = s.replace(/\.isEmpty\(\)/g, ".length === 0");
  s = s.replace(/\.add\(/g, ".push(");
  s = s.replace(/\.size\(\)/g, ".length");
  s = s.replace(/(\w+)\.get\((\w+)\)/g, "$1.at($2)");
  s = s.replace(/\.toCharArray\(\)/g, '.split("")');
  // Method declarations -> JS functions
  const kw = new Set([
    "if", "for", "while", "switch", "catch", "do", "else", "try", "return", "new", "synchronized",
  ]);
  s = s.replace(/([A-Za-z_][\w<>\[\],\s.]*?)\s+([A-Za-z_]\w*)\s*\(([^()]*)\)\s*\{/g, (m, retType: string, name: string, params: string) => {
    if (kw.has(name) || kw.has(retType.trim())) return m;
    const clean = params
      .split(",")
      .map((p) => {
        const t = p.trim().replace(/^[A-Za-z_][\w<>\[\],\s.]*?\s+/, "");
        return t || p.trim();
      })
      .join(", ");
    return `function ${name}(${clean}) {`;
  });
  void fnName;
  return s;
}

ctx.onmessage = async (ev: MessageEvent<RunRequest>) => {
  const req = ev.data;
  let fn: ((...args: unknown[]) => unknown) | null = null;
  try {
    const js = transpileJava(req.code, req.fnName);
    // eslint-disable-next-line no-new-func
    fn = new Function(`${js}\n;return ${req.fnName};`)() as (...args: unknown[]) => unknown;
  } catch (e) {
    for (let i = 0; i < req.cases.length; i++) {
      post({
        type: "case",
        index: i,
        passed: false,
        actual: null,
        error: `Could not run Java code (unsupported syntax or error): ${e instanceof Error ? e.message : String(e)}`,
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
        error: `Method ${req.fnName} not found. Keep the provided method name.`,
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
    post({
      type: "case",
      index: i,
      passed: error === null && JSON.stringify(actual) === JSON.stringify(c.expected),
      actual: error === null ? JSON.stringify(actual) ?? "undefined" : null,
      error,
      durationMs,
    });
  }
  post({ type: "done" });
};
