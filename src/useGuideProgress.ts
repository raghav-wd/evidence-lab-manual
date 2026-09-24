import { useCallback, useEffect, useMemo, useState } from "react";

import type { GuideProgress, Platform } from "./types/guide";

const STORAGE_KEY = "evidencelab-guide-progress:v1";

const defaultProgress: GuideProgress = {
  version: 1,
  completedStepIds: [],
  completedDayIds: [],
  notesByDay: {},
  lastVisitedDayId: "day-01",
  platform: "powershell",
  theme: "light",
};

function readProgress(): GuideProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultProgress;
    const parsed = JSON.parse(stored) as Partial<GuideProgress>;
    if (parsed.version !== 1) return defaultProgress;
    return {
      ...defaultProgress,
      ...parsed,
      completedStepIds: parsed.completedStepIds ?? [],
      completedDayIds: parsed.completedDayIds ?? [],
      notesByDay: parsed.notesByDay ?? {},
    };
  } catch {
    return defaultProgress;
  }
}

export function useGuideProgress() {
  const [progress, setProgress] = useState<GuideProgress>(readProgress);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    document.documentElement.dataset.theme = progress.theme;
  }, [progress]);

  const toggleStep = useCallback((stepId: string) => {
    setProgress((current) => ({
      ...current,
      completedStepIds: current.completedStepIds.includes(stepId)
        ? current.completedStepIds.filter((id) => id !== stepId)
        : [...current.completedStepIds, stepId],
    }));
  }, []);

  const toggleDay = useCallback((dayId: string) => {
    setProgress((current) => ({
      ...current,
      completedDayIds: current.completedDayIds.includes(dayId)
        ? current.completedDayIds.filter((id) => id !== dayId)
        : [...current.completedDayIds, dayId],
    }));
  }, []);

  const saveNote = useCallback((dayId: string, value: string) => {
    setProgress((current) => ({
      ...current,
      notesByDay: { ...current.notesByDay, [dayId]: value },
    }));
  }, []);

  const visitDay = useCallback((dayId: string) => {
    setProgress((current) => ({ ...current, lastVisitedDayId: dayId }));
  }, []);

  const setPlatform = useCallback((platform: Platform) => {
    setProgress((current) => ({ ...current, platform }));
  }, []);

  const toggleTheme = useCallback(() => {
    setProgress((current) => ({
      ...current,
      theme: current.theme === "light" ? "dark" : "light",
    }));
  }, []);

  const reset = useCallback(() => setProgress(defaultProgress), []);

  const completedSteps = useMemo(
    () => new Set(progress.completedStepIds),
    [progress.completedStepIds],
  );
  const completedDays = useMemo(
    () => new Set(progress.completedDayIds),
    [progress.completedDayIds],
  );

  return {
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
  };
}
