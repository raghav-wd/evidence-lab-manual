import { useEffect, useMemo, useState } from "react";

import { ArchitecturePage } from "./components/ArchitecturePage";
import { ConceptsPage } from "./components/ConceptsPage";
import { DayPage } from "./components/DayPage";
import { OverviewPage } from "./components/OverviewPage";
import { Sidebar } from "./components/Sidebar";
import { dayById, days } from "./data/days";
import { useGuideProgress } from "./useGuideProgress";

const staticPages = new Set(["overview", "architecture", "concepts"]);

function getRoute(): string {
  const value = window.location.hash.replace(/^#\/?/, "");
  if (staticPages.has(value) || dayById.has(value)) return value;
  return "overview";
}

export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    progress,
    completedSteps,
    completedDays,
    toggleStep,
    toggleDay,
    saveNote,
    visitDay,
    setPlatform,
    toggleTheme,
    reset,
  } = useGuideProgress();

  const activeDay = dayById.get(route);
  const overallPercent = Math.round((completedDays.size / days.length) * 100);
  const currentLabel = activeDay ? `Day ${activeDay.day}` : route === "overview" ? "Roadmap" : route === "architecture" ? "Architecture" : "Concepts";

  useEffect(() => {
    function onHashChange() {
      setRoute(getRoute());
      setSidebarOpen(false);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (activeDay) visitDay(activeDay.id);
  }, [activeDay, visitDay]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", sidebarOpen);
  }, [sidebarOpen]);

  const inProgressDays = useMemo(
    () => days.filter((day) => !completedDays.has(day.id) && day.steps.some((step) => completedSteps.has(step.id))).length,
    [completedDays, completedSteps],
  );

  function navigate(id: string) {
    if (getRoute() === id) {
      setRoute(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.location.hash = id;
  }

  function resetProgress() {
    const confirmed = window.confirm(
      "Reset all completed steps, completed days, notes, and preferences saved in this browser?",
    );
    if (confirmed) reset();
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeId={route}
        completedDays={completedDays}
        completedSteps={completedSteps}
        onNavigate={navigate}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__left">
            <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open guide navigation">
              <span aria-hidden="true">☰</span>
            </button>
            <span className="topbar-label">EvidenceLab guide</span>
            <span className="topbar-divider" aria-hidden="true">/</span>
            <strong>{currentLabel}</strong>
          </div>
          <div className="topbar__right">
            <span className="compact-progress" title={`${inProgressDays} days in progress`}>
              <span>{overallPercent}%</span>
              <i aria-hidden="true"><b style={{ width: `${overallPercent}%` }} /></i>
            </span>
            <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Use ${progress.theme === "light" ? "dark" : "light"} theme`}>
              <span aria-hidden="true">{progress.theme === "light" ? "◐" : "◑"}</span>
            </button>
            <button className="reset-button" type="button" onClick={resetProgress}>Reset</button>
          </div>
        </header>

        <main id="main-content" className="main-content">
          {route === "overview" && (
            <OverviewPage
              completedDays={completedDays}
              lastVisitedDayId={progress.lastVisitedDayId}
              onNavigate={navigate}
            />
          )}
          {route === "architecture" && <ArchitecturePage onNavigate={navigate} />}
          {route === "concepts" && <ConceptsPage onNavigate={navigate} />}
          {activeDay && (
            <DayPage
              day={activeDay}
              platform={progress.platform}
              completedSteps={completedSteps}
              dayComplete={completedDays.has(activeDay.id)}
              note={progress.notesByDay[activeDay.id] ?? ""}
              onToggleStep={toggleStep}
              onToggleDay={toggleDay}
              onSaveNote={saveNote}
              onSetPlatform={setPlatform}
              onNavigate={navigate}
            />
          )}
        </main>

        <footer className="site-footer">
          <span>EvidenceLab Field Guide · Progress stays in this browser.</span>
          <button type="button" onClick={() => navigate("overview")}>Back to roadmap ↑</button>
        </footer>
      </div>
    </div>
  );
}
