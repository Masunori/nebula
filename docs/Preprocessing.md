# CSV preprocessing

`server/app/services/csv_preprocessor.py` prepares the eight CSV files for a future
CP-SAT model. It uses Pydantic v2 for typed output models. It does not create solver
variables, solve schedules, expose an endpoint, or write browser storage.

From the repository root:

```sh
python -m server.app.services.csv_preprocessor --output /tmp/nebula-preprocessed.json
python -m server.app.services.csv_preprocessor --data-dir server/data --output /tmp/nebula-preprocessed.json
python -m unittest discover -s server/tests -v
```

From Python (use `app.services...` when running with `server` as the import root):

```python
from server.app.services.csv_preprocessor import preprocess_directory, preprocess_csv_files

problem = preprocess_directory()  # defaults to server/data, independent of cwd
activity = problem.activities['A001']
route = activity.R
local_nights = problem.groups[activity.group_id].local_nights
# A future upload handler can pass {filename: decoded_csv_text}:
# problem = preprocess_csv_files(files)
```

Both functions return a `PreparedProblem` Pydantic model from
`server/app/models/preprocessed_data.py`. Records support attribute access,
while lookup tables remain dictionaries keyed by ID. Use
`problem.model_dump(mode='json')` for the former dictionary representation or
`problem.model_dump_json(indent=2)` for JSON text. The CLI's JSON schema is unchanged.
Models validate types strictly; the existing CSV and cross-table checks still run.
Internal preprocessing helpers use dictionaries while constructing the result,
then validate the completed model once at the public boundary. Invalid inputs raise
`DatasetValidationError`; no partial result is returned. CSVs require the documented
headers (order may vary), integral workloads, ISO dates and valid identifiers.
UTF-8 BOMs and surrounding value whitespace are accepted. All network locations
must have a supply row. Multiple project rows per contract are supported when their
activity types differ and their contract-level metadata agree. Cross-contract
predecessors are allowed; cycles are rejected.

## Output

- `source_tables`: all eight parsed tables, retaining original fields and converting
  numeric columns to integers. Dates remain ISO strings.
- `lines`, `locations`, `contracts`, `groups`, `activities`: keyed records. Group
  IDs are local identifiers for `(contract_number, activity_type)` pairs; group
  records contain those fields, limits and member activities.
- `stations_by_line`, `sectors_by_line`, `ordered_locations`, `opposite_locations`:
  network topology. Station IDs are scoped by line. Sector sequence values need
  not start at one per line.
- Each activity includes `R`, `B`, `MIR`, `INT`, `X`, `C` as defined in
  `ConstraintModelling.md`, plus release/deadline weeks, eligible weeks, affected
  lines, doubled workload and integer delay weight.
- `activities_by_contract`, `activities_by_location`,
  `activities_by_affected_location`, `activities_by_line`, `successors` and
  `topological_order`: reverse indexes and dependency order. Affected-line indexing
  includes closures and supports the future ECLO window constraints.
- `conflicts` and `conflicts_by_activity`: independent-possession conflicts under
  the documented relation. Each pair includes conflict locations and common working
  locations. These are **not unconditional bans**: a future solver must apply the
  co-sharing exception and legal possession mixes.
- `location_capacity` is nominal supply. `possession_group_domains` uses one
  candidate group per activity working at a location, a safe upper bound even for
  scenario B. Unused locations have empty domains. Actual usage is a solver decision.
- `weeks`, `week_end_dates`, `parameters`, `scenarios`: calendar and scenario data.
- `warnings`: currently reports activity starts beyond the horizon; this does not
  replace solver feasibility checks.

## Spatial and calendar conventions

Based on the [problem statement](https://github.com/aochinwen/NebulaX-Hackathon-ProblemStatement/blob/main/PS1/PS1_README.md)
and local modelling document. The public repository does not include the referenced
`trackaccess` validator, so the following precise interpretations are explicit and
should be checked against it if it becomes available:

1. A route is the inclusive station interval covered by its endpoints. A tunnel
   endpoint includes both of its endpoint platforms. Platform-only and mixed
   platform/tunnel endpoints are supported. Reversed endpoints give the same
   footprint; endpoints on different lines/bounds are rejected.
2. Buffers extend the interval by the CSV's number of tunnel sectors on each side,
   clipped at termini, including platforms along those extensions. `B` excludes
   actual working locations.
3. When `opposite_bound_required=1`, the entire buffered interval is mirrored.
   For Live work, reaching either H01/H02 platform or the H01–H02 tunnel with that
   interval closes all three corresponding locations on **both bounds of the
   other line**, expanded by the configured buffer radius on that line, clipped
   at its termini. External-validator failures for A074/A075 showed that closing
   only the three interchange locations omitted adjacent closure zones. The
   expansion does not recursively cross back to the original line.
4. A planning week is seven days anchored at `horizon_start`. Release dates map
   to their containing week, consistent with the planned-start-week rule; dates
   before the horizon map to week one. Completion occurs on the last day of a week.
   The deadline week is the last week ending on/before the planned deadline,
   clipped to `0..horizon_weeks`. Zero means no on-time completion week exists.
5. Workload units use scale 2: normal access yields 2, ECLO adds 1. Objective values
   use scale 10: activity delay weights are 10 times their mathematical weights;
   excess-night and ECLO coefficients are 70 and 50. Divide the full resulting
   objective by 10 for reporting, not individual terms before solving.

No feasibility is inferred from successful parsing. The future solver still needs
all scheduling variables, workload, precedence, safety/co-sharing, capacity,
workfront and scenario constraints, and completion/overrun calculations.

## Hard-constraint model

`SatSolverService(scenario="A")` consumes the prepared data and builds the
common hard constraints plus the selected scenario's rules. Pass `"B"` or
`"C"` explicitly for those policies; other values raise `ValueError`.

- A: nominal location supply is a hard cap; ECLO is forbidden.
- B: every activity must finish by its planned deadline; there is no hard
  location supply cap or ECLO window.
- C: at most one extra possession per location/week; ECLO affecting each
  line must fit inside its own two-calendar-week window. Cross-line work
  must fit both windows. Window variables are in `service.eclo_window_starts`.

Weekly group-night allocation and per-night workfront limits apply in all
scenarios. The existing linking constraints enforce ECLO only with an access,
with doubled workload units accounting for its yield. Mathematical mapping
comments accompany each constraint in the service.

No minimization objective is installed yet: `solve()` checks feasibility under
the implemented interpretation. In particular, the rule-6 exemption remains
pairwise: co-sharing at any common working location waives the pair's mutual
closure conflict, as documented in the closure constraint function.
