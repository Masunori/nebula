# NebulaX: Railway Track Access Optimisation & Infrastructure Platform

An enterprise railway possession planning, capacity management, and optimization platform built for the **NebulaX Railway Track Access Optimisation Challenge**.

NebulaX coordinates maintenance workloads and commercial capital renewal contracts across a dense, multi-line electrified railway network (incorporating double-track corridors, shared single-track bottleneck links, and high-density interchange junctions). The system couples a relational PostgreSQL spatial infrastructure core with an interactive Next.js 16 dispatch studio and a constraint programming optimization engine (Google OR-Tools CP-SAT).

---

## 1. System Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Client Frontend (Next.js 16 + React 19)"]
        UI["Database Management Studio\n(http://localhost:3000)"]
        Top["Interactive Track Topology\n(Cap: 1, 2, 4)"]
        Foot["1D Linear Spatial Footprint\n(Active Work & Safety Buffers)"]
        DAG["Predecessor DAG Graph\n(DFS Cycle Detection)"]
        Dock["Staged Draft Dock\n[Review Diff] [Commit 🚀]"]
        NextAPI["Next.js Route Handlers\n(/api/database/*)"]
    end

    subgraph Fallback ["Offline / Zero-Friction Engine"]
        MemDB["Memory-Mapped Database Adapter\n(client/lib/db.ts + initial-data.ts)"]
    end

    subgraph Database ["PostgreSQL 16 Database Core (Port 5432)"]
        PG["PostgreSQL Relational Storage"]
        Init["01_schema.sql (8 Tables + FKs)\n02_spatial.sql (1D Coords + Buffers)\n03_seed_init.sql (Init CSVs)\n04_views.sql (Capacity Heatmaps)\n05_seed_output.sql (Solver Benchmarks)"]
        TUI["Interactive Rich TUI\n(database/scripts/nebula_tui.py)"]
    end

    subgraph Server ["Server & Solver Engine (FastAPI + OR-Tools)"]
        API["FastAPI Orchestrator (Port 8000)\n(/health, /api/...)"]
        Engine["CP-SAT Optimization Engine\n(Google OR-Tools CP-SAT)"]
        ValScore["Validator & Scorer Pipeline\n(Constraint Check & Penalty Scoring)"]
    end

    UI --> NextAPI
    NextAPI -->|Port 5432 Active| PG
    NextAPI -->|Port 5432 Offline| MemDB
    Dock -->|Commit & Trigger| API
    API --> PG
    API --> Engine
    Engine --> ValScore
    ValScore -->|Schedule Results| PG
    PG --> TUI
```

---

## 2. Where the Data Comes From

A common question when running the frontend without Docker is:
> *"The database container is not running, where is all this data the frontend is getting from?"*

The platform is designed with a **zero-friction dual-mode database adapter** ([`client/lib/db.ts`](client/lib/db.ts)):

1. **When PostgreSQL is Running (Docker / Local Port 5432)**:
   - Next.js API route handlers connect directly to PostgreSQL via connection pool (`pgPool`).
   - All queries, filters, updates, and transactions operate on the live PostgreSQL tables.
2. **When PostgreSQL is Offline (No Docker Started)**:
   - The frontend automatically activates an **in-memory database engine** seeded directly from the official competition files in [`database/init_data/`](database/init_data/) via [`client/lib/initial-data.ts`](client/lib/initial-data.ts):
     - `01_LINES.csv`: 2 lines (`ALP`, `BET`)
     - `02_STATIONS.csv`: 20 station platforms
     - `03_SECTORS.csv`: 18 tunnel track segments
     - `04_LOCATION_SUPPLY.csv`: 76 sector/platform physical capacities
     - `05_BUFFER_LOCATION.csv`: Safety buffer rules (`Live` = 2 sectors + opposite bound isolation; `Non-live` = 1/0)
     - `06_PARAMETERS.csv`: 30-week planning horizon starting `2027-01-04`
     - `07_PROJECT_DETAILS.csv`: 14 commercial contracts
     - `08_ACTIVITY_DETAILS.csv`: 54 track maintenance and renewal activities
   - **Why this is powerful**: You can test, browse, edit, filter, inspect safety buffers, and verify DAG cycle audits **instantly** without waiting for Docker containers or database seeding.

---

## 3. End-to-End Workflow: What Is Happening & What Is Expected

```
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│  1. Database Studio       │      │  2. Solver Engine         │      │  3. Timetable & Schedule  │
│  - Inspect Track Topology │      │  - Read Problem Model     │      │  - 30-Week Gantt Chart    │
│  - Maintainer P1 Jobs     │ ───> │  - OR-Tools CP-SAT Solver │ ───> │  - Capacity Heatmap View  │
│  - Live Safety Buffers    │      │  - Constraint Checking    │      │  - Delay Penalty Score    │
│  - Stage & Review Diffs   │      │  - Objective Optimization │      │  - Export Final Schedule  │
└───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
```

### Phase 1: Database Operations & Infrastructure Setup (Current Scope)
- **Maintainer Priority 1 Workloads**: Maintainers whose track geometry/fault repairs take priority over commercial renewal contracts can insert `Priority 1` activities.
- **Safety Envelope Enforcement**: `"Live"` track activities automatically require a **2-sector exclusion buffer** and block the **opposing track bound** (`WB` when on `EB`).
- **DAG Acyclicity Audit**: Built-in DFS / Tarjan cycle detection audits all activities. If a circular predecessor loop is introduced (e.g., $A_{004} \leftrightarrow A_{003}$), a red alert banner blocks submission before the solver is invoked.
- **Transactional Staging**: Edits (inline table tweaks, parameter changes, additions) accumulate in an uncommitted **Draft State**. Planners click **[Review Diff]** to inspect before committing.

### Phase 2: Solver Engine Execution (Expected Next Step)
- On clicking **[Commit & Trigger Solver 🚀]**, the client writes staged changes to PostgreSQL and notifies the FastAPI backend service (`http://server:8000`).
- The Python solver service uses **Google OR-Tools CP-SAT** to formulate the discrete optimization problem:
  - **Decision Variables**: $x_{a, w, d} \in \{0, 1\}$ (Activity $a$ scheduled on week $w$, night $d \in 1..7$).
  - **Hard Constraints**:
    - Physical sector supply limit: $\sum \text{occupancies} \le \text{Supply Capacity}$ per night.
    - Safety buffer non-overlap: No concurrent activities within safety buffer radius on same or opposing track.
    - Finish-to-Start precedence: Activity $B$ cannot begin until predecessor $A$ is fully completed ($FS+0$).
    - Contract workfront cap: At most 3 concurrent working fronts per contract per night.
  - **Objective Function**:
    - Maximize total completed activities.
    - Minimize delay penalties ($14 \times \text{delay weeks}$ for late contract completion).
    - Minimize work fragmentation (prefer continuous weekend shift blocks).
- **Validator & Scorer**: Inspects the solution against all 10 competition rules and outputs an official scorecard.

### Phase 3: Results Visualization (Timetable Page)
- Generates the final schedule output matching `09_SCHEDULE_OCCUPANCY.csv` and `10_SCHEDULE_CONTRACT.csv`.
- Renders the interactive 30-week capacity heatmap and contract milestone tracking dashboard.

---

## 4. Running & Deployment Guide

### Option A: Local Standalone Development (Fastest, No Docker Needed)

#### 1. Run the Client Web Studio
```powershell
cd client
npm run dev
```
Open **`http://localhost:3000`** in your browser.

#### 2. Run the Interactive Terminal UI (TUI)
```powershell
cd database
python scripts/nebula_tui.py
```
Provides an interactive curses/Rich terminal dashboard to inspect network topology, query activities, test benchmark tiers, and view capacity heatmaps.

#### 3. Run Automated Client & Database API Test Suite
```powershell
cd client
npm run test:api
```
Tests all 9 integration suites (Overview, Topology, Filtered Activities, Predecessor DAG, Buffer Policies, Transactional Commit, Flush, and HTML SSR).

---

### Option B: Local Docker Stack (`compose.local.yaml`)

Runs the full 3-tier architecture with hot-reloading:
- **`database`**: PostgreSQL 16 Alpine on port `5432` with pre-loaded schema, spatial functions, and seed data.
- **`server`**: FastAPI backend on port `8000` with OR-Tools and volume-mounted code.
- **`client`**: Next.js 16 development server on port `3000` with volume mounts.

```powershell
# Start all services with live reload
docker compose -f compose.local.yaml up --build

# Stop all services and retain database volume
docker compose -f compose.local.yaml down
```

**Service Endpoints**:
- Client Web Application: `http://localhost:3000`
- FastAPI Documentation (Swagger): `http://localhost:8000/docs`
- Backend Health Check: `http://localhost:8000/health`
- PostgreSQL Database: `localhost:5432` (User: `nebula_user`, Database: `nebula`)

---

### Option C: Production Docker Stack (`compose.prod.yaml`)

Runs production-optimized containers:
- Next.js compiled as a **standalone Node.js server** (`output: standalone`) running as non-root user `node`.
- FastAPI served by high-performance **Uvicorn workers** without reload overhead.
- PostgreSQL with automated healthcheck retries and persistent volume mounts.

```powershell
# Build and run in detached production mode
docker compose -f compose.prod.yaml up --build -d --wait

# View live container logs
docker compose -f compose.prod.yaml logs -f

# Teardown production containers
docker compose -f compose.prod.yaml down
```

---

### Option D: Google Cloud Platform (GCP) Deployment

The entire 3-tier architecture (PostgreSQL database, FastAPI solver engine, and Next.js frontend) is deployed to a unified Google Cloud Compute Engine instance with Docker Compose and an Nginx reverse proxy.

#### 1. Architecture & Live Endpoints

- **Live Public URL**: **[http://136.107.86.146/](http://136.107.86.146/)**
- **Public Entrypoint**: Nginx (Port `80`) acts as a reverse proxy forwarding web traffic to Next.js on port `3000`.
- **Internal Networking**: Next.js communicates with FastAPI over the internal Docker bridge network at `http://server:8000`. FastAPI connects directly to PostgreSQL at `postgresql://nebula_user:nebula_password@database:5432/nebula`.
- **Firewall & Security**: Only Ports `80` (HTTP) and `3000` (Next.js) are exposed externally via GCP VPC firewall rules. PostgreSQL (`5432`) and FastAPI (`8000`) remain secured and accessible only within the internal Docker network.

| Component | GCP Resource / Service | Specification | Access Scope |
| :--- | :--- | :--- | :--- |
| **Compute VM** | Google Compute Engine | `e2-standard-4` (4 vCPUs, 16 GB RAM) in `us-east4-a` | External IP: `136.107.86.146` |
| **Web Server** | Nginx Reverse Proxy | Debian package `nginx` | Port `80` -> `127.0.0.1:3000` |
| **Client** | Next.js 16 Standalone Container | `client/Dockerfile.prod` | Port `3000` (Healthy) |
| **Server** | FastAPI Engine Container | `server/Dockerfile.prod` | Port `8000` (Healthy) |
| **Database** | PostgreSQL 16 Alpine Container | `database/Dockerfile` + volume `database_pgdata` | Port `5432` (Healthy) |

---

#### 2. Step-by-Step GCP Deployment Commands

##### Step A: Create VPC Firewall Rule
Allow incoming HTTP traffic on port 80 and web port 3000:
```powershell
gcloud compute firewall-rules create allow-nebula-web `
    --direction=INGRESS `
    --priority=1000 `
    --network=default `
    --action=ALLOW `
    --rules=tcp:80,tcp:3000 `
    --source-ranges=0.0.0.0/0 `
    --target-tags=nebula-web
```

##### Step B: Provision Compute Engine Instance
Provision an `e2-standard-4` instance with 4 vCPUs and 16 GB RAM to provide ample compute capacity for multi-threaded OR-Tools CP-SAT solving:
```powershell
gcloud compute instances create nebula-vm `
    --zone=us-east4-a `
    --machine-type=e2-standard-4 `
    --image-family=debian-12 `
    --image-project=debian-cloud `
    --boot-disk-size=50GB `
    --boot-disk-type=pd-balanced `
    --tags=nebula-web,http-server
```

##### Step C: Install System Packages & Docker Compose v2 on the VM
Connect via Google Cloud Identity-Aware Proxy (IAP) and install Docker, Docker Compose v2, and Nginx:
```powershell
gcloud compute ssh nebula-vm --zone=us-east4-a --tunnel-through-iap --command="
sudo apt-get update -y &&
sudo apt-get install -y docker.io git curl nginx &&
sudo systemctl enable --now docker &&
sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose &&
sudo chmod +x /usr/local/bin/docker-compose
"
```

##### Step D: Package & Upload Repository
Create a clean archive excluding local dependencies and transfer via IAP SCP:
```powershell
# Create compact tarball
tar -czf deploy.tar.gz --exclude="client/node_modules" --exclude="client/.next" --exclude="*.pyc" --exclude="__pycache__" --exclude=".git" client database server compose.prod.yaml compose.local.yaml scripts docs

# Upload to the VM
gcloud compute scp --zone=us-east4-a --tunnel-through-iap deploy.tar.gz nebula-vm:deploy.tar.gz --quiet

# Extract on the VM
gcloud compute ssh nebula-vm --zone=us-east4-a --tunnel-through-iap --command="mkdir -p ~/nebula && tar -xzf ~/deploy.tar.gz -C ~/nebula" --quiet
```

##### Step E: Configure Nginx Reverse Proxy
Route public port 80 traffic to Next.js on `127.0.0.1:3000`:
```powershell
# Upload nginx.conf to the VM and apply:
gcloud compute scp --zone=us-east4-a --tunnel-through-iap nginx.conf nebula-vm:nebula/nginx.conf --quiet
gcloud compute ssh nebula-vm --zone=us-east4-a --tunnel-through-iap --command="sudo cp ~/nebula/nginx.conf /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl restart nginx" --quiet
```

##### Step F: Build & Launch Docker Compose Stack
```powershell
gcloud compute ssh nebula-vm --zone=us-east4-a --tunnel-through-iap --command="cd ~/nebula && sudo docker-compose -f compose.prod.yaml up -d --build" --quiet
```

---

#### 3. Verification & Live Health Checks

Verify all 3 services are active and healthy:
```powershell
# 1. Check container health status
gcloud compute ssh nebula-vm --zone=us-east4-a --tunnel-through-iap --command="cd ~/nebula && sudo docker-compose -f compose.prod.yaml ps" --quiet

# Expected Output:
# nebula-prod-client-1     Up (healthy)   0.0.0.0:3000->3000/tcp
# nebula-prod-database-1   Up (healthy)   127.0.0.1:5432->5432/tcp
# nebula-prod-server-1     Up (healthy)   127.0.0.1:8000->8000/tcp

# 2. Check public HTTP web access
curl.exe -sI http://136.107.86.146/
# Output: HTTP/1.1 200 OK (Served by Next.js via Nginx)

# 3. Check database integration API
curl.exe -s http://136.107.86.146/api/database/overview
# Output: JSON payload confirming 2 lines, 20 stations, 18 sectors, 54 activities

# 4. Trigger production CP-SAT optimization solve
curl.exe -s -X POST http://136.107.86.146/api/solver/solve `
    -H "Content-Type: application/json" `
    -d '{"scenario":"A","max_time_seconds":30,"sync_db":true}'
# Output: {"scenario":"A","feasible":true,"detail":{"solver_status":"OPTIMAL","wall_time_seconds":8.47,...}}
```

---

#### 4. Operational Management & Logs

```powershell
# SSH into the VM (via Google Cloud IAP)
gcloud compute ssh nebula-vm --zone=us-east4-a --tunnel-through-iap

# Tail real-time solver logs
sudo docker-compose -f ~/nebula/compose.prod.yaml logs -f server

# Tail real-time web client logs
sudo docker-compose -f ~/nebula/compose.prod.yaml logs -f client

# Restart any individual service
sudo docker-compose -f ~/nebula/compose.prod.yaml restart server
```

---

## 5. Repository Directory Structure

```text
nebula/
├── compose.local.yaml               # Docker Compose for local development (hot-reload)
├── compose.prod.yaml                # Docker Compose for production deployment
├── .gitignore                       # Clean Git rules (ignores node_modules, .next, __pycache__, logs)
├── README.md                        # Master system architecture & deployment guide
│
├── client/                          # Next.js 16 + React 19 Frontend
│   ├── app/
│   │   ├── api/database/            # Next.js Route Handlers (/overview, /topology, /activities, /dag, /commit)
│   │   ├── database/                # Database Management Studio Page & Components
│   │   │   └── components/          # TopologyViewer, FootprintBar, DataGrid, DAGViewer, Drawer, Dock
│   │   ├── layout.tsx               # Dark railway theme layout
│   │   └── page.tsx                 # Redirects / -> /database
│   ├── lib/
│   │   ├── db.ts                    # Dual-mode database adapter (PostgreSQL + memory fallback)
│   │   ├── types.ts                 # Complete TypeScript schema interfaces
│   │   ├── initial-data.ts          # Baseline constants mapped from init_data CSVs
│   │   └── database-store.ts        # React state store with 1D spatial and Tarjan DAG logic
│   ├── test_api_interactions.mjs   # Automated integration test suite (9 test suites)
│   ├── Dockerfile.local             # Node 22 slim dev image
│   ├── Dockerfile.prod              # Node 22 multi-stage standalone runner image
│   └── package.json                 # Next 16, React 19, Tailwind v4, Lucide, pg
│
├── database/                        # PostgreSQL Relational Engine & TUI
│   ├── sql/
│   │   ├── 01_schema.sql            # 8 Tables with strict FKs, check constraints & audit triggers
│   │   ├── 02_spatial.sql           # 1D linear track coordinate mapping & buffer envelope functions
│   │   ├── 03_seed_init.sql         # Seed script ingesting all initial CSVs
│   │   ├── 04_views.sql             # SQL views for capacity heatmaps and DAG diagnostics
│   │   └── 05_seed_output.sql       # Baseline schedule occupancy views
│   ├── init_data/                   # Official CSV input datasets (01_LINES to 08_ACTIVITY_DETAILS)
│   ├── scripts/
│   │   ├── nebula_tui.py            # Interactive Rich/Curses terminal dashboard
│   │   └── test_all_tui_options.py  # Automated TUI regression test suite (100% pass)
│   ├── benchmarks/                  # Synthetic multi-line scalability benchmarks (Tiers 1, 2, 3)
│   ├── Dockerfile                   # PostgreSQL 16 Alpine container with auto-init SQL scripts
│   └── docker-compose.db.yaml       # Standalone database docker compose
│
└── server/                          # FastAPI Backend & OR-Tools Solver Engine
    ├── app/
    │   └── main.py                  # FastAPI service entrypoint
    ├── Dockerfile.local             # Python 3.12 dev image
    ├── Dockerfile.prod              # Python 3.12 production image
    └── requirements.txt             # fastapi, uvicorn, ortools>=9.6
```

---

## 6. Verification & Test Summary

| Test Suite | Location | Command | Status |
| :--- | :--- | :--- | :--- |
| **Next.js Production Build** | `client/` | `npm run build` | **PASS** (356ms, 0 errors) |
| **Client & Database API Suite** | `client/` | `npm run test:api` | **PASS** (9/9 suites pass) |
| **TUI Interactive Regression** | `database/` | `python scripts/test_all_tui_options.py` | **PASS** (10/10 options pass) |
| **Docker Compose Config** | Root | `docker compose -f compose.local.yaml config` | **VALID** |
| **Google Cloud Live Stack** | `nebula-vm` (`136.107.86.146`) | `docker-compose -f compose.prod.yaml ps` | **PASS** (3/3 services healthy, CP-SAT solve certified) |

## Stub solve endpoint

Start the API (or rebuild the local Docker stack), then run:

```sh
curl --max-time 180 'http://localhost:8000/stub_solve?scenario=A&max_time_seconds=60'
```

`scenario` accepts A, B, or C (default A). The search limit is 1–300 seconds
(exclusive of zero); preprocessing/model construction adds to total request time.
The response follows the problem-statement report structure: `scenario`,
`feasible`, `hard_violations`, `soft_scores`, and `detail`. Detail includes the
exact solver status and whether CSVs were written. Scores describe the found
schedule; the current solver has no minimization objective. Feasibility uses the
implemented pairwise co-sharing interpretation, not an external validator.

Successful requests replace `SCHEDULE_ACCESS.csv`, `SCHEDULE_OCCUPANCY.csv`, and
`RESULTS.csv` in `server/data/actual_output`, using the sample_output headers.
Each request exports one scenario; the latest successful request replaces the
previous scenario's files. Unknown/time-limited and infeasible solves leave the
previous export untouched and set `csv_written` to false. `UNKNOWN` is not proof
of infeasibility; consult `detail.solver_status` rather than `feasible` alone.
Concurrent solve requests receive HTTP 409. Invalid query parameters receive 422.
This GET endpoint writes files, so invoke it explicitly rather than prefetching it.

Local Docker Compose mounts `server/data`, making exports visible on the host.
Production images include the data; mount `/app/data/actual_output` with write
permissions for UID 10001 if exports must persist outside the container.
