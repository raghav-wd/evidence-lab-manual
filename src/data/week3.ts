import type { DayGuide } from "../types/guide";

export const week3Days: DayGuide[] = [
  {
    id: "day-15",
    day: 15,
    week: 3,
    title: "Add Redis as a cache, not a database",
    navTitle: "Redis cache + progress",
    time: "2.5 hours",
    tools: ["Redis", "TTL", "Cache-aside", "Rate limit"],
    outcome: "By the end of today, a repeated search can reuse a Redis cache, progress can be read quickly, and stopping Redis will not erase an accepted run or its report.",
    whyNow: "Week 2 gave you a reliable PostgreSQL-backed workflow. Redis is the next layer because it can make common reads faster without taking ownership of any data the project cannot afford to lose.",
    prerequisites: ["The Week 2 API and worker complete a run through PostgreSQL and still work after a restart."],
    deliverables: ["`app/redis_client.py`", "Search cache", "Progress hash", "Redis outage note"],
    diagram: { type: "fanout", title: "PostgreSQL keeps it; Redis speeds it up", description: "The app checks Redis first for a quick answer. If the key is missing or Redis is down, it can still use PostgreSQL or perform the search again.", start: { label: "Application", detail: "needs data" }, branches: [
      { label: "Redis", detail: "fast + expiring", kind: "temporary" },
      { label: "PostgreSQL", detail: "durable truth", kind: "data" },
    ], end: { label: "Correct result", detail: "survives cache loss", kind: "accent" } },
    concepts: [
      { term: "TTL", meaning: "Time to live: the number of seconds Redis keeps a key before deleting it automatically.", inProject: "Search results expire after 30–60 minutes, so old answers do not remain in the cache forever." },
      { term: "Cache-aside", meaning: "The app checks the cache first. On a miss, it does the normal work and then saves a copy in the cache.", inProject: "A missing Redis key starts normal web research; it does not make the run fail." },
      { term: "Graceful degradation", meaning: "An optional feature can fail while the main job still works correctly.", inProject: "During a Redis outage, progress may be slower and searches may repeat, but PostgreSQL still keeps the run and report." },
    ],
    steps: [
      { id: "day-15-step-01", title: "Start Redis and install its Python client", explanation: "Run Redis in a container on port 6379, then install the async-capable Python package your workers will use. Redis is a separate process; the Python package is only the client that connects to it.", code: [{ label: "Terminal", language: "shell", code: String.raw`docker run --name evidencelab-redis -p 6379:6379 -d redis:7-alpine
python -m pip install redis` }], expected: "`docker ps` lists `evidencelab-redis`, and `python -c \"from redis.asyncio import Redis; print('ok')\"` prints `ok`." },
      { id: "day-15-step-02", title: "Add cache and progress helpers", explanation: "Create one file that defines exactly how EvidenceLab names Redis keys. The search query becomes a safe fixed-length hash, cached results expire, and each run gets a short-lived progress hash.", code: [{ label: "app/redis_client.py", language: "python", code: String.raw`import hashlib
import json

from redis.asyncio import Redis


def search_key(query: str) -> str:
    digest = hashlib.sha256(query.strip().casefold().encode()).hexdigest()
    return f"evidencelab:v1:search:{digest}"


async def read_search_cache(redis: Redis, query: str) -> dict | None:
    raw = await redis.get(search_key(query))
    return json.loads(raw) if raw else None


async def write_search_cache(
    redis: Redis, query: str, payload: dict, ttl_seconds: int = 3600
) -> None:
    await redis.set(search_key(query), json.dumps(payload), ex=ttl_seconds)


async def update_progress(
    redis: Redis, run_id: str, *, completed: int, total: int, sources: int
) -> None:
    key = f"evidencelab:v1:run:{run_id}:progress"
    await redis.hset(key, mapping={
        "tasks_completed": completed,
        "tasks_total": total,
        "sources_found": sources,
    })
    await redis.expire(key, 86400)` }], expected: "Writing a search result creates an `evidencelab:v1:search:...` key with a TTL; updating progress creates a run hash with the three counters." },
      { id: "day-15-step-03", title: "Fall back when Redis is empty or unavailable", explanation: "Try Redis only around the optional cache calls. If reading fails, continue as though the key was absent. Do not catch PostgreSQL or model-provider errors in this same block because those failures affect the real job.", code: [{ label: "Cache-aside shape", language: "python", code: String.raw`try:
    cached = await read_search_cache(redis, query)
except Exception:
    logger.warning("search cache unavailable", exc_info=True)
    cached = None

if cached is None:
    result = await perform_web_research(query)
    try:
        await write_search_cache(redis, query, result)
    except Exception:
        logger.warning("search cache write failed", exc_info=True)
else:
    result = cached` }], expected: "The first request performs web research, a repeated request can use the cached payload, and the same code still performs web research when Redis is stopped." },
      { id: "day-15-step-04", title: "Add a small per-minute request limit", explanation: "For each client, increment one Redis counter and expire it after a minute. This is enough to learn the mechanism; it is intentionally a simple fixed-window limiter rather than production-grade billing or fairness logic.", code: [{ label: "Basic limiter", language: "python", code: String.raw`async def allow_request(redis: Redis, client_id: str, limit: int = 10) -> bool:
    key = f"evidencelab:v1:ratelimit:{client_id}:minute"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    return count <= limit` }], expected: "For one client ID, calls 1–10 return `True`, call 11 returns `False`, and the counter disappears after roughly 60 seconds." },
    ],
    failure: { title: "Stop Redis during a run", steps: ["Run a search once so Redis contains a cached result.", "Run `docker stop evidencelab-redis`.", "Submit another run, wait for it to finish, and inspect the run and report in PostgreSQL."], expected: "Cache reads and fast progress updates log warnings or miss, but the worker continues. The run reaches `completed`, and its report is still stored in PostgreSQL.", lesson: "Redis is an optional shortcut. If turning it off loses an accepted run or final report, important data was put in the wrong place." },
    checks: ["A repeated query can use Redis instead of calling the provider again.", "Every Redis key starts with `evidencelab:v1:` and has an expiry.", "Stopping Redis does not stop a run from completing.", "The final report and enough data to rebuild progress remain in PostgreSQL."],
    explain: "Redis keeps temporary copies that make searches and progress reads faster. PostgreSQL keeps the real run, evidence, and report, so losing Redis may make the app slower but cannot make accepted work disappear.",
    commit: "day 15: add disposable redis cache and progress",
  },
  {
    id: "day-16",
    day: 16,
    week: 3,
    title: "Learn Kafka with a tiny test first",
    navTitle: "Kafka fundamentals lab",
    time: "2.5–3 hours",
    tools: ["Kafka", "Topic", "Partition", "Consumer group", "Offset"],
    outcome: "By the end of today, you can publish three small events, read them with a consumer, restart that consumer, and predict which events Kafka will deliver again.",
    whyNow: "Tomorrow, Kafka will carry real research commands. First isolate the moving parts with harmless sample events, so a topic, partition, group, and offset each have a behavior you have personally observed.",
    prerequisites: ["Docker Desktop is running."],
    deliverables: ["Local broker", "`learning-events` topic", "`scripts/kafka_producer.py`", "`scripts/kafka_consumer.py`"],
    diagram: { type: "fanout", title: "One topic, two ways to read it", description: "Consumers in the same group split the partitions between them. A consumer in a different group gets its own reading position and can read the same events independently.", start: { label: "Topic", detail: "3 partitions" }, branches: [
      { label: "Consumer A", detail: "group research-v1", kind: "accent" },
      { label: "Consumer B", detail: "group research-v1", kind: "accent" },
      { label: "Observer", detail: "group audit-v1", kind: "temporary" },
    ], end: { label: "Offsets", detail: "per group + partition", kind: "data" } },
    concepts: [
      { term: "Topic", meaning: "A named stream where producers append events and consumers read them.", inProject: "EvidenceLab will use separate topics for plan, search, and synthesis commands." },
      { term: "Partition", meaning: "One ordered lane inside a topic.", inProject: "Kafka assigns whole partitions—not individual messages—to workers in a consumer group." },
      { term: "Consumer group", meaning: "A set of consumers that cooperate to split a topic's partitions.", inProject: "Research workers use the same group ID, so one group member handles each command." },
      { term: "Offset", meaning: "The numbered position of an event inside one partition.", inProject: "After work is safely stored, the consumer commits the offset to record how far its group has finished." },
    ],
    steps: [
      { id: "day-16-step-01", title: "Start one Kafka broker and create a topic", explanation: "Use the current Apache Kafka quickstart to start a local single-node container named `evidencelab-kafka`. Then create `learning-events` with three partitions so you have multiple lanes to observe.", code: [{ label: "Topic command inside the broker container", language: "shell", code: String.raw`docker exec evidencelab-kafka /opt/kafka/bin/kafka-topics.sh \
  --create --topic learning-events --partitions 3 \
  --bootstrap-server localhost:9092` }], why: "Pin the image tag that works in your README so the lab is repeatable later.", expected: "The topic command reports success, and describing `learning-events` shows three partitions." },
      { id: "day-16-step-02", title: "Publish three events with the same key", explanation: "Install the Python client and run this producer once. The shared key makes all three sample events choose the same partition, which preserves their order. Later, real commands can use a run or task ID as the key.", code: [{ label: "Install the Python client", language: "shell", code: "python -m pip install confluent-kafka" }, { label: "scripts/kafka_producer.py", language: "python", code: String.raw`import json
import uuid

from confluent_kafka import Producer


producer = Producer({"bootstrap.servers": "localhost:9092"})
for index in range(1, 4):
    event = {"event_id": str(uuid.uuid4()), "number": index}
    producer.produce(
        "learning-events",
        key="same-run",
        value=json.dumps(event),
    )
producer.flush()` }], expected: "The script exits without an error after `flush()`, and the topic now contains three JSON events numbered 1, 2, and 3." },
      { id: "day-16-step-03", title: "Read events and commit them yourself", explanation: "Turn off automatic commits so you can see the safety boundary: print one event, finish its work, and only then tell Kafka that this group has completed that offset.", code: [{ label: "scripts/kafka_consumer.py", language: "python", code: String.raw`import json

from confluent_kafka import Consumer


consumer = Consumer({
    "bootstrap.servers": "localhost:9092",
    "group.id": "learning-group-v1",
    "auto.offset.reset": "earliest",
    "enable.auto.commit": False,
})
consumer.subscribe(["learning-events"])

try:
    while True:
        message = consumer.poll(1.0)
        if message is None:
            continue
        if message.error():
            raise RuntimeError(message.error())
        print(message.partition(), message.offset(), json.loads(message.value()))
        consumer.commit(message=message, asynchronous=False)
finally:
    consumer.close()` }], expected: "The consumer prints each event's partition, offset, and JSON value. After all three commits, restarting with the same group does not print those events again." },
      { id: "day-16-step-04", title: "Change one variable at a time", explanation: "Run these small experiments in order. Before each one, write down what you expect; then compare that prediction with the terminal output.", actions: ["Publish three events and read them.", "Restart the consumer; committed events should not replay.", "Change the group ID; all events are independently readable.", "Start two consumers in the same group; inspect assignments.", "Kill before commit; expect redelivery.", "Use the same key and observe stable partition placement."], expected: "You can point to terminal output showing that groups have separate offsets, same-group consumers split partitions, and an uncommitted event can return." },
    ],
    failure: { title: "Crash before committing an offset", steps: ["Add a five-second pause immediately before `consumer.commit(...)`.", "Publish a new event, start the consumer, and stop it during that pause.", "Restart the consumer with the same group ID."], expected: "The last event appears again because the group never committed the offset that came after it.", lesson: "Kafka avoids silently losing unfinished work by allowing redelivery. EvidenceLab must therefore make it safe for a handler to see the same command more than once." },
    checks: ["You can explain a broker, topic, partition, producer, consumer, group, and offset in plain language.", "Two consumers with the same group ID split the available partitions.", "A consumer with a new group ID can read the topic from its own starting position.", "Stopping before commit causes the event to be delivered again after restart."],
    explain: "Kafka stores events in ordered partition lanes. Workers with the same group ID divide those lanes and share a saved reading position. Because an uncommitted event can return, EvidenceLab will store results safely before committing offsets and will make repeated handling harmless.",
    commit: "day 16: add standalone kafka learning lab",
    resources: [{ label: "Apache Kafka quickstart", href: "https://kafka.apache.org/quickstart", note: "Use the current official local-container command and CLI paths." }],
  },
  {
    id: "day-17",
    day: 17,
    week: 3,
    title: "Make run creation survive a Kafka outage",
    navTitle: "Transactional outbox",
    time: "3 hours",
    tools: ["Outbox pattern", "Database transaction", "Relay"],
    outcome: "By the end of today, creating a run also stores its first Kafka command in the same PostgreSQL transaction. If Kafka is down, a relay publishes that saved command when Kafka returns.",
    whyNow: "The API currently needs to save a run and ask Kafka to plan it. Those are two separate systems, so one write can succeed while the other fails. The outbox removes that lost-work gap before you add real Kafka workers.",
    prerequisites: ["You observed Kafka redelivery and understand manual offset commit."],
    deliverables: ["`outbox_events` table", "Atomic run + event insert", "`app/outbox_relay.py`"],
    diagram: { type: "flow", title: "Save first, publish second", description: "The API saves the run and a description of the command together in PostgreSQL. A separate relay keeps trying to publish any command whose `published_at` value is still empty.", nodes: [
      { label: "API transaction", detail: "run + outbox", kind: "accent" },
      { label: "PostgreSQL", detail: "both or neither", kind: "data" },
      { label: "Outbox relay", detail: "retry publish" },
      { label: "Kafka", detail: "command stream", kind: "accent" },
      { label: "published_at", detail: "delivery recorded", kind: "data" },
    ] },
    concepts: [
      { term: "Dual write", meaning: "One user action tries to update two systems that cannot share the same transaction.", inProject: "The run insert might succeed while a direct Kafka publish fails, leaving an accepted run that never starts." },
      { term: "Transactional outbox", meaning: "Save the outgoing message as a database row in the same transaction as the main data.", inProject: "PostgreSQL commits both the accepted run and its plan command—or commits neither." },
      { term: "Relay", meaning: "A small background process that reads unpublished outbox rows, sends them to Kafka, and records successful publication.", inProject: "The relay can restart and retry because its to-do list is durable in PostgreSQL." },
    ],
    steps: [
      { id: "day-17-step-01", title: "Create a table for commands waiting to publish", explanation: "Add an `outbox_events` model and migration. Each row says where the event should go, which run it belongs to, what kind of event it is, its JSON body, and whether publication has succeeded.", code: [{ label: "Add outbox model and migrate", language: "python", code: String.raw`class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(100))
    message_key: Mapped[str] = mapped_column(String(100))
    event_type: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)` }], expected: "After the migration, PostgreSQL contains an `outbox_events` table. A new row starts with `published_at = NULL` and `attempt_count = 0`." },
      { id: "day-17-step-02", title: "Save the run and plan command together", explanation: "Use one SQLAlchemy session and one commit for both rows. If either insert fails, the transaction rolls back both, so the database never contains a run without its initial plan intent.", code: [{ label: "Service transaction", language: "python", code: String.raw`run = ResearchRun(question=request.question, status="queued")
session.add(run)
await session.flush()

session.add(OutboxEvent(
    topic="research.plan.commands",
    message_key=str(run.id),
    event_type="research.plan.requested.v1",
    payload={
        "event_id": str(uuid.uuid4()),
        "event_type": "research.plan.requested.v1",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "correlation_id": str(run.id),
        "idempotency_key": f"run:{run.id}:plan",
        "payload": {"run_id": str(run.id)},
    },
))
await session.commit()` }], expected: "Creating one run produces one `research_runs` row and one matching unpublished `outbox_events` row with the run ID as its correlation and message key." },
      { id: "day-17-step-03", title: "Publish saved commands with a relay", explanation: "The relay locks a small batch of rows that have not been published, sends them to Kafka, and fills `published_at` after `flush()` returns. A crash in the small gap before the database commit may publish an event twice, so consumers will still need duplicate protection.", code: [{ label: "Relay loop core", language: "python", code: String.raw`statement = (
    select(OutboxEvent)
    .where(OutboxEvent.published_at.is_(None))
    .order_by(OutboxEvent.created_at)
    .with_for_update(skip_locked=True)
    .limit(50)
)
events = list((await session.scalars(statement)).all())
for event in events:
    producer.produce(
        event.topic,
        key=event.message_key,
        value=json.dumps(event.payload),
    )
remaining = producer.flush(timeout=10)
if remaining:
    raise RuntimeError(f"{remaining} outbox events were not delivered")
for event in events:
    event.published_at = datetime.now(timezone.utc)
    event.attempt_count += 1
await session.commit()` }], why: "For this portfolio version, a nonzero `flush()` result keeps the row unpublished so the loop can retry it. A production relay should also check each message's delivery callback before marking that specific row published.", expected: "Running the relay sends the plan command to `research.plan.commands`, then changes the matching outbox row from `published_at = NULL` to a timestamp." },
    ],
    failure: { title: "Create a run while Kafka is stopped", steps: ["Stop Kafka but leave the API and PostgreSQL running.", "Submit a new research run.", "Verify that both the run and an outbox row with `published_at = NULL` exist.", "Restart Kafka, then start or resume the relay."], expected: "The API still accepts the run. Once Kafka returns, the relay publishes the saved command and fills `published_at`; no one has to resubmit the question.", lesson: "The request no longer has to keep a Kafka publish alive in memory. PostgreSQL remembers the unfinished publication and gives the relay something safe to retry." },
    checks: ["One API request commits both a run row and its initial outbox row.", "Stopping Kafka leaves a visible unpublished outbox row instead of losing the command.", "Restarting the relay eventually publishes that row and records a timestamp.", "Every event has a versioned type, unique event ID, and the run ID for correlation."],
    explain: "The API writes the run and its outgoing command to PostgreSQL in one transaction. The relay publishes that durable command to Kafka afterward and can retry during an outage, so an accepted run cannot be stranded by a failed second write.",
    commit: "day 17: add transactional outbox and relay",
  },
  {
    id: "day-18",
    day: 18,
    week: 3,
    title: "Run planning in a background Kafka worker",
    navTitle: "Planner worker",
    time: "2.5–3 hours",
    tools: ["Kafka consumer", "Event envelope", "Processed events"],
    outcome: "By the end of today, a planner worker receives a Kafka command, turns the run's question into durable research tasks, queues one search command per task, and safely ignores a repeated plan event.",
    whyNow: "Day 17 made command delivery recoverable. Planning is the smallest workflow stage, so moving it first lets you learn the full consume → save → commit cycle before you run several research workers at once.",
    prerequisites: ["Outbox relay publishes `research.plan.requested.v1`."],
    deliverables: ["`research.plan.commands` topic", "Planner handler", "Idempotent event record"],
    diagram: { type: "flow", title: "One plan command creates several search commands", description: "The worker validates the Kafka event, saves the plan's tasks and their outgoing search commands together, and only then commits the input offset.", nodes: [
      { label: "Plan command", detail: "Kafka" },
      { label: "Planner worker", detail: "validate envelope", kind: "accent" },
      { label: "PostgreSQL tx", detail: "tasks + outbox", kind: "data" },
      { label: "Commit offset", detail: "after DB success" },
    ] },
    concepts: [
      { term: "Command", meaning: "A message that asks a worker to perform one specific job.", inProject: "`research.plan.requested.v1` asks the planner worker to create research tasks for one run." },
      { term: "Correlation ID", meaning: "One shared identifier that connects logs and events from the same larger job.", inProject: "Every event created for a research run carries that run's ID, making its path searchable across processes." },
      { term: "Commit order", meaning: "The safety rule for deciding which durable action happens first.", inProject: "Commit tasks and outgoing commands to PostgreSQL first; commit the Kafka offset second. Reversing that order could lose work." },
    ],
    steps: [
      { id: "day-18-step-01", title: "Define and validate the event envelope", explanation: "Create one Pydantic model for the fields every workflow event must contain. Parse Kafka bytes into this model before touching the database, and route unsupported event types or versions to an explicit error path instead of guessing their meaning.", code: [{ label: "app/events.py", language: "python", code: String.raw`from datetime import datetime
from typing import Any

from pydantic import BaseModel


class EventEnvelope(BaseModel):
    event_id: str
    event_type: str
    occurred_at: datetime
    correlation_id: str
    idempotency_key: str
    payload: dict[str, Any]` }], expected: "A valid JSON envelope becomes an `EventEnvelope`; missing fields or bad timestamps fail validation before the planner runs." },
      { id: "day-18-step-02", title: "Turn one plan event into durable tasks", explanation: "First check whether this exact event was already completed. If not, load the run, call the planner you built in Week 1, save every research task, add its search command to the outbox, and add the processed marker in the same database commit.", code: [{ label: "Planner handler outline", language: "python", code: String.raw`async def handle_plan(event: EventEnvelope, session: AsyncSession) -> None:
    if event.event_type != "research.plan.requested.v1":
        raise ValueError(f"Unsupported event type: {event.event_type}")
    if await already_processed(session, "planner-v1", event.event_id):
        return

    run = await session.get(ResearchRun, uuid.UUID(event.payload["run_id"]))
    if run is None:
        raise ValueError("Research run does not exist")

    plan = await planner.create_plan(run.question)
    run.status = "researching"
    for task in plan.tasks:
        record = ResearchTaskRecord(
            run_id=run.id,
            task_key=task.task_id,
            title=task.title,
            question=task.question,
            search_queries=task.search_queries,
        )
        session.add(record)
        await session.flush()
        session.add(make_search_outbox_event(run, record))

    session.add(processed_marker("planner-v1", event.event_id))
    await session.commit()` }], expected: "One plan command changes the run to `researching`, creates the planned task rows, creates one unpublished search event per task, and records one `planner-v1` processed marker." },
      { id: "day-18-step-03", title: "Commit the Kafka offset last", explanation: "Call the handler and wait for its PostgreSQL transaction to finish before committing the input message. If the process dies between those two lines, Kafka sends the event again and the processed marker turns the second handling into a safe no-op.", code: [{ label: "Consumer loop order", language: "python", code: String.raw`message = consumer.poll(1.0)
event = EventEnvelope.model_validate_json(message.value())
await handle_plan(event, session)
consumer.commit(message=message, asynchronous=False)` }], expected: "A successful handler commit is followed by an offset commit. Replaying the same event does not create additional task or outbox rows." },
    ],
    failure: { title: "Send the same plan command twice", steps: ["Copy one valid plan-event JSON payload.", "Publish it twice without changing its `event_id`.", "Query the research tasks, search outbox rows, and planner processed-event rows for that run."], expected: "The worker receives two Kafka deliveries, but PostgreSQL contains only one set of tasks, one search command per task, and one processed marker for that event.", lesson: "Kafka delivery and business work are different counts. The event may arrive twice while the database deliberately applies its effect once." },
    checks: ["Invalid or unsupported events stop before the planner changes data.", "One valid plan event creates durable tasks and one search outbox row per task.", "The worker commits the Kafka offset only after the database commit succeeds.", "Publishing the same event ID twice leaves one set of planning results."],
    explain: "The planner worker receives one command and saves the resulting tasks plus their search commands in PostgreSQL. It records the event as processed before committing the Kafka offset, so a crash may cause redelivery but cannot create a second plan.",
    commit: "day 18: add idempotent planner consumer",
  },
  {
    id: "day-19",
    day: 19,
    week: 3,
    title: "Run research in parallel with a worker group",
    navTitle: "Research worker group",
    time: "3 hours",
    tools: ["Consumer group", "Partitions", "Redis cache"],
    outcome: "By the end of today, three identical research-worker processes share queued search tasks, save sources and evidence in PostgreSQL, and report progress through Redis without processing a task twice in effect.",
    whyNow: "The planner now creates several independent search commands. Research is the slowest stage, so this is where extra worker processes visibly reduce total run time and teach you how Kafka divides work.",
    prerequisites: ["Planner emits one search command per durable task.", "Redis cache-aside works."],
    deliverables: ["`research.search.commands` topic", "Research handler", "Three-worker demonstration"],
    diagram: { type: "fanout", title: "Kafka shares the search lanes between workers", description: "All three workers use the same group ID, so Kafka assigns each partition to one of them. A group cannot keep more workers busy than the topic has partitions.", start: { label: "Search topic", detail: "partitioned commands" }, branches: [
      { label: "Worker 1", detail: "group research-v1", kind: "accent" },
      { label: "Worker 2", detail: "group research-v1", kind: "accent" },
      { label: "Worker 3", detail: "group research-v1", kind: "accent" },
    ], end: { label: "Sources + evidence", detail: "PostgreSQL", kind: "data" } },
    concepts: [
      { term: "Horizontal scaling", meaning: "Run more copies of the same worker instead of giving one process a larger machine.", inProject: "Several research consumers can investigate different task partitions at the same time." },
      { term: "Rebalance", meaning: "Kafka pauses and reassigns partitions when a consumer joins or leaves a group.", inProject: "If one research worker stops, Kafka gives its partitions to surviving workers, which may see unfinished messages again." },
      { term: "Message key", meaning: "A value Kafka hashes to choose the same partition consistently.", inProject: "Use a task ID for an even spread; use a run ID only when keeping one run's messages ordered is more important than distribution." },
    ],
    steps: [
      { id: "day-19-step-01", title: "Create a search topic with room for several workers", explanation: "Create six partitions. Kafka gives at most one consumer in the group each partition, so six partitions can keep up to six research workers active; three workers are enough for today's demonstration.", code: [{ label: "Topic creation", language: "shell", code: String.raw`kafka-topics.sh --create \
  --topic research.search.commands \
  --partitions 6 \
  --bootstrap-server localhost:9092` }], expected: "Describing `research.search.commands` shows six partitions. Starting three same-group workers gives each active worker one or more partition assignments." },
      { id: "day-19-step-02", title: "Make one search handler safe to repeat", explanation: "Lock the task row while deciding whether work is already complete. If it is new, use yesterday's optional cache, store sources, evidence, and the result in PostgreSQL, mark the event processed, and commit all durable changes together. Update Redis only afterward because progress is optional.", code: [{ label: "Research handler core", language: "python", code: String.raw`async def handle_search(event: EventEnvelope, session: AsyncSession) -> None:
    task_id = uuid.UUID(event.payload["task_id"])
    task = await session.scalar(
        select(ResearchTaskRecord).where(ResearchTaskRecord.id == task_id).with_for_update()
    )
    if task is None:
        raise ValueError("Research task does not exist")
    if task.status == "completed":
        return

    result = await research_with_optional_cache(task)
    await persist_sources_and_evidence(session, task, result)
    task.result = result.model_dump()
    task.status = "completed"
    session.add(processed_marker("research-v1", event.event_id))
    await maybe_enqueue_synthesis(session, task.run_id)
    await session.commit()

    await best_effort_progress_update(task.run_id)` }], expected: "One search event changes its task to `completed`, stores its sources and evidence once, and adds a processed marker. Running the handler again leaves those durable rows unchanged." },
      { id: "day-19-step-03", title: "Start three copies of the same worker", explanation: "Open three terminals and run one line in each. Give every process a distinct display name but the same Kafka group ID in your worker configuration. Log the worker name, event ID, run ID, task ID, partition, and offset so you can see who handled what.", code: [{ label: "Three terminals", language: "powershell", code: String.raw`$env:WORKER_NAME="research-1"; python -m app.workers.research
$env:WORKER_NAME="research-2"; python -m app.workers.research
$env:WORKER_NAME="research-3"; python -m app.workers.research` }], expected: "One run's tasks appear across workers; every task finishes once in PostgreSQL." },
    ],
    failure: { title: "Stop one worker in the middle of a task", steps: ["Submit a run with enough tasks to keep all three workers busy.", "Stop one worker after it receives a message but before it commits the offset.", "Watch the remaining worker logs for a group rebalance and the unfinished event's redelivery."], expected: "Kafka assigns the stopped worker's partition to another group member. The task eventually completes, while PostgreSQL still contains one durable task result and one set of evidence rows.", lesson: "Kafka can move unfinished work to a healthy worker, but the application must make repeating that work safe. Rebalancing provides availability; database locks and idempotency provide correctness." },
    checks: ["All three worker processes use the same consumer-group ID and distinct log names.", "Logs show search tasks being handled by more than one worker.", "Each completed task has one durable result and its sources and evidence in PostgreSQL.", "Stopping Redis or one worker does not lose a task or create duplicate durable effects."],
    explain: "Kafka divides the search topic's partitions among workers that share one group ID, so several tasks can run at once. If membership changes, messages may return; locking and idempotent PostgreSQL writes ensure that redelivery still produces one durable task result.",
    commit: "day 19: distribute research across consumer group",
  },
  {
    id: "day-20",
    day: 20,
    week: 3,
    title: "Create one report even when messages repeat",
    navTitle: "Synthesis + duplicate safety",
    time: "2.5–3 hours",
    tools: ["Unique operation", "Processed events", "Offset ordering"],
    outcome: "By the end of today, finishing the last research task queues one synthesis command, and repeated or competing commands still produce exactly one citation-checked report for the run.",
    whyNow: "Several research workers now finish tasks at nearly the same time. More than one may try to start synthesis, and Kafka may also redeliver a command. Before completing the distributed workflow, make PostgreSQL enforce one final result.",
    prerequisites: ["Research workers persist task completion transactionally."],
    deliverables: ["Unique synthesis operation", "Synthesis consumer", "Duplicate-delivery test"],
    diagram: { type: "fanout", title: "Several attempts, one saved report", description: "Workers may reach the finish line together, but a per-run lock makes them check completion in order and a unique operation key allows only one synthesis job.", start: { label: "Last tasks finish", detail: "near-simultaneous" }, branches: [
      { label: "Try synth key", detail: "run:…:synthesize", kind: "accent" },
      { label: "Try synth key", detail: "same key", kind: "temporary" },
    ], end: { label: "One report", detail: "validated + stored", kind: "data" } },
    concepts: [
      { term: "Race condition", meaning: "Two operations run close together and the result changes depending on which one reaches shared data first.", inProject: "Two research workers can finish the last tasks together and both try to queue synthesis." },
      { term: "Database arbiter", meaning: "A lock or unique constraint lets the database choose one valid winner atomically.", inProject: "A run-row lock orders the completion check, and `UNIQUE(run_id, stage)` permits only one synthesis operation." },
      { term: "At-least-once", meaning: "Kafka aims not to lose a message, so the same message may sometimes be delivered again.", inProject: "EvidenceLab promises one stored business result, not that the handler function runs only once." },
    ],
    steps: [
      { id: "day-20-step-01", title: "Let one worker queue synthesis", explanation: "Inside the task-completion transaction, lock the parent run row so workers check completion one at a time. Count unfinished tasks; when the count reaches zero, insert a uniquely keyed synthesis operation and its outbox event. A duplicate key means another worker already won.", code: [{ label: "Synthesis enqueue core", language: "python", code: String.raw`async def maybe_enqueue_synthesis(session: AsyncSession, run_id: uuid.UUID) -> None:
    await session.execute(
        select(ResearchRun.id)
        .where(ResearchRun.id == run_id)
        .with_for_update()
    )
    incomplete = await session.scalar(
        select(func.count())
        .select_from(ResearchTaskRecord)
        .where(
            ResearchTaskRecord.run_id == run_id,
            ResearchTaskRecord.status != "completed",
        )
    )
    if incomplete:
        return

    try:
        async with session.begin_nested():
            operation = WorkflowOperation(run_id=run_id, stage="synthesize")
            session.add(operation)
            await session.flush()
    except IntegrityError:
        return
    session.add(make_synthesis_outbox_event(run_id))` }], why: "The run-row lock prevents two last-task transactions from both seeing stale counts. The nested transaction is a savepoint, so a duplicate operation key rolls back only the losing synthesis claim—not the research task completion around it.", expected: "When all tasks are complete, PostgreSQL contains one `synthesize` operation and one unpublished synthesis outbox event for the run. Earlier task completions create neither." },
      { id: "day-20-step-02", title: "Build the synthesis consumer around the citation gate", explanation: "Load the saved evidence from PostgreSQL, call the synthesizer, and reuse the citation validator from Day 4 before storing anything. Save the unique report, mark the run completed, and record the processed event in one transaction; commit Kafka afterward.", actions: ["Reject events with the wrong type/version.", "Return immediately if this exact event already has a completed processed marker.", "Resolve source IDs to URLs in application code; never trust URLs generated in the synthesis payload.", "Insert the report, update the run, and record the event in one PostgreSQL commit.", "Commit the Kafka offset only after that transaction succeeds."], expected: "A valid synthesis command creates one report whose citation IDs all exist, changes the run to `completed`, and then advances the consumer offset." },
      { id: "day-20-step-03", title: "Document the guarantee you actually provide", explanation: "Add this sentence to `docs/event-flow.md`. It explains why duplicate deliveries can appear in logs even though users see one report.", code: [{ label: "Documentation", language: "markdown", code: "Kafka provides at-least-once delivery. EvidenceLab makes handler effects idempotent with processed-event records, unique operation keys, and database transactions." }], expected: "Your event-flow document distinguishes message delivery count from the number of durable business results." },
    ],
    failure: { title: "Send both kinds of duplicate synthesis command", steps: ["Publish the same synthesis envelope twice with the same `event_id`.", "Then publish another envelope with a new `event_id` but the same run and `synthesize` operation.", "Query the reports, workflow operations, and processed-event rows for that run."], expected: "Logs may show every delivery, but PostgreSQL still contains one synthesis operation and one report. The run remains `completed` with valid citations.", lesson: "A processed-event record stops an exact Kafka replay. A unique run-stage operation stops a different event from requesting the same business job. You need both protections." },
    checks: ["Two near-simultaneous final task completions leave one synthesis operation and one outbox event.", "Replaying the same event ID does not create a second report.", "A different event ID for the same run and stage also cannot create a second report.", "Citation validation and the report transaction finish before the Kafka offset is committed."],
    explain: "EvidenceLab may receive the same synthesis request more than once, so it protects both the event ID and the run's unique synthesis operation. PostgreSQL accepts one citation-validated report, and the worker commits the Kafka offset only after that result is durable.",
    commit: "day 20: make synthesis idempotent",
  },
  {
    id: "day-21",
    day: 21,
    week: 3,
    title: "Manage prompts in Django Admin",
    navTitle: "Django prompt admin",
    time: "2.5–3 hours",
    tools: ["Django", "Admin", "Prompt versioning"],
    outcome: "By the end of today, you can sign in to Django Admin, create prompt versions and model profiles, choose the active prompt for each stage, and record exactly which configuration a new run used.",
    whyNow: "Your prompts are now used by several worker processes. Keeping separate copied strings in each process would make changes hard to track. A small internal admin gives those shared settings one versioned home without replacing FastAPI or the workers.",
    prerequisites: ["Distributed workers use named planner, researcher, and synthesizer stages."],
    deliverables: ["`control_plane/` project", "PromptTemplate and ModelProfile models", "Admin activation action", "Small internal read endpoint"],
    diagram: { type: "fanout", title: "Django configures; FastAPI and workers execute", description: "Django is an internal settings tool, not a second public product. Humans manage slow-changing prompts and model choices there; the existing API and workers still perform every research run.", start: { label: "Django Admin", detail: "human configuration", kind: "accent" }, branches: [
      { label: "Prompt versions", detail: "one active per stage", kind: "data" },
      { label: "Model profiles", detail: "provider + model", kind: "data" },
    ], end: { label: "API + workers", detail: "cached active config" } },
    concepts: [
      { term: "Control plane", meaning: "The part humans use to manage settings and rules that change occasionally.", inProject: "Django Admin lets you edit prompt versions and model profiles." },
      { term: "Data plane", meaning: "The part that handles the product's normal work repeatedly.", inProject: "FastAPI accepts runs and Kafka workers plan, research, and synthesize them." },
      { term: "Prompt version", meaning: "A numbered revision of the instructions sent to a model.", inProject: "Every output records its prompt version, so you can explain why an older run differs from a newer one." },
    ],
    steps: [
      { id: "day-21-step-01", title: "Create a small internal Django project", explanation: "Install Django, create the `control_plane` directory and project, then add one `prompts` app. Point this project at the existing PostgreSQL server, but keep its configuration tables separate from the research workflow tables.", code: [{ label: "Terminal", language: "shell", code: String.raw`python -m pip install django djangorestframework
mkdir control_plane
django-admin startproject config control_plane
cd control_plane
python manage.py startapp prompts` }], expected: "`control_plane/manage.py`, `control_plane/config/`, and `control_plane/prompts/` exist. After adding `prompts` to `INSTALLED_APPS`, `python manage.py check` reports no issues." },
      { id: "day-21-step-02", title: "Store prompt versions and model choices", explanation: "Create only the two configuration models the project needs. The `(stage, version)` constraint preserves each numbered prompt revision; the `active` fields identify what new work should use.", code: [{ label: "control_plane/prompts/models.py", language: "python", code: String.raw`from django.db import models


class PromptTemplate(models.Model):
    stage = models.CharField(max_length=30, choices=[
        ("planner", "Planner"),
        ("researcher", "Researcher"),
        ("synthesizer", "Synthesizer"),
    ])
    version = models.PositiveIntegerField()
    instructions = models.TextField()
    active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["stage", "version"], name="uq_prompt_stage_version")
        ]


class ModelProfile(models.Model):
    name = models.CharField(max_length=100, unique=True)
    provider = models.CharField(max_length=50)
    model_name = models.CharField(max_length=150)
    active = models.BooleanField(default=True)` }, { label: "Create and apply the tables", language: "shell", code: String.raw`python manage.py makemigrations prompts
python manage.py migrate` }], expected: "Django creates the prompt and model-profile tables. The database rejects two prompt rows with the same stage and version." },
      { id: "day-21-step-03", title: "Add a safe Activate action to Admin", explanation: "Register both models. When an administrator selects one prompt and chooses Activate, deactivate the other versions for that stage and activate the selected one inside one database transaction.", code: [{ label: "control_plane/prompts/admin.py", language: "python", code: String.raw`from django.contrib import admin, messages
from django.db import transaction

from .models import ModelProfile, PromptTemplate


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    list_display = ("stage", "version", "active", "created_at")
    list_filter = ("stage", "active")
    actions = ("activate_selected",)

    @admin.action(description="Activate selected prompt version")
    def activate_selected(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Select exactly one prompt.", level=messages.ERROR)
            return
        prompt = queryset.get()
        with transaction.atomic():
            PromptTemplate.objects.filter(stage=prompt.stage).update(active=False)
            prompt.active = True
            prompt.save(update_fields=["active"])


admin.site.register(ModelProfile)` }], expected: "After creating a superuser and opening Admin, you can add two planner prompt versions. Activating version 2 leaves version 2 active and version 1 inactive." },
      { id: "day-21-step-04", title: "Let workers read config and save what they used", explanation: "Expose one authenticated, read-only internal endpoint that returns the active prompt and model profile for a named stage. A worker may cache that response for up to one minute, but it must save the chosen stage, prompt version, and model profile with the run or operation before producing output.", actions: ["Return only the active prompt and model profile for a requested stage.", "Require internal authentication; do not expose this endpoint as part of the public research API.", "Cache active configuration for no more than one minute so Admin changes take effect predictably.", "Store the exact stage, prompt version, provider, and model name used for each operation.", "Keep the endpoint read-only; workers never create or activate configuration."], expected: "A new planner run records the active prompt version and model profile. Changing the active prompt affects new runs after the short cache expires, while old run records keep their original version." },
    ],
    failure: { title: "Switch the active planner prompt", steps: ["Create planner prompt version 2 with a small, harmless instruction change.", "Activate version 2 in Admin and wait for the worker's short cache to expire.", "Run a new question, then compare its stored prompt version with a run created under version 1."], expected: "The new run records planner prompt version 2. The earlier run still records version 1, and both prompt texts remain available in Admin.", lesson: "Changing today's configuration must not rewrite yesterday's history. Saving version identity makes output differences traceable and experiments comparable." },
    checks: ["Only internal users can access Django Admin and the configuration read endpoint.", "Creating a new prompt version keeps the older version and its text.", "Using the Admin activation action leaves one active prompt for the selected stage.", "Every new operation stores the exact prompt version and model profile it used."],
    explain: "Django Admin is the internal place where humans manage versioned prompts and model choices. FastAPI and the Kafka workers still execute research; they read active configuration and save its identity with each result so past runs remain explainable.",
    commit: "day 21: add prompt and model control plane",
  },
];
