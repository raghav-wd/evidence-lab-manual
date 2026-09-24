export type Platform = "powershell" | "bash";

export type CodeSample = {
  label: string;
  language: string;
  code: string;
  bashCode?: string;
};

export type GuideStep = {
  id: string;
  title: string;
  explanation: string;
  actions?: string[];
  code?: CodeSample[];
  why?: string;
  expected?: string;
};

export type Concept = {
  term: string;
  meaning: string;
  inProject: string;
};

export type DiagramNode = {
  label: string;
  detail?: string;
  kind?: "plain" | "accent" | "data" | "temporary";
};

export type GuideDiagram =
  | {
      type: "flow";
      title: string;
      description: string;
      nodes: DiagramNode[];
    }
  | {
      type: "fanout";
      title: string;
      description: string;
      start: DiagramNode;
      branches: DiagramNode[];
      end: DiagramNode;
    }
  | {
      type: "layers";
      title: string;
      description: string;
      layers: DiagramNode[];
    };

export type FailureExperiment = {
  title: string;
  steps: string[];
  expected: string;
  lesson: string;
};

export type ResourceLink = {
  label: string;
  href: string;
  note: string;
};

export type DayGuide = {
  id: string;
  day: number;
  week: number;
  title: string;
  navTitle: string;
  time: string;
  tools: string[];
  outcome: string;
  whyNow: string;
  prerequisites: string[];
  deliverables: string[];
  diagram?: GuideDiagram;
  concepts: Concept[];
  steps: GuideStep[];
  failure: FailureExperiment;
  checks: string[];
  explain: string;
  commit?: string;
  resources?: ResourceLink[];
};

export type WeekGuide = {
  number: number;
  title: string;
  subtitle: string;
  days: number[];
  goal: string;
  definitionOfDone: string[];
};

export type GuideProgress = {
  version: 1;
  completedStepIds: string[];
  completedDayIds: string[];
  notesByDay: Record<string, string>;
  lastVisitedDayId: string;
  platform: Platform;
  theme: "light" | "dark";
};
