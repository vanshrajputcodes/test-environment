import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Mail, ShieldAlert, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gmailComposeUrl } from "@/lib/assessment/payload";
import type { FinalPayload } from "./assessment-app";

function buildSummary(payload: FinalPayload): string {
  const lines = [
    `Candidate: ${payload.candidate.name}`,
    `Email: ${payload.candidate.email}`,
    `WhatsApp: ${payload.candidate.whatsapp}`,
    `Attempt ID: ${payload.attemptId}`,
    `Submitted: ${payload.submittedAt}`,
    `Status: ${payload.terminated ? "TERMINATED (proctoring violations)" : "Completed"}`,
    "",
    `Total marks: ${payload.totalMarks} / ${payload.maxMarks}`,
    "",
    "Question breakdown:",
  ];
  for (const q of payload.perQuestion) {
    lines.push(
      `- ${q.title} (${q.level}, ${q.language}): ${q.casesPassed}/${q.casesTotal} test cases, ${q.marks}/${q.maxMarks} marks`,
    );
  }
  lines.push(
    "",
    `Proctoring summary: ${payload.violations.strikes} strikes, ${payload.violations.tabSwitches} tab switches, ${payload.violations.fullscreenExits} fullscreen exits, ${payload.violations.cameraAlerts} camera alerts.`,
  );
  return lines.join("\n");
}

export function SubmissionCard({
  payload,
  resultCode,
}: {
  payload: FinalPayload;
  resultCode: string;
}) {
  const [copied, setCopied] = useState(false);
  const summary = buildSummary(payload);

  const openGmail = () => {
    window.open(gmailComposeUrl(resultCode, payload.candidate.name, summary), "_blank");
    toast.info("If Gmail did not open, use “Copy encrypted code” instead.");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(resultCode);
      setCopied(true);
      toast.success("Encrypted result code copied.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed. Select the code text manually and copy it.");
    }
  };

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border bg-card p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Assessment submitted</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {payload.candidate.name} · attempt {payload.attemptId.slice(0, 8)}
            </p>
          </div>
          {payload.terminated ? (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="h-3 w-3" /> Terminated
            </Badge>
          ) : (
            <Badge className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </Badge>
          )}
        </div>

        <div className="mt-6 rounded-md border bg-code-bg p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Final score</div>
          <div className="mt-1 font-code text-4xl font-bold text-primary">
            {payload.totalMarks}
            <span className="text-lg text-muted-foreground"> / {payload.maxMarks}</span>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Question breakdown</h2>
          <ul className="divide-y rounded-md border">
            {payload.perQuestion.map((q) => (
              <li key={q.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                {q.casesPassed === q.casesTotal ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="min-w-0 flex-1 truncate">{q.title}</span>
                <span className="font-code text-xs text-muted-foreground">
                  {q.casesPassed}/{q.casesTotal} cases
                </span>
                <span className="font-code text-xs">
                  {q.marks}/{q.maxMarks}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-md border p-4">
          <h2 className="text-sm font-semibold">Send your official result</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Open Gmail with a pre-filled email to the evaluation team. Do not modify the email
            content — the verification code proves your score is authentic.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={openGmail}>
              <Mail className="mr-1.5 h-4 w-4" />
              Send official result via Gmail
            </Button>
            <Button variant="secondary" onClick={copyCode}>
              <Copy className="mr-1.5 h-4 w-4" />
              {copied ? "Copied!" : "Copy encrypted code"}
            </Button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] text-muted-foreground">
              Show encrypted result code
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-code-bg p-3 font-code text-[10px] text-muted-foreground">
              {resultCode}
            </pre>
          </details>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Keep this page open until you have sent the email. Your camera has been released and
          fullscreen monitoring has ended.
        </p>
      </div>
    </div>
  );
}
