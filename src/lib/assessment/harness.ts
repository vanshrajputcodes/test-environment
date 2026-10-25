import type { Question } from "./questions";

export function canonicalize(value: unknown, orderInsensitive: boolean): unknown {
  if (!orderInsensitive) return value;
  if (!Array.isArray(value)) return value;
  return value
    .map((t) => (Array.isArray(t) ? [...t].sort((a, b) => Number(a) - Number(b)) : t))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function resultsEqual(
  actual: unknown,
  expected: unknown,
  orderInsensitive: boolean,
): boolean {
  const a = canonicalize(actual, orderInsensitive);
  const e = canonicalize(expected, orderInsensitive);
  return JSON.stringify(a) === JSON.stringify(e);
}

// ---------- C++ harness ----------

const CPP_PREFIX = `// ==== evaluation harness ====
#include <string>
#include <vector>
#include <cstdlib>
#include <cctype>
#include <cstdio>
#include <iostream>
struct HV {
  int kind; // 0 int, 1 string, 2 vector<int>, 3 vector<vector<int>>
  int i; std::string s; std::vector<int> v; std::vector<std::vector<int>> m;
};
static void hskip(const std::string& t, size_t& p) {
  while (p < t.size() && (t[p] == ' ' || t[p] == '\\t' || t[p] == '\\n' || t[p] == '\\r')) p++;
}
static HV hparse(const std::string& t, size_t& p) {
  HV r; r.kind = 0; hskip(t, p);
  if (p < t.size() && t[p] == '"') {
    r.kind = 1; p++;
    while (p < t.size() && t[p] != '"') { r.s += t[p]; p++; }
    if (p < t.size()) p++;
    return r;
  }
  if (p < t.size() && t[p] == '[') {
    p++; hskip(t, p); r.kind = 2;
    if (p < t.size() && t[p] == ']') { p++; return r; }
    HV first = hparse(t, p);
    bool isMat = first.kind == 2;
    if (isMat) { r.kind = 3; r.m.push_back(first.v); } else { r.v.push_back(first.i); }
    hskip(t, p);
    while (p < t.size() && t[p] == ',') {
      p++; HV nx = hparse(t, p);
      if (isMat) r.m.push_back(nx.v); else r.v.push_back(nx.i);
      hskip(t, p);
    }
    if (p < t.size() && t[p] == ']') p++;
    return r;
  }
  r.kind = 0;
  {
    std::string num;
    while (p < t.size() && (isdigit((unsigned char)t[p]) || t[p] == '-')) { num += t[p]; p++; }
    r.i = num.empty() ? 0 : atoi(num.c_str());
  }
  return r;
}
static void happendInt(std::string& o, int v) {
  char b[32]; snprintf(b, 32, "%d", v); o += b;
}
static std::string hserV(const std::vector<int>& v) {
  std::string o = "[";
  for (size_t i = 0; i < v.size(); ++i) { if (i) o += ","; happendInt(o, v[i]); }
  return o + "]";
}
static std::string hserM(const std::vector<std::vector<int>>& m) {
  std::string o = "[";
  for (size_t i = 0; i < m.size(); ++i) { if (i) o += ","; o += hserV(m[i]); }
  return o + "]";
}
// ==== end harness ====
`;

type HarnessSpec = Pick<Question, "fnName" | "params" | "returnType">;

export function buildCppHarness(q: HarnessSpec, candidateCode: string): string {
  const cppType = (t: Question["returnType"]): string =>
    t === "int" ? "int" : t === "int[]" ? "std::vector<int>" : t === "int[][]" ? "std::vector<std::vector<int>>" : "std::string";
  const decls = q.params
    .map((p, i) => {
      const init = `HV a${i} = hparse(argv[${i + 1}], p${i});`;
      const decl =
        p.type === "int"
          ? `int ${p.name} = a${i}.i;`
          : p.type === "int[]"
            ? `std::vector<int> ${p.name} = a${i}.v;`
            : p.type === "int[][]"
              ? `std::vector<std::vector<int>> ${p.name} = a${i}.m;`
              : `std::string ${p.name} = a${i}.s;`;
      return `size_t p${i} = 0; ${init} ${decl}`;
    })
    .join("\n  ");
  const ser =
    q.returnType === "int"
      ? "happendInt(out, RES);"
      : q.returnType === "int[]"
        ? "out += hserV(RES);"
        : q.returnType === "int[][]"
          ? "out += hserM(RES);"
          : 'out += "\\""; out += RES; out += "\\"";';
  return `${CPP_PREFIX}
/* ==== candidate solution ==== */
${candidateCode}
/* ==== end candidate solution ==== */
int main(int argc, char** argv) {
  std::string out;
  ${decls}
  ${cppType(q.returnType)} RES = ${q.fnName}(${q.params.map((p) => p.name).join(", ")});
  ${ser}
  std::cout << out << std::endl;
  return 0;
}`;
}

// ---------- C harness ----------

const C_PREFIX = `/* ==== evaluation harness ==== */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct HV {
  int kind; /* 0 num, 1 string, 2 vector, 3 matrix */
  long num; char* str; long* vec; int vlen; long** mat; int mlen; int* mlens;
} HV;
static HV hparse(const char* t, size_t* p) {
  HV r; memset(&r, 0, sizeof(r));
  while (t[*p] == ' ' || t[*p] == '\\t' || t[*p] == '\\n' || t[*p] == '\\r') (*p)++;
  if (t[*p] == '"') {
    (*p)++; size_t st = *p;
    while (t[*p] && t[*p] != '"') (*p)++;
    size_t en = *p;
    if (t[*p]) (*p)++;
    r.kind = 1;
    r.str = (char*)malloc(en - st + 1);
    memcpy(r.str, t + st, en - st);
    r.str[en - st] = 0;
    return r;
  }
  if (t[*p] == '[') {
    (*p)++;
    long* nums = NULL; int n = 0, cap = 0;
    long** mats = NULL; int* mlens = NULL; int m = 0, mcap = 0;
    for (;;) {
      while (t[*p] == ' ' || t[*p] == '\\t') (*p)++;
      if (t[*p] == ']') { (*p)++; break; }
      HV e = hparse(t, p);
      if (e.kind == 0) {
        if (n == cap) { cap = cap ? cap * 2 : 8; nums = (long*)realloc(nums, cap * sizeof(long)); }
        nums[n++] = e.num;
      } else if (e.kind == 2) {
        if (m == mcap) {
          mcap = mcap ? mcap * 2 : 8;
          mats = (long**)realloc(mats, mcap * sizeof(long*));
          mlens = (int*)realloc(mlens, mcap * sizeof(int));
        }
        mats[m] = e.vec; mlens[m] = e.vlen; m++;
        r.kind = 3;
      } else if (e.kind == 1) {
        r.kind = 1; r.str = e.str;
      }
      while (t[*p] == ' ' || t[*p] == '\\t') (*p)++;
      if (t[*p] == ',') { (*p)++; continue; }
      if (t[*p] == ']') { (*p)++; break; }
      break;
    }
    r.vec = nums; r.vlen = n; r.mat = mats; r.mlen = m; r.mlens = mlens;
    return r;
  }
  r.kind = 0;
  r.num = strtol(t + *p, NULL, 10);
  while ((t[*p] >= '0' && t[*p] <= '9') || t[*p] == '-') (*p)++;
  return r;
}
/* ==== end harness ==== */
`;

export function buildCHarness(q: HarnessSpec, candidateCode: string): string {
  const decls: string[] = [];
  q.params.forEach((p, i) => {
    if (p.type === "int[]") {
      decls.push(
        `size_t p${i} = 0; HV a${i} = hparse(argv[${i + 1}], &p${i});`,
        `int* ${p.name} = (int*)malloc(sizeof(int) * (a${i}.vlen > 0 ? a${i}.vlen : 1));`,
        `for (int ci = 0; ci < a${i}.vlen; ci++) ${p.name}[ci] = (int)a${i}.vec[ci];`,
        `int ${p.name}Size = a${i}.vlen;`,
      );
    } else if (p.type === "int") {
      decls.push(`size_t p${i} = 0; HV a${i} = hparse(argv[${i + 1}], &p${i}); int ${p.name} = (int)a${i}.num;`);
    } else {
      decls.push(`size_t p${i} = 0; HV a${i} = hparse(argv[${i + 1}], &p${i}); const char* ${p.name} = a${i}.str;`);
    }
  });
  let retDecl = "int";
  let callExtra = "";
  if (q.returnType === "int[]") {
    retDecl = "int*";
    callExtra = ", &returnSize";
  } else if (q.returnType === "int[][]") {
    retDecl = "int**";
    callExtra = ", &returnSize, &returnColumnSizes";
  } else if (q.returnType === "string") {
    retDecl = "char*";
  }
  const args = q.params
    .map((p) => (p.type === "int[]" ? `${p.name}, ${p.name}Size` : p.name))
    .join(", ") + callExtra;
  const ser =
    q.returnType === "int"
      ? 'printf("%d", RES);'
      : q.returnType === "int[]"
        ? `printf("[");
for (int ci = 0; ci < returnSize; ci++) { if (ci) printf(","); printf("%d", RES[ci]); }
printf("]");`
        : q.returnType === "int[][]"
          ? `printf("[");
for (int ci = 0; ci < returnSize; ci++) {
  if (ci) printf(",");
  printf("[");
  for (int cj = 0; cj < returnColumnSizes[ci]; cj++) { if (cj) printf(","); printf("%d", RES[ci][cj]); }
  printf("]");
}
printf("]");`
          : 'printf("\\"%s\\"", RES);';
  return `${C_PREFIX}
/* ==== candidate solution ==== */
${candidateCode}
/* ==== end candidate solution ==== */
int main(int argc, char** argv) {
  ${decls.join("\n  ")}
  int returnSize = 0; int* returnColumnSizes = NULL;
  ${retDecl} RES = ${q.fnName}(${args});
  ${ser}
  printf("\\n");
  return 0;
}`;
}
