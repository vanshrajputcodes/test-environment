import { createFileRoute } from "@tanstack/react-router";
import { AssessmentApp } from "@/components/assessment/assessment-app";

export const Route = createFileRoute("/test/icc-dsa-round")({
  head: () => ({
    meta: [
      { title: "ICC DSA Assessment — Proctored Coding Round" },
      {
        name: "description",
        content:
          "150-minute, fully browser-proctored DSA coding assessment. 5 randomly selected problems, 150 marks, zero setup required.",
      },
      { property: "og:title", content: "ICC DSA Assessment — Proctored Coding Round" },
      {
        property: "og:description",
        content:
          "A 150-minute proctored DSA coding round that runs entirely in your browser: 5 problems, 150 marks, live camera proctoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssessmentApp,
});
