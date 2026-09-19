import { Pool } from "pg";
import fs from "fs";
import path from "path";
import type {
  Line,
  Station,
  Sector,
  LocationSupply,
  BufferRule,
  SystemParameter,
  Contract,
  Activity,
  DatabaseOverview,
  DAGReport,
} from "./types";

import {
  INITIAL_LINES,
  INITIAL_STATIONS,
  INITIAL_SECTORS,
  INITIAL_LOCATION_SUPPLY,
  INITIAL_BUFFER_RULES,
  INITIAL_PARAMETERS,
  INITIAL_CONTRACTS,
  INITIAL_ACTIVITIES,
} from "./initial-data";
import { getPresetDatasetState } from "./csv-parser";

// In-memory working copy fallback (persists during process lifetime)
let memLines: Line[] = [...INITIAL_LINES];
let memStations: Station[] = [...INITIAL_STATIONS];
let memSectors: Sector[] = [...INITIAL_SECTORS];
let memSupply: LocationSupply[] = [...INITIAL_LOCATION_SUPPLY];
let memBufferRules: BufferRule[] = [...INITIAL_BUFFER_RULES];
let memParameters: SystemParameter[] = [...INITIAL_PARAMETERS];
let memContracts: Contract[] = [...INITIAL_CONTRACTS];
let memActivities: Activity[] = [...INITIAL_ACTIVITIES];

const pgPool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || "nebula_user"}:${
      process.env.POSTGRES_PASSWORD || "nebula_password"
    }@${process.env.POSTGRES_HOST || "127.0.0.1"}:${
      process.env.POSTGRES_PORT || "5432"
    }/${process.env.POSTGRES_DB || "nebula"}`,
  connectionTimeoutMillis: 1000,
});

async function isPostgresAvailable(): Promise<boolean> {
  try {
    const client = await pgPool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

async function queryPg<T = any>(sql: string, params: any[] = []): Promise<T[] | null> {
  try {
    const client = await pgPool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows;
    } finally {
      client.release();
    }
  } catch (err) {
    return null;
  }
}

export async function getDatabaseOverview(): Promise<DatabaseOverview> {
  const pgUp = await isPostgresAvailable();

  if (pgUp) {
    const counts = await queryPg<{
      lines_cnt: string;
      stations_cnt: string;
      sectors_cnt: string;
      contracts_cnt: string;
      activities_cnt: string;
      total_vol: string;
    }>(`
      SELECT 
        (SELECT count(*) FROM nebula.lines) as lines_cnt,
        (SELECT count(*) FROM nebula.stations) as stations_cnt,
        (SELECT count(*) FROM nebula.sectors) as sectors_cnt,
        (SELECT count(*) FROM nebula.contracts) as contracts_cnt,
        (SELECT count(*) FROM nebula.activities) as activities_cnt,
        (SELECT coalesce(sum(total_accesses), 0) FROM nebula.activities) as total_vol
    `);

    const hubsRows = await queryPg<{ station_id: string }>(`
      SELECT station_id FROM nebula.stations GROUP BY station_id HAVING count(DISTINCT line_code) > 1
    `);

    if (counts && counts[0]) {
      const row = counts[0];
      return {
        dataset_name: "PostgreSQL Live Database",
        dataset_source: "PostgreSQL 16 Engine (nebula schema)",
        lines_count: parseInt(row.lines_cnt, 10),
        stations_count: parseInt(row.stations_cnt, 10),
        sectors_count: parseInt(row.sectors_cnt, 10),
        contracts_count: parseInt(row.contracts_cnt, 10),
        activities_count: parseInt(row.activities_cnt, 10),
        total_work_volume: parseInt(row.total_vol, 10),
        is_dag_valid: true,
        dag_cycle_count: 0,
        is_topology_continuous: true,
        horizon_weeks: 30,
        horizon_start: "2027-01-04",
        interchange_hubs: (hubsRows || []).map((h) => h.station_id).sort(),
      };
    }
  }

  // Fallback to in-memory store
  const totalVolume = memActivities.reduce((sum, a) => sum + (a.total_accesses || 0), 0);
  const horizonParam = memParameters.find((p) => p.key === "horizon_weeks");
  const startParam = memParameters.find((p) => p.key === "horizon_start");

  // Interchange hubs
  const stationLineMap = new Map<string, Set<string>>();
  memStations.forEach((s) => {
    if (!stationLineMap.has(s.station_id)) stationLineMap.set(s.station_id, new Set());
    stationLineMap.get(s.station_id)!.add(s.line_code);
  });
  const hubs: string[] = [];
  stationLineMap.forEach((lines, id) => {
    if (lines.size > 1) hubs.push(id);
  });

  return {
    dataset_name: "Official Baseline (In-Memory Engine)",
    dataset_source: "Memory-Mapped init_data",
    lines_count: memLines.length,
    stations_count: memStations.length,
    sectors_count: memSectors.length,
    contracts_count: memContracts.length,
    activities_count: memActivities.length,
    total_work_volume: totalVolume,
    is_dag_valid: true,
    dag_cycle_count: 0,
    is_topology_continuous: true,
    horizon_weeks: horizonParam ? parseInt(horizonParam.value, 10) : 30,
    horizon_start: startParam ? startParam.value : "2027-01-04",
    interchange_hubs: hubs.sort(),
  };
}

export async function getNetworkTopology() {
  // If a multi-line tiered dataset has been actively loaded into memory, prioritize it
  if (memLines.length > 2) {
    return {
      lines: memLines,
      stations: memStations,
      sectors: memSectors,
      location_supply: memSupply,
    };
  }

  const pgUp = await isPostgresAvailable();
  if (pgUp) {
    const pgLines = await queryPg<Line>("SELECT line_code, line_name FROM nebula.lines ORDER BY line_code");
    const pgStations = await queryPg<Station>("SELECT station_id, line_code, station_id as station_name, seq as seq_order, is_interchange FROM nebula.stations ORDER BY line_code, seq");
    const pgSectors = await queryPg<Sector>("SELECT sector_id, line_code, from_station_id, to_station_id, seq as seq_order, is_shared, 1000 as length_meters FROM nebula.sectors ORDER BY line_code, seq");
    const pgSupply = await queryPg<LocationSupply>("SELECT location_id, location_kind as location_type, line_code, bound, supply_capacity FROM nebula.location_supply ORDER BY location_id");

    if (pgLines && pgLines.length > 0 && pgStations && pgStations.length > 0) {
      return {
        lines: pgLines.map(l => ({ ...l, color_hex: l.line_code === "ALP" ? "#06b6d4" : l.line_code === "BET" ? "#10b981" : l.line_code === "GAM" ? "#a855f7" : l.line_code === "DEL" ? "#f59e0b" : "#ec4899" })),
        stations: pgStations,
        sectors: pgSectors || memSectors,
        location_supply: pgSupply || memSupply,
      };
    }
  }

  return {
    lines: memLines,
    stations: memStations,
    sectors: memSectors,
    location_supply: memSupply,
  };
}

export async function getActivities(line?: string, priority?: number, search?: string) {
  const pgUp = await isPostgresAvailable();
  if (pgUp) {
    const rows = await queryPg<Activity>(`
      SELECT 
        a.activity_id,
        a.contract_number,
        c.contract_description,
        a.activity_type,
        c.nature_of_activity as nature_of_works,
        a.start_location_id,
        a.end_location_id,
        a.start_location_id as station_from,
        a.end_location_id as station_to,
        COALESCE(ls.bound, 'EB') as track_bound,
        a.total_accesses,
        to_char(a.planned_start_date, 'YYYY-MM-DD') as planned_start_date,
        a.predecessor_activity_id,
        a.activity_priority as priority,
        COALESCE(ls.line_code, 'ALP') as line_code
      FROM nebula.activities a
      JOIN nebula.contracts c ON a.contract_number = c.contract_number
      LEFT JOIN nebula.location_supply ls ON a.start_location_id = ls.location_id
      ORDER BY a.activity_id
    `);

    let list = rows || [];
    if (line && line !== "ALL") {
      list = list.filter((a) => a.line_code === line);
    }
    if (priority) {
      list = list.filter((a) => a.priority === priority);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.activity_id.toLowerCase().includes(q) ||
          a.contract_number.toLowerCase().includes(q) ||
          (a.station_from && a.station_from.toLowerCase().includes(q)) ||
          (a.station_to && a.station_to.toLowerCase().includes(q))
      );
    }
    return { count: list.length, activities: list };
  }

  let list = memActivities;
  if (line && line !== "ALL") {
    list = list.filter((a) => a.line_code === line);
  }
  if (priority) {
    list = list.filter((a) => a.priority === priority);
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (a) =>
        a.activity_id.toLowerCase().includes(q) ||
        a.contract_number.toLowerCase().includes(q) ||
        (a.station_from && a.station_from.toLowerCase().includes(q)) ||
        (a.station_to && a.station_to.toLowerCase().includes(q))
    );
  }
  return { count: list.length, activities: list };
}

export async function getContracts(): Promise<{ count: number; contracts: Contract[] }> {
  const pgUp = await isPostgresAvailable();
  if (pgUp) {
    const rows = await queryPg<Contract>(`
      SELECT
        contract_number,
        contractor_name,
        description,
        contract_description,
        to_char(contract_award_date, 'YYYY-MM-DD') as contract_award_date,
        line_code,
        contract_priority as priority,
        contract_priority,
        number_of_workfronts as max_workfronts,
        number_of_workfronts,
        number_of_maximum_access_per_week as max_access_per_week,
        number_of_maximum_access_per_week,
        to_char(planned_completion_date, 'YYYY-MM-DD') as planned_completion_date,
        to_char(contract_completion_date, 'YYYY-MM-DD') as contract_completion_date,
        activity_type,
        nature_of_activity,
        access_type
      FROM nebula.contracts
      ORDER BY contract_number
    `);
    if (rows) {
      return { count: rows.length, contracts: rows };
    }
  }
  return { count: memContracts.length, contracts: memContracts };
}

export async function getDAGReport(): Promise<DAGReport> {
  const nodes = memActivities.map((a) => ({
    id: a.activity_id,
    contract_number: a.contract_number,
    line_code: a.line_code,
    priority: a.priority,
    total_accesses: a.total_accesses,
    nature_of_works: a.nature_of_works,
    station_from: a.station_from,
    station_to: a.station_to,
  }));

  const edges: { from: string; to: string }[] = [];
  const adj = new Map<string, string[]>();

  for (const a of memActivities) {
    if (a.predecessor_activity_id) {
      edges.push({ from: a.predecessor_activity_id, to: a.activity_id });
      if (!adj.has(a.predecessor_activity_id)) adj.set(a.predecessor_activity_id, []);
      adj.get(a.predecessor_activity_id)!.push(a.activity_id);
    }
  }

  // Cycle check
  const visited = new Map<string, number>();
  const cycles: string[][] = [];

  function dfs(u: string, path: string[]) {
    visited.set(u, 1);
    for (const v of adj.get(u) || []) {
      if (visited.get(v) === 1) {
        const cycle = path.slice(path.indexOf(v));
        cycle.push(v);
        cycles.push(cycle);
      } else if (!visited.has(v) || visited.get(v) === 0) {
        dfs(v, [...path, v]);
      }
    }
    visited.set(u, 2);
  }

  for (const n of nodes) {
    if (!visited.has(n.id) || visited.get(n.id) === 0) {
      dfs(n.id, [n.id]);
    }
  }

  return {
    has_cycles: cycles.length > 0,
    cycle_count: cycles.length,
    cycles,
    nodes,
    edges,
    independent_activities_count: nodes.filter(
      (n) => !edges.some((e) => e.to === n.id || e.from === n.id)
    ).length,
  };
}

export async function getParametersAndRules() {
  return {
    buffer_rules: memBufferRules,
    parameters: memParameters,
  };
}

export async function commitDatabaseChanges(changes: any[]) {
  for (const change of changes) {
    if (change.entity_type === "ACTIVITY") {
      if (change.action === "UPDATE") {
        memActivities = memActivities.map((a) =>
          a.activity_id === change.key ? { ...a, ...change.new_value } : a
        );
      } else if (change.action === "CREATE") {
        memActivities = [change.new_value, ...memActivities];
      }
    } else if (change.entity_type === "PARAMETER") {
      memParameters = memParameters.map((p) =>
        p.key === change.key ? { ...p, value: change.new_value } : p
      );
    } else if (change.entity_type === "BUFFER_RULE") {
      memBufferRules = memBufferRules.map((b) =>
        b.nature_of_works === change.key
          ? {
              ...b,
              buffer_sectors: change.new_value.sectorsCount,
              requires_opposite_bound: change.new_value.oppBound,
            }
          : b
      );
    }
  }

  await syncMemToFastApi();

  return {
    success: true,
    message: `Successfully committed ${changes.length} change(s) to the database. Downstream solver synced.`,
    changes_count: changes.length,
    timestamp: Date.now(),
  };
}

const FASTAPI_URL =
  process.env.API_INTERNAL_URL ||
  process.env.SERVER_URL ||
  "http://127.0.0.1:8000";

async function flushFastApi() {
  try {
    await fetch(`${FASTAPI_URL}/api/database/flush`, { method: "POST" });
  } catch {}
}

async function syncMemToFastApi() {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/database/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: memLines,
        stations: memStations,
        sectors: memSectors,
        location_supply: memSupply,
        buffer_rules: memBufferRules,
        parameters: memParameters,
        contracts: memContracts,
        activities: memActivities,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("syncMemToFastApi failed:", res.status, txt);
      throw new Error(`Backend sync failed (${res.status}): ${txt}`);
    }
    return await res.json();
  } catch (err) {
    console.error("Could not sync in-memory records to FastAPI backend:", err);
    throw err;
  }
}

export async function flushDatabaseRecords() {
  memActivities = [];
  memContracts = [];
  memLines = [];
  memStations = [];
  memSectors = [];
  memSupply = [];
  memBufferRules = [];
  memParameters = [];
  await flushFastApi();
  return { success: true, message: "Database records and schedule cache successfully flushed." };
}

export async function ingestDatabaseRecords(table: string, records: any[]) {
  if (table === "activities") {
    memActivities = records;
  } else if (table === "contracts") {
    memContracts = records;
  } else if (table === "lines") {
    memLines = records;
  } else if (table === "stations") {
    memStations = records;
  } else if (table === "sectors") {
    memSectors = records;
  } else if (table === "locationSupply") {
    memSupply = records;
  } else if (table === "bufferRules") {
    memBufferRules = records;
  } else if (table === "parameters") {
    memParameters = records;
  }

  await syncMemToFastApi();

  return {
    success: true,
    table,
    count: records.length,
    message: `Successfully ingested ${records.length} records into table: ${table}`,
  };
}

export async function loadPresetDataset(presetName: string, stateData?: any) {
  const dataset = stateData || getPresetDatasetState(presetName as any);
  console.log("loadPresetDataset presetName:", presetName, "dataset activities:", dataset?.activities?.length, "lines:", dataset?.lines?.length);
  if (dataset) {
    if (dataset.lines) memLines = dataset.lines;
    if (dataset.stations) memStations = dataset.stations;
    if (dataset.sectors) memSectors = dataset.sectors;
    if (dataset.locationSupply) memSupply = dataset.locationSupply;
    if (dataset.bufferRules) memBufferRules = dataset.bufferRules;
    if (dataset.parameters) memParameters = dataset.parameters;
    if (dataset.contracts) memContracts = dataset.contracts;
    if (dataset.activities) memActivities = dataset.activities;
  }

  await syncMemToFastApi();

  return {
    success: true,
    dataset: presetName,
    activities_count: memActivities.length,
    stations_count: memStations.length,
    lines_count: memLines.length,
  };
}
