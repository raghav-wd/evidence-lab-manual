import type { DiagramNode, GuideDiagram as GuideDiagramType } from "../types/guide";

function Node({ node }: { node: DiagramNode }) {
  return (
    <div className={`diagram-node diagram-node--${node.kind ?? "plain"}`}>
      <strong>{node.label}</strong>
      {node.detail && <span>{node.detail}</span>}
    </div>
  );
}

export function GuideDiagram({ diagram }: { diagram: GuideDiagramType }) {
  return (
    <figure className={`guide-diagram guide-diagram--${diagram.type}`}>
      <figcaption>
        <strong>{diagram.title}</strong>
        <span>{diagram.description}</span>
      </figcaption>

      {diagram.type === "flow" && (
        <div className="diagram-flow" aria-label={diagram.title}>
          {diagram.nodes.map((node, index) => (
            <div className="diagram-flow__item" key={`${node.label}-${index}`}>
              <Node node={node} />
              {index < diagram.nodes.length - 1 && (
                <span className="diagram-arrow" aria-hidden="true">→</span>
              )}
            </div>
          ))}
        </div>
      )}

      {diagram.type === "fanout" && (
        <div className="diagram-fanout" aria-label={diagram.title}>
          <Node node={diagram.start} />
          <span className="diagram-arrow" aria-hidden="true">→</span>
          <div className="diagram-branches">
            {diagram.branches.map((node, index) => (
              <Node node={node} key={`${node.label}-${index}`} />
            ))}
          </div>
          <span className="diagram-arrow" aria-hidden="true">→</span>
          <Node node={diagram.end} />
        </div>
      )}

      {diagram.type === "layers" && (
        <div className="diagram-layers" aria-label={diagram.title}>
          {diagram.layers.map((node, index) => (
            <div key={`${node.label}-${index}`}>
              <Node node={node} />
              {index < diagram.layers.length - 1 && (
                <span className="diagram-down" aria-hidden="true">↓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}
