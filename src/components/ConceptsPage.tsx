import { useMemo, useState } from "react";

import { days } from "../data/days";

export function ConceptsPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const concepts = useMemo(() => {
    const byTerm = new Map<string, { term: string; meaning: string; inProject: string; day: number; dayId: string }>();
    for (const day of days) {
      for (const concept of day.concepts) {
        const key = concept.term.toLowerCase();
        if (!byTerm.has(key)) byTerm.set(key, { ...concept, day: day.day, dayId: day.id });
      }
    }
    const normalized = query.trim().toLowerCase();
    return [...byTerm.values()]
      .filter((concept) => [concept.term, concept.meaning, concept.inProject].join(" ").toLowerCase().includes(normalized))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [query]);

  return (
    <div className="standard-page page-enter">
      <header className="page-header concepts-header">
        <div>
          <div className="eyebrow">Plain-language glossary</div>
          <h1>Know what each word changes.</h1>
          <p>Definitions are short; the useful part is how each concept behaves inside EvidenceLab.</p>
        </div>
        <label className="concept-search">
          <span>Filter concepts</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try idempotency or schema"
          />
        </label>
      </header>

      <p className="result-count" aria-live="polite">{concepts.length} concepts</p>
      <div className="concept-list">
        {concepts.map((concept) => (
          <article className="concept-row" key={concept.term}>
            <div>
              <h2>{concept.term}</h2>
              <button className="mini-link" type="button" onClick={() => onNavigate(concept.dayId)}>
                Day {concept.day}
              </button>
            </div>
            <p>{concept.meaning}</p>
            <p><span>In EvidenceLab</span>{concept.inProject}</p>
          </article>
        ))}
        {concepts.length === 0 && (
          <div className="empty-state">
            <strong>No matching concept</strong>
            <p>Try a broader word such as “worker”, “state”, or “source”.</p>
          </div>
        )}
      </div>
    </div>
  );
}
