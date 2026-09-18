from ortools.sat.python import cp_model
from .csv_preprocessor import preprocess_directory
from ..models.preprocessed_data import PreparedProblem

from pydantic import BaseModel, ConfigDict, Field, PositiveInt


class OptimizationVariables(BaseModel):
    """In-memory solver variables, keyed by entity IDs and one-based indices."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    activity_access_vars: dict[
        tuple[str, PositiveInt, PositiveInt], cp_model.IntVar
    ] = Field(..., description="Activity access variables (x)")
    eclo_vars: dict[tuple[str, PositiveInt, PositiveInt], cp_model.IntVar] = Field(
        ..., description="ECLO variables (e)"
    )
    activity_week_access_vars: dict[tuple[str, PositiveInt], cp_model.IntVar] = Field(
        ..., description="Activity week access variables (y)"
    )
    loc_possess_cosharing_vars: dict[
        tuple[str, str, PositiveInt, PositiveInt], cp_model.IntVar
    ] = Field(..., description="Location possession co-sharing variables (z)")
    possess_group_usage_vars: dict[
        tuple[str, PositiveInt, PositiveInt], cp_model.IntVar
    ] = Field(..., description="Possession group usage variables (u)")
    group_access_night_usage_vars: dict[
        tuple[str, PositiveInt, PositiveInt], cp_model.IntVar
    ] = Field(..., description="Group access night usage variables (v)")


def initialize_optimization_variables(
    model: cp_model.CpModel, data: PreparedProblem
) -> OptimizationVariables:
    """
    Creates optimization variables only, without adding any constraints.

    Args:
        model (cp_model.CpModel): The CP-SAT model to which variables will be added.
        data (PreparedProblem): Typed preprocessing result for variable initialization.

    Returns:
        OptimizationVariables: An instance of the OptimizationVariables class containing the initialized variables.
    """
    activity_access_vars = {}  # x
    eclo_vars = {}  # e
    activity_week_access_vars = {}  # y

    for a, activity in data.activities.items():
        nights = data.groups[activity.group_id].local_nights

        for w in data.weeks:
            activity_week_access_vars[a, w] = model.new_bool_var(f"y_{a}_{w}")

            for n in nights:
                activity_access_vars[a, w, n] = model.new_bool_var(f"x_{a}_{w}_{n}")
                eclo_vars[a, w, n] = model.new_bool_var(f"e_{a}_{w}_{n}")

    loc_possess_cosharing_vars = {}  # z
    possess_group_usage_vars = {}  # u

    for l, possession_groups in data.possession_group_domains.items():
        for w in data.weeks:
            for g in possession_groups:
                possess_group_usage_vars[l, w, g] = model.new_bool_var(f"u_{l}_{w}_{g}")

    for a, activity in data.activities.items():
        for l in activity.R:
            for w in data.weeks:
                for g in data.possession_group_domains[l]:
                    loc_possess_cosharing_vars[a, l, w, g] = model.new_bool_var(
                        f"z_{a}_{l}_{w}_{g}"
                    )
    group_access_night_usage_vars = {}  # v

    for h, group in data.groups.items():
        for w in data.weeks:
            for n in group.local_nights:
                group_access_night_usage_vars[h, w, n] = model.new_bool_var(
                    f"v_{h}_{w}_{n}"
                )

    return OptimizationVariables(
        activity_access_vars=activity_access_vars,
        eclo_vars=eclo_vars,
        activity_week_access_vars=activity_week_access_vars,
        loc_possess_cosharing_vars=loc_possess_cosharing_vars,
        possess_group_usage_vars=possess_group_usage_vars,
        group_access_night_usage_vars=group_access_night_usage_vars,
    )


def add_variable_linking_constraints(
    model: cp_model.CpModel, data: PreparedProblem, variables: OptimizationVariables
) -> None:
    """Connect access, weekly activity, occupancy and usage indicators.

    Args:
        model: Model containing the initialized variables; modified in place.
        data: Prepared activity routes, groups and index domains.
        variables: Variables returned by initialize_optimization_variables.

    Returns:
        None. Adds e <= x, y = sum(x), sum(z) = y, and exact u/v usage
        links. Binary y also enforces at most one access per activity/week.
        Capacity, possession mixes and other scheduling rules are separate.
    """
    x = variables.activity_access_vars
    e = variables.eclo_vars
    y = variables.activity_week_access_vars
    z = variables.loc_possess_cosharing_vars
    u = variables.possess_group_usage_vars
    v = variables.group_access_night_usage_vars

    for a, activity in data.activities.items():
        nights = data.groups[activity.group_id].local_nights
        for w in data.weeks:
            for n in nights:
                # Rule 9: e_awn <= x_awn (ECLO requires an assigned access).
                model.add(e[a, w, n] <= x[a, w, n])
            # Weekly indicator: y_aw = sum_n x_awn; binary y implies sum_n x_awn <= 1.
            model.add(y[a, w] == sum(x[a, w, n] for n in nights))
            for l in activity.R:
                possession_groups = data.possession_group_domains[l]
                # Route occupancy: sum_{g in G_l} z_alwg = y_aw for each l in R_a.
                model.add(sum(z[a, l, w, g] for g in possession_groups) == y[a, w])
                for g in possession_groups:
                    # Possession usage: z_alwg <= u_lwg.
                    model.add(z[a, l, w, g] <= u[l, w, g])

    for l, possession_groups in data.possession_group_domains.items():
        for w in data.weeks:
            for g in possession_groups:
                # Reverse possession link: u_lwg <= sum_{a: l in R_a} z_alwg.
                model.add(
                    u[l, w, g]
                    <= sum(z[a, l, w, g] for a in data.activities_by_location[l])
                )

    for h, group in data.groups.items():
        for w in data.weeks:
            for n in group.local_nights:
                accesses = [x[a, w, n] for a in group.activities]
                for access in accesses:
                    # Rule 7 usage link: x_awn <= v_hwn for each a with h(a) = h.
                    model.add(access <= v[h, w, n])
                # Reverse usage link: v_hwn <= sum_{a: h(a)=h} x_awn.
                model.add(v[h, w, n] <= sum(accesses))


def add_workload_conservation_constraints(
    model: cp_model.CpModel, data: PreparedProblem, variables: OptimizationVariables
) -> None:
    """
    Adds workload conservation constraints to the model.

    Args:
        model (cp_model.CpModel): The CP-SAT model to which constraints will be added.
        data (PreparedProblem): Typed preprocessing result for constraint addition.
        variables (OptimizationVariables): An instance of the OptimizationVariables class containing the optimization variables.
    """
    x = variables.activity_access_vars
    e = variables.eclo_vars

    for a, activity in data.activities.items():
        nights = data.groups[activity.group_id].local_nights

        # Rule 1: 2 * sum_{w,n} x_awn + sum_{w,n} e_awn >= 2*q_a.
        model.add(
            sum(2 * x[a, w, n] + e[a, w, n] for w in data.weeks for n in nights)
            >= activity.workload_units
        )


def add_planned_start_date_constraints(
    model: cp_model.CpModel, data: PreparedProblem, variables: OptimizationVariables
) -> None:
    """
    Adds planned start date constraints to the model.

    Args:
        model (cp_model.CpModel): The CP-SAT model to which constraints will be added.
        data (PreparedProblem): Typed preprocessing result for constraint addition.
        variables (OptimizationVariables): An instance of the OptimizationVariables class containing the optimization variables.
    """
    x = variables.activity_access_vars

    for a, activity in data.activities.items():
        nights = data.groups[activity.group_id].local_nights

        for w in data.weeks:
            if w < activity.planned_start_week:
                for n in nights:
                    # Rule 2: x_awn = 0 for every w < r_a.
                    model.add(x[a, w, n] == 0)


def add_predecessor_precedence_constraints(
    model: cp_model.CpModel, data: PreparedProblem, variables: OptimizationVariables
) -> None:
    """Require each successor to start strictly after its predecessor finishes.

    For every week w in which successor a operates, forbid predecessor b
    from operating in w or any later week. With positive workload enforced
    for every activity, this is equivalent to S_a >= F_b + 1. Local night
    indices are accounting labels, not a chronological order within a week.

    Args:
        model: CP-SAT model to modify in place.
        data: Prepared activities with validated, acyclic predecessor IDs.
        variables: Initialized variables. Weekly indicators y must already
            be linked to x; workload conservation must also be enforced so
            each predecessor receives its required work.

    Returns:
        None. Adds conditional constraints for each dependency and week.
        Activities without predecessors add no constraints. Cross-contract
        dependencies work independently of their local-night domain sizes.
    """
    y = variables.activity_week_access_vars

    for activity_id, activity in data.activities.items():
        predecessor_id = activity.predecessor_activity_id
        if predecessor_id is None:
            continue

        for week in data.weeks:
            predecessor_remaining_accesses = sum(
                y[predecessor_id, predecessor_week]
                for predecessor_week in data.weeks
                if predecessor_week >= week
            )
            # Rule 3: y_aw = 1 => sum_{t >= w} y_bt = 0, enforcing S_a >= F_b + 1.
            model.add(predecessor_remaining_accesses == 0).only_enforce_if(
                y[activity_id, week]
            )


def add_closure_and_buffer_constraints(
    model: cp_model.CpModel, data: PreparedProblem, variables: OptimizationVariables
) -> None:
    """Prevent independent conflicting possessions from running in the same week.

    Uses the preprocessed relation (R_b intersects C_a) or (R_a intersects
    C_b) or (B_a intersects B_b), including live mirror/interchange effects.
    For each conflict pair, y_aw + y_bw <= 1 unless the pair co-shares.

    The rule-6 exemption is interpreted pairwise: sharing at least one
    actual working location's possession group waives the pair's mutual
    restrictions. Group labels at different locations are never compared.
    Rule 5 must separately constrain the legal mix and size of possessions;
    this function alone does not establish full schedule feasibility.

    Args:
        model: Model to modify with conflict constraints and auxiliary
            Boolean indicators of shared possession membership.
        data: Prepared conflicts, shared working locations and group domains.
        variables: Initialized x/y/z variables with linking constraints added.
            Local access-night n values do not identify global nights and
            therefore are not used to decide whether a conflict is exempt.

    Returns:
        None. Adds one exclusion per pair/week and exact AND indicators
        for possible shared (location, week, possession-group) assignments.
        Pairs absent from data.conflicts are left unconstrained by this rule.
    """
    y = variables.activity_week_access_vars
    z = variables.loc_possess_cosharing_vars

    for conflict in data.conflicts:
        first, second = conflict.activities
        for week in data.weeks:
            shared_possessions = []
            for location in conflict.shared_work_locations:
                for group in data.possession_group_domains[location]:
                    shared = model.new_bool_var(
                        f"shared_{first}_{second}_{location}_{week}_{group}"
                    )
                    first_occupancy = z[first, location, week, group]
                    second_occupancy = z[second, location, week, group]
                    # shared <=> both activities belong to this possession.
                    # Co-sharing indicator s_ab_lwg: s_ab_lwg <= z_alwg.
                    model.add(shared <= first_occupancy)
                    # Co-sharing indicator s_ab_lwg: s_ab_lwg <= z_blwg.
                    model.add(shared <= second_occupancy)
                    # Exact AND: s_ab_lwg >= z_alwg + z_blwg - 1.
                    model.add(shared >= first_occupancy + second_occupancy - 1)
                    shared_possessions.append(shared)

            # Rules 4/6: C_ab = 1 => y_aw + y_bw <= 1 + sum_{l,g} s_ab_lwg.
            model.add(y[first, week] + y[second, week] <= 1 + sum(shared_possessions))


def add_possession_legal_mix_constraints(
    model: cp_model.CpModel, data: PreparedProblem, variables: OptimizationVariables
) -> None:
    """Enforce rule 5's legal activity mixes for every location/week/possession.

    A used possession contains one PM alone, one PC with zero to three C,
    or one to four C without a possession master. Empty candidate groups
    remain allowed; the existing u/z links mark them unused.

    Args:
        model: CP-SAT model to modify in place.
        data: Prepared activities with access_type and location membership.
        variables: Initialized occupancy variables z, linked to y and u.

    Returns:
        None. Adds the two legal-mix inequalities for each (l, w, g).
        Weekly usage U_lw = sum_g u_lwg is already expressible from u.
        Its supply bound is scenario-specific (A: K_l, C: K_l + 1,
        B: no hard cap) and is left to scenario constraints.
    """
    z = variables.loc_possess_cosharing_vars

    for location, possession_groups in data.possession_group_domains.items():
        activities_by_type = {
            access_type: [
                activity_id
                for activity_id in data.activities_by_location[location]
                if data.activities[activity_id].access_type == access_type
            ]
            for access_type in ("PM", "PC", "C")
        }
        for week in data.weeks:
            for group in possession_groups:
                # PM_lwg, PC_lwg, C_lwg = sum_{a: l in R_a, tau_a=type} z_alwg.
                counts = {
                    access_type: sum(
                        z[activity_id, location, week, group]
                        for activity_id in activity_ids
                    )
                    for access_type, activity_ids in activities_by_type.items()
                }
                pm, pc, coworkers = counts["PM"], counts["PC"], counts["C"]
                # Rule 5: PM_lwg + PC_lwg <= 1 (at most one possession master).
                model.add(pm + pc <= 1)
                # Rule 5: C_lwg + PC_lwg + 4*PM_lwg <= 4 (legal sharing limit).
                model.add(coworkers + pc + 4 * pm <= 4)


def add_weekly_resource_constraints(
    model: cp_model.CpModel, data: PreparedProblem, variables: OptimizationVariables
) -> None:
    """Enforce rules 7 and 8 for each contract/type group and week.

    Args:
        model: Model to modify in place.
        data: Groups with member IDs, local nights, weekly access and team limits.
        variables: Initialized x/v variables with exact usage links added.

    Returns:
        None. The explicit weekly allocation bound is redundant with the
        preprocessed night domain but records rule 7 directly in the model.
    """
    x = variables.activity_access_vars
    v = variables.group_access_night_usage_vars
    for h, group in data.groups.items():
        for w in data.weeks:
            # Rule 7: sum_{n in N_h} v_hwn <= M_h.
            model.add(
                sum(v[h, w, n] for n in group.local_nights)
                <= group.number_of_maximum_access_per_week
            )
            for n in group.local_nights:
                # Rule 8: sum_{a: h(a)=h} x_awn <= F_h.
                model.add(
                    sum(x[a, w, n] for a in group.activities)
                    <= group.number_of_workfronts
                )


def add_scenario_hard_constraints(
    model: cp_model.CpModel,
    data: PreparedProblem,
    variables: OptimizationVariables,
    scenario: str,
) -> dict[str, cp_model.IntVar]:
    """Apply scenario supply/deadline rules and the line-wide ECLO window.

    Args:
        model: Model to modify in place.
        data: Prepared scenario settings, capacities, deadlines and affected lines.
        variables: Initialized variables with linking and workload rules added.
        scenario: 'A', 'B' or 'C'. A caps supply and forbids ECLO; B enforces
            planned deadlines with uncapped supply; C permits one extra slot
            and restricts ECLO to a two-calendar-week window per line.

    Returns:
        Line code -> ECLO window-start variable H_lambda for C; empty for
        scenarios without windows. Unused lines may have arbitrary starts.
        Window starts range from 1 through the horizon, allowing a single
        ECLO week at the horizon's end. No objective is added.

    Raises:
        ValueError: If scenario is not A, B or C.
    """
    if scenario not in ("A", "B", "C"):
        raise ValueError("scenario must be 'A', 'B' or 'C'")
    settings = data.scenarios[scenario]
    y = variables.activity_week_access_vars
    e = variables.eclo_vars
    u = variables.possess_group_usage_vars

    if settings.max_supply_excess is not None:
        for location, groups in data.possession_group_domains.items():
            for week in data.weeks:
                # A/C: U_lw = sum_g u_lwg <= K_l + delta (delta=0 for A, 1 for C).
                model.add(
                    sum(u[location, week, group] for group in groups)
                    <= data.location_capacity[location] + settings.max_supply_excess
                )

    if not settings.eclo_allowed:
        for variable in e.values():
            # Scenario A: e_awn = 0 for every activity/week/night.
            model.add(variable == 0)

    if settings.hard_deadline:
        for activity_id, activity in data.activities.items():
            for week in data.weeks:
                if week > activity.deadline_week:
                    # Scenario B: D(F_a) <= D_c^plan <=> y_aw = 0 after the deadline week.
                    model.add(y[activity_id, week] == 0)

    window_starts = {}
    if settings.eclo_window_weeks is not None:
        for line in data.lines:
            window_starts[line] = model.new_int_var(
                1, data.parameters.horizon_weeks, f"H_{line}"
            )
        for (activity_id, week, night), eclo in e.items():
            for line in data.activities[activity_id].affected_lines:
                start = window_starts[line]
                # Rule 10 (C): e_awn = 1 => H_lambda <= w, for every affected line.
                model.add(start <= week).only_enforce_if(eclo)
                # Rule 10 (C): e_awn = 1 => w <= H_lambda + 1 (two-week window).
                model.add(
                    week <= start + settings.eclo_window_weeks - 1
                ).only_enforce_if(eclo)
    return window_starts


class SatSolverService:
    def __init__(self, scenario: str = "A"):
        """Build hard constraints for one scenario (A by default), without an objective.

        Args:
            scenario: A, B or C; selects supply, deadline and ECLO policies.

        Raises:
            ValueError: If the scenario is unsupported.
        """
        if scenario not in ("A", "B", "C"):
            raise ValueError("scenario must be 'A', 'B' or 'C'")
        self.scenario = scenario
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.status = None
        self.data = preprocess_directory()
        # At most K_l + delta groups can be used in A/C; labels are interchangeable.
        excess = self.data.scenarios[scenario].max_supply_excess
        if excess is not None:
            self.data.possession_group_domains = {
                location: groups[:self.data.location_capacity[location] + excess]
                for location, groups in self.data.possession_group_domains.items()
            }
        self.variables = initialize_optimization_variables(self.model, self.data)

        add_variable_linking_constraints(self.model, self.data, self.variables)

        add_workload_conservation_constraints(self.model, self.data, self.variables)
        add_planned_start_date_constraints(self.model, self.data, self.variables)
        add_predecessor_precedence_constraints(self.model, self.data, self.variables)
        add_closure_and_buffer_constraints(self.model, self.data, self.variables)
        add_possession_legal_mix_constraints(self.model, self.data, self.variables)
        add_weekly_resource_constraints(self.model, self.data, self.variables)
        self.eclo_window_starts = add_scenario_hard_constraints(
            self.model, self.data, self.variables, scenario
        )

    def solve(self, max_time_seconds: float = 60, workers: int = 8) -> bool:
        """Search for a feasible assignment with a bounded solver runtime.

        Args:
            max_time_seconds: Positive solver search limit, excluding model building.
            workers: Positive number of parallel CP-SAT search workers.

        Returns:
            True only when an assignment is available. The exact result status
            is saved in self.status, distinguishing INFEASIBLE from UNKNOWN.
        """
        if max_time_seconds <= 0 or workers < 1:
            raise ValueError("Search limit and worker count must be positive")
        self.solver.parameters.max_time_in_seconds = max_time_seconds
        self.solver.parameters.num_search_workers = workers
        self.status = self.solver.solve(self.model)
        return self.status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

    def get_value(self, variable):
        return self.solver.Value(variable)
