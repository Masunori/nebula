# NebulaX Optimization Engine & Solver Service (Server Backend)

High-performance Python backend service orchestrating possession planning, constraint satisfaction, and discrete optimization for the **NebulaX Railway Track Access Optimisation Challenge**.

The server is built with **FastAPI** and **Google OR-Tools CP-SAT (Constraint Programming - Satisfiability)**. It models complex multi-line railway track access rules, safety buffer envelopes, shared bottleneck track segments, and commercial delivery milestones into a mathematical constraint optimization program.

---

## 1. Architectural Overview

```mermaid
flowchart TD
    subgraph ClientLayer ["Client / Dispatchers"]
        Client["Next.js Web Client\n(POST /api/solver/solve)"]
        Curl["Judge Evaluation Harness\n(GET /stub_solve?scenario=A)"]
    end

    subgraph FastAPILayer ["FastAPI Orchestrator (Port 8000)"]
        Router["app/main.py\n(Lifespan Cache Warmer, Routing, Async Dispatch)"]
        SyncService["db_preprocessor_sync.py\n(Spatial Footprint & Conflict Graph Generator)"]
    end

    subgraph DatabaseLayer ["PostgreSQL 16 Relational Engine"]
        PG["PostgreSQL Tables\n(preprocessed_activities, groups, conflicts)"]
    end

    subgraph SolverLayer ["Optimization & Validation Pipeline"]
        CP_SAT["sat_solver_service.py\n(Google OR-Tools CP-SAT Formulation)"]
        Validator["schedule_validator.py\n(10-Rule Independent Compliance Auditor)"]
        Exporter["solve_results.py\n(CSV Exporter: SCHEDULE_ACCESS, OCCUPANCY, RESULTS)"]
    end

    Client --> Router
    Curl --> Router
    Router --> SyncService
    SyncService <--> PG
    Router --> CP_SAT
    CP_SAT --> Validator
    Validator --> Exporter
    Exporter --> Router
```

---

## 2. Core Service Modules

### 1. Constraint Programming Solver Service (`app/services/sat_solver_service.py`)
Implements the exact mathematical formulation using Google OR-Tools CP-SAT:
- **Decision Variables**:
  - $x_{a, w, d} \in \{0, 1\}$: Binary variable indicating whether Activity $a$ is active on week $w \in \{1 \dots 30\}$, night $d \in \{1 \dots 7\}$.
  - $\text{start\_night}_a, \text{end\_night}_a \in [1, 210]$: Linearized calendar night bounds.
  - $\text{overrun\_days}_c \ge 0$: Lateness past planned deadline for Contract $c$.
- **Hard Constraints**:
  - **Work Volume Enforcement**: $\sum_{w, d} x_{a, w, d} = \text{total\_accesses}_a$.
  - **Predecessor Precedence ($FS+0$)**: $\text{end\_night}_{\text{predecessor}} \le \text{start\_night}_{\text{successor}}$.
  - **Workfront Limits**: At most $K$ concurrent workfronts per contract:type group per night.
  - **Maximum Weekly Access**: No activity may exceed its allowed weekly night budget.
  - **Spatial Non-Overlap / Co-Sharing Restrictions**: Strict spatial footprint exclusion preventing conflicting activities from occupying the same or buffer-adjacent tracks simultaneously.
  - **ECLO Night Restrictions**: Enforces electrical line possession outage windows.
  - **Single-Track Bottleneck Isolation**: Mutual exclusion across opposing bounds (`EB` / `WB`) on single-track shared corridor segments.
- **Objective Function**:
  - Minimizes weighted lateness: $\sum_{c} \text{PriorityWeight}_c \times \text{overrun\_days}_c$ ($100\times$ for Priority 1, $10\times$ for Priority 2, $1\times$ for Priority 3).
  - Minimizes contractual delay penalties.
  - Penalizes work fragmentation to prefer continuous shift blocks.

### 2. Preprocessor & Database Synchronizer (`app/services/db_preprocessor_sync.py`)
- Executes automatically during FastAPI application startup lifespan.
- Precomputes spatial footprints for every activity:
  - $R$: Requested working track span
  - $B$: Upstream and downstream safety buffer envelopes
  - $MIR$: Opposite-bound mirror track exclusion zones (for live-track activities)
  - $INT$: Interlocking protection zones
  - $X$: Crossing conflicts
  - $C$: Combined total possession exclusion boundary
- Builds pairwise conflict graphs across all 54 activities.
- Persists precomputed structures into PostgreSQL tables `preprocessed_activities`, `preprocessed_groups`, and `preprocessed_conflicts`, enabling sub-second solver warm starts without redundant disk I/O.

### 3. Independent Schedule Validator (`app/services/schedule_validator.py`)
- Independent verification engine verifying schedule output against all 10 competition rules.
- Checks capacity limits, co-sharing mix legality ($1\text{ PM}$, $1\text{ PC} + \le 3\text{ C}$, $\le 4\text{ C}$), workfront caps, and acyclicity.
- Issues a certified audit certificate (`independent_validator_certified: true`).

### 4. Output Results Exporter (`app/services/solve_results.py`)
- Generates official competition CSV outputs matching required submission schemas:
  - `SCHEDULE_ACCESS.csv`: Weekly night access assignments per activity.
  - `SCHEDULE_OCCUPANCY.csv`: Track sector and station platform physical footprints and co-share groups.
  - `RESULTS.csv`: Contractual milestone completions, earliness/lateness days, and penalty scorecards.

---

## 3. API Reference & Endpoints

### `GET /health`
System liveness and preprocessor readiness probe.
- **Response**:
  ```json
  {
    "status": "ok",
    "preprocessor_ready": true,
    "timestamp": "2026-09-19T07:08:01Z"
  }
  ```

### `POST /api/solver/solve`
Dispatches CP-SAT optimization for a given scenario.
- **Request Body**:
  ```json
  {
    "scenario": "A",
    "max_time_seconds": 30,
    "sync_db": true
  }
  ```
- **Response**:
  ```json
  {
    "scenario": "A",
    "feasible": true,
    "hard_violations": [],
    "soft_scores": {
      "scenario": "A",
      "overrun_days_total": 28,
      "contracts_overrunning": 3,
      "priority_weighted_score": 32.2,
      "objective_score": 32.2
    },
    "detail": {
      "solver_status": "OPTIMAL",
      "wall_time_seconds": 8.47,
      "independent_validator_certified": true,
      "nights_scheduled": 233,
      "csv_written": true
    }
  }
  ```

### `GET /stub_solve`
Direct evaluation endpoint accepting query parameters (`?scenario=A&max_time_seconds=60`). Returns standard competition JSON structure and updates `server/data/actual_output/` CSVs.

### `POST /api/solver/cancel`
Gracefully halts an ongoing CP-SAT optimization worker.

---

## 4. Local Development & Testing

### Prerequisites
- Python 3.12 or 3.13
- Virtual environment (`venv`)

### Installation & Run
```bash
cd server
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Start development server with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Visit the interactive OpenAPI documentation:
👉 **`http://localhost:8000/docs`**

---

## 5. Docker & Production Deployment

### Multi-Stage Production Dockerfile (`Dockerfile.prod`)
- Multi-stage build based on `python:3.13-slim-bookworm`.
- Compiles dependencies in builder stage, minimizing final runner image.
- Runs as an unprivileged non-root user (`app`, UID `10001`).
- Configured with an internal health check using Python standard library `urllib.request`.

```bash
# Build production server image
docker build -f Dockerfile.prod -t nebula-server:prod .

# Run standalone container connected to PostgreSQL
docker run -p 8000:8000 \
    -e DATABASE_URL="postgresql://nebula_user:nebula_password@localhost:5432/nebula" \
    nebula-server:prod
```

### Live Google Cloud Compute Engine Deployment
The solver engine is deployed live on Google Cloud Platform:
- **Host**: Google Compute Engine VM `nebula-vm` (`136.107.86.146`)
- **Machine Type**: `e2-standard-4` (4 vCPUs, 16 GB RAM) — sized to maximize parallel CP-SAT search threads and solve full 30-week schedules in under 10 seconds.
- **Network Isolation**: Accessible internally by the Next.js client via Docker network at `http://server:8000`.
