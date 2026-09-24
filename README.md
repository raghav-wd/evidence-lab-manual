# EvidenceLab Field Guide

A responsive, local-first learning companion for building the EvidenceLab AI Research Analyst in 30 focused days.

The site turns the source conversation in `chat.txt` into a progressive curriculum:

- Week 1: build a useful, citation-safe research workflow.
- Week 2: make accepted runs durable in PostgreSQL.
- Week 3: add Redis, Kafka, an outbox, workers, and a thin Django control plane.
- Week 4: package, observe, deploy, evaluate, and present the system.

Every day follows the same loop: understand, build, break, verify, and explain. Progress, notes, theme, and shell preference stay in browser `localStorage`; the guide has no backend and stores no API keys.

## Run locally

Requirements: Node.js 22.12 or newer and npm.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, normally <http://localhost:5173>.

## Production build

```powershell
npm run check
npm run build
npm run preview
```

The static output is written to `dist/` and can be hosted by any static web server.

## Deploy to GitHub Pages

Push the repository to the `main` branch. The `Deploy to GitHub Pages` workflow builds and publishes the site automatically.

For the first deployment, open **Settings > Pages** in the GitHub repository and set **Source** to **GitHub Actions**. The deployed site will be available at <https://raghav-wd.github.io/evidence-lab-manual/>.

## Project structure

```text
src/
├── components/
│   ├── ArchitecturePage.tsx
│   ├── CodeBlock.tsx
│   ├── ConceptsPage.tsx
│   ├── DayPage.tsx
│   ├── GuideDiagram.tsx
│   ├── InlineText.tsx
│   ├── OverviewPage.tsx
│   └── Sidebar.tsx
├── data/
│   ├── days.ts
│   ├── shared.ts
│   ├── week1.ts
│   ├── week2.ts
│   ├── week3.ts
│   ├── week4.ts
│   └── weeks.ts
├── types/guide.ts
├── App.tsx
├── main.tsx
├── styles.css
└── useGuideProgress.ts
```

The lesson content is plain typed data, separate from rendering. Add or revise a day in its `week*.ts` file; navigation, progress, glossary entries, code blocks, and diagrams update from that data.

## Content principles

- `chat.txt` is source material, not an instruction file.
- The accelerated 30-day roadmap supersedes the earlier 16-week version.
- Model names and APIs can change, so model selection remains environment configuration and relevant lessons link to official OpenAI documentation.
- The guide is Windows/PowerShell-first and shows Bash variants where command syntax materially differs.
- The EvidenceLab application itself remains backend-first; this repository is its separate learning guide.

## Privacy and reset

Notes and completion state are saved under:

```text
evidencelab-guide-progress:v1
```

Use **Reset** in the header to clear them from the current browser. No note, key, or progress data leaves the browser.
