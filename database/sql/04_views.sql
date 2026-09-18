-- =============================================================================
-- NebulaX Railway Track Access Optimisation
-- 04_views.sql: High-Performance Analytical & Optimization Views
-- =============================================================================

SET search_path TO nebula, public;

-- -----------------------------------------------------------------------------
-- 1. V_NETWORK_TOPOLOGY
-- Formatted, ordered visual layout of the entire physical railway network.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_network_topology AS
SELECT 
    nt.line_code,
    l.line_name,
    nt.bound,
    nt.seq_coord,
    nt.location_id,
    nt.location_kind,
    COALESCE(nt.station_id, nt.sector_id) AS physical_name,
    ls.supply_capacity
FROM network_topology nt
JOIN lines l ON l.line_code = nt.line_code
JOIN location_supply ls ON ls.location_id = nt.location_id
ORDER BY nt.line_code, nt.bound, nt.seq_coord;

COMMENT ON VIEW v_network_topology IS 'Ordered spatial sequence of all platform and tunnel sectors by line and bound';

-- -----------------------------------------------------------------------------
-- 2. V_ACTIVITY_SPANS
-- Precomputed spatial envelopes and safety buffer bounds for every activity.
-- Eliminates path-finding overhead for the solver and UI.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_activity_spans AS
WITH activity_bounds AS (
    SELECT 
        a.activity_id,
        a.contract_number,
        c.activity_type,
        c.nature_of_activity,
        c.access_type,
        c.contract_priority,
        a.activity_priority,
        a.total_accesses,
        a.planned_start_date,
        a.predecessor_activity_id,
        a.start_location_id,
        a.end_location_id,
        b.p_line AS line_code,
        b.p_bound AS bound,
        b.p_min_coord AS min_coord,
        b.p_max_coord AS max_coord,
        br.up_to_buffer_sectors,
        br.opposite_bound_required
    FROM activities a
    JOIN contracts c ON c.contract_number = a.contract_number
    JOIN buffer_rules br ON br.nature_of_works = c.nature_of_activity
    CROSS JOIN LATERAL get_location_span_bounds(a.start_location_id, a.end_location_id) b
)
SELECT 
    ab.*,
    -- Buffer extends by (buffer_sectors * 2) coordinates (each sector step is 2 coordinate units)
    GREATEST(1, ab.min_coord - (ab.up_to_buffer_sectors * 2))::SMALLINT AS buffer_min_coord,
    LEAST(19, ab.max_coord + (ab.up_to_buffer_sectors * 2))::SMALLINT AS buffer_max_coord
FROM activity_bounds ab;

COMMENT ON VIEW v_activity_spans IS 'Precomputed 1D coordinate intervals and safety exclusion envelopes for all activities';

-- -----------------------------------------------------------------------------
-- 3. V_WEEKLY_CAPACITY_UTILIZATION
-- Evaluates scheduled bookings vs nominal capacity per location and week.
-- Immediately flags bottlenecks and capacity breaches (tag: capacity).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_weekly_capacity_utilization AS
WITH booked_slots AS (
    SELECT 
        so.scenario,
        so.week,
        so.location_id,
        COUNT(DISTINCT so.co_share_group) AS co_share_groups_count,
        COUNT(DISTINCT so.activity_id) AS booked_activities_count
    FROM schedule_occupancy so
    GROUP BY so.scenario, so.week, so.location_id
)
SELECT 
    ls.location_id,
    ls.location_kind,
    ls.line_code,
    ls.bound,
    ls.supply_capacity,
    cw.week_number,
    cw.start_date AS week_start_date,
    cw.end_date AS week_end_date,
    COALESCE(bs.scenario, 'A') AS scenario,
    COALESCE(bs.co_share_groups_count, 0) AS used_slots,
    COALESCE(bs.booked_activities_count, 0) AS booked_activities_count,
    (ls.supply_capacity - COALESCE(bs.co_share_groups_count, 0)) AS remaining_capacity,
    CASE 
        WHEN COALESCE(bs.co_share_groups_count, 0) > ls.supply_capacity THEN TRUE 
        ELSE FALSE 
    END AS is_over_capacity
FROM location_supply ls
CROSS JOIN dim_calendar_weeks cw
LEFT JOIN booked_slots bs 
       ON bs.location_id = ls.location_id 
      AND bs.week = cw.week_number;

COMMENT ON VIEW v_weekly_capacity_utilization IS 'Weekly capacity tracking comparing distinct co-share groups against supply_capacity';

-- -----------------------------------------------------------------------------
-- 4. V_CONTRACT_METRICS
-- Evaluates contract completion performance, overrun days, and tiered penalty scores.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_contract_metrics AS
SELECT 
    sr.scenario,
    c.contract_number,
    c.contract_description,
    c.activity_type,
    c.nature_of_activity,
    c.contract_priority,
    c.planned_completion_date,
    c.contract_completion_date,
    sr.simulated_completion_date,
    sr.overrun_days,
    -- Contract tier weight: P1 = 100, P2 = 10, P3 = 1
    CASE c.contract_priority
        WHEN 1 THEN 100
        WHEN 2 THEN 10
        WHEN 3 THEN 1
        ELSE 1
    END AS tier_weight,
    -- Base contract overrun penalty: tier_weight * overrun_days
    (CASE c.contract_priority
        WHEN 1 THEN 100
        WHEN 2 THEN 10
        WHEN 3 THEN 1
        ELSE 1
    END * sr.overrun_days) AS base_overrun_penalty
FROM contracts c
JOIN schedule_results sr ON sr.contract_number = c.contract_number;

COMMENT ON VIEW v_contract_metrics IS 'Contract completion deadlines, overrun days, and base priority penalties';

-- -----------------------------------------------------------------------------
-- 5. V_SCENARIO_SCORES
-- Comprehensive calculation of the competition objective penalty scores for A, B, and C.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_scenario_scores AS
WITH overrun_agg AS (
    SELECT 
        scenario,
        SUM(overrun_days) AS total_overrun_days,
        SUM(base_overrun_penalty) AS total_priority_overrun_cost,
        COUNT(CASE WHEN overrun_days > 0 THEN 1 END) AS contracts_overrunning_count
    FROM v_contract_metrics
    GROUP BY scenario
),
eclo_agg AS (
    SELECT 
        scenario,
        COUNT(CASE WHEN eclo = 1 THEN 1 END) AS eclo_nights_total,
        COUNT(*) AS total_access_nights_scheduled
    FROM schedule_access
    GROUP BY scenario
),
excess_capacity_agg AS (
    SELECT 
        scenario,
        SUM(GREATEST(0, used_slots - supply_capacity)) AS excess_access_nights_total
    FROM v_weekly_capacity_utilization
    GROUP BY scenario
)
SELECT 
    oa.scenario,
    oa.total_overrun_days,
    oa.contracts_overrunning_count,
    oa.total_priority_overrun_cost,
    COALESCE(ea.eclo_nights_total, 0) AS eclo_nights_total,
    COALESCE(exc.excess_access_nights_total, 0) AS excess_access_nights_total,
    -- Scenario A Penalty Score: Priority Overrun Cost only (ECLO forbidden)
    oa.total_priority_overrun_cost AS score_a,
    -- Scenario B Penalty Score: 7 * excess_nights + 5 * eclo_nights (Zero overrun)
    (7 * COALESCE(exc.excess_access_nights_total, 0) + 5 * COALESCE(ea.eclo_nights_total, 0)) AS score_b,
    -- Scenario C Penalty Score: Priority Overrun + 7 * excess_nights + 5 * eclo_nights
    (oa.total_priority_overrun_cost + 7 * COALESCE(exc.excess_access_nights_total, 0) + 5 * COALESCE(ea.eclo_nights_total, 0)) AS score_c
FROM overrun_agg oa
LEFT JOIN eclo_agg ea ON ea.scenario = oa.scenario
LEFT JOIN excess_capacity_agg exc ON exc.scenario = oa.scenario;

COMMENT ON VIEW v_scenario_scores IS 'Deterministic evaluation of competition penalty formulas across Scenarios A, B, and C';

-- -----------------------------------------------------------------------------
-- 6. V_PREDECESSOR_DAG_CHECK
-- Predecessor dependency integrity check (validates Finish-to-Start strictly later week).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_predecessor_dag_check AS
WITH activity_schedule_bounds AS (
    SELECT 
        scenario,
        activity_id,
        MIN(week) AS first_scheduled_week,
        MAX(week) AS last_scheduled_week
    FROM schedule_access
    GROUP BY scenario, activity_id
)
SELECT 
    succ.scenario,
    succ.activity_id AS successor_activity_id,
    succ.contract_number AS successor_contract,
    succ_sched.first_scheduled_week AS successor_first_week,
    pred.activity_id AS predecessor_activity_id,
    pred.contract_number AS predecessor_contract,
    pred_sched.last_scheduled_week AS predecessor_last_week,
    CASE 
        WHEN succ_sched.first_scheduled_week > pred_sched.last_scheduled_week THEN TRUE
        ELSE FALSE
    END AS is_fs_precedence_valid
FROM activities succ
JOIN activities pred ON pred.activity_id = succ.predecessor_activity_id
JOIN activity_schedule_bounds succ_sched ON succ_sched.activity_id = succ.activity_id
JOIN activity_schedule_bounds pred_sched 
  ON pred_sched.activity_id = pred.activity_id 
 AND pred_sched.scenario = succ_sched.scenario;

COMMENT ON VIEW v_predecessor_dag_check IS 'Audits strict FS+0 precedence rule (successor first week > predecessor last week)';
