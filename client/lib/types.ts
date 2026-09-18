export type TrackBound = "EB" | "WB";
export type PersonaMode = "ALL" | "MAINTAINER" | "PLANNER" | "AUDITOR";

export interface Line {
  line_code: string;
  line_name: string;
  color_hex?: string;
  station_count?: number;
  sector_count?: number;
}

export interface Station {
  station_id: string;
  line_code: string;
  station_name: string;
  seq_order: number;
  seq_coord?: number;
  is_interchange?: boolean;
}

export interface Sector {
  sector_id: string;
  line_code: string;
  from_station_id: string;
  to_station_id: string;
  length_meters: number;
  from_coord?: number;
  to_coord?: number;
  supply_capacity?: number;
}

export interface LocationSupply {
  location_id: string;
  location_type: "PLATFORM" | "SECTOR";
  line_code: string;
  bound: TrackBound;
  supply_capacity: number;
  seq_coord?: number;
}

export interface BufferRule {
  nature_of_works: string;
  buffer_sectors: number;
  requires_opposite_bound: boolean;
}

export interface SystemParameter {
  key: string;
  value: string;
  data_type: string;
  description: string;
}

export interface Contract {
  contract_number: string;
  contractor_name: string;
  description: string;
  line_code: string;
  priority: number;
  max_workfronts: number;
  max_access_per_week: number;
  planned_completion_date: string;
  activity_count?: number;
}

export interface Activity {
  activity_id: string;
  contract_number: string;
  line_code: string;
  activity_type: string;
  priority: number;
  nature_of_works: string;
  station_from: string;
  station_to: string;
  track_bound: TrackBound;
  total_accesses: number;
  planned_start_date: string;
  predecessor_activity_id: string | null;
  start_coord?: number;
  end_coord?: number;
  buffer_sectors?: number;
  requires_opposite_bound?: boolean;
}

export interface ActivityFootprint {
  activity_id: string;
  contract_number: string;
  line_code: string;
  bound: TrackBound;
  priority: number;
  nature_of_works: string;
  station_from: string;
  station_to: string;
  start_coord: number;
  end_coord: number;
  buffer_sectors: number;
  requires_opposite_bound: boolean;
  buffer_start_coord: number;
  buffer_end_coord: number;
  total_stations: number;
  max_coord: number;
}

export interface DAGNode {
  id: string;
  contract_number: string;
  line_code: string;
  priority: number;
  total_accesses: number;
  nature_of_works: string;
  station_from: string;
  station_to: string;
}

export interface DAGEdge {
  from: string;
  to: string;
  is_cycle?: boolean;
}

export interface DAGReport {
  has_cycles: boolean;
  cycle_count: number;
  cycles: string[][];
  nodes: DAGNode[];
  edges: DAGEdge[];
  independent_activities_count: number;
}

export interface DatabaseOverview {
  dataset_name: string;
  dataset_source: string;
  lines_count: number;
  stations_count: number;
  sectors_count: number;
  contracts_count: number;
  activities_count: number;
  total_work_volume: number;
  is_dag_valid: boolean;
  dag_cycle_count: number;
  is_topology_continuous: boolean;
  horizon_weeks: number;
  horizon_start: string;
  interchange_hubs: string[];
}

export type StagedActionType = "CREATE" | "UPDATE" | "DELETE" | "CSV_REPLACE";

export interface StagedChange {
  id: string;
  entity_type: "ACTIVITY" | "CONTRACT" | "PARAMETER" | "BUFFER_RULE" | "CSV_DATASET";
  action: StagedActionType;
  key: string;
  title: string;
  previous_value?: any;
  new_value: any;
  timestamp: number;
}

export interface ValidationReport {
  is_valid: boolean;
  dataset_path: string;
  stats: Record<string, number>;
  warnings: string[];
  errors: string[];
}
