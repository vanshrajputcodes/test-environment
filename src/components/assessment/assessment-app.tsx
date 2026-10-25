import { useCallback, useEffect, useState } from "react";
import { Timer, ListChecks, Camera, Wifi, MonitorX, Laptop } from "lucide-react";
const LOGO_URL = "https://vanshrajput.in/wp-content/uploads/2026/08/Hack-The-Future.png";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SetupScreen } from "./setup-screen";
import { ExamScreen, type Candidate, type FinishData } from "./exam-screen";
import { SubmissionCard } from "./submission-card";
import { createAttempt, type Attempt } from "@/lib/assessment/attempt";
import { APP } from "@/lib/assessment/config";
import { readDeviceLock, writeDeviceLock, type DeviceLock } from "@/lib/assessment/device-lock";
import { encodePayload } from "@/lib/assessment/payload";
import type { ProctorState } from "@/hooks/use-proctor";

export interface FinalPayload {
  attemptId: string;
  candidate: Candidate;
  submittedAt: string;
  terminated: boolean;
  totalMarks: number;
  maxMarks: number;
  perQuestion: FinishData["perQuestion"];
  violations: {
    strikes: number;
    tabSwitches: number;
    fullscreenExits: number;
    pasteBlocks: number;
    shortcutBlocks: number;
    cameraAlerts: number;
    log: ProctorState["events"];
  };
}

type Phase = "register" | "setup" | "exam" | "done";

export function AssessmentApp() {
  const [phase, setPhase] = useState<Phase>("register");
  const [candidate, setCandidate] = useState<Candidate>({ name: "", email: "", whatsapp: "" });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<{ payload: FinalPayload; code: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deviceLock, setDeviceLock] = useState<DeviceLock | null>(null);
  const [deviceChecked, setDeviceChecked] = useState(false);

  useEffect(() => {
    setDeviceLock(readDeviceLock());
    setDeviceChecked(true);
  }, []);

  const lockDevice = useCallback((locked: Attempt, by: Candidate) => {
    writeDeviceLock({
      attemptId: locked.attemptId,
      name: by.name,
      email: by.email,
      at: new Date().toISOString(),
    });
  }, []);



  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const name = candidate.name.trim();
    const email = candidate.email.trim();
    const phone = candidate.whatsapp.trim();
    if (name.length < 2) return setFormError("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError("Please enter a valid email address.");
    if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, "")))
      return setFormError("Please enter a valid WhatsApp number (10–15 digits).");
    setFormError(null);
    setCandidate({ name, email, whatsapp: phone });
    setAttempt(createAttempt());
    setPhase("setup");
  };

  const handleFinish = useCallback(
    async (data: FinishData) => {
      if (!attempt) return;
      const totalMarks = data.perQuestion.reduce((s, q) => s + q.marks, 0);
      const cameraAlerts = data.proctor.events.filter((e) => e.type.startsWith("camera_")).length;
      const payload: FinalPayload = {
        attemptId: attempt.attemptId,
        candidate,
        submittedAt: new Date().toISOString(),
        terminated: data.terminated,
        totalMarks,
        maxMarks: APP.maxMarks,
        perQuestion: data.perQuestion,
        violations: {
          strikes: data.proctor.strikes,
          tabSwitches: data.proctor.tabSwitches,
          fullscreenExits: data.proctor.fullscreenExits,
          pasteBlocks: data.proctor.pasteBlocks,
          shortcutBlocks: data.proctor.shortcutBlocks,
          cameraAlerts,
          log: data.proctor.events,
        },
      };
      const code = await encodePayload(payload);
      setResult({ payload, code });
      setPhase("done");
    },
    [attempt, candidate],
  );

  if (phase === "setup") {
    return (
      <SetupScreen
        onComplete={() => {
          if (attempt) lockDevice(attempt, candidate);
          setPhase("exam");
        }}
      />
    );
  }

  if (phase === "exam" && attempt) {
    return (
      <ExamScreen
        candidate={candidate}
        attemptId={attempt.attemptId}
        questions={attempt.questions}
        onFinish={handleFinish}
      />
    );
  }

  if (phase === "done" && result) {
    return <SubmissionCard payload={result.payload} resultCode={result.code} />;
  }

  // Register phase
  if (deviceChecked && deviceLock) {
    return (
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
          <MonitorX className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="mb-2 text-xl font-bold tracking-tight">Device already used</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This device has already been used for an assessment attempt
          {deviceLock.name ? ` by ${deviceLock.name}` : ""}. Only one attempt is allowed per
          device.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Attempt {deviceLock.attemptId.slice(0, 8).toUpperCase()} ·{" "}
          {new Date(deviceLock.at).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
      <div>
        <img
          src={LOGO_URL}
          alt="Hack The Future"
          className="mb-5 h-24 w-auto"
        />
        <div className="mb-6 flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ICC DSA Assessment</h1>
            <p className="text-sm text-muted-foreground">Proctored coding round — browser only</p>
          </div>
        </div>
        <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          A 150-minute, strictly proctored DSA round that runs entirely in your browser. No
          installs, no logins — just your webcam, fullscreen, and your best code.
        </p>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Timer className="h-4 w-4 text-primary" /> 150-minute countdown with auto-submission
          </li>
          <li className="flex items-center gap-3">
            <ListChecks className="h-4 w-4 text-primary" /> 5 random problems (3 easy + 2 medium), 150 marks
          </li>
          <li className="flex items-center gap-3">
            <Camera className="h-4 w-4 text-primary" /> Live camera proctoring with strike system
          </li>
          <li className="flex items-center gap-3">
            <Laptop className="h-4 w-4 text-primary" /> One attempt per device — no retakes
          </li>
          <li className="flex items-center gap-3">
            <Wifi className="h-4 w-4 text-primary" /> JavaScript, Python, C, C++ and Java support
          </li>
        </ul>
      </div>

      <form onSubmit={handleRegister} className="rounded-lg border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold tracking-tight">Candidate registration</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your details are sealed into the encrypted result code submitted at the end.
        </p>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cand-name">Full name</Label>
            <Input
              id="cand-name"
              value={candidate.name}
              onChange={(e) => setCandidate((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Priya Sharma"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cand-email">Email</Label>
            <Input
              id="cand-email"
              type="email"
              value={candidate.email}
              onChange={(e) => setCandidate((c) => ({ ...c, email: e.target.value }))}
              placeholder="you@example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cand-phone">WhatsApp number</Label>
            <Input
              id="cand-phone"
              value={candidate.whatsapp}
              onChange={(e) => setCandidate((c) => ({ ...c, whatsapp: e.target.value }))}
              placeholder="e.g. 9876543210"
              autoComplete="off"
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive">{formError}</p>}
        <Button type="submit" className="mt-6 w-full">
          Continue to environment setup
        </Button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          By continuing you accept fullscreen and camera monitoring for the full duration of the
          assessment.
        </p>
      </form>
    </div>
  );
}
