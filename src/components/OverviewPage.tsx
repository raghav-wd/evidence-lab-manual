import { days } from "../data/days";
import { weeks } from "../data/weeks";
import { GuideDiagram } from "./GuideDiagram";

type OverviewPageProps = {
  completedDays: Set<string>;
  lastVisitedDayId: string;
  onNavigate: (id: string) => void;
};

const overviewDiagram = {
  type: "flow" as const,
  title: "How the finished app answers a question",
  description:
    "The app breaks one broad question into smaller research tasks, checks web sources, saves the useful facts, and writes a report. Before returning it, normal code verifies that every citation points to a source the app actually saved.",
  nodes: [
    { label: "Question", detail: "what the user wants to learn" },
    { label: "Research plan", detail: "3–5 smaller questions" },
    { label: "Web search", detail: "find sources for each task", kind: "accent" as const },
    { label: "Saved evidence", detail: "facts + source details", kind: "data" as const },
    { label: "Draft report", detail: "use only saved sources" },
    { label: "Checked report", detail: "verify every citation", kind: "accent" as const },
  ],
};

export function OverviewPage({ completedDays, lastVisitedDayId, onNavigate }: OverviewPageProps) {
  const continueDay = completedDays.has(lastVisitedDayId)
    ? days.find((day) => !completedDays.has(day.id)) ?? days.at(-1)!
    : days.find((day) => day.id === lastVisitedDayId) ?? days[0];
  const percent = Math.round((completedDays.size / days.length) * 100);

  return (
    <div className="overview-page page-enter">
      <section className="overview-hero">
        <div className="eyebrow">A 30-day learn-by-building plan · 60–80 focused hours</div>
        <h1>Build an AI research app—and understand why each part exists.</h1>
        <p className="hero-copy">
          Begin with a small Python program that turns a question into a report with checked
          citations. Then move its data into a database, send slow work to background programs,
          add tools for speed and reliability, and package it as a portfolio project. Each new
          tool arrives only when the app has a clear problem for it to solve.
        </p>
        <div className="hero-actions">
          <button className="button button--primary" type="button" onClick={() => onNavigate(continueDay.id)}>
            {completedDays.size ? `Continue Day ${continueDay.day}` : "Start Day 1"}
            <span aria-hidden="true">→</span>
          </button>
          <button className="button button--quiet" type="button" onClick={() => onNavigate("architecture")}>
            See how the app grows
          </button>
        </div>

        <div className="overall-progress" aria-label={`${completedDays.size} of ${days.length} days complete`}>
          <div>
            <span>Overall progress</span>
            <strong>{completedDays.size} / {days.length} days</strong>
          </div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      <GuideDiagram diagram={overviewDiagram} />

      <section className="content-section" aria-labelledby="roadmap-title">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div>
            <h2 id="roadmap-title">What you will build each week</h2>
            <p>Every week ends with a working version. The next week keeps it and adds one new level of reliability or scale.</p>
          </div>
        </div>
        <div className="week-grid">
          {weeks.map((week) => {
            const done = week.days.filter((number) => completedDays.has(`day-${String(number).padStart(2, "0")}`)).length;
            return (
              <article className="week-card" key={week.number}>
                <div className="week-card__topline">
                  <span>Week {week.number} · Days {week.days[0]}–{week.days.at(-1)}</span>
                  <span>{done}/{week.days.length} complete</span>
                </div>
                <h3>{week.title}</h3>
                <p className="week-card__subtitle">{week.subtitle}</p>
                <p>{week.goal}</p>
                <div className="week-card__outcome">
                  <strong>By the end of this stage</strong>
                  <ul>
                    {week.definitionOfDone.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <button className="text-link" type="button" onClick={() => onNavigate(`day-${String(week.days[0]).padStart(2, "0")}`)}>
                  Open Day {week.days[0]} <span aria-hidden="true">→</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="content-section" aria-labelledby="learning-loop-title">
        <div className="section-heading">
          <span className="section-number">02</span>
          <div>
            <h2 id="learning-loop-title">Use the same learning loop every day</h2>
            <p>Each lesson introduces one idea, adds one working change, and asks you to prove what happens when part of it fails.</p>
          </div>
        </div>
        <ol className="learning-loop">
          {[
            ["20 min", "Understand", "Read the idea first. In one sentence, name the problem today's tool should solve."],
            ["90 min", "Build", "Add the smallest end-to-end change that works, then inspect its output."],
            ["20 min", "Break", "Cause one safe failure. Check what stops, what continues, and what data remains."],
            ["10 min", "Explain", "Write what you learned in your own words, then save the change in Git."],
          ].map(([time, title, body], index) => (
            <li key={title}>
              <span className="loop-index">{index + 1}</span>
              <small>{time}</small>
              <strong>{title}</strong>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="content-section scope-section" aria-labelledby="scope-title">
        <div className="section-heading">
          <span className="section-number">03</span>
          <div>
            <h2 id="scope-title">Choose what belongs in the first version</h2>
            <p>Finish the complete question-to-report path first. Extra features can wait until the core flow is reliable and easy to demonstrate.</p>
          </div>
        </div>
        <div className="scope-columns">
          <div>
            <h3>Must work well</h3>
            <ul className="check-list">
              <li>A question becomes a useful report with checked citations</li>
              <li>The app—not the AI—controls every citation link</li>
              <li>A web API, PostgreSQL database, and background worker</li>
              <li>One-command local setup and tests for critical behavior</li>
            </ul>
          </div>
          <div>
            <h3>Keep small on purpose</h3>
            <ul>
              <li>Redis only for temporary cache and progress</li>
              <li>Kafka only for the three types of background job</li>
              <li>Django Admin only for prompts and model settings</li>
              <li>Kubernetes only for the API and workers</li>
            </ul>
          </div>
          <div>
            <h3>Save for later</h3>
            <ul>
              <li>Uploaded-document search and advanced retrieval (RAG)</li>
              <li>User accounts and payments</li>
              <li>Full dashboards and end-to-end request tracing</li>
              <li>Self-hosted AI models and several cloud providers</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
