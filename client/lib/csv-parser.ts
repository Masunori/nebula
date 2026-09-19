import type {
  Line,
  Station,
  Sector,
  LocationSupply,
  BufferRule,
  SystemParameter,
  Contract,
  Activity,
  TrackBound,
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

/**
 * Robust RFC 4180 CSV parser supporting quoted strings, newlines, and commas
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      row.push(current.trim());
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
        lines.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Detect table and parse records from filename and raw CSV text
 */
export function parseRailwayCSV(
  filename: string,
  content: string
): {
  table: string;
  records: any[];
  error?: string;
} {
  const rows = parseCSV(content);
  if (rows.length < 2) {
    return { table: "unknown", records: [], error: "CSV file is empty or missing headers." };
  }

  const rawHeaders = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  const dataRows = rows.slice(1);
  const fn = filename.toLowerCase();

  // 1. Activities
  if (fn.includes("activity") || rawHeaders.includes("activity_id") || rawHeaders.includes("predecessor_activity_id")) {
    const activities: Activity[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        activity_id: get("activity_id", cols[0] || ""),
        contract_number: get("contract_number", cols[1] || "C001"),
        line_code: get("line_code", cols[2] || "ALP"),
        activity_type: get("activity_type", cols[3] || "Track Renewal"),
        priority: parseInt(get("priority", cols[4] || "2"), 10) || 2,
        nature_of_works: get("nature_of_works", cols[5] || "Non-live (Others)"),
        station_from: get("station_from", cols[6] || "S01"),
        station_to: get("station_to", cols[7] || "S02"),
        track_bound: (get("track_bound", cols[8] || "EB") as TrackBound) || "EB",
        total_accesses: parseInt(get("total_accesses", cols[9] || "1"), 10) || 1,
        planned_start_date: get("planned_start_date", cols[10] || "2027-02-01"),
        predecessor_activity_id: get("predecessor_activity_id", cols[11] || "") || null,
      };
    });
    return { table: "activities", records: activities };
  }

  // 2. Contracts / Projects
  if (fn.includes("project") || fn.includes("contract") || rawHeaders.includes("contractor_name")) {
    const contracts: Contract[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        contract_number: get("contract_number", cols[0] || ""),
        contractor_name: get("contractor_name", cols[1] || "Contractor"),
        description: get("description", cols[2] || "Infrastructure Project"),
        line_code: get("line_code", cols[3] || "ALP"),
        priority: parseInt(get("priority", cols[4] || "2"), 10) || 2,
        max_workfronts: parseInt(get("max_workfronts", get("max_concurrent_teams", cols[5] || "3")), 10) || 3,
        max_access_per_week: parseInt(get("max_access_per_week", cols[6] || "3"), 10) || 3,
        planned_completion_date: get("planned_completion_date", cols[7] || "2027-08-31"),
      };
    });
    return { table: "contracts", records: contracts };
  }

  // 3. Lines
  if (fn.includes("line") || (rawHeaders.includes("line_code") && rawHeaders.includes("line_name"))) {
    const lines: Line[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        line_code: get("line_code", cols[0] || "ALP"),
        line_name: get("line_name", cols[1] || "Line"),
        station_count: parseInt(get("total_stations", get("station_count", cols[2] || "10")), 10) || 10,
        sector_count: 9,
        color_hex: cols[0] === "BET" ? "#10b981" : "#06b6d4",
      };
    });
    return { table: "lines", records: lines };
  }

  // 4. Stations
  if (fn.includes("station") || (rawHeaders.includes("station_id") && rawHeaders.includes("seq_order"))) {
    const stations: Station[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        station_id: get("station_id", cols[0] || ""),
        line_code: get("line_code", cols[1] || "ALP"),
        station_name: get("station_name", cols[2] || "Station"),
        seq_order: parseInt(get("seq_order", cols[3] || "1"), 10) || 1,
      };
    });
    return { table: "stations", records: stations };
  }

  // 5. Sectors
  if (fn.includes("sector") || (rawHeaders.includes("sector_id") && (rawHeaders.includes("from_station_id") || rawHeaders.includes("station_from")))) {
    const sectors: Sector[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        sector_id: get("sector_id", cols[0] || ""),
        line_code: get("line_code", cols[1] || "ALP"),
        from_station_id: get("from_station_id", get("station_from", cols[2] || "")),
        to_station_id: get("to_station_id", get("station_to", cols[3] || "")),
        length_meters: parseInt(get("length_meters", cols[4] || "1200"), 10) || 1200,
      };
    });
    return { table: "sectors", records: sectors };
  }

  // 6. Location Supply
  if (fn.includes("supply") || rawHeaders.includes("supply_capacity")) {
    const supply: LocationSupply[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        location_id: get("location_id", cols[0] || ""),
        location_type: (cols[0] || "").startsWith("PLAT") ? "PLATFORM" : "SECTOR",
        line_code: get("line_code", cols[1] || "ALP"),
        bound: (get("bound", cols[2] || "EB") as TrackBound) || "EB",
        supply_capacity: parseInt(get("supply_capacity", cols[3] || "4"), 10) || 4,
      };
    });
    return { table: "locationSupply", records: supply };
  }

  // 7. Buffer Location
  if (fn.includes("buffer") || rawHeaders.includes("buffer_sectors")) {
    const rules: BufferRule[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        nature_of_works: get("nature_of_works", cols[0] || "Live"),
        buffer_sectors: parseInt(get("buffer_sectors", cols[1] || "1"), 10) || 1,
        requires_opposite_bound: get("requires_opposite_bound", cols[2] || "false").toLowerCase() === "true",
      };
    });
    return { table: "bufferRules", records: rules };
  }

  // 8. Parameters
  if (fn.includes("parameter") || rawHeaders.includes("parameter_name") || rawHeaders.includes("parameter_value")) {
    const params: SystemParameter[] = dataRows.map((cols) => {
      const get = (idxName: string, def: string = "") => {
        const idx = rawHeaders.indexOf(idxName);
        return idx >= 0 && cols[idx] !== undefined ? cols[idx] : def;
      };
      return {
        key: get("parameter_name", get("key", cols[0] || "")),
        value: get("parameter_value", get("value", cols[1] || "")),
        data_type: get("data_type", "STRING"),
        description: get("description", cols[3] || ""),
      };
    });
    return { table: "parameters", records: params };
  }

  return { table: "unknown", records: [], error: `Could not identify table format for: ${filename}` };
}

/**
 * Generate synthetic dataset states for quick testing and stress benchmarking
 */
export function getPresetDatasetState(preset: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") {
  if (preset === "DEFAULT") {
    return {
      lines: INITIAL_LINES,
      stations: INITIAL_STATIONS,
      sectors: INITIAL_SECTORS,
      locationSupply: INITIAL_LOCATION_SUPPLY,
      bufferRules: INITIAL_BUFFER_RULES,
      parameters: INITIAL_PARAMETERS,
      contracts: INITIAL_CONTRACTS,
      activities: INITIAL_ACTIVITIES,
      datasetName: "Default Baseline (init_data/)",
    };
  }

  if (preset === "TIER_1") {
    // 3 lines (ALP, BET, GAM), 30 stations converging at H01 and H02
    const lines: Line[] = [
      ...INITIAL_LINES,
      {
        line_code: "GAM",
        line_name: "Line Gamma",
        station_count: 10,
        sector_count: 9,
        color_hex: "#a855f7",
      },
    ];

    const gamStations: Station[] = [
      { station_id: "SGA01", line_code: "GAM", station_name: "Station SGA01", seq_order: 1, is_interchange: false },
      { station_id: "SGA02", line_code: "GAM", station_name: "Station SGA02", seq_order: 2, is_interchange: false },
      { station_id: "SGA03", line_code: "GAM", station_name: "Station SGA03", seq_order: 3, is_interchange: false },
      { station_id: "SGA04", line_code: "GAM", station_name: "Station SGA04", seq_order: 4, is_interchange: false },
      { station_id: "H01", line_code: "GAM", station_name: "Central Hub 1", seq_order: 5, is_interchange: true },
      { station_id: "H02", line_code: "GAM", station_name: "Central Hub 2", seq_order: 6, is_interchange: true },
      { station_id: "SGA07", line_code: "GAM", station_name: "Station SGA07", seq_order: 7, is_interchange: false },
      { station_id: "SGA08", line_code: "GAM", station_name: "Station SGA08", seq_order: 8, is_interchange: false },
      { station_id: "SGA09", line_code: "GAM", station_name: "Station SGA09", seq_order: 9, is_interchange: false },
      { station_id: "SGA10", line_code: "GAM", station_name: "Station SGA10", seq_order: 10, is_interchange: false },
    ];

    const stations = [...INITIAL_STATIONS, ...gamStations];

    const gamSectors: Sector[] = [
      { sector_id: "SEC:GAM:SGA01_SGA02", line_code: "GAM", from_station_id: "SGA01", to_station_id: "SGA02", length_meters: 1000 },
      { sector_id: "SEC:GAM:SGA02_SGA03", line_code: "GAM", from_station_id: "SGA02", to_station_id: "SGA03", length_meters: 1000 },
      { sector_id: "SEC:GAM:SGA03_SGA04", line_code: "GAM", from_station_id: "SGA03", to_station_id: "SGA04", length_meters: 1000 },
      { sector_id: "SEC:GAM:SGA04_H01", line_code: "GAM", from_station_id: "SGA04", to_station_id: "H01", length_meters: 1000 },
      { sector_id: "SEC:GAM:H01_H02", line_code: "GAM", from_station_id: "H01", to_station_id: "H02", length_meters: 800, supply_capacity: 1 },
      { sector_id: "SEC:GAM:H02_SGA07", line_code: "GAM", from_station_id: "H02", to_station_id: "SGA07", length_meters: 1000 },
      { sector_id: "SEC:GAM:SGA07_SGA08", line_code: "GAM", from_station_id: "SGA07", to_station_id: "SGA08", length_meters: 1000 },
      { sector_id: "SEC:GAM:SGA08_SGA09", line_code: "GAM", from_station_id: "SGA08", to_station_id: "SGA09", length_meters: 1000 },
      { sector_id: "SEC:GAM:SGA09_SGA10", line_code: "GAM", from_station_id: "SGA09", to_station_id: "SGA10", length_meters: 1000 },
    ];

    const sectors = [...INITIAL_SECTORS, ...gamSectors];

    // Gamma Supply
    const gamSupply: LocationSupply[] = [];
    gamStations.forEach((st) => {
      gamSupply.push({ location_id: `STA:GAM:${st.station_id}:EB`, location_type: "PLATFORM", line_code: "GAM", bound: "EB", supply_capacity: 4 });
      gamSupply.push({ location_id: `STA:GAM:${st.station_id}:WB`, location_type: "PLATFORM", line_code: "GAM", bound: "WB", supply_capacity: 4 });
    });
    gamSectors.forEach((sec) => {
      const cap = sec.sector_id.includes("H01_H02") ? 1 : 2;
      gamSupply.push({ location_id: `${sec.sector_id}:EB`, location_type: "SECTOR", line_code: "GAM", bound: "EB", supply_capacity: cap });
      gamSupply.push({ location_id: `${sec.sector_id}:WB`, location_type: "SECTOR", line_code: "GAM", bound: "WB", supply_capacity: cap });
    });

    const contracts: Contract[] = [
      ...INITIAL_CONTRACTS,
      {
        contract_number: "C015",
        contractor_name: "Gamma Trackworks Ltd",
        description: "Gamma Tunnel Heavy Maintenance",
        line_code: "GAM",
        priority: 2,
        max_workfronts: 3,
        max_access_per_week: 3,
        planned_completion_date: "2027-08-31",
      },
      {
        contract_number: "C016",
        contractor_name: "Trans-Regional Electrics",
        description: "Overhead 750V Modernisation",
        line_code: "GAM",
        priority: 1,
        max_workfronts: 2,
        max_access_per_week: 2,
        planned_completion_date: "2027-07-15",
      },
    ];

    const extraActivities: Activity[] = [];
    for (let i = 55; i <= 80; i++) {
      const stIdx = (i - 55) % 4;
      extraActivities.push({
        activity_id: `A0${i}`,
        contract_number: i % 2 === 0 ? "C015" : "C016",
        line_code: "GAM",
        activity_type: i % 3 === 0 ? "Track Geometry" : "Traction Power Overhaul",
        priority: (i % 3) + 1,
        nature_of_works: i % 2 === 0 ? "Live" : "Non-live (Others)",
        station_from: gamStations[stIdx].station_id,
        station_to: gamStations[stIdx + 1].station_id,
        track_bound: i % 2 === 0 ? "EB" : "WB",
        total_accesses: (i % 3) + 1,
        planned_start_date: "2027-02-15",
        predecessor_activity_id: i > 60 ? `A0${i - 4}` : null,
      });
    }

    return {
      lines,
      stations,
      sectors,
      locationSupply: [...INITIAL_LOCATION_SUPPLY, ...gamSupply],
      bufferRules: INITIAL_BUFFER_RULES,
      parameters: INITIAL_PARAMETERS,
      contracts,
      activities: [...INITIAL_ACTIVITIES, ...extraActivities],
      datasetName: "Synthetic Tier 1 (3 Lines / 30 Stations / 80 Activities)",
    };
  }

  if (preset === "TIER_2") {
    // 5 lines (ALP, BET, GAM, DEL, EPS), 50 stations converging at H01 and H02
    const lines: Line[] = [
      ...INITIAL_LINES,
      { line_code: "GAM", line_name: "Line Gamma", station_count: 10, sector_count: 9, color_hex: "#a855f7" },
      { line_code: "DEL", line_name: "Line Delta", station_count: 10, sector_count: 9, color_hex: "#f59e0b" },
      { line_code: "EPS", line_name: "Line Epsilon", station_count: 10, sector_count: 9, color_hex: "#ec4899" },
    ];

    const lineDefs: Array<{ code: string; prefix: string; name: string }> = [
      { code: "GAM", prefix: "SGA", name: "Gamma" },
      { code: "DEL", prefix: "SDE", name: "Delta" },
      { code: "EPS", prefix: "SEP", name: "Epsilon" },
    ];

    let allStations = [...INITIAL_STATIONS];
    let allSectors = [...INITIAL_SECTORS];
    let allSupply = [...INITIAL_LOCATION_SUPPLY];

    lineDefs.forEach(({ code, prefix, name }) => {
      const lineStations: Station[] = [
        { station_id: `${prefix}01`, line_code: code, station_name: `Station ${prefix}01`, seq_order: 1, is_interchange: false },
        { station_id: `${prefix}02`, line_code: code, station_name: `Station ${prefix}02`, seq_order: 2, is_interchange: false },
        { station_id: `${prefix}03`, line_code: code, station_name: `Station ${prefix}03`, seq_order: 3, is_interchange: false },
        { station_id: `${prefix}04`, line_code: code, station_name: `Station ${prefix}04`, seq_order: 4, is_interchange: false },
        { station_id: "H01", line_code: code, station_name: "Central Hub 1", seq_order: 5, is_interchange: true },
        { station_id: "H02", line_code: code, station_name: "Central Hub 2", seq_order: 6, is_interchange: true },
        { station_id: `${prefix}07`, line_code: code, station_name: `Station ${prefix}07`, seq_order: 7, is_interchange: false },
        { station_id: `${prefix}08`, line_code: code, station_name: `Station ${prefix}08`, seq_order: 8, is_interchange: false },
        { station_id: `${prefix}09`, line_code: code, station_name: `Station ${prefix}09`, seq_order: 9, is_interchange: false },
        { station_id: `${prefix}10`, line_code: code, station_name: `Station ${prefix}10`, seq_order: 10, is_interchange: false },
      ];

      const lineSectors: Sector[] = [
        { sector_id: `SEC:${code}:${prefix}01_${prefix}02`, line_code: code, from_station_id: `${prefix}01`, to_station_id: `${prefix}02`, length_meters: 1000 },
        { sector_id: `SEC:${code}:${prefix}02_${prefix}03`, line_code: code, from_station_id: `${prefix}02`, to_station_id: `${prefix}03`, length_meters: 1000 },
        { sector_id: `SEC:${code}:${prefix}03_${prefix}04`, line_code: code, from_station_id: `${prefix}03`, to_station_id: `${prefix}04`, length_meters: 1000 },
        { sector_id: `SEC:${code}:${prefix}04_H01`, line_code: code, from_station_id: `${prefix}04`, to_station_id: "H01", length_meters: 1000 },
        { sector_id: `SEC:${code}:H01_H02`, line_code: code, from_station_id: "H01", to_station_id: "H02", length_meters: 800, supply_capacity: 1 },
        { sector_id: `SEC:${code}:H02_${prefix}07`, line_code: code, from_station_id: "H02", to_station_id: `${prefix}07`, length_meters: 1000 },
        { sector_id: `SEC:${code}:${prefix}07_${prefix}08`, line_code: code, from_station_id: `${prefix}07`, to_station_id: `${prefix}08`, length_meters: 1000 },
        { sector_id: `SEC:${code}:${prefix}08_${prefix}09`, line_code: code, from_station_id: `${prefix}08`, to_station_id: `${prefix}09`, length_meters: 1000 },
        { sector_id: `SEC:${code}:${prefix}09_${prefix}10`, line_code: code, from_station_id: `${prefix}09`, to_station_id: `${prefix}10`, length_meters: 1000 },
      ];

      allStations.push(...lineStations);
      allSectors.push(...lineSectors);

      lineStations.forEach((st) => {
        allSupply.push({ location_id: `STA:${code}:${st.station_id}:EB`, location_type: "PLATFORM", line_code: code, bound: "EB", supply_capacity: 4 });
        allSupply.push({ location_id: `STA:${code}:${st.station_id}:WB`, location_type: "PLATFORM", line_code: code, bound: "WB", supply_capacity: 4 });
      });
      lineSectors.forEach((sec) => {
        const cap = sec.sector_id.includes("H01_H02") ? 1 : 2;
        allSupply.push({ location_id: `${sec.sector_id}:EB`, location_type: "SECTOR", line_code: code, bound: "EB", supply_capacity: cap });
        allSupply.push({ location_id: `${sec.sector_id}:WB`, location_type: "SECTOR", line_code: code, bound: "WB", supply_capacity: cap });
      });
    });

    const contracts: Contract[] = [
      ...INITIAL_CONTRACTS,
      { contract_number: "C015", contractor_name: "Gamma Trackworks", description: "Gamma Tunnel Heavy Maintenance", line_code: "GAM", priority: 2, max_workfronts: 3, max_access_per_week: 3, planned_completion_date: "2027-08-31" },
      { contract_number: "C016", contractor_name: "Delta Infrastructure", description: "Delta Signalling Renewal", line_code: "DEL", priority: 1, max_workfronts: 2, max_access_per_week: 2, planned_completion_date: "2027-07-15" },
      { contract_number: "C017", contractor_name: "Epsilon Rail Systems", description: "Epsilon Overhead Catenary Works", line_code: "EPS", priority: 3, max_workfronts: 4, max_access_per_week: 4, planned_completion_date: "2027-09-30" },
    ];

    const extraActivities: Activity[] = [];
    for (let i = 55; i <= 100; i++) {
      const lineCode = i % 3 === 0 ? "GAM" : i % 3 === 1 ? "DEL" : "EPS";
      const cNum = i % 3 === 0 ? "C015" : i % 3 === 1 ? "C016" : "C017";
      const prefix = lineCode === "GAM" ? "SGA" : lineCode === "DEL" ? "SDE" : "SEP";
      const stIdx = ((i - 55) % 3) + 1;
      extraActivities.push({
        activity_id: `A0${i}`,
        contract_number: cNum,
        line_code: lineCode,
        activity_type: i % 2 === 0 ? "Track Geometry" : "Traction Power Overhaul",
        priority: (i % 3) + 1,
        nature_of_works: i % 2 === 0 ? "Live" : "Non-live (Others)",
        station_from: `${prefix}0${stIdx}`,
        station_to: `${prefix}0${stIdx + 1}`,
        track_bound: i % 2 === 0 ? "EB" : "WB",
        total_accesses: (i % 3) + 1,
        planned_start_date: "2027-02-15",
        predecessor_activity_id: i > 65 ? `A0${i - 5}` : null,
      });
    }

    return {
      lines,
      stations: allStations,
      sectors: allSectors,
      locationSupply: allSupply,
      bufferRules: INITIAL_BUFFER_RULES,
      parameters: INITIAL_PARAMETERS,
      contracts,
      activities: [...INITIAL_ACTIVITIES, ...extraActivities],
      datasetName: "Synthetic Tier 2 (5 Lines / 50 Stations / 100 Activities)",
    };
  }

  if (preset === "TIER_3") {
    // Fault Injected: Introduce deliberate DAG cycle A004 -> A003 -> A004
    const activitiesWithCycle = INITIAL_ACTIVITIES.map((a) => {
      if (a.activity_id === "A003") {
        return { ...a, predecessor_activity_id: "A004" }; // A004 has A003 as predecessor -> circular loop!
      }
      return a;
    });

    return {
      lines: INITIAL_LINES,
      stations: INITIAL_STATIONS,
      sectors: INITIAL_SECTORS,
      locationSupply: INITIAL_LOCATION_SUPPLY,
      bufferRules: INITIAL_BUFFER_RULES,
      parameters: INITIAL_PARAMETERS,
      contracts: INITIAL_CONTRACTS,
      activities: activitiesWithCycle,
      datasetName: "Synthetic Tier 3 (Fault Injected - DAG Cycle Active)",
    };
  }

  return {
    lines: INITIAL_LINES,
    stations: INITIAL_STATIONS,
    sectors: INITIAL_SECTORS,
    locationSupply: INITIAL_LOCATION_SUPPLY,
    bufferRules: INITIAL_BUFFER_RULES,
    parameters: INITIAL_PARAMETERS,
    contracts: INITIAL_CONTRACTS,
    activities: INITIAL_ACTIVITIES,
    datasetName: "Default Baseline (init_data/)",
  };
}
