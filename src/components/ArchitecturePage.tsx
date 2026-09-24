import { GuideDiagram } from "./GuideDiagram";

const recurringParts = [
  {
    term: "Run",
    meaning: "One complete attempt to answer one user question, from the first request to the final report.",
  },
  {
    term: "API",
    meaning: "The app's front door. Other programs use it to start a run or ask how that run is going.",
  },
  {
    term: "Worker",
    meaning: "A separate program that performs slow work in the background, so the API does not keep the user waiting.",
  },
  {
    term: "PostgreSQL",
    meaning: "The app's permanent memory. Run data stored here remains available after a program restarts.",
  },
  {
    term: "Redis",
    meaning: "A fast scratchpad for cached results and live progress. It is useful, but safe to clear or rebuild.",
  },
  {
    term: "Kafka",
    meaning: "A delivery system for background jobs. It holds messages until the appropriate worker reads them.",
  },
];

const stages = [
  {
    week: 1,
    startDay: 1,
    title: "One Python app does the whole job",
    summary:
      "First, prove that the product is useful. The app should turn one question into a trustworthy report before you add databases, queues, or several services.",
    problem:
      "You do not yet know whether the research steps work well together or whether the citations can be trusted.",
    add:
      "One Python program containing a planner, web researchers, a report writer, and a citation checker.",
    result:
      "You can enter a question and receive one Markdown report whose citation links have been checked by code.",
    diagram: {
      type: "flow" as const,
      title: "Week 1: everything runs in one program",
      description:
        "The steps happen in order inside one running Python app. Keeping them together makes the first version quick to build and easy to debug.",
      nodes: [
        { label: "Question", detail: "entered in the CLI or API" },
        { label: "Planner", detail: "creates 3–5 smaller tasks" },
        { label: "Researchers", detail: "search the web", kind: "accent" as const },
        { label: "Report writer", detail: "uses saved evidence" },
        { label: "Citation check", detail: "turns saved IDs into links", kind: "data" as const },
      ],
    },
    walkthrough: [
      "The user enters a broad question through the command line or the web API.",
      "The planner turns that question into a few focused research tasks.",
      "Researchers run several web searches at the same time, but your code limits how many can run together.",
      "The report writer receives saved facts and source IDs—not a loose list of URLs.",
      "Finally, normal code rejects unknown IDs and inserts the matching source links.",
    ],
    ready: [
      "One question travels through every step without manual intervention.",
      "A made-up source ID causes a clear validation error.",
      "You can explain why the AI writes the prose while code controls the links.",
    ],
  },
  {
    week: 2,
    startDay: 8,
    title: "The database remembers every run",
    summary:
      "Next, separate accepting a request from doing the slow research. The API saves the request quickly; a background worker can finish it even after the original web connection closes.",
    problem:
      "If the one Python process stops, unfinished work and progress held only in memory can disappear.",
    add:
      "PostgreSQL for permanent records and a background worker that looks for queued runs.",
    result:
      "The user gets a tracking ID immediately, and saved checkpoints let a run continue safely after a restart.",
    diagram: {
      type: "flow" as const,
      title: "Week 2: accept now, finish in the background",
      description:
        "The API stores a new run and returns its ID. A worker later claims that run, completes each research stage, and saves progress after every stage.",
      nodes: [
        { label: "Start a run", detail: "POST request" },
        { label: "API", detail: "saves it and returns an ID" },
        { label: "PostgreSQL", detail: "status: queued", kind: "data" as const },
        { label: "Worker", detail: "takes one queued run", kind: "accent" as const },
        { label: "Saved report", detail: "progress survives restarts", kind: "data" as const },
      ],
    },
    walkthrough: [
      "The API receives a question, saves a queued run in PostgreSQL, and returns HTTP 202 with a tracking ID. HTTP 202 means accepted, not finished.",
      "A separate worker asks the database for the next queued run.",
      "The worker briefly locks that database row while claiming it, preventing another worker from taking the same job.",
      "Planning, research, and report writing each save a checkpoint before the worker moves on.",
      "If the worker restarts, it reads the saved state and retries without creating a second report.",
    ],
    ready: [
      "The API responds before the report is finished and exposes progress by run ID.",
      "Two workers do not process the same queued run at the same time.",
      "A restart or repeated request cannot create duplicate final reports.",
    ],
  },
  {
    week: 3,
    startDay: 15,
    title: "Several workers share the workflow",
    summary:
      "Once the database version is reliable, split planning, research, and report writing into specialized workers. This lets independent research tasks run on more than one worker.",
    problem:
      "One general worker limits how much research you can do at once, and repeatedly asking the database for new jobs creates unnecessary work.",
    add:
      "Kafka to deliver jobs, an outbox table to publish them safely, Redis for quick temporary progress, and small workers with one role each.",
    result:
      "You can add more research workers when demand grows without changing the API or risking lost database updates.",
    diagram: {
      type: "flow" as const,
      title: "Week 3: saved jobs move to specialized workers",
      description:
        "The database first saves both the state change and a note in its outbox. That note is published to Kafka, which delivers work to the planner, researcher, or report-writing worker. Redis is a removable speed layer beside this durable path.",
      nodes: [
        { label: "PostgreSQL", detail: "run + outbox note", kind: "data" as const },
        { label: "Publisher", detail: "sends unsent notes" },
        { label: "Kafka", detail: "holds job messages", kind: "accent" as const },
        { label: "Specialized workers", detail: "plan · research · write" },
        { label: "PostgreSQL", detail: "saved progress + report", kind: "data" as const },
      ],
    },
    walkthrough: [
      "When the app changes a run, it also writes an outbox row in the same database transaction. Either both records are saved or neither is.",
      "A publisher reads unsent outbox rows and sends their job messages to Kafka.",
      "Kafka keeps each message until a worker responsible for that kind of job receives it.",
      "Kafka may deliver a message again, so each worker checks PostgreSQL before creating an effect that already exists.",
      "Redis can answer frequent progress checks quickly, but PostgreSQL remains the permanent source of truth.",
    ],
    ready: [
      "Planning, research, and report writing run as separate worker programs.",
      "Repeating the same Kafka message does not duplicate evidence or reports.",
      "Clearing Redis makes reads slower, not incorrect, because durable data stays in PostgreSQL.",
    ],
  },
  {
    week: 4,
    startDay: 22,
    title: "Package the system and prove it behaves well",
    summary:
      "Finally, make the collection of services easy to start and inspect. Then test both normal behavior and failure behavior before presenting it as finished work.",
    problem:
      "A multi-service app is hard for someone else to run, and a happy-path demo alone does not prove that it is reliable.",
    add:
      "Docker Compose for local setup, useful logs and measurements, Kubernetes for running process copies, plus failure tests and quality evaluations.",
    result:
      "Another engineer can start the project, see whether each part is healthy, reproduce failures, and understand the evidence behind your quality claims.",
    diagram: {
      type: "fanout" as const,
      title: "Week 4: one tested image, several running roles",
      description:
        "The same container image can start as the API or as one of three workers. Kubernetes keeps the requested number of copies running; PostgreSQL, Redis, and Kafka keep their specialized data roles.",
      start: { label: "One app image", detail: "the packaged Python code" },
      branches: [
        { label: "API", detail: "receives web requests", kind: "accent" as const },
        { label: "Planner worker", detail: "creates tasks" },
        { label: "Research workers", detail: "scale up independently", kind: "accent" as const },
        { label: "Report worker", detail: "writes final answer" },
      ],
      end: { label: "External data tools", detail: "PostgreSQL · Redis · Kafka", kind: "data" as const },
    },
    walkthrough: [
      "Docker builds the Python code and its dependencies into one repeatable image.",
      "That image starts with a different command for the API, planner, researchers, or report writer.",
      "Kubernetes Deployments keep the requested number of each program running and can add more research workers independently.",
      "Health checks answer two separate questions: is this program alive, and is it ready to receive work?",
      "Controlled outages, logs, measurements, and a fixed question set show how the system recovers and how good its reports are.",
    ],
    ready: [
      "One Docker Compose command starts the whole local system.",
      "You can explain what happens when a worker or Redis stops and then returns.",
      "Your README, evaluation results, and short demo support every reliability claim you make.",
    ],
  },
];

export function ArchitecturePage({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="standard-page page-enter">
      <header className="page-header architecture-header">
        <div className="eyebrow">Architecture · how the parts fit together</div>
        <h1>Start simple. Add one kind of complexity at a time.</h1>
        <p>
          Architecture simply means deciding where work happens and where information is kept.
          You are not building four different products: you are improving the same question-to-report
          flow each week as its needs become clearer.
        </p>
      </header>

      <section className="architecture-basics" aria-labelledby="architecture-basics-title">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div>
            <h2 id="architecture-basics-title">Six words to know before the diagrams</h2>
            <p>These names repeat throughout the guide. Read them as jobs, not as mysterious technologies.</p>
          </div>
        </div>
        <dl className="architecture-basics__grid">
          {recurringParts.map((part) => (
            <div key={part.term}>
              <dt>{part.term}</dt>
              <dd>{part.meaning}</dd>
            </div>
          ))}
        </dl>
        <div className="diagram-legend" aria-label="Diagram key">
          <strong>How to read the diagrams:</strong>
          <span><i className="legend-swatch legend-swatch--arrow" aria-hidden="true">→</i> work or data moves</span>
          <span><i className="legend-swatch legend-swatch--stored" aria-hidden="true" /> double border means saved data</span>
          <span><i className="legend-swatch legend-swatch--temporary" aria-hidden="true" /> dashed border means temporary data</span>
        </div>
      </section>

      <section className="architecture-roadmap" aria-labelledby="architecture-roadmap-title">
        <div className="section-heading architecture-roadmap__heading">
          <span className="section-number">02</span>
          <div>
            <h2 id="architecture-roadmap-title">How the system changes each week</h2>
            <p>For every stage, connect the new tool to the concrete problem it solves.</p>
          </div>
        </div>

        <div className="architecture-timeline">
          {stages.map((stage) => (
            <article className="architecture-stage" key={stage.week}>
              <div className="architecture-stage__marker">Week {stage.week}</div>
              <div className="architecture-stage__body">
                <h2>{stage.title}</h2>
                <p className="architecture-stage__summary">{stage.summary}</p>

                <div className="architecture-change-grid">
                  <div>
                    <span>Problem</span>
                    <p>{stage.problem}</p>
                  </div>
                  <div>
                    <span>What you add</span>
                    <p>{stage.add}</p>
                  </div>
                  <div>
                    <span>Result</span>
                    <p>{stage.result}</p>
                  </div>
                </div>

                <GuideDiagram diagram={stage.diagram} />

                <div className="architecture-explanation">
                  <div>
                    <h3>Read the diagram from left to right</h3>
                    <ol>
                      {stage.walkthrough.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  </div>
                  <div>
                    <h3>Move on when</h3>
                    <ul className="check-list">
                      {stage.ready.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </div>

                <button
                  className="text-link"
                  type="button"
                  onClick={() => onNavigate(`day-${String(stage.startDay).padStart(2, "0")}`)}
                >
                  Start Week {stage.week} on Day {stage.startDay} <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="principle-banner">
        <span>The rule that stays the same all month</span>
        <p>
          Use AI for choices that need interpretation. Use normal code for rules that must never
          be ambiguous: IDs, saved state, cost limits, retries, permissions, and citation links.
        </p>
      </section>
    </div>
  );
}
