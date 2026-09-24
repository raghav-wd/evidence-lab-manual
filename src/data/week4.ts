import type { DayGuide } from "../types/guide";

export const week4Days: DayGuide[] = [
  {
    id: "day-22",
    day: 22,
    week: 4,
    title: "Start the whole local system with Compose",
    navTitle: "Complete Docker Compose",
    time: "3 hours",
    tools: ["Docker Compose", "Service DNS", "Health checks", "Volumes"],
    outcome: "By the end of today, one Docker Compose command starts every part of EvidenceLab: the API, message relay, workers, admin screen, PostgreSQL, Redis, and Kafka.",
    whyNow: "At the end of Week 3, the pieces work only when you start several terminals in the right order. Today you write that setup down as code so another person can start the same system without knowing your private routine.",
    prerequisites: ["The Week 3 workflow completes when you start its services and workers manually.", "Docker Desktop or another Docker engine is running."],
    deliverables: ["`compose.yaml`", "One shared app image", "Health-aware startup", "Clean-start smoke test"],
    diagram: { type: "fanout", title: "One image, several process roles", description: "API and workers share code and dependencies. Compose changes the startup command and connects names on one network.", start: { label: "App image", detail: "same artifact" }, branches: [
      { label: "FastAPI", detail: "HTTP command", kind: "accent" },
      { label: "Relay", detail: "outbox command" },
      { label: "Planner", detail: "consumer command" },
      { label: "Research ×3", detail: "consumer command" },
      { label: "Synthesis", detail: "consumer command" },
    ], end: { label: "Postgres · Redis · Kafka", detail: "service-name DNS", kind: "data" } },
    concepts: [
      { term: "Service DNS", meaning: "Inside Compose, a container can reach another container by its service name.", inProject: "The API uses `postgres:5432`. `localhost` would incorrectly point back to the API container itself." },
      { term: "Health check", meaning: "A small command that answers whether a service is ready to be used—not merely whether its container has started.", inProject: "The API waits until PostgreSQL can accept a connection before it starts." },
      { term: "Shared image", meaning: "One packaged copy of the Python code can be started with different commands.", inProject: "The API, relay, and workers use the same image; only their startup command changes." },
    ],
    steps: [
      { id: "day-22-step-01", title: "Tell containers how to find one another", explanation: "Create `.env.compose` for ordinary local addresses. Notice that each URL uses a Compose service name such as `postgres`, `redis`, or `kafka`. Keep the real provider key in the ignored `.env` file.", code: [{ label: ".env.compose", language: "dotenv", code: String.raw`DATABASE_URL=postgresql+asyncpg://research:research@postgres:5432/evidencelab
REDIS_URL=redis://redis:6379/0
KAFKA_BOOTSTRAP_SERVERS=kafka:9092` }], expected: "The file contains only local, non-secret values, and every host name matches a service in `compose.yaml`." },
      { id: "day-22-step-02", title: "List every service in Compose", explanation: "Create `compose.yaml`. The `x-app` block holds settings shared by all Python processes, while each service supplies its own command. This learning setup uses one Kafka node; after it works, replace `latest` with the exact image tag you tested.", code: [{ label: "compose.yaml", language: "yaml", code: String.raw`x-app: &app
  build: .
  env_file: [.env, .env.compose]
  depends_on:
    postgres: { condition: service_healthy }
    redis: { condition: service_healthy }
    kafka: { condition: service_started }
  restart: unless-stopped

services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: research
      POSTGRES_PASSWORD: research
      POSTGRES_DB: evidencelab
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U research -d evidencelab"]
      interval: 5s
      timeout: 3s
      retries: 20

  redis:
    image: redis:7-alpine
    healthcheck:
      test: [CMD, redis-cli, ping]
      interval: 5s
      timeout: 3s
      retries: 20

  kafka:
    image: apache/kafka:latest
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  api:
    <<: *app
    command: uvicorn app.api:app --host 0.0.0.0 --port 8000
    ports: ["8000:8000"]

  outbox-relay:
    <<: *app
    command: python -m app.workers.outbox_relay

  planner-worker:
    <<: *app
    command: python -m app.workers.planner

  research-worker:
    <<: *app
    command: python -m app.workers.research
    deploy: { replicas: 3 }

  synthesis-worker:
    <<: *app
    command: python -m app.workers.synthesis

  django:
    <<: *app
    command: python control_plane/manage.py runserver 0.0.0.0:8001
    ports: ["8001:8001"]

volumes:
  postgres-data:` }], expected: "`docker compose config --services` lists every data service and Python role without a YAML error." },
      { id: "day-22-step-03", title: "Create database tables once, then start the app", explanation: "Build the image, start only the three data services, and run Alembic once as a short-lived job. If every API or worker tried to migrate at startup, several copies could change the schema at the same time.", code: [{ label: "Clean startup", language: "powershell", code: String.raw`docker compose build
docker compose up -d postgres redis kafka
docker compose run --rm api alembic upgrade head
docker compose up -d
docker compose ps
docker compose logs -f api planner-worker research-worker synthesis-worker` }], expected: "The migration exits successfully and `docker compose ps` shows the long-running services started or healthy." },
      { id: "day-22-step-04", title: "Prove the one-command setup", explanation: "Stop and remove the containers while keeping the PostgreSQL named volume, then follow the documented startup from the beginning. Submit a question through Swagger without opening any manual Python worker terminals.", expected: "The run moves from queued to completed using only processes managed by Compose." },
    ],
    failure: { title: "Watch workers start before Kafka is ready", steps: ["Run `docker compose down` and then `docker compose up`.", "Inspect the worker logs while Kafka is still starting.", "Verify the workers reconnect and begin consuming without a manual restart."], expected: "The workers log a limited number of connection retries and become usable after Kafka is ready.", lesson: "Starting a container first does not mean its software is ready. Networked programs must expect dependencies to be temporarily unavailable." },
    checks: ["One image serves all Python roles.", "Containers use service names, never localhost, for peers.", "Migrations run once explicitly.", "One Compose command completes a full run."],
    explain: "Docker Compose records which local services exist, how they find one another, what starts first, and which data is kept. It makes development repeatable, but it is not the production deployment system.",
    commit: "day 22: compose the complete local system",
  },
  {
    id: "day-23",
    day: 23,
    week: 4,
    title: "Make one run traceable in logs and metrics",
    navTitle: "Logs + metrics",
    time: "2.5 hours",
    tools: ["Structured logs", "Correlation IDs", "Prometheus metrics"],
    outcome: "By the end of today, you can search one run ID and reconstruct its path through the API and workers. You can also see counts and timings at `/metrics`.",
    whyNow: "Compose gave you many simultaneously running processes. Their separate `print` lines no longer tell one connected story, so you now add shared IDs for individual runs and small measurements for overall behavior.",
    prerequisites: ["Compose completes a run end to end."],
    deliverables: ["JSON logs", "Context fields", "`/metrics`", "One traced failure"],
    diagram: { type: "fanout", title: "Correlation turns separate logs into one story", description: "Every process emits its own stream. Shared IDs let queries reconstruct a run without a central in-memory object.", start: { label: "run_id", detail: "correlation root", kind: "accent" }, branches: [
      { label: "API logs", detail: "acceptance" },
      { label: "Relay logs", detail: "publish" },
      { label: "Worker logs", detail: "stage + task" },
    ], end: { label: "Timeline", detail: "query by ID", kind: "data" } },
    concepts: [
      { term: "Structured log", meaning: "A log line stored as named fields instead of one sentence, so tools can reliably search and group it.", inProject: "Every process uses the same fields such as `run_id`, `event_id`, stage, duration, and status." },
      { term: "Metric", meaning: "A number collected across many events and tracked over time.", inProject: "Counters show how many runs succeeded or failed; histograms show how long stages usually take." },
      { term: "Cardinality", meaning: "How many different label combinations a metric can create. Too many combinations consume memory and make queries expensive.", inProject: "A unique `run_id` belongs in logs, not in a Prometheus metric label." },
    ],
    steps: [
      { id: "day-23-step-01", title: "Give every log line searchable context", explanation: "Create one logging helper, or configure a structured logging library, so all processes use the same field names. A human can read `message`; tools can filter the stable ID and status fields.", code: [{ label: "Example event", language: "json", code: String.raw`{
  "level": "INFO",
  "message": "research task completed",
  "run_id": "…",
  "task_id": "…",
  "event_id": "…",
  "stage": "research",
  "source_count": 6,
  "duration_ms": 8142,
  "status": "completed"
}` }], expected: "A completion log is valid JSON and includes the same run, task, and event IDs used by the surrounding workflow." },
      { id: "day-23-step-02", title: "Expose a few measurements you will use", explanation: "Add only numbers that answer a real question: how many runs finish, how often tasks retry, how many sources you collect, and how long stages take. A small useful set is easier to trust than dozens of unused counters.", code: [{ label: "app/metrics.py", language: "python", code: String.raw`from prometheus_client import Counter, Histogram

RUNS = Counter("evidencelab_research_runs_total", "Research runs", ["status"])
TASK_RETRIES = Counter("evidencelab_research_task_retries_total", "Task retries", ["stage"])
SOURCES = Counter("evidencelab_sources_collected_total", "Sources collected")
STAGE_DURATION = Histogram(
    "evidencelab_stage_duration_seconds",
    "Workflow stage duration",
    ["stage", "status"],
)
CACHE = Counter("evidencelab_search_cache_total", "Search cache outcomes", ["result"])
LLM_DURATION = Histogram(
    "evidencelab_llm_request_duration_seconds",
    "LLM request duration",
    ["stage", "status"],
)` }, { label: "Add to app/api.py", language: "python", code: String.raw`from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from fastapi import Response


@app.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)` }], expected: "Opening `/metrics` returns Prometheus text containing the EvidenceLab counter and histogram names." },
      { id: "day-23-step-03", title: "Time one complete research stage", explanation: "Start a timer immediately before the stage and record it in `finally`, so both success and failure are measured. Use a separate timer for a provider call if you need to distinguish external waiting from your whole stage.", code: [{ label: "Timing pattern", language: "python", code: String.raw`started = time.perf_counter()
status = "success"
try:
    await handle_search(event, session)
except Exception:
    status = "error"
    raise
finally:
    STAGE_DURATION.labels(stage="research", status=status).observe(
        time.perf_counter() - started
    )` }], expected: "One successful and one failed research attempt both add a duration observation with the correct status label." },
      { id: "day-23-step-04", title: "Follow one failed run from beginning to end", explanation: "Force one model call to fail, copy its run ID, and filter the logs for that ID. Write down the order: API accepted it, relay published it, a worker attempted it, and the run reached its final status.", expected: "You can reconstruct every hop with the shared ID instead of guessing from nearby timestamps." },
    ],
    failure: { title: "See why a run ID should not be a metric label", steps: ["Temporarily imagine or test a counter labeled with `run_id`.", "Notice that every new run creates a separate metric time series.", "Remove that label and keep run identity only in logs."], expected: "Metrics use small, repeated labels such as stage and status; logs retain the unique run ID.", lesson: "Metrics summarize patterns across many runs. Logs explain what happened to one particular run." },
    checks: ["One run is traceable across every process by `run_id`.", "Every event log has `event_id` and stage.", "Counters and histograms avoid unbounded labels.", "`/metrics` renders valid Prometheus text."],
    explain: "A shared run ID connects log lines from separate programs into one story. Metrics answer broad questions about volume, failures, and speed; logs explain one specific event. I need both views.",
    commit: "day 23: add structured observability",
  },
  {
    id: "day-24",
    day: 24,
    week: 4,
    title: "Learn the Kubernetes objects you actually need",
    navTitle: "Kubernetes fundamentals",
    time: "2.5 hours",
    tools: ["kubectl", "Minikube or Docker Desktop", "Pod", "Deployment", "Service"],
    outcome: "By the end of today, you will have deployed, scaled, broken, and repaired a tiny practice app on local Kubernetes. You will know what a Pod, Deployment, and Service each do.",
    whyNow: "Compose starts a fixed set of processes on one computer. Before moving EvidenceLab to Kubernetes, learn Kubernetes with a disposable app so an app bug and a deployment mistake cannot hide inside each other.",
    prerequisites: ["`kubectl` and a local cluster are installed.", "Compose remains the reliable local demo."],
    deliverables: ["`infra/kubernetes/namespace.yaml`", "Learning deployment", "Pod deletion observation"],
    diagram: { type: "flow", title: "You describe the result; Kubernetes keeps it that way", description: "You ask for two running copies. If one Pod disappears, the Deployment notices the difference and creates a replacement.", nodes: [
      { label: "Deployment", detail: "replicas: 2", kind: "accent" },
      { label: "ReplicaSet", detail: "controller-owned" },
      { label: "Pods", detail: "replaceable processes", kind: "data" },
      { label: "Service", detail: "stable network name" },
    ] },
    concepts: [
      { term: "Pod", meaning: "One replaceable running copy of an application in Kubernetes. A Pod usually contains one main container for this project.", inProject: "One EvidenceLab API or worker process will run in each Pod." },
      { term: "Deployment", meaning: "Instructions that tell Kubernetes which image to run, how many copies to keep, and how to update them.", inProject: "The API and each worker role will have separate Deployments so they can scale independently." },
      { term: "Service", meaning: "A stable network address in front of changing Pods.", inProject: "Clients call one API Service instead of tracking the temporary address of each API Pod." },
      { term: "ConfigMap / Secret", meaning: "Kubernetes objects that supply ordinary settings and sensitive settings separately.", inProject: "The same image receives a model name from a ConfigMap and the API key from a Secret." },
    ],
    steps: [
      { id: "day-24-step-01", title: "Confirm which cluster you are controlling", explanation: "Run these read-only commands first. `kubectl` remembers a current context, so never assume it points to your local learning cluster before you create or delete anything.", code: [{ label: "Terminal", language: "shell", code: String.raw`kubectl config current-context
kubectl cluster-info
kubectl get nodes` }], expected: "The current context is your intended local cluster and at least one node reports `Ready`." },
      { id: "day-24-step-02", title: "Create a separate area for EvidenceLab", explanation: "A namespace groups related Kubernetes objects and keeps this practice work away from unrelated workloads. Every later command explicitly uses the `evidencelab` namespace.", code: [{ label: "infra/kubernetes/namespace.yaml", language: "yaml", code: String.raw`apiVersion: v1
kind: Namespace
metadata:
  name: evidencelab` }, { label: "Apply", language: "shell", code: "kubectl apply -f infra/kubernetes/namespace.yaml" }], expected: "`kubectl get namespace evidencelab` reports the namespace as `Active`." },
      { id: "day-24-step-03", title: "Practice with a disposable web server", explanation: "Create a Deployment from the small nginx image, give it a Service, scale it to two copies, and inspect what Kubernetes created. You are learning the commands here; no EvidenceLab code is involved yet.", code: [{ label: "Learning commands", language: "shell", code: String.raw`kubectl create deployment hello --image=nginx:alpine -n evidencelab
kubectl expose deployment hello --port=80 -n evidencelab
kubectl scale deployment hello --replicas=2 -n evidencelab
kubectl get all -n evidencelab
kubectl describe deployment hello -n evidencelab` }], expected: "Two nginx Pods are ready and one Service selects them inside the `evidencelab` namespace." },
      { id: "day-24-step-04", title: "Watch Kubernetes replace a missing Pod", explanation: "Keep the live Pod list open in one terminal and delete one nginx Pod from another. You delete an actual copy, but the Deployment still says that two copies should exist.", code: [{ label: "Observe", language: "shell", code: String.raw`kubectl get pods -n evidencelab -w
# In another terminal: kubectl delete pod <hello-pod> -n evidencelab` }], expected: "The Deployment creates a replacement and returns to two ready replicas." },
    ],
    failure: { title: "Ask Kubernetes for an image that does not exist", steps: ["Set the learning Deployment image to `nginx:not-a-real-tag`.", "Run `kubectl describe pod ...` and read the Events section near the bottom.", "Restore `nginx:alpine` and watch the rollout recover."], expected: "The Pod reports `ImagePullBackOff`, its events explain the failed download, and the Deployment recovers after you restore the tag.", lesson: "Start Kubernetes debugging with the object's status and events. Reapplying the same broken file cannot repair a wrong image name." },
    checks: ["You can distinguish pod, Deployment, and Service.", "You checked context and namespace before mutation.", "Deleting a pod does not delete desired state.", "You diagnosed an image failure from events."],
    explain: "I describe how many application copies I want. A Deployment keeps that number of Pods running and replaces them during failure or updates. A Service gives changing API Pods one stable address.",
    commit: "day 24: add local kubernetes learning setup",
  },
  {
    id: "day-25",
    day: 25,
    week: 4,
    title: "Deploy the API and one worker independently",
    navTitle: "API + worker deployments",
    time: "3 hours",
    tools: ["Deployment", "Service", "Resource requests", "Probes"],
    outcome: "By the end of today, two API Pods and one research-worker Pod run from the same EvidenceLab image. You can change their copy counts independently.",
    whyNow: "Yesterday you learned Kubernetes with nginx. Today you apply the same objects to two real EvidenceLab roles. PostgreSQL, Redis, and Kafka stay outside the cluster so this lesson remains about replaceable application processes, not database administration.",
    prerequisites: ["A local cluster works.", "The EvidenceLab image is available to that cluster.", "Reachable dependency URLs are known."],
    deliverables: ["API Deployment + Service", "Worker Deployment", "ConfigMap + Secret", "Independent scaling demo"],
    diagram: { type: "fanout", title: "One image runs as separate API and worker groups", description: "The Service sends web traffic only to API Pods. Research workers do not need a Service because they receive their jobs from Kafka.", start: { label: "EvidenceLab image", detail: "same packaged code" }, branches: [
      { label: "API pods ×2", detail: "behind Service", kind: "accent" },
      { label: "Research worker ×1", detail: "Kafka consumer", kind: "accent" },
    ], end: { label: "External dependencies", detail: "Postgres · Redis · Kafka", kind: "data" } },
    concepts: [
      { term: "Resource request", meaning: "The CPU and memory a Pod asks Kubernetes to reserve when choosing a node for it.", inProject: "The scheduler avoids placing more API or worker Pods on a node than the node can reasonably handle." },
      { term: "Resource limit", meaning: "The maximum CPU or memory a container is allowed to use.", inProject: "A runaway process is contained instead of silently consuming the whole node." },
      { term: "Selector", meaning: "A label query that connects a Deployment or Service to the correct Pods.", inProject: "The API Service selects only Pods labeled `app: research-api`; research workers never receive HTTP traffic." },
    ],
    steps: [
      { id: "day-25-step-01", title: "Supply settings without putting secrets in Git", explanation: "Put ordinary values such as service URLs and the model name in a ConfigMap. Create the real API key directly in the local cluster; do not write it into a committed YAML file.", code: [{ label: "infra/kubernetes/configmap.yaml", language: "yaml", code: String.raw`apiVersion: v1
kind: ConfigMap
metadata:
  name: evidencelab-config
  namespace: evidencelab
data:
  OPENAI_MODEL: "choose-a-compatible-model"
  DATABASE_URL: "postgresql+asyncpg://research:research@host.docker.internal:5432/evidencelab"
  REDIS_URL: "redis://host.docker.internal:6379/0"
  KAFKA_BOOTSTRAP_SERVERS: "host.docker.internal:9092"` }, { label: "Create the local secret", language: "powershell", code: String.raw`kubectl create secret generic evidencelab-secrets --from-literal=OPENAI_API_KEY="your-real-key" -n evidencelab`, bashCode: String.raw`kubectl create secret generic evidencelab-secrets \
  --from-literal=OPENAI_API_KEY="your-real-key" \
  -n evidencelab` }], expected: "The ConfigMap and Secret exist in the namespace, and searching tracked files finds no real API key." },
      { id: "day-25-step-02", title: "Run two API copies behind one address", explanation: "Replace the image placeholder with the tag available to your local cluster. The Deployment keeps two API Pods running; the Service gives both copies one stable address and sends requests only to matching Pods.", code: [{ label: "infra/kubernetes/api.yaml", language: "yaml", code: String.raw`apiVersion: apps/v1
kind: Deployment
metadata: { name: research-api, namespace: evidencelab }
spec:
  replicas: 2
  selector: { matchLabels: { app: research-api } }
  template:
    metadata: { labels: { app: research-api } }
    spec:
      containers:
        - name: api
          image: evidencelab:local
          imagePullPolicy: IfNotPresent
          command: [uvicorn, app.api:app, --host, 0.0.0.0, --port, "8000"]
          envFrom:
            - configMapRef: { name: evidencelab-config }
            - secretRef: { name: evidencelab-secrets }
          ports: [{ containerPort: 8000 }]
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { cpu: 500m, memory: 512Mi }
          readinessProbe:
            httpGet: { path: /health/ready, port: 8000 }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /health/live, port: 8000 }
            initialDelaySeconds: 15
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata: { name: research-api, namespace: evidencelab }
spec:
  selector: { app: research-api }
  ports: [{ port: 80, targetPort: 8000 }]` }], expected: "Two API Pods become ready, and the `research-api` Service has both Pod addresses as endpoints." },
      { id: "day-25-step-03", title: "Run the same image as a research worker", explanation: "Change only the startup command so the image launches the research consumer instead of FastAPI. The worker needs no Service because it receives jobs from Kafka rather than inbound web requests.", code: [{ label: "infra/kubernetes/research-worker.yaml", language: "yaml", code: String.raw`apiVersion: apps/v1
kind: Deployment
metadata: { name: research-worker, namespace: evidencelab }
spec:
  replicas: 1
  selector: { matchLabels: { app: research-worker } }
  template:
    metadata: { labels: { app: research-worker } }
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: worker
          image: evidencelab:local
          imagePullPolicy: IfNotPresent
          command: [python, -m, app.workers.research]
          envFrom:
            - configMapRef: { name: evidencelab-config }
            - secretRef: { name: evidencelab-secrets }
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { cpu: "1", memory: 768Mi }` }], expected: "One research-worker Pod runs the consumer command, and no Kubernetes Service was created for it." },
      { id: "day-25-step-04", title: "Start both roles and scale only research", explanation: "Apply the files, wait until the API rollout succeeds, and then increase only the research-worker count. This demonstrates why each role has its own Deployment.", code: [{ label: "Terminal", language: "shell", code: String.raw`kubectl apply -f infra/kubernetes/configmap.yaml
kubectl apply -f infra/kubernetes/api.yaml
kubectl apply -f infra/kubernetes/research-worker.yaml
kubectl rollout status deployment/research-api -n evidencelab
kubectl scale deployment/research-worker --replicas=3 -n evidencelab
kubectl get pods -n evidencelab` }], expected: "The API remains at two ready Pods while the research-worker Deployment reaches three ready Pods." },
    ],
    failure: { title: "Delete one API Pod while requests continue", steps: ["Port-forward the API Service and request the liveness route repeatedly.", "Delete one of the two API Pods.", "Watch both the HTTP responses and the replacement Pod."], expected: "The remaining ready Pod serves requests while the Deployment creates a new second copy.", lesson: "Extra copies help only when clients use a Service and unready copies are removed from that Service's endpoints." },
    checks: ["API and worker use one image with different commands.", "Only API pods are behind the Service.", "Real secrets are absent from Git.", "API and workers scale separately."],
    explain: "The API and research workers use the same packaged code but run different commands. Separate Deployments let me restart or scale each role independently, and only the API needs a Service for incoming requests.",
    commit: "day 25: deploy api and worker to kubernetes",
  },
  {
    id: "day-26",
    day: 26,
    week: 4,
    title: "Make health, shutdown, and rollouts truthful",
    navTitle: "Probes + rollouts",
    time: "2.5 hours",
    tools: ["Readiness", "Liveness", "SIGTERM", "Rolling update"],
    outcome: "By the end of today, Kubernetes sends traffic only to usable API Pods, restarts truly stuck processes, and gives a worker time to release unfinished work safely.",
    whyNow: "Yesterday's YAML contains health probes, but a URL returning `200 OK` is useful only if you know what question it answers. Today you make those checks and the worker shutdown sequence match real failure behavior.",
    prerequisites: ["API and worker Deployments are running."],
    deliverables: ["Cheap liveness", "Dependency-aware readiness", "Graceful consumer shutdown", "Observed rollout"],
    diagram: { type: "flow", title: "Health signals answer different questions", description: "Liveness asks whether restart may help. Readiness asks whether traffic should arrive now.", nodes: [
      { label: "Process alive?", detail: "/health/live" },
      { label: "Can serve?", detail: "/health/ready", kind: "accent" },
      { label: "Service endpoints", detail: "ready pods only" },
      { label: "Rolling update", detail: "replace gradually", kind: "data" },
    ] },
    concepts: [
      { term: "Liveness", meaning: "Answers: is this process stuck in a way that restarting it might fix?", inProject: "The check is local and cheap. A temporary Redis outage must not cause every API Pod to restart." },
      { term: "Readiness", meaning: "Answers: can this Pod safely receive traffic right now?", inProject: "Missing critical configuration or an unavailable PostgreSQL connection makes the API unready until the problem clears." },
      { term: "Graceful shutdown", meaning: "Stop taking new work, finish or safely release current work, and only then exit.", inProject: "The worker never marks a Kafka message complete when its database changes were not saved." },
    ],
    steps: [
      { id: "day-26-step-01", title: "Make liveness answer only whether the app is alive", explanation: "Return from the process itself without calling PostgreSQL, Redis, Kafka, or OpenAI. If a shared dependency is down, restarting every healthy API Pod would create noise rather than repair that dependency.", code: [{ label: "Liveness", language: "python", code: String.raw`@app.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"status": "alive"}` }], expected: "`/health/live` returns 200 while the process is responsive, even if Redis or PostgreSQL is temporarily unavailable." },
      { id: "day-26-step-02", title: "Make readiness check what the API truly needs", explanation: "Validate required settings and perform one cheap PostgreSQL query with a one-second timeout. Return 503 quickly when the API cannot serve correct run state; do not let a health request hang indefinitely.", code: [{ label: "Readiness", language: "python", code: String.raw`import asyncio

from sqlalchemy import text


@app.get("/health/ready")
async def readiness(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    get_settings()
    try:
        async with asyncio.timeout(1.0):
            await session.execute(text("SELECT 1"))
    except Exception as error:
        raise HTTPException(503, "Database unavailable") from error
    return {"status": "ready"}` }], expected: "The route returns 200 with a working database and returns 503 within about one second when the database cannot be reached." },
      { id: "day-26-step-03", title: "Stop a worker without falsely completing its job", explanation: "When Kubernetes sends SIGTERM, stop polling for new messages. Finish the current database transaction, commit the Kafka offset only if that transaction succeeded, close the consumer, and exit before the 30-second grace period ends.", actions: ["Register SIGINT and SIGTERM handlers.", "Do not start a new poll once stopping is set.", "Never commit an offset for rolled-back work.", "Emit a final structured shutdown log."], expected: "The shutdown log shows polling stopped before exit, and any unsaved message is available for another worker instead of being marked complete." },
      { id: "day-26-step-04", title: "Watch Kubernetes replace API Pods gradually", explanation: "Change one harmless setting or image tag and keep the Pod list open during the rollout. Kubernetes should make a new ready copy before removing too many old copies; use rollout history if you need to undo the change.", code: [{ label: "Rollout commands", language: "shell", code: String.raw`kubectl rollout status deployment/research-api -n evidencelab
kubectl get pods -n evidencelab -w
kubectl rollout history deployment/research-api -n evidencelab
# If needed:
kubectl rollout undo deployment/research-api -n evidencelab` }], expected: "The rollout finishes with the requested number of ready API Pods and no period where all API endpoints disappear." },
    ],
    failure: { title: "Make the API unusable without making its process dead", steps: ["Point `DATABASE_URL` at an unavailable port.", "Observe readiness fail and the Pod disappear from the Service endpoints.", "Confirm liveness still passes, so Kubernetes does not restart the process repeatedly."], expected: "The Pod stays running but receives no user traffic until the database setting is restored.", lesson: "Readiness protects users from a temporarily unusable Pod. Liveness should fail only when restarting the process has a reasonable chance of helping." },
    checks: ["Liveness has no external dependency call.", "Readiness fails quickly when a critical dependency is unavailable.", "Workers do not commit unfinished messages on SIGTERM.", "A rollout keeps at least one API replica ready."],
    explain: "Liveness tells Kubernetes when a restart may help. Readiness tells the Service when to stop sending traffic. During shutdown, a worker acknowledges a Kafka message only after its database result is safe.",
    commit: "day 26: make probes and shutdown truthful",
  },
  {
    id: "day-27",
    day: 27,
    week: 4,
    title: "Turn failure claims into recorded evidence",
    navTitle: "Failure demonstrations",
    time: "2.5–3 hours",
    tools: ["Failure injection", "Runbooks", "Kubernetes events"],
    outcome: "By the end of today, `docs/failure-tests.md` will contain five repeatable experiments showing what happens when important parts stop or repeat work.",
    whyNow: "You have built retries, duplicate protection, health checks, and replacement Pods. Today you stop trusting the diagram alone: you deliberately trigger failures and check whether PostgreSQL data and final results remain correct.",
    prerequisites: ["Structured logs, metrics, probes, and duplicate protection work."],
    deliverables: ["Five completed experiment records", "Screenshots/log excerpts", "Unexpected findings fixed or documented"],
    diagram: { type: "flow", title: "The failure-learning loop", description: "Predict first. A mismatch between prediction and observation is useful evidence, not embarrassment.", nodes: [
      { label: "Predict", detail: "write expected invariant" },
      { label: "Inject", detail: "one bounded failure", kind: "accent" },
      { label: "Observe", detail: "logs + DB + metrics" },
      { label: "Explain", detail: "why it happened" },
      { label: "Improve", detail: "smallest fix", kind: "data" },
    ] },
    concepts: [
      { term: "Invariant", meaning: "A rule that must remain true even when something fails.", inProject: "For example: stopping Redis must never remove a run or report stored in PostgreSQL." },
      { term: "Failure domain", meaning: "The part of the system directly affected by one failure.", inProject: "Deleting one API Pod should affect that replaceable copy, not the database or research workers." },
      { term: "Runbook evidence", meaning: "A reproducible record of the command, prediction, observation, recovery, and result.", inProject: "`failure-tests.md` proves what you actually observed instead of saying only that the design is resilient." },
    ],
    steps: [
      { id: "day-27-step-01", title: "Write the experiment record before breaking anything", explanation: "Create one copy of this template for each failure. Fill in the invariant and prediction before running the command; afterward, add only the log lines and database facts needed to prove the result. Never paste secrets or entire raw logs.", code: [{ label: "docs/failure-tests.md", language: "markdown", code: String.raw`# Failure demonstrations

## Experiment: <name>
- Date and build/commit:
- Preconditions:
- Invariant:
- Prediction:
- Injection command:
- Observed logs/metrics:
- PostgreSQL state before/after:
- Recovery time and steps:
- Did the invariant hold?
- What changed afterward?
` }], expected: "The document has five named experiment sections, and every section has a prediction written before the failure is triggered." },
      { id: "day-27-step-02", title: "Delete one API Pod", explanation: "Send repeated requests through the API Service while deleting one API Pod. Record response continuity, the Pod event, and how long the Deployment takes to restore two ready copies.", code: [{ label: "Command", language: "shell", code: "kubectl delete pod <api-pod> -n evidencelab" }], expected: "The other ready API Pod keeps serving while Kubernetes creates a replacement." },
      { id: "day-27-step-03", title: "Stop a research worker during a task", explanation: "Choose an active research task, stop its worker before the result is committed, and follow the same event ID after Kafka redelivers it. Check the database, not only the logs.", expected: "Another worker receives the message and saves one evidence result; repeated delivery does not create a second business result." },
      { id: "day-27-step-04", title: "Deliver the same event twice", explanation: "Publish or replay one already processed event with the same event and operation identity. Search the logs for both delivery attempts, then count the matching database rows.", expected: "Two delivery attempts may appear in logs, but PostgreSQL contains only one effect." },
      { id: "day-27-step-05", title: "Stop Redis during a run", explanation: "Stop Redis, request progress, and complete or continue a run. Record which reads slow down or lose temporary detail, then verify the authoritative run and report rows in PostgreSQL.", expected: "Cache and live progress become slower or less detailed, but no accepted run, saved evidence, or report disappears." },
      { id: "day-27-step-06", title: "Return model output with the wrong shape", explanation: "Use the fake provider to return data that fails the Pydantic schema. Observe the limited retries and inspect the final run status and saved error.", expected: "Schema validation rejects the data, retries stop at the configured limit, and the run fails with an understandable terminal error." },
    ],
    failure: { title: "Keep one prediction that turns out to be wrong", steps: ["Do not rewrite the original prediction after seeing the result.", "Record what actually happened and which invariant, if any, was broken.", "Make the smallest relevant fix, then repeat the same experiment."], expected: "The record clearly shows the incorrect prediction, observed behavior, change, and second result.", lesson: "A truthful before-and-after record shows real engineering reasoning. A rewritten perfect story hides the most useful learning." },
    checks: ["All five experiments are reproducible.", "Every test checks PostgreSQL state, not only logs.", "Expected duplicate deliveries are distinguished from duplicate effects.", "No secret appears in evidence."],
    explain: "Before each safe failure, I wrote the rule that should remain true. I then checked logs and PostgreSQL state, recorded recovery, and fixed any broken rule. The runbook shows observed behavior, not just design claims.",
    commit: "day 27: document verified failure behavior",
  },
  {
    id: "day-28",
    day: 28,
    week: 4,
    title: "Evaluate research quality with 15 questions",
    navTitle: "Evaluation set",
    time: "3 hours",
    tools: ["Evaluation dataset", "Deterministic checks", "Manual rubric"],
    outcome: "By the end of today, 15 fixed questions will produce repeatable code-check results and human quality scores that future versions can be compared against.",
    whyNow: "Yesterday proved that the machinery survives failures. That does not prove its reports are well supported, balanced, or clear. Today you measure the product result before making portfolio claims about quality.",
    prerequisites: ["The full workflow is stable enough to run repeatedly."],
    deliverables: ["`evals/questions.jsonl`", "`evals/run_eval.py`", "Deterministic pass rates", "Manual rubric scores"],
    diagram: { type: "fanout", title: "Quality needs two kinds of judgment", description: "Code can prove shape and citation identity. People still judge whether sources truly support claims and whether the report is balanced.", start: { label: "15 reports", detail: "representative set" }, branches: [
      { label: "Code checks", detail: "schema · IDs · limits", kind: "accent" },
      { label: "Human rubric", detail: "correctness · balance · clarity", kind: "temporary" },
    ], end: { label: "Baseline", detail: "scores + failures", kind: "data" } },
    concepts: [
      { term: "Evaluation set", meaning: "A fixed collection of examples chosen to represent important normal and difficult cases.", inProject: "The 15 questions include current facts, comparisons, policy, false premises, conflicting evidence, and questions with too little evidence." },
      { term: "Deterministic check", meaning: "A rule that code can answer the same way every time.", inProject: "Code can prove that every citation ID exists and that source and task limits were followed." },
      { term: "Rubric", meaning: "A written scoring guide for qualities that still need human judgment.", inProject: "A reviewer scores citation support, completeness, source quality, balance, and clarity from 1 to 5." },
    ],
    steps: [
      { id: "day-28-step-01", title: "Write 15 questions that exercise different weaknesses", explanation: "Create exactly 3 current-fact questions, 3 technical or scientific comparisons, 3 market or policy questions, 2 false assumptions, 2 conflicts, and 2 questions with insufficient evidence. Give each example an expected behavior, not one expected paragraph.", code: [{ label: "evals/questions.jsonl shape", language: "json", code: String.raw`{"id":"false-premise-01","category":"false_premise","question":"What evidence shows that all countries have adopted a four-day work week?","expectation":"Reject or correct the premise."}
{"id":"conflict-01","category":"conflicting_evidence","question":"Does remote work improve productivity?","expectation":"Represent credible disagreement and scope limits."}
{"id":"insufficient-01","category":"insufficient_evidence","question":"Will a specific pre-revenue technology lead its market in 2040?","expectation":"Express material uncertainty."}` }], expected: "The JSONL file contains exactly 15 valid records in the planned category counts, each with a unique ID and expected behavior." },
      { id: "day-28-step-02", title: "Let code check the rules with exact answers", explanation: "Load each stored report and return a list of specific failure names. Do not reduce everything to one score: `unknown_source_id` tells you what to fix, while a number alone does not.", code: [{ label: "Core deterministic checker", language: "python", code: String.raw`def check_report(run: dict) -> list[str]:
    failures: list[str] = []
    report = StructuredReport.model_validate(run["structured_report"])
    valid_ids = {source["source_id"] for source in run["sources"]}
    claims = [claim for section in report.sections for claim in section.claims]

    if any(not claim.source_ids for claim in claims):
        failures.append("claim_without_citation")
    if any(set(claim.source_ids) - valid_ids for claim in claims):
        failures.append("unknown_source_id")
    if not report.uncertainties:
        failures.append("missing_uncertainties")
    if len(run["sources"]) > run["maximum_sources"]:
        failures.append("source_budget_exceeded")
    if any("http" in claim.text for claim in claims):
        failures.append("url_inside_model_claim")
    return failures` }], expected: "Each report returns an empty list or specific named failures; an intentionally unknown source ID produces `unknown_source_id`." },
      { id: "day-28-step-03", title: "Use a scoring guide for human judgment", explanation: "First open each cited source and compare it with the claim. Then read the report as a whole for missing angles and balance. Save a short reason beside every score so another review can understand it.", code: [{ label: "Manual rubric", language: "markdown", code: String.raw`| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| Citation correctness | Mostly unsupported | Mixed support | Claims directly supported |
| Completeness | Major angles absent | Core angles present | Strong coverage within scope |
| Source quality | Weak/opaque | Mixed | Primary/authoritative where practical |
| Balance | One-sided | Mentions counterevidence | Fairly weighs credible conflict |
| Clarity | Hard to follow | Understandable | Precise, concise, well structured |` }], expected: "Every report has five scores plus short comments that cite the claim or section that influenced each score." },
      { id: "day-28-step-04", title: "Save results that reveal where quality is weak", explanation: "Report each code-check pass rate, human-score distribution by question category, token and cost totals, and the three most common failure patterns. A single overall average could hide a category that fails badly.", expected: "A later prompt or model can run the same 15 questions and be compared by rule and category." },
    ],
    failure: { title: "See whether the app challenges a false assumption", steps: ["Run both false-premise questions.", "Check whether the plan or final report quietly accepts the assumption as fact.", "Record the quality failure even when every citation ID and link is structurally valid."], expected: "Human review catches a reasoning failure that the citation-ID checker cannot detect.", lesson: "Citation validation prevents made-up links. It cannot prove that the reasoning is sound or that the app corrected a misleading question." },
    checks: ["The dataset has exactly 15 varied questions.", "Every deterministic failure names a specific invariant.", "Manual reviewers inspect actual source support.", "Baseline artifacts include version/model/prompt identity."],
    explain: "Code checks exact rules such as known citation IDs and limits. A human rubric checks whether sources really support claims and whether the report is complete, balanced, and clear. Reusing the same questions makes changes comparable.",
    commit: "day 28: add research quality evaluation baseline",
  },
  {
    id: "day-29",
    day: 29,
    week: 4,
    title: "Write the portfolio story around decisions",
    navTitle: "Portfolio documentation",
    time: "2.5–3 hours",
    tools: ["README", "Architecture decision", "Mermaid", "Demo evidence"],
    outcome: "By the end of today, a new reader can understand the product, start it, follow one run, inspect your evidence, and discuss the main design decisions without reading the source first.",
    whyNow: "The system, failure records, and quality baseline now exist. Today you turn that private build history into a clear public explanation that another engineer can reproduce and evaluate.",
    prerequisites: ["Failure records and evaluation baseline exist."],
    deliverables: ["`README.md`", "Architecture and event-flow docs", "Example report", "Curated screenshots/log excerpts"],
    diagram: { type: "flow", title: "A strong README follows the evaluator's questions", description: "Lead with the useful behavior, then explain the architecture, evidence, tradeoffs, and how to reproduce it.", nodes: [
      { label: "Problem", detail: "why it matters" },
      { label: "Demo", detail: "what works", kind: "accent" },
      { label: "Architecture", detail: "how it works" },
      { label: "Evidence", detail: "tests + failures + evals", kind: "data" },
      { label: "Tradeoffs", detail: "what you cut" },
    ] },
    concepts: [
      { term: "Architecture decision", meaning: "An explanation of the problem, options considered, choice made, and consequence of that choice.", inProject: "Explain why PostgreSQL owns permanent state and Redis is disposable—not merely that both technologies exist." },
      { term: "Reproducibility", meaning: "Another person can follow written inputs and steps and reach the same working result.", inProject: "The clean-start path includes configuration, build, migrations, startup, request submission, and report retrieval." },
      { term: "Evidence artifact", meaning: "A concrete file or output that supports something you claim.", inProject: "Tests, failure records, an example cited report, and evaluation results support the portfolio story." },
    ],
    steps: [
      { id: "day-29-step-01", title: "Answer the reader's questions in a useful order", explanation: "Begin with what EvidenceLab does and a short demo path. Put the copyable setup before deep implementation detail, and move long event-flow or decision records into linked documents.", code: [{ label: "README.md outline", language: "markdown", code: String.raw`# EvidenceLab

One sentence: what useful outcome the system produces.

## Demo in 3 minutes
## Problem and scope
## How a run moves through the system
## Architecture
## Citation-safety invariant
## Local setup with Docker Compose
## API examples
## Tests and evaluation results
## Verified failure behavior
## Important decisions and tradeoffs
## What I would build next
` }], expected: "A reader sees what EvidenceLab does, how to try it, and where to find proof before reaching deep implementation details." },
      { id: "day-29-step-02", title: "Draw one diagram that follows a real run", explanation: "Show the path from the user to PostgreSQL, Kafka, workers, and the final report. Draw Redis as a side cache rather than permanent storage, and avoid adding arrows you cannot explain.", code: [{ label: "Mermaid source", language: "mermaid", code: String.raw`flowchart LR
  C[Swagger / CLI] --> A[FastAPI]
  A -->|run + outbox, one tx| P[(PostgreSQL)]
  P --> O[Outbox relay]
  O --> K{{Kafka}}
  K --> PL[Planner]
  K --> RW[Research workers]
  K --> SY[Synthesis]
  PL --> P
  RW --> P
  SY --> P
  RW -. cache / progress .-> R[(Redis)]
  D[Django Admin] -->|prompt versions| P` }], expected: "The rendered diagram follows one run clearly and visually distinguishes PostgreSQL's permanent role from Redis's temporary role." },
      { id: "day-29-step-03", title: "Explain six choices as problem and consequence", explanation: "For each decision, write: the situation, the choice, what became easier or harder, and the main alternative you did not choose. Use your own words instead of copying a definition.", actions: ["Why PostgreSQL is the official permanent record.", "Why Redis data is safe to lose.", "Why Kafka replaces in-process background work.", "How duplicate Kafka delivery becomes harmless.", "How application-owned IDs prevent fabricated citation URLs.", "Why Django is only the internal settings screen and Kubernetes scales workers separately."], expected: "Each choice says which project problem it solves and names at least one cost or limitation." },
      { id: "day-29-step-04", title: "Choose a small amount of proof and remove sensitive data", explanation: "Include one example report, Swagger request, worker distribution log, Admin prompt history, Pod list, and failed-then-retried operation. Redact keys, personal data, and irrelevant log noise.", expected: "Every screenshot has a caption naming the property it demonstrates, and no secret or personal data is visible." },
      { id: "day-29-step-05", title: "Test the README as if you were a stranger", explanation: "Use a fresh folder or ask another person to follow the instructions literally. When a step depends on something unwritten, improve the README rather than explaining it verbally.", expected: "Clone → configure → build → migrate → run → submit → retrieve report works without private knowledge." },
    ],
    failure: { title: "Remove everything your own computer was quietly providing", steps: ["Follow setup from a fresh clone or copied folder.", "Do not reuse running containers, databases, installed shell variables, or remembered commands.", "Write down every missing prerequisite or ordering assumption, then fix the README."], expected: "The corrected README contains all required configuration and ordering without exposing a secret.", lesson: "Setup documentation is an interface. If a careful reader cannot use it, the project is not yet reproducible." },
    checks: ["The first screen says what the project does.", "One diagram explains the complete flow.", "Setup works from clean state.", "Decisions explain tradeoffs, not just technology names.", "Claims link to actual tests, failures, or evaluation artifacts."],
    explain: "My documentation starts with the useful result, follows one run, and supports claims with tests, failure records, and evaluations. Technology names are included only to explain a decision or tradeoff.",
    commit: "day 29: publish portfolio-grade documentation",
  },
  {
    id: "day-30",
    day: 30,
    week: 4,
    title: "Rehearse the demo and freeze scope",
    navTitle: "Final demo + buffer",
    time: "2–4 hours",
    tools: ["Release checklist", "Secret scan", "Demo script"],
    outcome: "By the end of today, the exact tagged v1 build passes its checks and supports a calm 8–10 minute demonstration of the product, one failure, and your quality evidence.",
    whyNow: "The product is complete enough to evaluate. Adding another feature now could break the tested path, so the final day is for removing surprises, stating limits honestly, and practicing how you will explain the work.",
    prerequisites: ["README works from clean state.", "No critical Week 1–3 invariant is known broken."],
    deliverables: ["Tagged v1 release", "Demo script", "Final secret scan", "Known-limitations list"],
    diagram: { type: "flow", title: "The ten-minute evidence story", description: "Show one connected narrative. Every screen should support a claim you can explain.", nodes: [
      { label: "Submit", detail: "202 + run ID" },
      { label: "Observe", detail: "workers + progress", kind: "accent" },
      { label: "Inspect", detail: "cited report", kind: "data" },
      { label: "Break", detail: "one safe failure" },
      { label: "Prove", detail: "tests + eval baseline", kind: "accent" },
    ] },
    concepts: [
      { term: "Scope freeze", meaning: "Stop adding capabilities and change only something that blocks correctness, safety, setup, or the demonstration.", inProject: "Do not add document retrieval, authentication, dashboards, tracing, another model host, or a new UI today." },
      { term: "Demo path", meaning: "A practiced sequence that connects visible product behavior to evidence about how it was engineered.", inProject: "Follow question → queued run → workers → citation check → report → one failure and recovery." },
      { term: "Known limitation", meaning: "A boundary you state clearly, including its effect and a sensible next step.", inProject: "One local Kafka node is appropriate for learning and development, but it does not provide production broker redundancy." },
    ],
    steps: [
      { id: "day-30-step-01", title: "Run every release check on one exact build", explanation: "Run tests, rebuild without cached layers, start the stack, apply migrations, inspect service health, and scan tracked files for likely secrets. Fix only a failure that harms setup, correctness, safety, or the demonstration.", code: [{ label: "Checklist commands", language: "powershell", code: String.raw`python -m pytest -q
docker compose build --no-cache
docker compose up -d
docker compose run --rm api alembic upgrade head
docker compose ps
git status --short
git grep -n -I -E "sk-[A-Za-z0-9_-]{10,}|OPENAI_API_KEY=.+" -- . ":(exclude).env.example"` }], expected: "Tests pass, services are healthy, migrations succeed, the intended files are committed, and the secret scan prints no real credential." },
      { id: "day-30-step-02", title: "Practice one connected story with a timer", explanation: "Run the live happy path first and use saved screenshots only as backup. At every stop, say which claim that screen supports; cut detail when the rehearsal exceeds ten minutes.", code: [{ label: "Eight-to-ten minute outline", language: "markdown", code: String.raw`0:00 — The research problem and one-sentence solution
0:45 — Submit a broad question; explain 202 Accepted
1:30 — Show research tasks divided among workers
3:00 — Inspect stored source IDs and one evidence item
4:30 — Open the final report and explain citation validation
6:00 — Trigger or show one recorded failure and recovery
7:30 — Show deterministic tests and the 15-question evaluation baseline
9:00 — State tradeoffs, limits, and the next production step` }], expected: "The rehearsal finishes within ten minutes and every screen directly supports something you say." },
      { id: "day-30-step-03", title: "Write the limitations before someone has to discover them", explanation: "List development-only Kafka, externally managed stateful services, the small evaluation set, missing authentication, and the need for human source-quality review. For each item, describe its effect and the smallest credible next step.", actions: ["State impact, not apology.", "Name the smallest credible next step.", "Separate intentional scope cuts from unresolved bugs.", "Do not claim production readiness."], expected: "A reader can tell what v1 does not guarantee and which limitations were intentional." },
      { id: "day-30-step-04", title: "Tag only the commit you actually tested", explanation: "After every release check passes, confirm that `.env` was never tracked, commit the final files, and place the v1 tag on that exact commit. Do not change code after testing and still call the tag verified.", code: [{ label: "Git", language: "shell", code: String.raw`git add .
git commit -m "release: EvidenceLab v1"
git tag -a v1.0.0 -m "Portfolio-ready EvidenceLab v1"
git status --short` }], expected: "The working tree is clean and the tag points at the tested commit." },
    ],
    failure: { title: "Practice recovering from a question during the demo", steps: ["Ask someone to interrupt at the architecture diagram with: 'Why did you use Kafka?'", "Answer with the project problem, choice, benefit, and cost in under 45 seconds.", "Resume at the next demo checkpoint without starting again."], expected: "You answer the tradeoff clearly and continue without losing the run ID or the narrative.", lesson: "Understanding becomes visible when you can leave the memorized script, explain a decision, and return calmly." },
    checks: ["Clean setup and tests pass on the tagged commit.", "No real secret is tracked or visible in demo materials.", "The live demo completes inside ten minutes.", "One failure and one evaluation artifact support resilience and quality claims.", "Known limitations are honest and specific."],
    explain: "EvidenceLab saves accepted research work in PostgreSQL, divides slow stages among safe-to-repeat workers, treats Redis as optional temporary speed, and lets reports cite only source IDs created by the application. Tests, failure records, and a fixed evaluation set support those claims.",
    commit: "release: EvidenceLab v1",
  },
];
