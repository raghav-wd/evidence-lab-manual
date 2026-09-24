import type { DayGuide } from "../types/guide";
import { directionByDayId } from "./directions";
import { week1Days } from "./week1";
import { week2Days } from "./week2";
import { week3Days } from "./week3";
import { week4Days } from "./week4";

export const days: DayGuide[] = [
  ...week1Days,
  ...week2Days,
  ...week3Days,
  ...week4Days,
];

const expectedDays = Array.from({ length: 30 }, (_, index) => index + 1);
const actualDays = days.map((day) => day.day);
const allStepIds = days.flatMap((day) => day.steps.map((step) => step.id));

if (
  JSON.stringify(actualDays) !== JSON.stringify(expectedDays) ||
  new Set(days.map((day) => day.id)).size !== days.length ||
  new Set(allStepIds).size !== allStepIds.length ||
  days.some((day) => !directionByDayId[day.id]) ||
  Object.keys(directionByDayId).length !== days.length
) {
  throw new Error("Guide data must contain Days 1–30 with unique IDs and one direction map per day.");
}

export const dayById = new Map(days.map((day) => [day.id, day]));

export const dayByNumber = new Map(days.map((day) => [day.day, day]));
