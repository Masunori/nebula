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

  const rawHeaders = rows[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, ""));
  const dataRows = rows.slice(1).filter((r) => r.length > 0 && r.some((c) => c.trim() !== ""));
  const fn = filename.toLowerCase();

  const getCol = (cols: string[], ...fieldNames: string[]): string => {
    for (const name of fieldNames) {
      const clean = name.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const idx = rawHeaders.indexOf(clean);
      if (idx >= 0 && cols[idx] !== undefined && cols[idx].trim() !== "") {
        return cols[idx].trim();
      }
    }
    return "";
  };

  // 1. Activities (08_ACTIVITY_DETAILS.csv)
  if (
    fn.includes("activity") ||
    rawHeaders.includes("activity_id") ||
    rawHeaders.includes("predecessor_activity_id")
  ) {
    const activities: Activity[] = dataRows.map((cols) => {
      const aid = getCol(cols, "activity_id") || cols[0] || "";
      const cnum = getCol(cols, "contract_number") || cols[1] || "C001";
      const atype = getCol(cols, "activity_type") || (cols.length > 2 && cols[2].includes(" ") ? cols[2] : "Renewal");

      let startLoc = getCol(cols, "start_location_id");
      let endLoc = getCol(cols, "end_location_id");

      // Positional fallback if headers not present
      if (!startLoc && cols[3] && (cols[3].includes(":") || cols[3].startsWith("S"))) {
        startLoc = cols[3];
      }
      if (!endLoc && cols[4] && (cols[4].includes(":") || cols[4].startsWith("S"))) {
        endLoc = cols[4];
      }

      // Deconstruct location (SEC:LINE:STATIONFROM_STATIONTO:BOUND or PLAT:LINE:STATION:BOUND)
      let derivedLine = "ALP";
      let derivedBound: TrackBound = "EB";
      let derivedFrom = "S01";
      let derivedTo = "S02";

      if (startLoc) {
        const parts = startLoc.split(":");
        if (parts.length >= 4) {
          derivedLine = parts[1];
          const stParts = parts[2].split("_");
          derivedFrom = stParts[0];
          derivedTo = stParts.length > 1 ? stParts[1] : stParts[0];
          derivedBound = (parts[3].toUpperCase() as TrackBound) || "EB";
        }
      }

      const lcode = getCol(cols, "line_code") || derivedLine;
      const stFrom = getCol(cols, "station_from") || derivedFrom;
      const stTo = getCol(cols, "station_to") || derivedTo;
      const bound = (getCol(cols, "track_bound", "bound") || derivedBound).toUpperCase() as TrackBound;

      const totAcc = parseInt(getCol(cols, "total_accesses", "total_access") || "1", 10) || 1;
      const pStart = getCol(cols, "planned_start_date") || "2027-01-04";
      const pred = getCol(cols, "predecessor_activity_id", "predecessor_id") || null;
      const prio = parseInt(getCol(cols, "activity_priority", "priority") || "2", 10) || 2;
      const nature = getCol(cols, "nature_of_works", "nature_of_activity") || "Non-live (Others)";

      return {
        activity_id: aid,
        contract_number: cnum,
        line_code: lcode,
        activity_type: atype,
        priority: prio,
        activity_priority: prio,
        nature_of_works: nature,
        station_from: stFrom,
        station_to: stTo,
        track_bound: bound,
        total_accesses: totAcc,
        planned_start_date: pStart,
        predecessor_activity_id: pred && pred !== "null" && pred !== "none" ? pred : null,
        start_location_id: startLoc || `SEC:${lcode}:${stFrom}_${stTo}:${bound}`,
        end_location_id: endLoc || startLoc || `SEC:${lcode}:${stFrom}_${stTo}:${bound}`,
      };
    });
    return { table: "activities", records: activities };
  }

  // 2. Contracts / Projects (07_PROJECT_DETAILS.csv)
  if (
    fn.includes("project") ||
    fn.includes("contract") ||
    rawHeaders.includes("contract_number") ||
    rawHeaders.includes("contractor_name") ||
    rawHeaders.includes("contract_description")
  ) {
    const contracts: Contract[] = dataRows.map((cols) => {
      const cnum = getCol(cols, "contract_number") || cols[0] || "";
      const cdesc = getCol(cols, "contract_description", "description") || cols[1] || `Contract ${cnum}`;
      const caward = getCol(cols, "contract_award_date") || "2026-01-01";
      const atype = getCol(cols, "activity_type") || "Renewal";
      const nature = getCol(cols, "nature_of_activity", "nature_of_works") || "Non-live (Consist)";
      const prio = parseInt(getCol(cols, "contract_priority", "priority") || "2", 10) || 2;
      const ccomp = getCol(cols, "contract_completion_date") || "2027-08-31";
      const pcomp = getCol(cols, "planned_completion_date") || ccomp;
      const wfronts = Math.max(1, parseInt(getCol(cols, "number_of_workfronts", "max_workfronts") || "2", 10) || 2);
      const accType = (getCol(cols, "access_type") || "C").toUpperCase();

      let maxAcc = parseInt(getCol(cols, "number_of_maximum_access_per_week", "max_access_per_week") || "3", 10) || 3;
      if (maxAcc > 7 || maxAcc < 1) maxAcc = 3;

      const lcode = getCol(cols, "line_code") || "ALP";

      return {
        contract_number: cnum,
        contractor_name: cdesc,
        description: cdesc,
        contract_description: cdesc,
        contract_award_date: caward,
        line_code: lcode,
        priority: prio,
        contract_priority: prio,
        max_workfronts: wfronts,
        number_of_workfronts: wfronts,
        max_access_per_week: maxAcc,
        number_of_maximum_access_per_week: maxAcc,
        planned_completion_date: pcomp,
        contract_completion_date: ccomp,
        activity_type: atype,
        nature_of_activity: nature,
        access_type: accType,
      };
    });
    return { table: "contracts", records: contracts };
  }

  // 3. Lines (01_LINES.csv)
  if (fn.includes("line") || (rawHeaders.includes("line_code") && rawHeaders.includes("line_name"))) {
    const lines: Line[] = dataRows.map((cols) => {
      const lcode = getCol(cols, "line_code") || cols[0] || "ALP";
      const lname = getCol(cols, "line_name") || cols[1] || `Line ${lcode}`;
      const stCount = parseInt(getCol(cols, "station_count", "total_stations") || "10", 10) || 10;
      return {
        line_code: lcode,
        line_name: lname,
        station_count: stCount,
        sector_count: Math.max(1, stCount - 1),
        color_hex: lcode === "BET" ? "#10b981" : "#06b6d4",
      };
    });
    return { table: "lines", records: lines };
  }

  // 4. Stations (02_STATIONS.csv)
  if (
    fn.includes("station") ||
    (rawHeaders.includes("station_id") && (rawHeaders.includes("seq") || rawHeaders.includes("seq_order")))
  ) {
    const stations: Station[] = dataRows.map((cols) => {
      const sid = getCol(cols, "station_id") || cols[0] || "";
      const lcode = getCol(cols, "line_code") || cols[1] || "ALP";
      const seq = parseInt(getCol(cols, "seq", "seq_order") || "1", 10) || 1;
      const icRaw = getCol(cols, "is_interchange");
      const isInterchange = icRaw === "1" || icRaw.toLowerCase() === "true";
      const sname = getCol(cols, "station_name") || `Station ${sid}`;
      return {
        station_id: sid,
        line_code: lcode,
        station_name: sname,
        seq_order: seq,
        seq: seq,
        is_interchange: isInterchange,
      };
    });
    return { table: "stations", records: stations };
  }

  // 5. Sectors (03_SECTORS.csv)
  if (
    fn.includes("sector") ||
    (rawHeaders.includes("sector_id") && (rawHeaders.includes("from_station_id") || rawHeaders.includes("station_from")))
  ) {
    const sectors: Sector[] = dataRows.map((cols) => {
      const secId = getCol(cols, "sector_id") || cols[0] || "";
      const lcode = getCol(cols, "line_code") || cols[1] || "ALP";
      const fromSt = getCol(cols, "from_station_id", "station_from") || "";
      const toSt = getCol(cols, "to_station_id", "station_to") || "";
      const seq = parseInt(getCol(cols, "seq", "seq_order") || "1", 10) || 1;
      const len = parseInt(getCol(cols, "length_meters") || "1000", 10) || 1000;
      const shRaw = getCol(cols, "is_shared");
      const isShared = shRaw === "1" || shRaw.toLowerCase() === "true";
      return {
        sector_id: secId,
        line_code: lcode,
        from_station_id: fromSt,
        to_station_id: toSt,
        seq_order: seq,
        seq: seq,
        length_meters: len,
        is_shared: isShared,
      };
    });
    return { table: "sectors", records: sectors };
  }

  // 6. Location Supply (04_LOCATION_SUPPLY.csv)
  if (fn.includes("supply") || rawHeaders.includes("supply_capacity")) {
    const supply: LocationSupply[] = dataRows.map((cols) => {
      const locId = getCol(cols, "location_id") || cols[0] || "";
      const kind = getCol(cols, "location_kind", "location_type") || (locId.startsWith("PLAT") ? "PLATFORM" : "SECTOR");
      const lcode = getCol(cols, "line_code") || (locId.includes(":") ? locId.split(":")[1] : "ALP");
      const bound = (getCol(cols, "bound", "track_bound") || (locId.includes(":") ? locId.split(":").pop() : "EB") || "EB").toUpperCase() as TrackBound;
      const cap = parseInt(getCol(cols, "supply_capacity") || "2", 10) || 2;
      return {
        location_id: locId,
        location_kind: kind,
        location_type: kind.toUpperCase().includes("PLAT") ? "PLATFORM" : "SECTOR",
        line_code: lcode,
        bound: bound,
        supply_capacity: cap,
      };
    });
    return { table: "location_supply", records: supply };
  }

  // 7. Buffer Location (05_BUFFER_LOCATION.csv)
  if (fn.includes("buffer") || rawHeaders.includes("buffer_sectors") || rawHeaders.includes("up_to_buffer_sectors")) {
    const rules: BufferRule[] = dataRows.map((cols) => {
      const nature = getCol(cols, "nature_of_works") || cols[0] || "Live";
      const bufSecs = parseInt(getCol(cols, "up_to_buffer_sectors", "buffer_sectors") || "0", 10) || 0;
      const oppRaw = getCol(cols, "opposite_bound_required", "requires_opposite_bound");
      const opp = oppRaw === "1" || oppRaw.toLowerCase() === "true";
      return {
        nature_of_works: nature,
        buffer_sectors: bufSecs,
        up_to_buffer_sectors: bufSecs,
        requires_opposite_bound: opp,
        opposite_bound_required: opp,
      };
    });
    return { table: "buffer_rules", records: rules };
  }

  // 8. Parameters (06_PARAMETERS.csv)
  if (fn.includes("parameter") || rawHeaders.includes("param_key") || rawHeaders.includes("key")) {
    const params: SystemParameter[] = dataRows.map((cols) => {
      const k = getCol(cols, "key", "param_key", "parameter_name") || cols[0] || "";
      const v = getCol(cols, "value", "param_value", "parameter_value") || cols[1] || "";
      const desc = getCol(cols, "description") || "";
      return {
        key: k,
        param_key: k,
        value: v,
        param_value: v,
        data_type: "STRING",
        description: desc,
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
      { sector_id: "SEC:GAM:SGA01_SGA02", line_code: "GAM", from_station_id: "SGA01", to_station_id: "SGA02", length_meters: 1000, seq_order: 1 },
      { sector_id: "SEC:GAM:SGA02_SGA03", line_code: "GAM", from_station_id: "SGA02", to_station_id: "SGA03", length_meters: 1000, seq_order: 2 },
      { sector_id: "SEC:GAM:SGA03_SGA04", line_code: "GAM", from_station_id: "SGA03", to_station_id: "SGA04", length_meters: 1000, seq_order: 3 },
      { sector_id: "SEC:GAM:SGA04_H01", line_code: "GAM", from_station_id: "SGA04", to_station_id: "H01", length_meters: 1000, seq_order: 4 },
      { sector_id: "SEC:GAM:H01_H02", line_code: "GAM", from_station_id: "H01", to_station_id: "H02", length_meters: 800, supply_capacity: 1, seq_order: 5 },
      { sector_id: "SEC:GAM:H02_SGA07", line_code: "GAM", from_station_id: "H02", to_station_id: "SGA07", length_meters: 1000, seq_order: 6 },
      { sector_id: "SEC:GAM:SGA07_SGA08", line_code: "GAM", from_station_id: "SGA07", to_station_id: "SGA08", length_meters: 1000, seq_order: 7 },
      { sector_id: "SEC:GAM:SGA08_SGA09", line_code: "GAM", from_station_id: "SGA08", to_station_id: "SGA09", length_meters: 1000, seq_order: 8 },
      { sector_id: "SEC:GAM:SGA09_SGA10", line_code: "GAM", from_station_id: "SGA09", to_station_id: "SGA10", length_meters: 1000, seq_order: 9 },
    ];

    const sectors = [...INITIAL_SECTORS, ...gamSectors];

    // Gamma Supply
    const gamSupply: LocationSupply[] = [];
    gamStations.forEach((st) => {
      gamSupply.push({ location_id: `PLAT:GAM:${st.station_id}:EB`, location_type: "PLATFORM", line_code: "GAM", bound: "EB", supply_capacity: 4 });
      gamSupply.push({ location_id: `PLAT:GAM:${st.station_id}:WB`, location_type: "PLATFORM", line_code: "GAM", bound: "WB", supply_capacity: 4 });
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
        activity_type: "Renewal",
        nature_of_activity: "Non-live (Consist)",
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
        activity_type: "Construction",
        nature_of_activity: "Non-live (Others)",
      },
    ];

    const extraActivities: Activity[] = [];
    for (let i = 101; i <= 126; i++) {
      const stIdx = (i - 101) % 4;
      const isC015 = i % 2 === 0;
      extraActivities.push({
        activity_id: `A${i}`,
        contract_number: isC015 ? "C015" : "C016",
        line_code: "GAM",
        activity_type: isC015 ? "Renewal" : "Construction",
        priority: (i % 3) + 1,
        nature_of_works: isC015 ? "Non-live (Consist)" : "Non-live (Others)",
        station_from: gamStations[stIdx].station_id,
        station_to: gamStations[stIdx + 1].station_id,
        track_bound: i % 2 === 0 ? "EB" : "WB",
        total_accesses: (i % 3) + 1,
        planned_start_date: "2027-02-15",
        predecessor_activity_id: i > 105 ? `A${i - 4}` : null,
        start_location_id: `SEC:GAM:${gamStations[stIdx].station_id}_${gamStations[stIdx + 1].station_id}:${i % 2 === 0 ? "EB" : "WB"}`,
        end_location_id: `SEC:GAM:${gamStations[stIdx].station_id}_${gamStations[stIdx + 1].station_id}:${i % 2 === 0 ? "EB" : "WB"}`,
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
        { sector_id: `SEC:${code}:${prefix}01_${prefix}02`, line_code: code, from_station_id: `${prefix}01`, to_station_id: `${prefix}02`, length_meters: 1000, seq_order: 1 },
        { sector_id: `SEC:${code}:${prefix}02_${prefix}03`, line_code: code, from_station_id: `${prefix}02`, to_station_id: `${prefix}03`, length_meters: 1000, seq_order: 2 },
        { sector_id: `SEC:${code}:${prefix}03_${prefix}04`, line_code: code, from_station_id: `${prefix}03`, to_station_id: `${prefix}04`, length_meters: 1000, seq_order: 3 },
        { sector_id: `SEC:${code}:${prefix}04_H01`, line_code: code, from_station_id: `${prefix}04`, to_station_id: "H01", length_meters: 1000, seq_order: 4 },
        { sector_id: `SEC:${code}:H01_H02`, line_code: code, from_station_id: "H01", to_station_id: "H02", length_meters: 800, supply_capacity: 1, seq_order: 5 },
        { sector_id: `SEC:${code}:H02_${prefix}07`, line_code: code, from_station_id: "H02", to_station_id: `${prefix}07`, length_meters: 1000, seq_order: 6 },
        { sector_id: `SEC:${code}:${prefix}07_${prefix}08`, line_code: code, from_station_id: `${prefix}07`, to_station_id: `${prefix}08`, length_meters: 1000, seq_order: 7 },
        { sector_id: `SEC:${code}:${prefix}08_${prefix}09`, line_code: code, from_station_id: `${prefix}08`, to_station_id: `${prefix}09`, length_meters: 1000, seq_order: 8 },
        { sector_id: `SEC:${code}:${prefix}09_${prefix}10`, line_code: code, from_station_id: `${prefix}09`, to_station_id: `${prefix}10`, length_meters: 1000, seq_order: 9 },
      ];

      allStations.push(...lineStations);
      allSectors.push(...lineSectors);

      lineStations.forEach((st) => {
        allSupply.push({ location_id: `PLAT:${code}:${st.station_id}:EB`, location_type: "PLATFORM", line_code: code, bound: "EB", supply_capacity: 4 });
        allSupply.push({ location_id: `PLAT:${code}:${st.station_id}:WB`, location_type: "PLATFORM", line_code: code, bound: "WB", supply_capacity: 4 });
      });
      lineSectors.forEach((sec) => {
        const cap = sec.sector_id.includes("H01_H02") ? 1 : 2;
        allSupply.push({ location_id: `${sec.sector_id}:EB`, location_type: "SECTOR", line_code: code, bound: "EB", supply_capacity: cap });
        allSupply.push({ location_id: `${sec.sector_id}:WB`, location_type: "SECTOR", line_code: code, bound: "WB", supply_capacity: cap });
      });
    });

    const contracts: Contract[] = [
      ...INITIAL_CONTRACTS,
      {
        contract_number: "C015",
        contractor_name: "Gamma Trackworks",
        description: "Gamma Tunnel Heavy Maintenance",
        line_code: "GAM",
        priority: 2,
        max_workfronts: 3,
        max_access_per_week: 3,
        planned_completion_date: "2027-08-31",
        activity_type: "Renewal",
        nature_of_activity: "Non-live (Consist)",
      },
      {
        contract_number: "C016",
        contractor_name: "Delta Infrastructure",
        description: "Delta Signalling Renewal",
        line_code: "DEL",
        priority: 1,
        max_workfronts: 2,
        max_access_per_week: 2,
        planned_completion_date: "2027-07-15",
        activity_type: "Construction",
        nature_of_activity: "Non-live (Others)",
      },
      {
        contract_number: "C017",
        contractor_name: "Epsilon Rail Systems",
        description: "Epsilon Overhead Catenary Works",
        line_code: "EPS",
        priority: 3,
        max_workfronts: 4,
        max_access_per_week: 4,
        planned_completion_date: "2027-09-30",
        activity_type: "Renewal",
        nature_of_activity: "Non-live (Consist)",
      },
    ];

    const extraActivities: Activity[] = [];
    for (let i = 101; i <= 146; i++) {
      const lineCode = i % 3 === 0 ? "GAM" : i % 3 === 1 ? "DEL" : "EPS";
      const cNum = i % 3 === 0 ? "C015" : i % 3 === 1 ? "C016" : "C017";
      const actType = cNum === "C016" ? "Construction" : "Renewal";
      const nature = cNum === "C016" ? "Non-live (Others)" : "Non-live (Consist)";
      const prefix = lineCode === "GAM" ? "SGA" : lineCode === "DEL" ? "SDE" : "SEP";
      const stIdx = ((i - 101) % 3) + 1;
      extraActivities.push({
        activity_id: `A${i}`,
        contract_number: cNum,
        line_code: lineCode,
        activity_type: actType,
        priority: (i % 3) + 1,
        nature_of_works: nature,
        station_from: `${prefix}0${stIdx}`,
        station_to: `${prefix}0${stIdx + 1}`,
        track_bound: i % 2 === 0 ? "EB" : "WB",
        total_accesses: (i % 3) + 1,
        planned_start_date: "2027-02-15",
        predecessor_activity_id: i > 105 ? `A${i - 5}` : null,
        start_location_id: `SEC:${lineCode}:${prefix}0${stIdx}_${prefix}0${stIdx + 1}:${i % 2 === 0 ? "EB" : "WB"}`,
        end_location_id: `SEC:${lineCode}:${prefix}0${stIdx}_${prefix}0${stIdx + 1}:${i % 2 === 0 ? "EB" : "WB"}`,
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
