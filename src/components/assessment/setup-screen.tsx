import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const STEPS = [
  "Initializing compiler sandbox…",
  "Preparing environment…",
  "Optimizing workspace…",
];

export function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const totalMs = 4200;
    const iv = window.setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - started) / totalMs) * 100));
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(iv);
        window.setTimeout(onComplete, 350);
      }
    }, 60);
    return () => clearInterval(iv);
  }, [onComplete]);

  const stepIndex = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length));

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Setting up your assessment</h2>
        </div>
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="font-code text-sm text-muted-foreground">
          {progress}% — {STEPS[stepIndex]}
        </p>
        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Please keep this tab in the foreground. Your camera and fullscreen will be requested once
          setup completes.
        </p>
      </div>
    </div>
  );
}
