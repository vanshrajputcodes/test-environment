import { useEffect, useRef, useState } from "react";

export type CamStatus = "idle" | "starting" | "ok" | "warn" | "error";

const NO_FACE_MS = 5000;
const GAZE_MS = 4000;
const THROTTLE_MS = 12000;

export function useFaceProctor(
  active: boolean,
  onViolation: (type: string) => void,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<CamStatus>("idle");
  const [statusText, setStatusText] = useState("Camera off");
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  useEffect(() => {
    if (!active) return;
    let landmarker: {
      close?: () => void;
      detectForVideo: (
        v: HTMLVideoElement,
        ts: number,
      ) => { faceLandmarks: { x: number; y: number }[][] };
    } | null = null;
    let raf = 0;
    let interval = 0;
    let cancelled = false;
    let lastFaceSeen = Date.now();
    let gazeStart: number | null = null;
    let lastNoFace = 0;
    let lastMulti = 0;
    let lastGaze = 0;

    const start = async () => {
      setStatus("starting");
      setStatusText("Starting camera…");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});

        const url = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
        const vision = await import(/* @vite-ignore */ url);
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
        );
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 2,
        });

        const loop = () => {
          const video = videoRef.current;
          if (!landmarker || !video || video.readyState < 2 || cancelled) return;
          const ts = performance.now();
          let result: { faceLandmarks: { x: number; y: number }[][] };
          try {
            result = landmarker.detectForVideo(video, ts);
          } catch {
            return;
          }
          const faces = result.faceLandmarks ?? [];
          const now = Date.now();
          if (faces.length === 0) {
            if (now - lastFaceSeen > NO_FACE_MS && now - lastNoFace > THROTTLE_MS) {
              lastNoFace = now;
              onViolationRef.current("camera_no_face");
            }
            setStatus("warn");
            setStatusText("Face not visible");
            gazeStart = null;
          } else {
            lastFaceSeen = now;
            if (faces.length >= 2) {
              if (now - lastMulti > THROTTLE_MS) {
                lastMulti = now;
                onViolationRef.current("camera_multiple_faces");
              }
              setStatus("warn");
              setStatusText("Multiple faces detected");
            } else {
              const f0 = faces[0];
              const nose = f0?.[1] ?? f0?.[0];
              const turned = nose && (nose.x < 0.22 || nose.x > 0.78);
              if (turned) {
                if (gazeStart === null) gazeStart = now;
                if (now - gazeStart > GAZE_MS && now - lastGaze > THROTTLE_MS) {
                  lastGaze = now;
                  onViolationRef.current("camera_gaze");
                }
                setStatus("warn");
                setStatusText("Stay facing the screen");
              } else {
                gazeStart = null;
                setStatus("ok");
                setStatusText("Proctoring active");
              }
            }
          }
        };
        interval = window.setInterval(loop, 500);
        setStatus("ok");
        setStatusText("Proctoring active");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setStatusText("Camera unavailable");
          onViolationRef.current("camera_error");
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
      landmarker?.close?.();
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [active]);

  return { videoRef, camStatus: status, camStatusText: statusText };
}
