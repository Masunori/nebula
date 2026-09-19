# Validate and score output CSVs

Run from the repository root. Both commands read `RESULTS.csv`,
`SCHEDULE_ACCESS.csv`, and `SCHEDULE_OCCUPANCY.csv` from the supplied directory.
They do not run the solver or modify files.

```bash
python -m server.app.services.schedule_validation validate server/data/actual_output
python -m server.app.services.schedule_validation score server/data/actual_output
```

Use `--input-directory path/to/inputs` to select the eight source CSVs (default:
`server/data`). The input dataset must be the one used to produce the schedule.
Scenario is inferred from `RESULTS.csv`; `--scenario A` additionally requires
that the file declares A. Mixed scenarios are rejected.

`validate` prints a JSON report containing `feasible`, `hard_violations`,
`soft_scores`, and diagnostic details. Violations have a `tag`, a message, and
row/entity context where applicable. `score` prints only the scores for valid
submissions; invalid submissions receive the full validation report and no
scores. Exit codes are 0 for valid, 1 for invalid submissions, and 2 for invalid
input datasets or command usage.

## Python API

```python
from server.app.services.schedule_validation import (
    validate_directory, score_directory, validate_schedule, InvalidScheduleError,
)

report = validate_directory("server/data/actual_output", scenario="A")
scores = score_directory("server/data/actual_output")
# score_directory raises InvalidScheduleError on failure; exc.report has details.
# validate_schedule(directory, prepared_problem, scenario=None) reuses an
# already preprocessed input dataset.
```

## Checks and scoring

Validation covers schemas, typed values, references, horizon bounds, access
sequence numbering, one access per activity/week, workload, planned starts,
predecessors, exact working-route occupancy, legal possession mixes, closures
and buffers, weekly resource limits, workfronts, scenario capacity/deadlines,
ECLO eligibility and line-wide windows. Contract result dates and overrun days
are recomputed from final activity accesses and checked against `RESULTS.csv`.
Every input contract must have exactly one result row.

The checker uses input preprocessing for topology and conflict footprints, but
checks submitted schedules directly without CP-SAT. It follows the modelling
document's pairwise co-sharing interpretation: sharing a possession at a common
location in the same week exempts that pair's mutual closure/buffer restrictions.
Group labels are arbitrary and scoped to a location/week, not global nights.
This is a repository validator, not a claim of certification by an external
competition validator.

Scores match the model: A = P, B = 7X + 5E, C = P + 7X + 5E. P is weighted
calendar-day overrun summed per activity, X counts excess possessions per
location/week, and E counts ECLO accesses. Contract priority chooses the delay
weight band; activity priority applies the nudge. `overrun_days_total`,
`earliness_days_total`, and `priority_overrun` aggregate activity days;
`contracts_overrunning` counts contracts. Scores never trust reported result
values, and are withheld if any check fails. Validation does not prove optimality.
