import type { WeekGuide } from "../types/guide";

export const weeks: WeekGuide[] = [
  {
    number: 1,
    title: "Make one complete research report",
    subtitle: "Keep everything in one Python app",
    days: [1, 2, 3, 4, 5, 6, 7],
    goal:
      "Start with the smallest useful version. One command takes a question, splits it into smaller tasks, finds evidence, checks the citations, and writes a report.",
    definitionOfDone: [
      "A broad question becomes 3–5 smaller research questions.",
      "Several web searches can run at once without exceeding a safe limit.",
      "The AI can cite only sources that your code has saved and numbered.",
      "You can run the workflow from an API, test it, and package it in a container.",
    ],
  },
  {
    number: 2,
    title: "Make every run survive a restart",
    subtitle: "Save progress in PostgreSQL",
    days: [8, 9, 10, 11, 12, 13, 14],
    goal:
      "Save each request and each finished step in a database. The API can respond quickly while a separate background worker completes the slow research.",
    definitionOfDone: [
      "The API immediately returns a tracking ID instead of making the user wait.",
      "PostgreSQL permanently stores the run, tasks, evidence, and final report.",
      "Two workers can look for jobs without both taking the same one.",
      "Restarting or retrying work does not create duplicate reports.",
    ],
  },
  {
    number: 3,
    title: "Let several workers share the work",
    subtitle: "Add Redis, Kafka, and specialized workers",
    days: [15, 16, 17, 18, 19, 20, 21],
    goal:
      "Split planning, research, and report writing into separate workers. Add each new tool for one clear reason: faster reads, reliable work delivery, or editable configuration.",
    definitionOfDone: [
      "Redis makes status checks faster, but the system still works if Redis is cleared.",
      "Kafka sends planning, research, and report-writing jobs to the right workers.",
      "An outbox table prevents a saved database change from losing its matching message.",
      "Django Admin gives you a small internal screen for prompts and model settings.",
    ],
  },
  {
    number: 4,
    title: "Run, test, and present the whole system",
    subtitle: "From one local command to a clear portfolio demo",
    days: [22, 23, 24, 25, 26, 27, 28, 29, 30],
    goal:
      "Make the project easy to start, inspect, deploy, deliberately break, measure, and explain to another engineer.",
    definitionOfDone: [
      "One Docker Compose command starts the full system on your computer.",
      "Kubernetes can run and scale the API and workers separately.",
      "Failure experiments and 15 test questions give you evidence that the system works.",
      "A clear README and rehearsed demo make the engineering story easy to follow.",
    ],
  },
];
