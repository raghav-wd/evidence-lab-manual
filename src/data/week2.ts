import type { DayGuide } from "../types/guide";

export const week2Days: DayGuide[] = [
  {
    id: "day-08",
    day: 8,
    week: 2,
    title: "Add PostgreSQL and migrations",
    navTitle: "PostgreSQL + Alembic",
    time: "2.5–3 hours",
    tools: ["PostgreSQL", "SQLAlchemy async", "Alembic"],
    outcome: "By the end of today, EvidenceLab can connect to a local PostgreSQL database. Committed data survives an API restart, and Alembic records every future database-structure change.",
    whyNow: "In Week 1, one Python process passed data through memory and JSON files. A separate API and worker cannot share that memory, so Week 2 starts by giving both of them one durable place to read and write. Today is only the foundation: start PostgreSQL, connect to it, and set up migrations.",
    prerequisites: ["The Week 1 API and tests work.", "Docker Desktop is installed and running."],
    deliverables: ["A running PostgreSQL container with a named data volume", "A validated `DATABASE_URL` setting", "An async session factory in `app/db.py`", "An Alembic `migrations/` directory"],
    diagram: { type: "flow", title: "How data becomes durable", description: "Python values are temporary. SQLAlchemy sends changes inside a transaction, and PostgreSQL keeps them only after a successful commit.", nodes: [
      { label: "Python objects", detail: "temporary memory" },
      { label: "SQLAlchemy", detail: "unit of work" },
      { label: "Transaction", detail: "all or nothing", kind: "accent" },
      { label: "PostgreSQL", detail: "durable truth", kind: "data" },
    ] },
    concepts: [
      { term: "Transaction", meaning: "A group of database changes that either all succeed or all get undone.", inProject: "Later, EvidenceLab can save a run and its next command together instead of saving only half of the work." },
      { term: "Migration", meaning: "A numbered file that describes one change to the database structure.", inProject: "Running the same migrations gives every developer and deployment the same tables and columns." },
      { term: "Session", meaning: "The short-lived SQLAlchemy object used to read rows, change rows, and commit a unit of work.", inProject: "Each API request or worker operation opens a session, finishes its database work, and closes it." },
    ],
    steps: [
      { id: "day-08-step-01", title: "Start PostgreSQL without losing its data on restart", explanation: "Run PostgreSQL in Docker and attach a named volume. The container is the running database process; the volume is where its data lives even when that process stops.", code: [{ label: "PowerShell", language: "powershell", code: String.raw`docker volume create evidencelab-postgres-data
docker run --name evidencelab-postgres -e POSTGRES_USER=research -e POSTGRES_PASSWORD=research -e POSTGRES_DB=evidencelab -p 5432:5432 -v evidencelab-postgres-data:/var/lib/postgresql/data -d postgres:17`, bashCode: String.raw`docker volume create evidencelab-postgres-data
docker run --name evidencelab-postgres \
  -e POSTGRES_USER=research \
  -e POSTGRES_PASSWORD=research \
  -e POSTGRES_DB=evidencelab \
  -p 5432:5432 \
  -v evidencelab-postgres-data:/var/lib/postgresql/data \
  -d postgres:17` }], expected: "`docker ps` lists `evidencelab-postgres` as running. If you stop and start that container, it uses the same named volume." },
      { id: "day-08-step-02", title: "Install the three database libraries", explanation: "SQLAlchemy gives Python a database interface, asyncpg is the PostgreSQL driver it uses, and Alembic keeps a history of table changes. Install them inside the active virtual environment.", code: [{ label: "Terminal", language: "shell", code: "python -m pip install \"sqlalchemy[asyncio]\" asyncpg alembic" }], expected: "The command finishes without errors, and `python -m pip show sqlalchemy asyncpg alembic` finds all three packages." },
      { id: "day-08-step-03", title: "Tell EvidenceLab how to open a database session", explanation: "Add the connection URL to settings, then create one shared engine and a factory that produces a fresh session for each request or worker operation.", code: [
        { label: "Add to .env.example and .env", language: "dotenv", code: "DATABASE_URL=postgresql+asyncpg://research:research@localhost:5432/evidencelab" },
        { label: "Add inside the Settings class in app/config.py", language: "python", code: String.raw`database_url: str = (
    "postgresql+asyncpg://research:research@localhost:5432/evidencelab"
)` },
        { label: "app/db.py", language: "python", code: String.raw`from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


engine = create_async_engine(
    get_settings().database_url,
    pool_pre_ping=True,
)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session` },
      ], why: "Creating the engine does not create tables. It only prepares connections. `pool_pre_ping` checks an old connection before reuse, but later code still needs sensible retry handling.", expected: "Importing `app.db` succeeds. Opening a session and running `SELECT 1` returns `1`." },
      { id: "day-08-step-04", title: "Create the migration workspace", explanation: "Alembic generates a `migrations/` directory that will hold ordered schema changes. Configure `migrations/env.py` to read the same settings and SQLAlchemy metadata as the application; do not copy a password into `alembic.ini`.", code: [{ label: "Terminal", language: "shell", code: String.raw`alembic init -t async migrations
# In migrations/env.py import your Base and set:
# target_metadata = Base.metadata
alembic current` }], expected: "Alembic connects successfully and reports no revision yet." },
    ],
    failure: { title: "See what happens when PostgreSQL is unavailable", steps: ["Run `docker stop evidencelab-postgres`.", "Call an endpoint or small script that opens a database session.", "Run `docker start evidencelab-postgres`, wait for it to become ready, and retry."], expected: "Only the database-dependent operation fails. The Python process may still be alive even though it cannot do useful database work.", lesson: "‘The process is running’ and ‘the service can reach what it needs’ are different checks. This is why later you will have separate liveness and readiness endpoints." },
    checks: ["`docker ps` shows the PostgreSQL container running.", "Restarting the container keeps previously committed test data.", "Settings rejects a missing or malformed `DATABASE_URL`.", "An async session can run `SELECT 1`.", "You know that future table changes belong in Alembic migrations, not manual SQL."],
    explain: "PostgreSQL is EvidenceLab's shared, durable memory. SQLAlchemy opens short-lived sessions for database work, and Alembic applies the same ordered schema changes everywhere.",
    commit: "day 8: add async postgres foundation",
  },
  {
    id: "day-09",
    day: 9,
    week: 2,
    title: "Model runs, tasks, evidence, and reports",
    navTitle: "Durable schema",
    time: "3 hours",
    tools: ["SQLAlchemy 2", "UUID", "JSONB", "Indexes"],
    outcome: "PostgreSQL contains five connected tables for runs, tasks, sources, evidence, and reports. The database itself rejects broken links and important duplicates.",
    whyNow: "Day 8 gave EvidenceLab an empty database connection. Today you decide exactly what must survive: the original request, each unit of work, every source and evidence item, and the final report. These rows will become the shared language between the API and workers.",
    prerequisites: ["Day 8 can connect to PostgreSQL and `alembic current` runs successfully."],
    deliverables: ["Five SQLAlchemy models in `app/models.py`", "The first generated and applied migration", "Verified foreign-key and uniqueness rules"],
    diagram: { type: "layers", title: "Store the journey, not only the final answer", description: "The final report sits on top of a traceable chain. Keeping each earlier step lets you show progress, recover after failure, and explain where every claim came from.", layers: [
      { label: "research_runs", detail: "question + state" },
      { label: "research_tasks", detail: "independent work" },
      { label: "sources + evidence_items", detail: "provenance", kind: "accent" },
      { label: "reports", detail: "one structured + rendered result", kind: "data" },
    ] },
    concepts: [
      { term: "Primary key", meaning: "A value that uniquely identifies one row.", inProject: "A run keeps the same UUID when it moves between the API, database, worker, and later Kafka messages." },
      { term: "Foreign key", meaning: "A database rule that says one row must point to a real row in another table.", inProject: "A task, source, evidence item, or report cannot refer to a research run that does not exist." },
      { term: "Unique constraint", meaning: "A database rule that refuses a duplicate value or duplicate combination.", inProject: "One run cannot accidentally store the same source URL twice or produce two final reports." },
      { term: "JSONB", meaning: "PostgreSQL's format for storing structured JSON that can still be queried.", inProject: "Flexible model output can stay JSON while important workflow fields such as status remain normal columns." },
    ],
    steps: [
      { id: "day-09-step-01", title: "Describe the five kinds of records", explanation: "Create one SQLAlchemy class per table. Read the code once from top to bottom: a run owns tasks, sources, evidence items, and one report. Keep changing statuses as strings for this first version, while foreign keys and unique constraints enforce the relationships that must never break.", code: [{ label: "app/models.py", language: "python", code: String.raw`import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ResearchRun(Base):
    __tablename__ = "research_runs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    maximum_research_tasks: Mapped[int] = mapped_column(Integer, default=4)
    maximum_sources: Mapped[int] = mapped_column(Integer, default=12)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (Index("ix_runs_status_created", "status", "created_at"),)


class ResearchTaskRecord(Base):
    __tablename__ = "research_tasks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    task_key: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(100))
    question: Mapped[str] = mapped_column(Text)
    search_queries: Mapped[list[str]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(30), default="queued")
    result: Mapped[dict | None] = mapped_column(JSONB)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("run_id", "task_key"),)


class SourceRecord(Base):
    __tablename__ = "sources"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    source_code: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    __table_args__ = (
        UniqueConstraint("run_id", "source_code"),
        UniqueConstraint("run_id", "url"),
    )


class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_tasks.id", ondelete="CASCADE"))
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    statement: Mapped[str] = mapped_column(Text)
    excerpt: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[str] = mapped_column(String(20))


class ReportRecord(Base):
    __tablename__ = "reports"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_runs.id", ondelete="CASCADE"), unique=True)
    structured_report: Mapped[dict] = mapped_column(JSONB)
    markdown_report: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())` }], expected: "`python -c \"from app.models import Base; print(Base.metadata.tables.keys())\"` lists all five table names." },
      { id: "day-09-step-02", title: "Turn the Python models into real tables", explanation: "Ask Alembic to compare the models with the empty database and generate a migration. Treat the generated file as a draft: open it and confirm it creates the five expected tables, keys, indexes, and constraints before applying it.", code: [{ label: "Terminal", language: "shell", code: String.raw`alembic revision --autogenerate -m "create research workflow schema"
# Read the new migrations/versions/*.py file.
alembic upgrade head
alembic current` }], expected: "Current revision matches `head`, and all five tables exist." },
      { id: "day-09-step-03", title: "Prove the database rejects invalid records", explanation: "Do not merely trust the model definitions. Insert a valid run first, then deliberately try three invalid writes. Catch each integrity error and roll back so the session can be used again.", actions: ["Try the same source URL twice for one run; the second insert must fail.", "Try two reports for one run; the second insert must fail.", "Try a task with a random, missing run ID; the insert must fail.", "Call `await session.rollback()` after each expected integrity error."], expected: "PostgreSQL accepts the valid records and rejects all three invalid writes without leaving partial rows." },
    ],
    failure: { title: "Try to save a task whose run does not exist", steps: ["Create a task with a newly generated `run_id` that is not in `research_runs`.", "Flush or commit the session.", "Catch the integrity error and roll back the session."], expected: "PostgreSQL refuses the task, and no orphan row is stored.", lesson: "The rule lives in PostgreSQL, so it protects the data no matter whether a future write comes from the API, worker A, worker B, or a maintenance script." },
    checks: ["A fresh database reaches the current schema using only `alembic upgrade head`.", "The database contains all five expected tables.", "Tasks, sources, evidence, and reports point to runs through foreign keys.", "One run cannot contain duplicate source URLs or more than one report.", "Status and attempt count are normal columns that a worker can query efficiently."],
    explain: "I store stable workflow facts in normal columns and flexible model payloads in JSONB. Foreign keys connect the research trail, while unique constraints stop duplicates even when several processes write at the same time.",
    commit: "day 9: create durable research schema",
  },
  {
    id: "day-10",
    day: 10,
    week: 2,
    title: "Accept a run and return immediately",
    navTitle: "Asynchronous run API",
    time: "2.5 hours",
    tools: ["HTTP 202", "UUID", "Repositories"],
    outcome: "`POST /v1/research-runs` saves a queued row and returns its ID immediately. Two GET endpoints let the caller check that row and fetch the report when it eventually exists.",
    whyNow: "On Day 9 you created a place to store a run. Now stop making the browser wait several minutes for research. The API's job is to accept and remember the request; a worker will do the slow work tomorrow.",
    prerequisites: ["The Day 9 migration is applied and the five workflow tables exist."],
    deliverables: ["Repository methods for runs and reports", "Create, status, and report routes", "An immediate `202 Accepted` response with a stable run ID"],
    diagram: { type: "fanout", title: "Accepted does not mean finished", description: "The API validates and stores the request, then returns a tracking ID. The caller uses that ID to read durable status while a separate worker performs the slow work later.", start: { label: "POST /runs", detail: "validated request" }, branches: [
      { label: "202 + run_id", detail: "client continues", kind: "accent" },
      { label: "queued row", detail: "worker can claim", kind: "data" },
    ], end: { label: "GET status/report", detail: "read durable truth" } },
    concepts: [
      { term: "202 Accepted", meaning: "The server saved the request but has not finished the requested work.", inProject: "EvidenceLab returns a run ID now and produces the report later." },
      { term: "Polling", meaning: "A client checks the same status URL every few seconds until the state changes.", inProject: "Swagger or the future CLI calls `GET /runs/{id}` until it sees `completed`, `failed`, or `cancelled`." },
      { term: "Repository", meaning: "A small class that collects database reads and writes for one part of the application.", inProject: "Routes ask `RunRepository` for a run instead of containing SQLAlchemy queries themselves." },
    ],
    steps: [
      { id: "day-10-step-01", title: "Put run database operations in one repository", explanation: "Create the few database operations the routes need: add a queued run, find a run by ID, and find its report. The repository calls `flush()` so the new UUID is available, but it does not commit; the route or service decides when the whole operation is safely complete.", code: [{ label: "app/repositories.py", language: "python", code: String.raw`import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ReportRecord, ResearchRun


class RunRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, *, question: str, maximum_tasks: int, maximum_sources: int) -> ResearchRun:
        run = ResearchRun(
            question=question,
            maximum_research_tasks=maximum_tasks,
            maximum_sources=maximum_sources,
        )
        self.session.add(run)
        await self.session.flush()
        return run

    async def get(self, run_id: uuid.UUID) -> ResearchRun | None:
        return await self.session.get(ResearchRun, run_id)

    async def get_report(self, run_id: uuid.UUID) -> ReportRecord | None:
        return await self.session.scalar(
            select(ReportRecord).where(ReportRecord.run_id == run_id)
        )` }], why: "`flush()` sends pending SQL inside the current transaction; `commit()` makes it durable. Keeping that distinction visible will matter when one operation changes several tables.", expected: "Creating through the repository gives the run a UUID and default `queued` status; querying that UUID in the same session returns the same run." },
      { id: "day-10-step-02", title: "Replace the preview endpoint with three run endpoints", explanation: "The POST route commits one queued row and returns it. The status route returns the current state. The report route returns 409—not ready—until a report row exists, and both GET routes return 404 for an unknown run ID.", code: [{ label: "Core route shape for app/api.py", language: "python", code: String.raw`import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.repositories import RunRepository


@app.post("/v1/research-runs", status_code=status.HTTP_202_ACCEPTED)
async def create_run(
    request: ResearchRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    run = await RunRepository(session).create(
        question=request.question,
        maximum_tasks=request.maximum_research_tasks,
        maximum_sources=request.maximum_sources,
    )
    await session.commit()
    return {"run_id": str(run.id), "status": run.status}


@app.get("/v1/research-runs/{run_id}")
async def get_run(run_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> dict[str, object]:
    run = await RunRepository(session).get(run_id)
    if run is None:
        raise HTTPException(404, "Research run not found")
    return {"run_id": str(run.id), "status": run.status, "error": run.last_error}


@app.get("/v1/research-runs/{run_id}/report")
async def get_report(run_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> dict[str, object]:
    repository = RunRepository(session)
    run = await repository.get(run_id)
    if run is None:
        raise HTTPException(404, "Research run not found")
    report = await repository.get_report(run_id)
    if report is None:
        raise HTTPException(409, f"Report is not ready; run status is {run.status}")
    return {"run_id": str(run_id), "report": report.structured_report, "markdown": report.markdown_report}` }], expected: "An unknown UUID returns 404. A new valid run returns 202 with an ID, its status endpoint returns `queued`, and its report endpoint returns 409." },
      { id: "day-10-step-03", title: "Walk through the new request lifecycle", explanation: "Use Swagger at `/docs` and observe each state instead of starting model work. The POST should perform only validation and one short database transaction.", actions: ["Submit a valid question and copy the returned run ID.", "Confirm the POST returns in well under one second locally.", "Call the status endpoint and see `queued`.", "Call the report endpoint and see 409 because no worker has created a report.", "Restart the API, then fetch the same run ID again."], expected: "The same queued run is still present after the API restart, proving PostgreSQL—not the Uvicorn process—remembers it." },
    ],
    failure: { title: "Restart the API immediately after accepting a run", steps: ["Create a run and copy its ID.", "Stop and restart Uvicorn before doing any research.", "GET the copied run ID."], expected: "The status endpoint still finds the run and reports `queued`.", lesson: "Once the transaction commits, the request is no longer trapped inside one Python process. The saved row becomes the handoff point between the client and tomorrow's worker." },
    checks: ["POST returns 202 quickly and includes a UUID plus `queued` status.", "A missing run returns 404; an existing run without a report returns 409 from the report endpoint.", "Accepted runs remain available after an API restart.", "No planner, web search, or synthesis call happens inside the POST route."],
    explain: "`202 Accepted` means ‘I saved your request, but the work is not finished.’ PostgreSQL holds the queued run, the client tracks it by UUID, and a separate worker can safely pick it up next.",
    commit: "day 10: add durable research run API",
  },
  {
    id: "day-11",
    day: 11,
    week: 2,
    title: "Claim work safely with two database workers",
    navTitle: "Database worker",
    time: "2.5–3 hours",
    tools: ["Row locks", "SKIP LOCKED", "Worker loop"],
    outcome: "You can run two worker terminals at the same time. Each worker claims a different queued run, changes it to `planning`, and performs the slow workflow outside FastAPI.",
    whyNow: "Yesterday the API created queued work, but nothing consumed it. Today you build the simplest possible background queue using PostgreSQL. This teaches the real coordination problem before Kafka is introduced in Week 3: how do two workers avoid taking the same job?",
    prerequisites: ["The Day 10 API can create a durable row with status `queued`."],
    deliverables: ["An atomic `claim_next_run` database operation", "A stoppable polling process in `app/worker.py`", "A recorded two-worker, five-run experiment"],
    diagram: { type: "fanout", title: "Two workers, two different rows", description: "Worker A briefly locks the oldest queued row. Worker B skips that locked row and claims the next one, so neither starts the same run.", start: { label: "Queued runs", detail: "oldest first" }, branches: [
      { label: "Worker A", detail: "locks run 1", kind: "accent" },
      { label: "Worker B", detail: "skips 1, locks 2", kind: "accent" },
    ], end: { label: "Distinct claims", detail: "commit status=planning", kind: "data" } },
    concepts: [
      { term: "Row lock", meaning: "A temporary database marker that prevents another transaction from changing the same selected row.", inProject: "Only one worker can change a particular run from `queued` to `planning`." },
      { term: "SKIP LOCKED", meaning: "If another worker already locked a row, move on instead of waiting for it.", inProject: "Worker B skips the run being claimed by worker A and selects the next queued run." },
      { term: "Lease versus lock", meaning: "A database lock lasts only until commit or rollback; a lease is a longer claim with an expiry time.", inProject: "Use the short lock only to claim a run. Day 13 adds timestamps and recovery for a worker that crashes during the longer processing step." },
    ],
    steps: [
      { id: "day-11-step-01", title: "Claim one queued run in a short transaction", explanation: "Select the oldest queued row, lock it, change its status to `planning`, and commit immediately. Never keep this lock open while waiting for a model or web request; that would block other database work for minutes.", code: [{ label: "Add to app/repositories.py", language: "python", code: String.raw`from sqlalchemy import select


async def claim_next_run(session: AsyncSession) -> ResearchRun | None:
    statement = (
        select(ResearchRun)
        .where(ResearchRun.status == "queued")
        .order_by(ResearchRun.created_at)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    run = await session.scalar(statement)
    if run is None:
        return None
    run.status = "planning"
    run.attempt_count += 1
    await session.commit()
    return run` }], expected: "Calling `claim_next_run` once changes one row from `queued` to `planning`. A second concurrent caller receives a different row or `None`." },
      { id: "day-11-step-02", title: "Create a worker that keeps looking for work", explanation: "The worker opens a short session to claim one run, closes that session, and then processes the run. If there is no work, it waits one second instead of repeatedly hammering PostgreSQL. Add `process_durable_run(run_id)` in `app/service.py` as a thin adapter around the Week 1 workflow: load the saved question, run the workflow, and persist its result. Day 12 will split that adapter into visible stages.", code: [{ label: "app/worker.py", language: "python", code: String.raw`import asyncio
import signal

from app.db import SessionFactory
from app.repositories import claim_next_run
from app.service import process_durable_run


async def run_worker() -> None:
    stopping = asyncio.Event()
    loop = asyncio.get_running_loop()
    try:
        for name in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(name, stopping.set)
    except NotImplementedError:
        # Native Windows event loops stop through Ctrl+C / KeyboardInterrupt.
        pass

    while not stopping.is_set():
        async with SessionFactory() as session:
            run = await claim_next_run(session)
        if run is None:
            try:
                await asyncio.wait_for(stopping.wait(), timeout=1.0)
            except TimeoutError:
                pass
            continue
        await process_durable_run(run.id)


if __name__ == "__main__":
    asyncio.run(run_worker())` }], why: "On Windows, Ctrl+C still stops the process even when `add_signal_handler` is unavailable. Finish the current unit of work cleanly where possible.", expected: "With no queued rows, the worker stays alive and checks roughly once per second. After you POST a run, its log shows the claimed run ID and processing begins outside Uvicorn." },
      { id: "day-11-step-03", title: "Watch two workers divide five runs", explanation: "Open two terminals, activate the same virtual environment in both, and start one worker per terminal. Add a worker name or process ID to each log line so you can see which process claimed which run, then submit five runs through Swagger.", code: [{ label: "Run in both terminals", language: "powershell", code: "python -m app.worker" }], expected: "Both terminals claim work, every submitted run is claimed once, and the two workers never log the same `queued` run as their own." },
    ],
    failure: { title: "Kill a worker after it claims a run", steps: ["Temporarily add a short delay immediately after `claim_next_run` returns.", "Submit a run, then stop that worker while the database status is `planning`.", "Query the run from the API or database."], expected: "The run still exists, but it remains stuck in `planning` because no recovery rule exists yet.", lesson: "The row lock solved two workers claiming at the same instant; it did not solve a worker dying later. Persisted status reveals the stuck job, and Day 13 will add a safe way to retry it." },
    checks: ["The worker commits and releases the row lock before any model call starts.", "Two simultaneous workers claim different queued rows.", "Stopping or restarting the API does not stop the independent workers.", "You reproduced and wrote down the stuck-`planning` failure that still needs recovery."],
    explain: "`FOR UPDATE SKIP LOCKED` lets each worker briefly reserve a different queued row. The commit changes that row to `planning` and releases the lock; the slow research work then happens outside the claim transaction.",
    commit: "day 11: add database-backed research worker",
  },
  {
    id: "day-12",
    day: 12,
    week: 2,
    title: "Persist every workflow stage",
    navTitle: "Workflow state machine",
    time: "2.5 hours",
    tools: ["State machine", "Checkpoints", "Transactions"],
    outcome: "A run moves through visible, saved states—`queued`, `planning`, `researching`, `synthesizing`, and `completed`. Each stage reads its input from PostgreSQL and saves its output before the next stage starts.",
    whyNow: "Day 11 moved work into a background process, but `process_durable_run` is still one large black box. If it crashes, `planning` does not tell you which useful work was saved. Today you split that box into three restartable stages and make status describe real progress.",
    prerequisites: ["A Day 11 worker can claim a queued run and start the Week 1 workflow."],
    deliverables: ["One map of allowed status changes", "Separate planning, research, and synthesis functions", "A database commit after each completed stage"],
    diagram: { type: "flow", title: "A saved checkpoint after every stage", description: "Each status names the next work to perform. A stage saves its result and next status together, so a restart can inspect PostgreSQL and continue from a known point.", nodes: [
      { label: "queued", detail: "accepted" },
      { label: "planning", detail: "create tasks", kind: "accent" },
      { label: "researching", detail: "collect evidence", kind: "accent" },
      { label: "synthesizing", detail: "write report", kind: "accent" },
      { label: "completed", detail: "terminal", kind: "data" },
    ] },
    concepts: [
      { term: "State machine", meaning: "A list of valid states and the specific moves allowed between them.", inProject: "A queued run can begin planning, but a completed run cannot silently move backward to researching." },
      { term: "Checkpoint", meaning: "Saved output that proves a stage finished and gives the next stage something to load.", inProject: "Once planning saves its tasks, later code reads those task rows instead of depending on a local Python variable." },
      { term: "Terminal state", meaning: "A final state with no normal next step.", inProject: "`completed`, `failed`, and `cancelled` tell the worker to stop processing that run." },
    ],
    steps: [
      { id: "day-12-step-01", title: "Write down every legal status change", explanation: "Put the workflow rules in one map rather than scattering string assignments across routes and workers. The `transition` helper checks the current status before it commits the next one.", code: [{ label: "app/workflow.py", language: "python", code: String.raw`import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ResearchRun


ALLOWED_TRANSITIONS = {
    "queued": {"planning", "cancelled"},
    "planning": {"researching", "failed", "cancelled"},
    "researching": {"synthesizing", "failed", "cancelled"},
    "synthesizing": {"completed", "failed", "cancelled"},
    "completed": set(),
    "failed": set(),
    "cancelled": set(),
}


async def transition(
    session: AsyncSession, run: ResearchRun, target: str
) -> None:
    if target not in ALLOWED_TRANSITIONS[run.status]:
        raise ValueError(f"Invalid transition: {run.status} -> {target}")
    run.status = target
    await session.commit()` }], expected: "A valid move such as `planning` to `researching` commits. An invalid move raises `ValueError` and leaves the saved status unchanged." },
      { id: "day-12-step-02", title: "Move the Week 1 workflow into three stage functions", explanation: "Do this one stage at a time. Planning loads the run question and saves task rows. Research loads those task rows and saves results, sources, and evidence. Synthesis loads only saved evidence and sources, validates citations, and saves the report. Each function saves its output and next status in one commit.", code: [{ label: "Stage shape in app/workflow.py", language: "python", code: String.raw`async def plan_run(run_id: uuid.UUID) -> None:
    # Load run, call planner, insert ResearchTaskRecord rows.
    # In the same commit, transition planning -> researching.
    ...


async def research_run(run_id: uuid.UUID) -> None:
    # Load incomplete tasks, research them, persist results/sources/evidence.
    # In the same commit, transition researching -> synthesizing.
    ...


async def synthesize_run(run_id: uuid.UUID) -> None:
    # Load stored evidence and source catalog, synthesize, validate, insert report.
    # In the same commit, transition synthesizing -> completed.
    ...` }], why: "Write the comments first, then move the existing Week 1 calls into the matching function. Between functions, deliberately discard local results and reload from PostgreSQL; that is what makes the boundary real.", expected: "After planning, task rows exist and status is `researching`. After research, stored sources/evidence exist and status is `synthesizing`. After synthesis, one report exists and status is `completed`." },
      { id: "day-12-step-03", title: "Choose the next stage from the saved status", explanation: "Map each in-progress status to one handler. After every handler commits, reload the run instead of guessing the next step from a local variable. This makes the database record easy to inspect while the worker runs.", code: [{ label: "Worker dispatch core", language: "python", code: String.raw`STAGE_HANDLERS = {
    "planning": plan_run,
    "researching": research_run,
    "synthesizing": synthesize_run,
}

while run.status in STAGE_HANDLERS:
    await STAGE_HANDLERS[run.status](run.id)
    async with SessionFactory() as session:
        run = await session.get(ResearchRun, run.id)
        if run is None:
            raise RuntimeError("Run disappeared during processing")` }], expected: "Watching the status endpoint during a run shows the named stages in order, and the loop stops when the reloaded status becomes `completed`, `failed`, or `cancelled`." },
    ],
    failure: { title: "Try to move a finished run backward", steps: ["Load a run whose saved status is `completed`.", "Call `transition(session, run, \"researching\")`.", "Reload the run after catching the error."], expected: "The helper raises `ValueError`, and PostgreSQL still says `completed`.", lesson: "Explicit transition rules stop accidental status changes from hiding what really happened. A future retry must follow a deliberate recovery path rather than moving a finished run backward." },
    checks: ["The only valid status moves are listed in one map.", "Each expensive stage begins by loading its input from PostgreSQL, not a previous function's local variable.", "Each stage commits its output and next status together.", "The status endpoint shows where a run is in the workflow.", "Invalid transitions fail without changing saved state."],
    explain: "I split one long research job into three saved stages. PostgreSQL carries data between them, and the status tells a restarted worker what work is next instead of forcing it to start blindly from the beginning.",
    commit: "day 12: persist explicit workflow stages",
  },
  {
    id: "day-13",
    day: 13,
    week: 2,
    title: "Classify failures and make stages idempotent",
    navTitle: "Retries + idempotency",
    time: "3 hours",
    tools: ["Backoff", "Idempotency keys", "Recovery"],
    outcome: "Temporary failures retry at most three times, unrecoverable failures become clear `failed` runs, and running the same stage twice still leaves only one durable result.",
    whyNow: "Days 11 and 12 made crashes visible, but visibility is not recovery. A worker may time out, die, or repeat a stage after a restart. Today you decide which failures deserve another attempt and give every stage a unique identity so a retry cannot create duplicate reports or evidence.",
    prerequisites: ["A run moves through the persisted Day 12 stages and finishes successfully in the normal case."],
    deliverables: ["A plain list of retryable versus permanent errors", "A retry helper with a fixed attempt limit", "A unique workflow-operation record for each run and stage", "A documented rule for recovering stale runs"],
    diagram: { type: "flow", title: "The attempt may repeat; the saved result must not", description: "Every stage has one stable key made from the run and stage name. A retry checks that key and either reuses completed work or creates the durable effect once.", nodes: [
      { label: "Attempt", detail: "may repeat" },
      { label: "Operation key", detail: "run + stage", kind: "accent" },
      { label: "Already done?", detail: "return stored result" },
      { label: "Execute + commit", detail: "once", kind: "data" },
    ] },
    concepts: [
      { term: "Retryable error", meaning: "A temporary problem that may disappear if you wait and try again.", inProject: "A timeout, rate-limit response, interrupted network, or temporary database connection can retry a small fixed number of times." },
      { term: "Permanent error", meaning: "A problem that another identical attempt will not fix.", inProject: "A missing run, illegal status, or repeatedly invalid model output should stop with a useful error instead of looping forever." },
      { term: "Idempotency", meaning: "Repeating the same requested operation leaves the same final result as running it once.", inProject: "If synthesis is delivered twice, the run still has exactly one report." },
    ],
    steps: [
      { id: "day-13-step-01", title: "Give each run stage one durable identity", explanation: "Add a `workflow_operations` table. The pair `(run_id, stage)` answers ‘have we already completed this exact work?’ Before a handler runs, it checks this record; when the handler saves its output, it marks the operation complete in the same transaction.", code: [{ label: "Model addition", language: "python", code: String.raw`class WorkflowOperation(Base):
    __tablename__ = "workflow_operations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("research_runs.id", ondelete="CASCADE"))
    stage: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="started")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("run_id", "stage"),)` }], why: "Generate and apply a new Alembic migration after adding the model. The unique constraint is the final guard if two workers check at nearly the same time.", expected: "Trying to insert a second operation with the same run ID and stage fails, while different stages for the same run are allowed." },
      { id: "day-13-step-02", title: "Retry only known temporary failures", explanation: "Wrap external operations with a helper that waits one second, then two seconds, and stops after the configured attempt count. Pass only specific temporary exception classes in `retry_on`; never retry every `Exception`, because bad input will not repair itself.", code: [{ label: "app/retry.py", language: "python", code: String.raw`import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


async def with_retry(
    operation: Callable[[], Awaitable[T]],
    *,
    retry_on: tuple[type[Exception], ...],
    maximum_attempts: int = 3,
) -> T:
    for attempt in range(1, maximum_attempts + 1):
        try:
            return await operation()
        except retry_on:
            if attempt == maximum_attempts:
                raise
            await asyncio.sleep(2 ** (attempt - 1))
    raise AssertionError("unreachable")` }], why: "Start with a small, explicit error list such as provider timeouts and rate-limit errors. Keep schema errors, invalid state, and missing data outside that list.", expected: "A fake operation that fails twice with a retryable error succeeds on attempt three. A permanent error is raised immediately, and a fourth attempt never occurs." },
      { id: "day-13-step-03", title: "Decide when a stuck stage may be tried again", explanation: "Add `started_at` and increment `attempt_count` when a worker starts work. A small recovery job may reset a run only when it has been inactive longer than a normal stage should take and still has attempts left. Treat this SQL as the policy to implement and test, not a command to run casually against all environments.", code: [{ label: "Recovery query idea", language: "sql", code: String.raw`UPDATE research_runs
SET status = 'queued', last_error = 'Recovered stale worker claim'
WHERE status IN ('planning', 'researching', 'synthesizing')
  AND started_at < now() - interval '15 minutes'
  AND attempt_count < 3;` }], why: "Choose the timeout from observed stage duration, not guesswork. When a run exceeds the attempt limit, mark it `failed` with a useful `last_error` instead of resetting it forever.", expected: "A recent in-progress run is untouched. An old run below the attempt limit becomes eligible for retry, while an old run at the limit becomes a clear failure." },
      { id: "day-13-step-04", title: "Prove that repeating synthesis is harmless", explanation: "Call the synthesis handler twice with the same run ID. On the second call, the handler should find the completed operation and return the already-saved outcome or perform a no-op instead of inserting again.", expected: "Both calls finish in an understood way, and PostgreSQL contains exactly one report row and one completed synthesis operation for the run." },
    ],
    failure: { title: "Crash after the model responds but before the database commit", steps: ["Temporarily raise an exception after synthesis produces a report but before the transaction commits it.", "Confirm the run did not save a partial report or completed operation.", "Remove the injected exception and run the same stage again.", "Count report rows and completed synthesis operations."], expected: "The uncommitted first attempt leaves no durable partial write. The retry stores one report and one completed operation.", lesson: "You cannot guarantee that a worker runs only once. You can make repeated attempts safe by grouping database effects in a transaction and using a unique operation key to reject duplicates." },
    checks: ["Only named temporary errors retry; permanent errors fail immediately.", "Retries stop after a fixed attempt limit and record a useful final error.", "Every run-stage pair has one unique durable operation record.", "A stale run below the limit can be recovered; one at the limit does not loop forever.", "Two synthesis attempts leave exactly one report."],
    explain: "A worker may attempt a stage more than once. I use bounded retries for temporary failures, a saved operation key to recognize repeated work, and one transaction so a retry cannot leave duplicate business results.",
    commit: "day 13: add bounded retries and idempotent stages",
  },
  {
    id: "day-14",
    day: 14,
    week: 2,
    title: "Prove the durable workflow end to end",
    navTitle: "Postgres integration tests",
    time: "2.5–3 hours",
    tools: ["pytest", "Test database", "Failure injection"],
    outcome: "One repeatable test submits a run through the real HTTP API, processes it with a worker against real PostgreSQL, and proves that the final report is durable, citation-safe, and not duplicated.",
    whyNow: "Each Week 2 piece works on its own, but the important promise crosses all of them: accept a request, save it, process it after the request ends, survive retries, and return one report. A real test database can catch migration, transaction, constraint, and row-lock mistakes that mocks cannot see.",
    prerequisites: ["The normal workflow completes manually, and the Day 13 retry/idempotency experiments pass."],
    deliverables: ["A clearly isolated `evidencelab_test` database", "Test setup that applies migrations", "One full API-to-worker-to-report integration test", "Focused failure tests and a passing Week 2 gate"],
    diagram: { type: "flow", title: "Test one complete saved journey", description: "Use a fake model so results are fast and predictable, but keep HTTP, SQLAlchemy, migrations, worker orchestration, and PostgreSQL real.", nodes: [
      { label: "TestClient", detail: "POST run" },
      { label: "PostgreSQL", detail: "queued", kind: "data" },
      { label: "Worker once", detail: "fake model" },
      { label: "PostgreSQL", detail: "report + completed", kind: "data" },
      { label: "Assertions", detail: "IDs + no duplicates", kind: "accent" },
    ] },
    concepts: [
      { term: "Integration test", meaning: "A test that lets several real parts work together instead of replacing every boundary with a fake.", inProject: "It can catch SQL, transaction, migration, and worker-orchestration mistakes that small unit tests cannot." },
      { term: "Test isolation", meaning: "Every test starts from known data and cannot damage development or production data.", inProject: "Tests use a dedicated database whose name ends in `_test`, then clean only that database." },
      { term: "Failure injection", meaning: "Deliberately cause one known failure at a precise line or stage.", inProject: "Calling a handler twice or returning an invalid citation proves the recovery and validation rules actually work." },
    ],
    steps: [
      { id: "day-14-step-01", title: "Create a database that tests are allowed to erase", explanation: "Create `evidencelab_test`, point this terminal at it, and add a guard in your test setup that aborts unless the database name ends in `_test`. Never reuse the development database for cleanup-heavy tests.", code: [{ label: "PowerShell", language: "powershell", code: String.raw`docker exec evidencelab-postgres createdb -U research evidencelab_test
$env:DATABASE_URL = "postgresql+asyncpg://research:research@localhost:5432/evidencelab_test"
alembic upgrade head` }], expected: "`alembic current` reports `head` while `DATABASE_URL` points to `evidencelab_test`; the development database remains unchanged." },
      { id: "day-14-step-02", title: "Test one full run from POST to saved report", explanation: "Replace only the paid, nondeterministic model provider with the Day 6 fake. Keep the API route, database sessions, repositories, state machine, worker, migrations, and PostgreSQL real so the test exercises the complete durable path.", code: [{ label: "tests/integration/test_research_run.py", language: "python", code: String.raw`import pytest


@pytest.mark.asyncio
async def test_run_survives_and_completes(api_client, worker, session) -> None:
    created = await api_client.post(
        "/v1/research-runs",
        json={"question": "What evidence supports and challenges a four-day work week?"},
    )
    assert created.status_code == 202
    run_id = created.json()["run_id"]

    await worker.run_once()

    status = await api_client.get(f"/v1/research-runs/{run_id}")
    assert status.json()["status"] == "completed"
    report = await api_client.get(f"/v1/research-runs/{run_id}/report")
    assert report.status_code == 200
    assert "https://example.test/source" in report.json()["markdown"]

    await worker.process_run(run_id)  # duplicate attempt
    count = await count_reports(session, run_id)
    assert count == 1` }], why: "Your exact fixture names depend on the Day 6 provider seam. Make the dependency override and cleanup visible in fixtures; do not hide a live API call inside test setup.", expected: "The test receives 202, the worker changes the run to `completed`, the report endpoint returns 200 with the fake source URL, and a repeated worker call leaves one report." },
      { id: "day-14-step-03", title: "Add one small test for each failure promise", explanation: "Keep each test focused so a failure tells you which guarantee broke. Reuse the real test database and fake provider, resetting data between cases.", actions: ["Return an unknown source ID and assert the run becomes `failed` with a useful error.", "Stop after a saved stage, run a new worker instance, and assert it resumes from that stage.", "Claim concurrently with two workers and assert they receive different run IDs.", "Invoke synthesis twice and assert exactly one report exists.", "Restart the API between POST and GET and assert durable state is unchanged."], expected: "Each test has one clear reason to fail, and together they cover citation safety, restart recovery, concurrent claims, duplicate handling, and API-process independence." },
      { id: "day-14-step-04", title: "Run the Week 2 gate from a known empty state", explanation: "Recreate or clean only the guarded test database, apply all migrations, then run the full unit and integration suite with no real model credentials.", code: [{ label: "Terminal", language: "shell", code: "python -m pytest -q" }], expected: "All tests pass without live model calls, a fresh database can migrate to `head`, and the development database is untouched." },
    ],
    failure: { title: "Make the test suite refuse the wrong database", steps: ["Add a fixture guard that parses `DATABASE_URL` and requires the database name to end with `_test`.", "Temporarily point the test command at the normal `evidencelab` development database.", "Start the suite and confirm it aborts before truncating, deleting, or migrating test data.", "Restore the test URL."], expected: "The suite stops immediately with a clear safety message and does not change the development database.", lesson: "Automated cleanup is intentionally destructive inside its sandbox. A simple, tested guard turns the database name into a safety boundary instead of trusting that every future command is typed perfectly." },
    checks: ["Tests apply real migrations to a dedicated PostgreSQL test database.", "The model provider is fake, fast, and deterministic; no live key or network call is needed.", "One test covers the full POST → queued row → worker → completed report journey.", "Separate tests cover invalid citations, restart recovery, concurrent claims, and duplicate synthesis.", "Starting from an empty test database, the complete Week 2 suite passes without touching development data."],
    explain: "Unit tests protect small deterministic rules. These integration tests prove that the real API, worker, migrations, transactions, and PostgreSQL cooperate, so an accepted run survives restarts and retries without losing data or creating duplicate reports.",
    commit: "day 14: prove durable workflow with postgres",
  },
];
