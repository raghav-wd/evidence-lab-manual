import type { ResourceLink } from "../types/guide";

export const openAIResources: ResourceLink[] = [
  {
    label: "Responses API reference",
    href: "https://developers.openai.com/api/reference/resources/responses/methods/create",
    note: "Request fields, tools, structured text, and response objects.",
  },
  {
    label: "Structured Outputs guide",
    href: "https://developers.openai.com/api/docs/guides/structured-outputs",
    note: "Typed model output with Python and Pydantic.",
  },
  {
    label: "Web search guide",
    href: "https://developers.openai.com/api/docs/guides/tools-web-search",
    note: "Hosted search, citations, and source metadata.",
  },
  {
    label: "Current model catalog",
    href: "https://developers.openai.com/api/docs/models",
    note: "Choose a model your API project can access; keep it configurable.",
  },
];

export const sharedRule =
  "Let the model do fuzzy judgment; let ordinary code own IDs, limits, state, permissions, retries, and validation.";
