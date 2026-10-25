import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ShieldAlert, Printer, FileSpreadsheet, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP } from "@/lib/assessment/config";
import { decodePayload } from "@/lib/assessment/payload";
import type { FinalPayload } from "@/components/assessment/assessment-app";
import {
  loadResults,
  saveResult,
  removeResult,
  clearResults,
  buildResultRows,
  buildQuestionRows,
  downloadBlob,
  type StoredResult,
} from "@/lib/assessment/results-store";

export const Route = createFileRoute("/result-checker-icc")({
  head: () => ({
    meta: [
      { title: "Result Verification" },
      { name: "description", content: "Secure result code verification." },
      { property: "og:title", content: "Result Verification" },
      { property: "og:description", content: "Verify an encrypted assessment result code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultChecker,
});

function ResultChecker() {
  const [code, setCode] = useState("");
  const [payload, setPayload] = useState<FinalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saved, setSaved] = useState<StoredResult[]>([]);

  useEffect(() => {
    setSaved(loadResults());
  }, []);

  const verify = async () => {
    setVerifying(true);
    setError(null);
    setPayload(null);
    try {
      const p = (await decodePayload(code)) as FinalPayload;
      if (!p || typeof p.totalMarks !== "number" || !Array.isArray(p.perQuestion)) {
        throw new Error("Unrecognized result payload.");
      }
      const wasNew = !saved.some((r) => r.payload.attemptId === p.attemptId);
      setSaved(saveResult(p, saved));
      setPayload(p);
      setCode("");
      toast.success(wasNew ? "Result saved to the local sheet" : "Saved result updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify this code.");
    } finally {
      setVerifying(false);
    }
  };

  const exportExcel = async () => {
    if (saved.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildResultRows(saved)), "Results");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildQuestionRows(saved)), "Questions");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `ICC-Results-${date}.xlsx`);
  };

  const certificateEligible =
    payload !== null &&
    !payload.terminated &&
    payload.perQuestion.reduce((s, q) => s + q.casesPassed, 0) /
      Math.max(1, payload.perQuestion.reduce((s, q) => s + q.casesTotal, 0)) >=
      APP.certificateThreshold;

  const downloadCertificate = () => {
    if (!payload) return;
    const totalCases = payload.perQuestion.reduce((s, q) => s + q.casesTotal, 0);
    const passedCases = payload.perQuestion.reduce((s, q) => s + q.casesPassed, 0);
    const w = window.open("", "_blank", "width=900,height=650");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Certificate — ${payload.candidate.name}</title>
<style>
  body { font-family: Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f2; }
  .cert { width: 800px; padding: 60px; border: 6px double #1e3a4f; background: #fffdf8; text-align: center; }
  h1 { letter-spacing: 4px; font-size: 28px; margin: 0 0 8px; color: #1e3a4f; }
  .sub { color: #666; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
  .name { font-size: 34px; margin: 28px 0 6px; color: #111; }
  .line { width: 320px; border-bottom: 1px solid #999; margin: 0 auto 24px; }
  .body { font-size: 14px; color: #333; line-height: 1.7; }
  .score { font-size: 20px; margin: 18px 0; color: #1e3a4f; font-weight: bold; }
  .foot { margin-top: 40px; font-size: 11px; color: #888; }
</style></head><body>
<div class="cert">
  <div class="sub">Certificate of Achievement</div>
  <h1>ICC DSA ASSESSMENT</h1>
  <div class="name">${payload.candidate.name}</div>
  <div class="line"></div>
  <div class="body">has successfully completed the proctored Data Structures &amp; Algorithms coding assessment<br/>
  with ${passedCases} of ${totalCases} test cases passed and a final score of ${payload.totalMarks} / ${payload.maxMarks}.</div>
  <div class="score">${Math.round((passedCases / Math.max(1, totalCases)) * 100)}% test cases passed</div>
  <div class="body">Attempt ID: ${payload.attemptId}<br/>Date: ${new Date(payload.submittedAt).toLocaleDateString()}</div>
  <div class="foot">Verified result code ${payload.attemptId.slice(0, 8)}… · ICC Assessment Program</div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-lg border bg-card p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-3">
          <BadgeCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Result code verification</h1>
            <p className="text-xs text-muted-foreground">
              Paste a candidate&apos;s encrypted result code to verify and inspect it. Each verified
              result is saved in this browser only.
            </p>
          </div>
        </div>

        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ICC1.…"
          rows={5}
          className="mt-5 w-full resize-none rounded-md border bg-code-bg p-3 font-code text-xs outline-none focus:ring-2 focus:ring-ring"
        />
        <Button className="mt-3" onClick={verify} disabled={verifying || code.trim().length === 0}>
          {verifying ? "Verifying…" : "Verify result code"}
        </Button>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {payload && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between rounded-md border bg-code-bg p-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Checksum verified
                </div>
                <div className="mt-0.5 text-lg font-semibold">{payload.candidate.name}</div>
                <div className="text-xs text-muted-foreground">
                  {payload.candidate.email} · {payload.candidate.whatsapp}
                </div>
                <div className="mt-1 font-code text-[10px] text-muted-foreground">
                  Attempt {payload.attemptId} · {new Date(payload.submittedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-code text-3xl font-bold text-primary">
                  {payload.totalMarks}
                  <span className="text-sm text-muted-foreground">/{payload.maxMarks}</span>
                </div>
                {payload.terminated ? (
                  <Badge variant="destructive" className="mt-1">
                    Terminated
                  </Badge>
                ) : (
                  <Badge className="mt-1">Completed</Badge>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold">Question breakdown</h2>
              <ul className="divide-y rounded-md border">
                {payload.perQuestion.map((q) => (
                  <li key={q.id} className="px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate">{q.title}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {q.level}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {q.language}
                      </Badge>
                      <span className="font-code text-xs text-muted-foreground">
                        {q.casesPassed}/{q.casesTotal} cases
                      </span>
                      <span className="font-code text-xs">
                        {q.marks}/{q.maxMarks}
                      </span>
                    </div>
                    <pre className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-code-bg p-2 font-code text-[10px] text-muted-foreground">
                      {q.code}
                    </pre>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold">Proctoring integrity report</h2>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  Strikes: <span className="font-code">{payload.violations.strikes}</span>
                </div>
                <div className="rounded-md border p-3">
                  Tab switches: <span className="font-code">{payload.violations.tabSwitches}</span>
                </div>
                <div className="rounded-md border p-3">
                  Fullscreen exits: <span className="font-code">{payload.violations.fullscreenExits}</span>
                </div>
                <div className="rounded-md border p-3">
                  Paste blocks: <span className="font-code">{payload.violations.pasteBlocks}</span>
                </div>
                <div className="rounded-md border p-3">
                  Shortcut blocks: <span className="font-code">{payload.violations.shortcutBlocks}</span>
                </div>
                <div className="rounded-md border p-3">
                  Camera alerts: <span className="font-code">{payload.violations.cameraAlerts}</span>
                </div>
              </div>
              {payload.violations.log.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border p-3 text-xs text-muted-foreground">
                  {payload.violations.log.map((e, i) => (
                    <li key={i}>
                      {new Date(e.at).toLocaleTimeString()} — {e.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {certificateEligible && (
              <Button onClick={downloadCertificate}>
                <Printer className="mr-1.5 h-4 w-4" />
                Download PDF certificate
              </Button>
            )}
          </div>
        )}
      </div>

      {saved.length > 0 && (
        <div className="mt-6 rounded-lg border bg-card p-6 shadow-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Saved results</h2>
              <p className="text-xs text-muted-foreground">
                {saved.length} candidate{saved.length === 1 ? "" : "s"} stored in this browser ·
                nothing leaves your device until you export
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportExcel} size="sm">
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                Download Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearResults();
                  setSaved([]);
                  toast.success("Local sheet cleared");
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Clear all
              </Button>
            </div>
          </div>
          <ul className="mt-4 divide-y rounded-md border">
            {saved.map((r) => {
              const p = r.payload;
              const totalCases = p.perQuestion.reduce((s, q) => s + q.casesTotal, 0);
              const passedCases = p.perQuestion.reduce((s, q) => s + q.casesPassed, 0);
              return (
                <li key={p.attemptId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.candidate.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.candidate.email} · {new Date(p.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  {p.terminated ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Terminated
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Completed
                    </Badge>
                  )}
                  <span className="shrink-0 font-code text-xs text-muted-foreground">
                    {passedCases}/{totalCases} cases
                  </span>
                  <span className="shrink-0 font-code text-sm font-semibold text-primary">
                    {p.totalMarks}
                    <span className="text-xs text-muted-foreground">/{p.maxMarks}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 p-0"
                    aria-label={`Remove ${p.candidate.name} from the local sheet`}
                    onClick={() => {
                      setSaved(removeResult(p.attemptId, saved));
                      toast.success("Removed from the local sheet");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
