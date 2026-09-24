import { useMemo, useState } from "react";

import { dayByNumber, days } from "../data/days";
import { weeks } from "../data/weeks";

type SidebarProps = {
  activeId: string;
  completedDays: Set<string>;
  completedSteps: Set<string>;
  onNavigate: (id: string) => void;
  mobileOpen: boolean;
  onClose: () => void;
};

export function Sidebar({
  activeId,
  completedDays,
  completedSteps,
  onNavigate,
  mobileOpen,
  onClose,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const matching = useMemo(
    () =>
      new Set(
        days
          .filter((day) =>
            [day.title, day.navTitle, ...day.tools]
              .join(" ")
              .toLowerCase()
              .includes(normalized),
          )
          .map((day) => day.day),
      ),
    [normalized],
  );

  function navigate(id: string) {
    onNavigate(id);
    onClose();
  }

  return (
    <>
      <button
        className={`sidebar-scrim ${mobileOpen ? "is-visible" : ""}`}
        aria-label="Close navigation"
        type="button"
        onClick={onClose}
      />
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Guide navigation">
        <div className="brand-block">
          <button className="brand" type="button" onClick={() => navigate("overview")}>
            <span className="brand-mark" aria-hidden="true">E</span>
            <span>
              <strong>EvidenceLab</strong>
              <small>Field guide</small>
            </span>
          </button>
          <button className="mobile-close" type="button" onClick={onClose} aria-label="Close navigation">×</button>
        </div>

        <nav className="primary-links" aria-label="Primary">
          {[
            ["overview", "Roadmap"],
            ["architecture", "Architecture"],
            ["concepts", "Concepts"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={activeId === id ? "is-active" : ""}
              onClick={() => navigate(id)}
            >
              <span>{label}</span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </nav>

        <label className="day-search">
          <span className="sr-only">Filter days</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a day or tool"
          />
        </label>

        <nav className="week-navigation" aria-label="Daily roadmap">
          {weeks.map((week) => {
            const visibleDays = week.days.filter((number) => matching.has(number));
            if (visibleDays.length === 0) return null;
            return (
              <section key={week.number} className="week-nav-group">
                <div className="week-nav-heading">
                  <span>Week {week.number}</span>
                  <small>{week.subtitle}</small>
                </div>
                <ol>
                  {visibleDays.map((number) => {
                    const day = dayByNumber.get(number);
                    if (!day) return null;
                    const isComplete = completedDays.has(day.id);
                    const isInProgress = day.steps.some((step) => completedSteps.has(step.id));
                    return (
                      <li key={day.id}>
                        <button
                          type="button"
                          className={activeId === day.id ? "is-active" : ""}
                          onClick={() => navigate(day.id)}
                          aria-current={activeId === day.id ? "page" : undefined}
                        >
                          <span
                            className={`day-state ${isComplete ? "is-complete" : isInProgress ? "is-progress" : ""}`}
                            aria-label={isComplete ? "Complete" : isInProgress ? "In progress" : "Not started"}
                          >
                            {isComplete ? "✓" : number}
                          </span>
                          <span>{day.navTitle}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
