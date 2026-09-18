-- =============================================================================
-- NebulaX Railway Track Access Optimisation
-- 01_schema.sql: Core Database Schema Definition
-- =============================================================================

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS nebula;
SET search_path TO nebula, public;

-- Drop existing tables if needed (in reverse dependency order)
DROP TABLE IF EXISTS schedule_occupancy CASCADE;
DROP TABLE IF EXISTS schedule_access CASCADE;
DROP TABLE IF EXISTS schedule_results CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS dim_calendar_weeks CASCADE;
DROP TABLE IF EXISTS system_parameters CASCADE;
DROP TABLE IF EXISTS buffer_rules CASCADE;
DROP TABLE IF EXISTS location_supply CASCADE;
DROP TABLE IF EXISTS sectors CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS lines CASCADE;

-- -----------------------------------------------------------------------------
-- 1. LINES
-- Represents the railway lines (Line Alpha, Line Beta)
-- -----------------------------------------------------------------------------
CREATE TABLE lines (
    line_code VARCHAR(5) PRIMARY KEY,
    line_name VARCHAR(50) NOT NULL
);

COMMENT ON TABLE lines IS 'Railway lines in the dual-line network (ALP, BET)';
COMMENT ON COLUMN lines.line_code IS 'Unique 3-letter code: ALP or BET';

-- -----------------------------------------------------------------------------
-- 2. STATIONS
-- Stations on each line. Interchange stations (H01, H02) appear on both lines.
-- Cardinality: lines -> stations (1 : N)
-- Composite PK: (station_id, line_code) ensures line membership uniqueness.
-- -----------------------------------------------------------------------------
CREATE TABLE stations (
    station_id VARCHAR(10) NOT NULL,
    line_code VARCHAR(5) NOT NULL REFERENCES lines(line_code) ON DELETE CASCADE,
    seq SMALLINT NOT NULL CHECK (seq > 0),
    is_interchange BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (station_id, line_code)
);

CREATE INDEX idx_stations_line_seq ON stations(line_code, seq);

COMMENT ON TABLE stations IS 'Station stops per line. Hubs (H01, H02) are linked to both ALP and BET';
COMMENT ON COLUMN stations.line_code IS 'Foreign key referencing lines(line_code)';

-- -----------------------------------------------------------------------------
-- 3. SECTORS
-- Physical tunnel sectors connecting adjacent stations along a line.
-- Cardinality: stations -> sectors (2 : 1) - from_station and to_station bound one sector.
-- lines -> sectors (1 : N)
-- -----------------------------------------------------------------------------
CREATE TABLE sectors (
    sector_id VARCHAR(30) PRIMARY KEY,
    line_code VARCHAR(5) NOT NULL REFERENCES lines(line_code) ON DELETE CASCADE,
    from_station_id VARCHAR(10) NOT NULL,
    to_station_id VARCHAR(10) NOT NULL,
    seq SMALLINT NOT NULL CHECK (seq > 0),
    is_shared BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sectors_line_seq ON sectors(line_code, seq);

COMMENT ON TABLE sectors IS 'Tunnel track sections between adjacent stations (from_station_id to to_station_id)';

-- -----------------------------------------------------------------------------
-- 4. LOCATION_SUPPLY
-- Supply capacity per physical location (platform sector or tunnel sector) and bound.
-- Cardinality: sectors -> location_supply (1 : 2 per sector: EB, WB)
--              stations -> location_supply (1 : 2 per station: EB, WB)
-- -----------------------------------------------------------------------------
CREATE TABLE location_supply (
    location_id VARCHAR(30) PRIMARY KEY,
    location_kind VARCHAR(20) NOT NULL CHECK (location_kind IN ('tunnel sector', 'platform sector')),
    line_code VARCHAR(5) NOT NULL REFERENCES lines(line_code) ON DELETE CASCADE,
    bound VARCHAR(5) NOT NULL CHECK (bound IN ('EB', 'WB')),
    supply_capacity SMALLINT NOT NULL CHECK (supply_capacity >= 0)
);

CREATE INDEX idx_location_supply_line_bound ON location_supply(line_code, bound);
CREATE INDEX idx_location_supply_kind ON location_supply(location_kind);

COMMENT ON TABLE location_supply IS 'Nominal weekly capacity (access nights) per physical platform or tunnel sector';

-- -----------------------------------------------------------------------------
-- 5. BUFFER_RULES
-- Safety exclusion buffer rules based on nature of works.
-- Fully editable by administrators.
-- -----------------------------------------------------------------------------
CREATE TABLE buffer_rules (
    nature_of_works VARCHAR(30) PRIMARY KEY,
    up_to_buffer_sectors SMALLINT NOT NULL CHECK (up_to_buffer_sectors >= 0),
    opposite_bound_required BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE buffer_rules IS 'Safety buffer distances and opposite-bound mirroring requirements';

-- -----------------------------------------------------------------------------
-- 6. SYSTEM_PARAMETERS
-- Key-value parameter store for planning horizon and solver configurations.
-- -----------------------------------------------------------------------------
CREATE TABLE system_parameters (
    param_key VARCHAR(50) PRIMARY KEY,
    param_value VARCHAR(100) NOT NULL,
    description TEXT
);

COMMENT ON TABLE system_parameters IS 'Operational configuration parameters including horizon_start and horizon_weeks';

-- -----------------------------------------------------------------------------
-- 7. DIM_CALENDAR_WEEKS
-- Temporal dimension table precomputing calendar weeks and boundaries.
-- -----------------------------------------------------------------------------
CREATE TABLE dim_calendar_weeks (
    week_number SMALLINT PRIMARY KEY CHECK (week_number > 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CHECK (start_date <= end_date)
);

CREATE INDEX idx_calendar_weeks_dates ON dim_calendar_weeks(start_date, end_date);

COMMENT ON TABLE dim_calendar_weeks IS 'Precomputed 7-day week intervals across the planning horizon';

-- -----------------------------------------------------------------------------
-- 8. CONTRACTS
-- Contract packages / programmes of work.
-- Cardinality: buffer_rules -> contracts (1 : N)
-- -----------------------------------------------------------------------------
CREATE TABLE contracts (
    contract_number VARCHAR(10) PRIMARY KEY,
    contract_description VARCHAR(100) NOT NULL,
    contract_award_date DATE NOT NULL,
    activity_type VARCHAR(30) NOT NULL,
    nature_of_activity VARCHAR(30) NOT NULL REFERENCES buffer_rules(nature_of_works),
    contract_priority SMALLINT NOT NULL CHECK (contract_priority IN (1, 2, 3)),
    contract_completion_date DATE NOT NULL,
    planned_completion_date DATE NOT NULL,
    number_of_workfronts SMALLINT NOT NULL CHECK (number_of_workfronts > 0),
    access_type VARCHAR(10) NOT NULL CHECK (access_type IN ('PM', 'PC', 'C')),
    number_of_maximum_access_per_week SMALLINT NOT NULL CHECK (number_of_maximum_access_per_week > 0),
    CHECK (contract_award_date <= planned_completion_date),
    CHECK (planned_completion_date <= contract_completion_date)
);

CREATE INDEX idx_contracts_priority ON contracts(contract_priority);
CREATE INDEX idx_contracts_nature ON contracts(nature_of_activity);

COMMENT ON TABLE contracts IS 'Work packages with deadlines, workfront caps, possession type, and weekly allocation limits';

-- -----------------------------------------------------------------------------
-- 9. ACTIVITIES
-- Work activities belonging to contracts.
-- Cardinality: contracts -> activities (1 : N)
--              activities -> activities (0..1 : N, predecessor dependency)
--              location_supply -> activities (start and end bounds)
-- -----------------------------------------------------------------------------
CREATE TABLE activities (
    activity_id VARCHAR(10) PRIMARY KEY,
    contract_number VARCHAR(10) NOT NULL REFERENCES contracts(contract_number) ON DELETE CASCADE,
    activity_type VARCHAR(30) NOT NULL,
    start_location_id VARCHAR(30) NOT NULL REFERENCES location_supply(location_id),
    end_location_id VARCHAR(30) NOT NULL REFERENCES location_supply(location_id),
    total_accesses SMALLINT NOT NULL CHECK (total_accesses > 0),
    planned_start_date DATE NOT NULL,
    predecessor_activity_id VARCHAR(10) REFERENCES activities(activity_id) ON DELETE SET NULL,
    activity_priority SMALLINT NOT NULL CHECK (activity_priority IN (1, 2, 3))
);

CREATE INDEX idx_activities_contract ON activities(contract_number, planned_start_date);
CREATE INDEX idx_activities_predecessor ON activities(predecessor_activity_id);
CREATE INDEX idx_activities_priority ON activities(activity_priority);

COMMENT ON TABLE activities IS 'Specific work tasks with spatial span, workload volume, and predecessor constraints';

-- -----------------------------------------------------------------------------
-- 10. SCHEDULE_RESULTS
-- Contract completion evaluation results per scenario.
-- Cardinality: contracts -> schedule_results (1 : 3 across Scenarios A, B, C)
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_results (
    scenario VARCHAR(5) NOT NULL CHECK (scenario IN ('A', 'B', 'C')),
    contract_number VARCHAR(10) NOT NULL REFERENCES contracts(contract_number) ON DELETE CASCADE,
    simulated_completion_date DATE NOT NULL,
    overrun_days INTEGER NOT NULL DEFAULT 0 CHECK (overrun_days >= 0),
    PRIMARY KEY (scenario, contract_number)
);

CREATE INDEX idx_schedule_results_scenario ON schedule_results(scenario);

COMMENT ON TABLE schedule_results IS 'Simulation completion dates and overrun days per contract and scenario';

-- -----------------------------------------------------------------------------
-- 11. SCHEDULE_ACCESS
-- Weekly schedule access sequence assignment.
-- Cardinality: activities -> schedule_access (1 : N)
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_access (
    id BIGSERIAL PRIMARY KEY,
    scenario VARCHAR(5) NOT NULL DEFAULT 'A' CHECK (scenario IN ('A', 'B', 'C')),
    activity_id VARCHAR(10) NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    access_seq SMALLINT NOT NULL CHECK (access_seq > 0),
    week SMALLINT NOT NULL CHECK (week > 0),
    eclo SMALLINT NOT NULL DEFAULT 0 CHECK (eclo IN (0, 1)),
    access_night SMALLINT NOT NULL CHECK (access_night > 0),
    UNIQUE (scenario, activity_id, access_seq)
);

CREATE INDEX idx_schedule_access_lookup ON schedule_access(scenario, week, activity_id);
CREATE INDEX idx_schedule_access_night ON schedule_access(scenario, week, access_night);

COMMENT ON TABLE schedule_access IS 'Weekly allocation of access nights and ECLO usage per activity';

-- -----------------------------------------------------------------------------
-- 12. SCHEDULE_OCCUPANCY
-- Weekly spatial possession footprint and slot assignment.
-- Cardinality: activities -> schedule_occupancy (1 : N)
--              location_supply -> schedule_occupancy (1 : N)
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_occupancy (
    id BIGSERIAL PRIMARY KEY,
    scenario VARCHAR(5) NOT NULL DEFAULT 'A' CHECK (scenario IN ('A', 'B', 'C')),
    activity_id VARCHAR(10) NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    week SMALLINT NOT NULL CHECK (week > 0),
    location_id VARCHAR(30) NOT NULL REFERENCES location_supply(location_id) ON DELETE CASCADE,
    co_share_group VARCHAR(10) NOT NULL,
    UNIQUE (scenario, activity_id, week, location_id)
);

CREATE INDEX idx_schedule_occupancy_lookup ON schedule_occupancy(scenario, week, location_id, co_share_group);
CREATE INDEX idx_schedule_occupancy_activity ON schedule_occupancy(scenario, activity_id, week);

COMMENT ON TABLE schedule_occupancy IS 'Weekly physical location reservations and co-share slot identifiers';
