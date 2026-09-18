"""Typed preprocessing output. Dictionary keys remain IDs for fast solver lookups."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

PositiveInt = Annotated[int, Field(ge=1)]
NonNegativeInt = Annotated[int, Field(ge=0)]
Priority = Literal[1, 2, 3]
Nature = Literal["Live", "Non-live (Consist)", "Non-live (Others)"]


class DataModel(BaseModel):
    """Reject unknown fields and implicit type conversions in prepared records."""

    model_config = ConfigDict(extra="forbid", strict=True)


class LineData(DataModel):
    """Railway line metadata."""

    line_code: str
    line_name: str


class LocationData(DataModel):
    """One bound-specific tunnel or platform and its nominal weekly supply."""

    location_id: str
    location_kind: Literal["tunnel sector", "platform sector"]
    line_code: str
    bound: Literal["EB", "WB"]
    supply_capacity: NonNegativeInt


class ContractData(DataModel):
    """Metadata shared by all activity-type groups in a contract; dates are ISO strings."""

    contract_number: str
    contract_description: str
    contract_award_date: str
    contract_priority: Priority
    contract_completion_date: str
    planned_completion_date: str


class GroupData(ContractData):
    """Contract/type resource limits and local access-night domain."""

    activity_type: str
    nature_of_activity: Nature
    number_of_workfronts: PositiveInt
    access_type: Literal["PM", "PC", "C"]
    number_of_maximum_access_per_week: PositiveInt
    local_nights: list[PositiveInt]
    activities: list[str]


class ActivityData(DataModel):
    """Activity constants, with footprint symbols matching ConstraintModelling.md."""

    activity_id: str
    contract_number: str
    activity_type: str
    start_location_id: str
    end_location_id: str
    total_accesses: PositiveInt
    planned_start_date: str
    predecessor_activity_id: str | None
    activity_priority: Priority
    group_id: str
    access_type: Literal["PM", "PC", "C"]
    nature_of_activity: Nature
    planned_start_week: PositiveInt
    eligible_weeks: list[PositiveInt]
    deadline_week: NonNegativeInt = Field(
        description="Last on-time week; zero means none."
    )
    workload_units: PositiveInt = Field(description="Twice total_accesses.")
    delay_weight_scaled: PositiveInt = Field(
        description="Delay cost per day multiplied by 10."
    )
    affected_lines: list[str]
    R: list[str] = Field(description="Actual working locations.")
    B: list[str] = Field(description="Buffer locations, excluding the working route.")
    MIR: list[str] = Field(description="Opposite-bound closures.")
    INT: list[str] = Field(description="Other-line interchange closures.")
    X: list[str] = Field(description="External exclusions: B union MIR union INT.")
    C: list[str] = Field(description="Total footprint: R union X.")


class PlanningParameters(DataModel):
    """Planning horizon; additional CSV parameters are retained as strings."""

    model_config = ConfigDict(extra="allow", strict=True)
    __pydantic_extra__: dict[str, str] = Field(init=False)
    horizon_start: str
    horizon_weeks: PositiveInt


class ConflictData(DataModel):
    """Independent-possession conflict; a solver must still apply co-sharing rules."""

    activities: list[str] = Field(min_length=2, max_length=2)
    locations: list[str]
    shared_work_locations: list[str]


class ScenarioData(DataModel):
    """Scenario-specific limits and integer-scaled objective coefficients."""

    max_supply_excess: NonNegativeInt | None
    eclo_allowed: bool
    hard_deadline: bool
    eclo_window_weeks: PositiveInt | None
    delay_multiplier: Literal[0, 1]
    excess_weight_scaled: NonNegativeInt
    eclo_weight_scaled: NonNegativeInt


class PreparedProblem(DataModel):
    """Validated preprocessing result, independent of CP-SAT variables.

    Access records as ``problem.activities['A001'].workload_units``.
    Use ``model_dump(mode='json')`` for a dictionary or ``model_dump_json()``
    for JSON text. CSV parsing and cross-table/domain validation remain in
    the preprocessor; validating this model alone does not check topology,
    predecessor cycles, or consistency of derived indexes.
    """

    schema_version: Literal[1]
    source_tables: dict[str, list[dict[str, str | int]]]
    parameters: PlanningParameters
    weeks: list[PositiveInt]
    week_end_dates: dict[str, str]
    lines: dict[str, LineData]
    locations: dict[str, LocationData]
    stations_by_line: dict[str, list[str]]
    sectors_by_line: dict[str, list[str]]
    ordered_locations: dict[str, list[str]]
    opposite_locations: dict[str, str]
    contracts: dict[str, ContractData]
    groups: dict[str, GroupData]
    activities: dict[str, ActivityData]
    activities_by_contract: dict[str, list[str]]
    activities_by_location: dict[str, list[str]]
    activities_by_affected_location: dict[str, list[str]]
    activities_by_line: dict[str, list[str]]
    successors: dict[str, list[str]]
    topological_order: list[str]
    conflicts: list[ConflictData]
    conflicts_by_activity: dict[str, list[str]]
    location_capacity: dict[str, NonNegativeInt]
    possession_group_domains: dict[str, list[PositiveInt]]
    objective_scale: Literal[10]
    normal_access_units: Literal[2]
    eclo_bonus_units: Literal[1]
    scenarios: dict[Literal["A", "B", "C"], ScenarioData]
    warnings: list[str]
