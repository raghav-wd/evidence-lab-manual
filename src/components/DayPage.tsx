import { useEffect, useMemo, useRef, useState } from "react";

import { dayByNumber } from "../data/days";
import { directionByDayId, projectStages } from "../data/directions";
import type { DayGuide, GuideStep, Platform } from "../types/guide";
import { CodeBlock } from "./CodeBlock";
import { GuideDiagram } from "./GuideDiagram";
import { inlineText } from "./InlineText";

type DayPageProps = {
  day: DayGuide;
  platform: Platform;
  completedSteps: Set<string>;
  dayComplete: boolean;
  note: string;
  onToggleStep: (stepId: string) => void;
  onToggleDay: (dayId: string) => void;
  onSaveNote: (dayId: string, value: string) => void;
  onSetPlatform: (platform: Platform) => void;
  onNavigate: (id: string) => void;
};

function StepCard({
  step,
  number,
  complete,
  platform,
  onToggle,
}: {
  step: GuideStep;
  number: number;
  complete: boolean;
  platform: Platform;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(!complete);

  return (
    <article className={`build-step ${complete ? "is-complete" : ""}`}>
      <div className="build-step__header">
        <span className="build-step__number">{String(number).padStart(2, "0")}</span>
        <button
          className="step-expand"
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span>
            <strong>{step.title}</strong>
            <small>{complete ? "Done" : "Open for instructions"}</small>
          </span>
          <span className="chevron" aria-hidden="true">⌄</span>
        </button>
        <label className="step-check">
          <input type="checkbox" checked={complete} onChange={onToggle} />
          <span className="sr-only">Mark “{step.title}” complete</span>
        </label>
      </div>

      {expanded && (
        <div className="build-step__content">
          <p>{inlineText(step.explanation)}</p>
          {step.actions && (
            <ol className="action-list">
              {step.actions.map((action) => <li key={action}>{inlineText(action)}</li>)}
            </ol>
          )}
          {step.code?.map((sample, index) => (
            <CodeBlock sample={sample} platform={platform} key={`${sample.label}-${index}`} />
          ))}
          {step.why && (
            <aside className="why-note">
              <strong>Why you are doing this</strong>
              <p>{inlineText(step.why)}</p>
            </aside>
          )}
          {step.expected && (
            <div className="expected-result">
              <span aria-hidden="true">✓</span>
              <p><strong>What you should see:</strong> {inlineText(step.expected)}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function DayPage({
  day,
  platform,
  completedSteps,
  dayComplete,
  note,
  onToggleStep,
  onToggleDay,
  onSaveNote,
  onSetPlatform,
  onNavigate,
}: DayPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [noteSaved, setNoteSaved] = useState(true);
  const completedCount = useMemo(
    () => day.steps.filter((step) => completedSteps.has(step.id)).length,
    [completedSteps, day.steps],
  );
  const percent = Math.round((completedCount / day.steps.length) * 100);
  const previous = dayByNumber.get(day.day - 1);
  const next = dayByNumber.get(day.day + 1);
  const direction = directionByDayId[day.id];

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [day.id]);

  function updateNote(value: string) {
    setNoteSaved(false);
    onSaveNote(day.id, value);
    window.setTimeout(() => setNoteSaved(true), 350);
  }

  return (
    <article className="day-page page-enter">
      <header className="day-header">
        <div className="day-header__meta">
          <span className="eyebrow">Week {day.week} · Day {day.day}</span>
          <span>{day.time}</span>
        </div>
        <h1 ref={headingRef} tabIndex={-1}>{day.title}</h1>
        <span className="day-goal-label">Today's goal</span>
        <p className="day-outcome">{day.outcome}</p>
        <span className="tool-label">Tools used today</span>
        <div className="tool-row" aria-label="Tools used today">
          {day.tools.map((tool) => <span key={tool}>{tool}</span>)}
        </div>
        <div className="day-progress-row">
          <div>
            <span>Build progress</span>
            <strong>{completedCount} of {day.steps.length} steps</strong>
          </div>
          <div className="progress-track" role="progressbar" aria-label="Today's build progress" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      </header>

      <section className="project-direction" aria-labelledby={`${day.id}-direction`}>
        <div className="day-section__heading project-direction__heading">
          <span>Your place in the project</span>
          <h2 id={`${day.id}-direction`}>See how today's work changes EvidenceLab.</h2>
          <p>Read this once before opening the code steps. It is the map for today's work.</p>
        </div>

        <ol className="project-stage-path" aria-label="Four-week project path">
          {projectStages.map((stage) => {
            const state = stage.week < day.week ? "is-past" : stage.week === day.week ? "is-current" : "is-future";
            return (
              <li className={state} key={stage.week} aria-current={stage.week === day.week ? "step" : undefined}>
                <span>Week {stage.week}</span>
                <strong>{stage.short}</strong>
                <small>{stage.detail}</small>
              </li>
            );
          })}
        </ol>

        <div className="direction-change-grid">
          <div>
            <span>Where you are starting</span>
            <p>{direction.startingPoint}</p>
          </div>
          <div className="is-today">
            <span>What changes today</span>
            <p>{direction.change}</p>
          </div>
          <div>
            <span>Where you will finish</span>
            <p>{direction.endState}</p>
          </div>
        </div>

        <div className="direction-plan">
          <div>
            <h3>What you will actually do</h3>
            <ol>
              {direction.plan.map((item) => <li key={item}>{inlineText(item)}</li>)}
            </ol>
          </div>
          <aside>
            <span>What this unlocks</span>
            <p>{direction.unlocks}</p>
          </aside>
        </div>
      </section>

      <section className="why-now">
        <span>Why this day comes now</span>
        <p>{day.whyNow}</p>
      </section>

      {day.diagram && <GuideDiagram diagram={day.diagram} />}

      <section className="day-section before-section" aria-labelledby={`${day.id}-before`}>
        <div className="day-section__heading">
          <span>Before you start</span>
          <h2 id={`${day.id}-before`}>Check what you need and what you will create.</h2>
        </div>
        <div className="before-grid">
          <div>
            <h3>Prerequisites</h3>
            <ul>
              {day.prerequisites.map((item) => <li key={item}>{inlineText(item)}</li>)}
            </ul>
          </div>
          <div>
            <h3>Today produces</h3>
            <ul className="file-list">
              {day.deliverables.map((item) => <li key={item}>{inlineText(item)}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="day-section" aria-labelledby={`${day.id}-mental-model`}>
        <div className="day-section__heading">
          <span>Ideas to understand first</span>
          <h2 id={`${day.id}-mental-model`}>Learn the few terms the steps depend on.</h2>
        </div>
        <div className="concept-grid">
          {day.concepts.map((concept) => (
            <article key={concept.term}>
              <h3>{concept.term}</h3>
              <p>{concept.meaning}</p>
              <div>
                <span>In EvidenceLab</span>
                <p>{inlineText(concept.inProject)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="day-section" aria-labelledby={`${day.id}-build`}>
        <div className="day-section__heading build-heading">
          <div>
            <span>Do the work</span>
            <h2 id={`${day.id}-build`}>Follow these steps in order, one open section at a time.</h2>
          </div>
          <div className="platform-switch" role="group" aria-label="Command platform">
            <button className={platform === "powershell" ? "is-active" : ""} type="button" onClick={() => onSetPlatform("powershell")}>PowerShell</button>
            <button className={platform === "bash" ? "is-active" : ""} type="button" onClick={() => onSetPlatform("bash")}>Bash</button>
          </div>
        </div>
        <div className="build-list">
          {day.steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              number={index + 1}
              complete={completedSteps.has(step.id)}
              platform={platform}
              onToggle={() => onToggleStep(step.id)}
            />
          ))}
        </div>
      </section>

      <section className="day-section break-section" aria-labelledby={`${day.id}-break`}>
        <div className="day-section__heading">
          <span>Test your understanding with a safe failure</span>
          <h2 id={`${day.id}-break`}>{day.failure.title}</h2>
        </div>
        <ol className="action-list">
          {day.failure.steps.map((step) => <li key={step}>{inlineText(step)}</li>)}
        </ol>
        <div className="break-results">
          <div><span>Expected</span><p>{inlineText(day.failure.expected)}</p></div>
          <div><span>Lesson</span><p>{inlineText(day.failure.lesson)}</p></div>
        </div>
      </section>

      <section className="day-section finish-section" aria-labelledby={`${day.id}-finish`}>
        <div className="day-section__heading">
          <span>How to know you are done</span>
          <h2 id={`${day.id}-finish`}>Check the result, not just the code.</h2>
        </div>
        <ul className="completion-list">
          {day.checks.map((check) => <li key={check}><span aria-hidden="true">✓</span>{inlineText(check)}</li>)}
        </ul>
        <blockquote>
          <span>Say this in your own words</span>
          <p>“{day.explain}”</p>
        </blockquote>
        {day.commit && (
          <div className="commit-line">
            <span>Suggested commit</span>
            <code>git commit -m &quot;{day.commit}&quot;</code>
          </div>
        )}
      </section>

      {day.resources && day.resources.length > 0 && (
        <section className="day-section resource-section" aria-labelledby={`${day.id}-resources`}>
          <div className="day-section__heading">
            <span>Official references</span>
            <h2 id={`${day.id}-resources`}>Use these when a tool or API behaves differently.</h2>
          </div>
          <div className="resource-list">
            {day.resources.map((resource) => (
              <a href={resource.href} target="_blank" rel="noreferrer" key={resource.href}>
                <strong>{resource.label}<span aria-hidden="true">↗</span></strong>
                <span>{resource.note}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="day-section notes-section" aria-labelledby={`${day.id}-notes`}>
        <div className="day-section__heading notes-heading">
          <div>
            <span>Your lab notes</span>
            <h2 id={`${day.id}-notes`}>Record what happened in your own words.</h2>
          </div>
          <small aria-live="polite">{noteSaved ? "Saved locally" : "Saving…"}</small>
        </div>
        <textarea
          value={note}
          onChange={(event) => updateNote(event.target.value)}
          placeholder="What did you build? What did you observe? What was confusing, and how would you explain it now?"
          rows={7}
        />
      </section>

      <div className="complete-day-panel">
        <div>
          <span>Day {day.day}</span>
          <strong>{dayComplete ? "Marked complete" : "Ready when you can explain it"}</strong>
        </div>
        <button
          className={`button ${dayComplete ? "button--complete" : "button--primary"}`}
          type="button"
          onClick={() => onToggleDay(day.id)}
        >
          {dayComplete ? "✓ Completed" : "Mark day complete"}
        </button>
      </div>

      <nav className="day-pagination" aria-label="Adjacent days">
        {previous ? (
          <button type="button" onClick={() => onNavigate(previous.id)}>
            <span>← Previous</span>
            <strong>Day {previous.day}: {previous.navTitle}</strong>
          </button>
        ) : <span />}
        {next ? (
          <button type="button" onClick={() => onNavigate(next.id)}>
            <span>Next →</span>
            <strong>Day {next.day}: {next.navTitle}</strong>
          </button>
        ) : (
          <button type="button" onClick={() => onNavigate("overview")}>
            <span>Return</span>
            <strong>Roadmap overview</strong>
          </button>
        )}
      </nav>
    </article>
  );
}
