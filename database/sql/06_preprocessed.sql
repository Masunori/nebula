-- =============================================================================
-- NebulaX Railway Track Access Optimisation
-- 06_preprocessed.sql: Intermediate Optimization Entities & Operational Disruptions
-- =============================================================================

SET search_path TO nebula, public;

-- -----------------------------------------------------------------------------
-- 1. PREPROCESSED_ACTIVITIES
-- Precomputed spatial footprints (R, B, MIR, INT, X, C), calendar timing,
-- workload units, and delay weights for each activity.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preprocessed_activities (
    activity_id VARCHAR(10) PRIMARY KEY,
    contract_number VARCHAR(10) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    group_id VARCHAR(60) NOT NULL,
    start_location_id VARCHAR(30) NOT NULL,
    end_location_id VARCHAR(30) NOT NULL,
    total_accesses SMALLINT NOT NULL,
    planned_start_date DATE NOT NULL,
    planned_start_week SMALLINT NOT NULL,
    deadline_week SMALLINT NOT NULL,
    workload_units SMALLINT NOT NULL,
    delay_weight_scaled INTEGER NOT NULL,
    predecessor_activity_id VARCHAR(10),
    activity_priority SMALLINT NOT NULL,
    access_type VARCHAR(5) NOT NULL,
    nature_of_activity VARCHAR(30) NOT NULL,
    eligible_weeks JSONB NOT NULL,
    affected_lines JSONB NOT NULL,
    r_locations JSONB NOT NULL,
    b_locations JSONB NOT NULL,
    mir_locations JSONB NOT NULL,
    int_locations JSONB NOT NULL,
    x_locations JSONB NOT NULL,
    c_locations JSONB NOT NULL,
    activity_data JSONB,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prep_act_group ON preprocessed_activities(group_id);
CREATE INDEX IF NOT EXISTS idx_prep_act_contract ON preprocessed_activities(contract_number);

COMMENT ON TABLE preprocessed_activities IS 'Precomputed intermediate activity attributes, footprints, and scheduling horizons';

-- -----------------------------------------------------------------------------
-- 2. PREPROCESSED_GROUPS
-- Resource limits, workfront capacity, and local night domains per contract:type.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preprocessed_groups (
    group_id VARCHAR(60) PRIMARY KEY,
    contract_number VARCHAR(10) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    nature_of_activity VARCHAR(30) NOT NULL,
    number_of_workfronts SMALLINT NOT NULL,
    access_type VARCHAR(5) NOT NULL,
    number_of_maximum_access_per_week SMALLINT NOT NULL,
    local_nights JSONB NOT NULL,
    activities JSONB NOT NULL,
    group_data JSONB,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE preprocessed_groups IS 'Precomputed contract-type groups with workfront limits and member activities';

-- -----------------------------------------------------------------------------
-- 3. PREPROCESSED_CONFLICTS
-- Pairwise independent possession conflict pairs and shared work locations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preprocessed_conflicts (
    id SERIAL PRIMARY KEY,
    activity_a VARCHAR(10) NOT NULL,
    activity_b VARCHAR(10) NOT NULL,
    conflict_locations JSONB NOT NULL,
    shared_work_locations JSONB NOT NULL,
    UNIQUE (activity_a, activity_b)
);

CREATE INDEX IF NOT EXISTS idx_prep_conf_a ON preprocessed_conflicts(activity_a);
CREATE INDEX IF NOT EXISTS idx_prep_conf_b ON preprocessed_conflicts(activity_b);

COMMENT ON TABLE preprocessed_conflicts IS 'Precomputed pairwise activity spatial conflicts for O(1) solver constraint generation';

-- -----------------------------------------------------------------------------
-- 4. PREPROCESSED_METADATA
-- Global solver parameters, calendar week mappings, and scenario constants.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preprocessed_metadata (
    meta_key VARCHAR(50) PRIMARY KEY,
    meta_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE preprocessed_metadata IS 'Serialized calendar dates, topological order, and scenario parameters';

-- -----------------------------------------------------------------------------
-- 5. DISRUPTIONS
-- Operational network disruptions (capacity reductions, closures, activity delays).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disruptions (
    disruption_id VARCHAR(50) PRIMARY KEY,
    disruption_type VARCHAR(30) NOT NULL CHECK (disruption_type IN ('CAPACITY_REDUCTION', 'ACTIVITY_DELAY', 'SECTOR_CLOSURE', 'EMERGENCY_POSSESSION')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location_id VARCHAR(30) REFERENCES location_supply(location_id) ON DELETE CASCADE,
    activity_id VARCHAR(30) REFERENCES activities(activity_id) ON DELETE CASCADE,
    from_week SMALLINT NOT NULL CHECK (from_week >= 1),
    to_week SMALLINT NOT NULL CHECK (to_week >= from_week),
    adjusted_capacity SMALLINT CHECK (adjusted_capacity >= 0),
    delay_weeks SMALLINT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'Chief Train Controller'
);

CREATE INDEX IF NOT EXISTS idx_disruptions_location ON disruptions(location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_disruptions_activity ON disruptions(activity_id, is_active);

COMMENT ON TABLE disruptions IS 'Persistent operational network disruptions that recalibrate the optimization model';

-- -----------------------------------------------------------------------------
-- 6. PLANNING_RUNS
-- Versioned planning iterations (Baseline, Draft revisions, and Approved plans).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planning_runs (
    run_id VARCHAR(50) PRIMARY KEY,
    scenario VARCHAR(5) NOT NULL CHECK (scenario IN ('A', 'B', 'C')),
    revision_number VARCHAR(20) NOT NULL,
    revision_type VARCHAR(20) NOT NULL CHECK (revision_type IN ('baseline', 'draft', 'approved')),
    validation_state VARCHAR(20) NOT NULL CHECK (validation_state IN ('valid', 'invalid', 'pending', 'unvalidated')),
    objective_score NUMERIC(10, 2),
    hard_violations_count INTEGER DEFAULT 0,
    parent_run_id VARCHAR(50) REFERENCES planning_runs(run_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ready'
);

CREATE INDEX IF NOT EXISTS idx_planning_runs_scenario ON planning_runs(scenario, revision_type);

COMMENT ON TABLE planning_runs IS 'Persistent planning runs and revision versions';
