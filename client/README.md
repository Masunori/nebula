# NebulaX Railway Database Studio (Client Frontend)

An interactive, high-performance web studio built with **Next.js 16 (App Router), React 19, and Tailwind CSS v4** to manage railway infrastructure, capacity constraints, spatial safety buffer envelopes, and maintenance workloads.

---

## 1. Quickstart: Running the Frontend

### Option A: Local Development Server (Recommended)
From the root directory or inside `client/`:

```bash
cd client
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:3000`** (automatically redirects to `http://localhost:3000/database`)

---

### Option B: Production Build & Start
To test the optimized production build:

```bash
cd client
npm run build
npm start
```

---

## 2. Testing Frontend & Database Interactions

We provide an automated integration test suite that tests all API routes, database operations, filtering, DAG cycle audits, staged transactional commits, and HTML rendering:

```bash
cd client
npm run test:api
```

*(Note: Run this while `npm start` or `npm run dev` is running on port 3000).*

### What the Test Suite Verifies:
1. `GET /api/database/overview`: Validates line counts (2), stations (20), activities (54), and clean acyclic DAG status.
2. `GET /api/database/topology`: Validates sectors (18) and static location supply capacities (76 records).
3. `GET /api/database/activities`: Tests faceted querying and filtering by `line=ALP` and `priority=1`.
4. `GET /api/database/dag`: Verifies Tarjan / DFS cycle detection and absence of circular loops in the baseline dataset.
5. `GET /api/database/parameters`: Tests safety buffer policies (`Live` = 2 sectors with opposite bound isolation) and calendar horizon parameters.
6. `POST /api/database/commit`: Tests staged modifications (e.g. updating work volume for `A001`) and verifies changes persist.
7. `POST /api/database/flush`: Tests database truncation and confirms activity counts reset to 0.
8. `GET /database`: Verifies full server-side and client-side HTML rendering.

---

## 3. Database Connection Architecture

The client features a **dual-mode database interaction adapter** in [`client/lib/db.ts`](./lib/db.ts):
- **Live PostgreSQL Mode**: If PostgreSQL is running on port 5432 (or via `DATABASE_URL`), the client connects directly to PostgreSQL using `pg`.
- **Zero-Friction Offline/Memory Mode**: If PostgreSQL or Docker is offline, the client seamlessly falls back to memory-mapped CSV parsing from `database/init_data/`, allowing 100% of the UI, API, and validation checks to operate immediately without external dependencies.

---

## 4. Key Interactive UI Features

1. **Topology & Static Supply Schematic**:
   - Interactive multi-line track map (`ALP`, `BET`) showing station platforms and tunnel sectors with physical capacity badges (`Cap: 1`, `Cap: 4`).
   - Interchange hubs (`H01`, `H02`) highlighted with distinctive multi-line convergence badges.
   - Click any sector to filter workloads in the table.
2. **1D Linear Spatial Footprint Inspector**:
   - Discrete coordinate track bar ($1 \dots 19$) highlighting active working spans (`[====]`), upstream/downstream safety envelopes (`<~~~~>`), and opposite-bound live exclusion zones.
3. **Contracts & Workloads Data Grid**:
   - Instant search across ID, Contract, Line, and Station bounds (`A004`, `C001`, `S04`).
   - Faceted filters: Line, Priority (`P1`, `P2`, `P3`), Nature (`Live`, `Non-live`), and Bound (`EB`, `WB`).
   - Inline cell editing for work volume (nights), priority, and predecessors.
4. **Predecessor DAG Dependency Graph**:
   - Visual graph of work dependencies ($FS+0$).
   - Built-in DFS cycle detection that immediately warns with red alert banners if circular loops exist.
5. **Entry Creation Drawer**:
   - Slide-over wizard for maintainers to insert urgent maintenance jobs with `Priority 1`, auto-populating valid stations and calculating safety margins in real-time.
6. **Staged Changes Bottom Dock**:
   - Edits accumulate in an uncommitted working copy:
     `✏️ X uncommitted change(s) staged | [Review Diff] [Discard] [Commit & Trigger Solver 🚀]`
   - Committing writes changes via `POST /api/database/commit` and triggers the downstream optimization solver.
