import type { LangId } from "./config";
import type { ParamType } from "./questions";

export interface RunCase {
  args: unknown[];
  expected: unknown;
}

export interface RunRequest {
  lang: LangId;
  code: string;
  fnName: string;
  params: { name: string; type: ParamType }[];
  returnType: ParamType;
  orderInsensitive: boolean;
  cases: RunCase[];
}

export interface CaseResult {
  passed: boolean;
  actual: string | null;
  error: string | null;
  durationMs: number;
}

export type WorkerOut =
  | { type: "status"; text: string }
  | ({ type: "case"; index: number } & CaseResult)
  | { type: "done" };
