// Initial dataset mirrored directly from init_data CSVs
import type { Line, Station, Sector, LocationSupply, BufferRule, SystemParameter, Contract, Activity } from "./types";

export const INITIAL_LINES: Line[] = [
  {
    "line_code": "ALP",
    "line_name": "Line ALP",
    "color_hex": "#06b6d4"
  },
  {
    "line_code": "BET",
    "line_name": "Line BET",
    "color_hex": "#10b981"
  }
];

export const INITIAL_STATIONS: Station[] = [
  {
    "station_id": "S01",
    "line_code": "ALP",
    "station_name": "Station S01",
    "seq_order": 1,
    "is_interchange": false
  },
  {
    "station_id": "S02",
    "line_code": "ALP",
    "station_name": "Station S02",
    "seq_order": 2,
    "is_interchange": false
  },
  {
    "station_id": "S03",
    "line_code": "ALP",
    "station_name": "Station S03",
    "seq_order": 3,
    "is_interchange": false
  },
  {
    "station_id": "S04",
    "line_code": "ALP",
    "station_name": "Station S04",
    "seq_order": 4,
    "is_interchange": false
  },
  {
    "station_id": "H01",
    "line_code": "ALP",
    "station_name": "Station H01",
    "seq_order": 5,
    "is_interchange": true
  },
  {
    "station_id": "H02",
    "line_code": "ALP",
    "station_name": "Station H02",
    "seq_order": 6,
    "is_interchange": true
  },
  {
    "station_id": "S05",
    "line_code": "ALP",
    "station_name": "Station S05",
    "seq_order": 7,
    "is_interchange": false
  },
  {
    "station_id": "S06",
    "line_code": "ALP",
    "station_name": "Station S06",
    "seq_order": 8,
    "is_interchange": false
  },
  {
    "station_id": "S07",
    "line_code": "ALP",
    "station_name": "Station S07",
    "seq_order": 9,
    "is_interchange": false
  },
  {
    "station_id": "S08",
    "line_code": "ALP",
    "station_name": "Station S08",
    "seq_order": 10,
    "is_interchange": false
  },
  {
    "station_id": "S11",
    "line_code": "BET",
    "station_name": "Station S11",
    "seq_order": 1,
    "is_interchange": false
  },
  {
    "station_id": "S12",
    "line_code": "BET",
    "station_name": "Station S12",
    "seq_order": 2,
    "is_interchange": false
  },
  {
    "station_id": "S13",
    "line_code": "BET",
    "station_name": "Station S13",
    "seq_order": 3,
    "is_interchange": false
  },
  {
    "station_id": "S14",
    "line_code": "BET",
    "station_name": "Station S14",
    "seq_order": 4,
    "is_interchange": false
  },
  {
    "station_id": "H01",
    "line_code": "BET",
    "station_name": "Station H01",
    "seq_order": 5,
    "is_interchange": true
  },
  {
    "station_id": "H02",
    "line_code": "BET",
    "station_name": "Station H02",
    "seq_order": 6,
    "is_interchange": true
  },
  {
    "station_id": "S15",
    "line_code": "BET",
    "station_name": "Station S15",
    "seq_order": 7,
    "is_interchange": false
  },
  {
    "station_id": "S16",
    "line_code": "BET",
    "station_name": "Station S16",
    "seq_order": 8,
    "is_interchange": false
  },
  {
    "station_id": "S17",
    "line_code": "BET",
    "station_name": "Station S17",
    "seq_order": 9,
    "is_interchange": false
  },
  {
    "station_id": "S18",
    "line_code": "BET",
    "station_name": "Station S18",
    "seq_order": 10,
    "is_interchange": false
  }
];

export const INITIAL_SECTORS: Sector[] = [
  {
    "sector_id": "SEC:ALP:S01_S02",
    "line_code": "ALP",
    "from_station_id": "S01",
    "to_station_id": "S02",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:ALP:S02_S03",
    "line_code": "ALP",
    "from_station_id": "S02",
    "to_station_id": "S03",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:ALP:S03_S04",
    "line_code": "ALP",
    "from_station_id": "S03",
    "to_station_id": "S04",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:ALP:S04_H01",
    "line_code": "ALP",
    "from_station_id": "S04",
    "to_station_id": "H01",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:ALP:H01_H02",
    "line_code": "ALP",
    "from_station_id": "H01",
    "to_station_id": "H02",
    "length_meters": 1000,
    "supply_capacity": 1
  },
  {
    "sector_id": "SEC:ALP:H02_S05",
    "line_code": "ALP",
    "from_station_id": "H02",
    "to_station_id": "S05",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:ALP:S05_S06",
    "line_code": "ALP",
    "from_station_id": "S05",
    "to_station_id": "S06",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:ALP:S06_S07",
    "line_code": "ALP",
    "from_station_id": "S06",
    "to_station_id": "S07",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:ALP:S07_S08",
    "line_code": "ALP",
    "from_station_id": "S07",
    "to_station_id": "S08",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:S11_S12",
    "line_code": "BET",
    "from_station_id": "S11",
    "to_station_id": "S12",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:S12_S13",
    "line_code": "BET",
    "from_station_id": "S12",
    "to_station_id": "S13",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:S13_S14",
    "line_code": "BET",
    "from_station_id": "S13",
    "to_station_id": "S14",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:S14_H01",
    "line_code": "BET",
    "from_station_id": "S14",
    "to_station_id": "H01",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:H01_H02",
    "line_code": "BET",
    "from_station_id": "H01",
    "to_station_id": "H02",
    "length_meters": 1000,
    "supply_capacity": 1
  },
  {
    "sector_id": "SEC:BET:H02_S15",
    "line_code": "BET",
    "from_station_id": "H02",
    "to_station_id": "S15",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:S15_S16",
    "line_code": "BET",
    "from_station_id": "S15",
    "to_station_id": "S16",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:S16_S17",
    "line_code": "BET",
    "from_station_id": "S16",
    "to_station_id": "S17",
    "length_meters": 1000,
    "supply_capacity": 4
  },
  {
    "sector_id": "SEC:BET:S17_S18",
    "line_code": "BET",
    "from_station_id": "S17",
    "to_station_id": "S18",
    "length_meters": 1000,
    "supply_capacity": 4
  }
];

export const INITIAL_LOCATION_SUPPLY: LocationSupply[] = [
  {
    "location_id": "SEC:ALP:S01_S02:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S01_S02:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S02_S03:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S02_S03:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S03_S04:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S03_S04:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S04_H01:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:ALP:S04_H01:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:ALP:H01_H02:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 1
  },
  {
    "location_id": "SEC:ALP:H01_H02:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 1
  },
  {
    "location_id": "SEC:ALP:H02_S05:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:ALP:H02_S05:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:ALP:S05_S06:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S05_S06:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S06_S07:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S06_S07:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S07_S08:EB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:ALP:S07_S08:WB",
    "location_type": "SECTOR",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S11_S12:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S11_S12:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S12_S13:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S12_S13:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S13_S14:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S13_S14:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S14_H01:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:BET:S14_H01:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:BET:H01_H02:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 1
  },
  {
    "location_id": "SEC:BET:H01_H02:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 1
  },
  {
    "location_id": "SEC:BET:H02_S15:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:BET:H02_S15:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "SEC:BET:S15_S16:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S15_S16:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S16_S17:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S16_S17:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S17_S18:EB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 4
  },
  {
    "location_id": "SEC:BET:S17_S18:WB",
    "location_type": "SECTOR",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 4
  },
  {
    "location_id": "PLAT:ALP:S01:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S01:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S02:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S02:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S03:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S03:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S04:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S04:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:H01:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:ALP:H01:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:ALP:H02:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:ALP:H02:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:ALP:S05:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S05:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S06:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S06:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S07:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S07:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S08:EB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:ALP:S08:WB",
    "location_type": "PLATFORM",
    "line_code": "ALP",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S11:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S11:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S12:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S12:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S13:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S13:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S14:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S14:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:H01:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:BET:H01:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:BET:H02:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:BET:H02:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 1
  },
  {
    "location_id": "PLAT:BET:S15:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S15:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S16:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S16:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S17:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S17:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S18:EB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "EB",
    "supply_capacity": 2
  },
  {
    "location_id": "PLAT:BET:S18:WB",
    "location_type": "PLATFORM",
    "line_code": "BET",
    "bound": "WB",
    "supply_capacity": 2
  }
];

export const INITIAL_BUFFER_RULES: BufferRule[] = [
  {
    "nature_of_works": "Live",
    "buffer_sectors": 2,
    "requires_opposite_bound": true
  },
  {
    "nature_of_works": "Non-live (Consist)",
    "buffer_sectors": 1,
    "requires_opposite_bound": false
  },
  {
    "nature_of_works": "Non-live (Others)",
    "buffer_sectors": 0,
    "requires_opposite_bound": false
  }
];

export const INITIAL_PARAMETERS: SystemParameter[] = [
  {
    "key": "horizon_start",
    "value": "2027-01-04",
    "data_type": "DATE",
    "description": "Calendar start date for Horizon Week 1"
  },
  {
    "key": "horizon_weeks",
    "value": "30",
    "data_type": "INTEGER",
    "description": "Operational evaluation window in weeks"
  }
];

export const INITIAL_CONTRACTS: Contract[] = [
  {
    "contract_number": "C001",
    "contractor_name": "Vendor C001",
    "description": "Renewal programme 1",
    "line_code": "ALP",
    "priority": 3,
    "max_workfronts": 2,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-06-13"
  },
  {
    "contract_number": "C002",
    "contractor_name": "Vendor C002",
    "description": "Renewal programme 2",
    "line_code": "ALP",
    "priority": 2,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-04"
  },
  {
    "contract_number": "C003",
    "contractor_name": "Vendor C003",
    "description": "Construction programme 3",
    "line_code": "ALP",
    "priority": 1,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-04"
  },
  {
    "contract_number": "C004",
    "contractor_name": "Vendor C004",
    "description": "Renewal programme 4",
    "line_code": "ALP",
    "priority": 1,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-25"
  },
  {
    "contract_number": "C005",
    "contractor_name": "Vendor C005",
    "description": "Renewal programme 5",
    "line_code": "ALP",
    "priority": 3,
    "max_workfronts": 2,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-03-21"
  },
  {
    "contract_number": "C006",
    "contractor_name": "Vendor C006",
    "description": "Construction programme 6",
    "line_code": "ALP",
    "priority": 3,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-04"
  },
  {
    "contract_number": "C007",
    "contractor_name": "Vendor C007",
    "description": "Renewal programme 7",
    "line_code": "ALP",
    "priority": 1,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-11"
  },
  {
    "contract_number": "C008",
    "contractor_name": "Vendor C008",
    "description": "Renewal programme 8",
    "line_code": "BET",
    "priority": 3,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-18"
  },
  {
    "contract_number": "C009",
    "contractor_name": "Vendor C009",
    "description": "Construction programme 9",
    "line_code": "BET",
    "priority": 3,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-06-27"
  },
  {
    "contract_number": "C010",
    "contractor_name": "Vendor C010",
    "description": "Construction programme 10",
    "line_code": "BET",
    "priority": 3,
    "max_workfronts": 2,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-05-16"
  },
  {
    "contract_number": "C011",
    "contractor_name": "Vendor C011",
    "description": "Renewal programme 11",
    "line_code": "BET",
    "priority": 2,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-11"
  },
  {
    "contract_number": "C012",
    "contractor_name": "Vendor C012",
    "description": "Construction programme 12",
    "line_code": "BET",
    "priority": 1,
    "max_workfronts": 1,
    "max_access_per_week": 3,
    "planned_completion_date": "2027-07-11"
  },
  {
    "contract_number": "C013",
    "contractor_name": "Vendor C013",
    "description": "Live-rail renewal programme 13",
    "line_code": "BET",
    "priority": 2,
    "max_workfronts": 1,
    "max_access_per_week": 2,
    "planned_completion_date": "2027-05-30"
  },
  {
    "contract_number": "C014",
    "contractor_name": "Vendor C014",
    "description": "Live-rail construction programme 14",
    "line_code": "BET",
    "priority": 3,
    "max_workfronts": 1,
    "max_access_per_week": 2,
    "planned_completion_date": "2027-07-18"
  }
];

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    "activity_id": "A001",
    "contract_number": "C001",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S15",
    "station_to": "S17",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-05-24",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A002",
    "contract_number": "C001",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S11",
    "station_to": "S13",
    "track_bound": "WB",
    "total_accesses": 1,
    "planned_start_date": "2027-01-04",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A003",
    "contract_number": "C001",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "H01",
    "station_to": "S16",
    "track_bound": "EB",
    "total_accesses": 5,
    "planned_start_date": "2027-03-15",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A004",
    "contract_number": "C001",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S03",
    "station_to": "H01",
    "track_bound": "EB",
    "total_accesses": 3,
    "planned_start_date": "2027-04-12",
    "predecessor_activity_id": "A003"
  },
  {
    "activity_id": "A006",
    "contract_number": "C001",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S03",
    "station_to": "H02",
    "track_bound": "WB",
    "total_accesses": 2,
    "planned_start_date": "2027-01-11",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A007",
    "contract_number": "C001",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "H01",
    "station_to": "H02",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-04-12",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A008",
    "contract_number": "C002",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S17",
    "station_to": "S18",
    "track_bound": "EB",
    "total_accesses": 5,
    "planned_start_date": "2027-04-19",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A009",
    "contract_number": "C002",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S05",
    "station_to": "S06",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-01-11",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A011",
    "contract_number": "C002",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S15",
    "station_to": "S17",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-04-12",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A012",
    "contract_number": "C002",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "H01",
    "station_to": "S15",
    "track_bound": "WB",
    "total_accesses": 7,
    "planned_start_date": "2027-01-11",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A013",
    "contract_number": "C002",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S05",
    "station_to": "S06",
    "track_bound": "WB",
    "total_accesses": 5,
    "planned_start_date": "2027-05-24",
    "predecessor_activity_id": "A012"
  },
  {
    "activity_id": "A014",
    "contract_number": "C003",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S07",
    "station_to": "S08",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-03-29",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A017",
    "contract_number": "C003",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 2,
    "nature_of_works": "Non-live (Others)",
    "station_from": "H01",
    "station_to": "S16",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-04-26",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A019",
    "contract_number": "C003",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S16",
    "station_to": "S17",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-03-15",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A020",
    "contract_number": "C003",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 2,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S04",
    "station_to": "S05",
    "track_bound": "WB",
    "total_accesses": 2,
    "planned_start_date": "2027-03-29",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A021",
    "contract_number": "C004",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S11",
    "station_to": "S13",
    "track_bound": "WB",
    "total_accesses": 3,
    "planned_start_date": "2027-01-18",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A023",
    "contract_number": "C004",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S03",
    "station_to": "S04",
    "track_bound": "WB",
    "total_accesses": 7,
    "planned_start_date": "2027-05-24",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A025",
    "contract_number": "C004",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S01",
    "station_to": "S03",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-02-22",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A028",
    "contract_number": "C005",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S03",
    "station_to": "H01",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-03-01",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A031",
    "contract_number": "C005",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S06",
    "station_to": "S08",
    "track_bound": "WB",
    "total_accesses": 2,
    "planned_start_date": "2027-01-04",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A035",
    "contract_number": "C006",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 1,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S02",
    "station_to": "S04",
    "track_bound": "WB",
    "total_accesses": 3,
    "planned_start_date": "2027-01-04",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A036",
    "contract_number": "C006",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 1,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S14",
    "station_to": "H01",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-05-31",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A037",
    "contract_number": "C006",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 1,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S15",
    "station_to": "S17",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-02-22",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A038",
    "contract_number": "C006",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S17",
    "station_to": "S18",
    "track_bound": "EB",
    "total_accesses": 3,
    "planned_start_date": "2027-01-18",
    "predecessor_activity_id": "A037"
  },
  {
    "activity_id": "A039",
    "contract_number": "C006",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 2,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S11",
    "station_to": "S14",
    "track_bound": "WB",
    "total_accesses": 7,
    "planned_start_date": "2027-02-22",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A040",
    "contract_number": "C007",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "H01",
    "station_to": "S16",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-03-29",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A041",
    "contract_number": "C007",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S15",
    "station_to": "S16",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-03-15",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A042",
    "contract_number": "C007",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S15",
    "station_to": "S18",
    "track_bound": "EB",
    "total_accesses": 3,
    "planned_start_date": "2027-06-07",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A043",
    "contract_number": "C007",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "H02",
    "station_to": "S17",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-03-29",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A046",
    "contract_number": "C007",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S05",
    "station_to": "S06",
    "track_bound": "WB",
    "total_accesses": 5,
    "planned_start_date": "2027-03-01",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A047",
    "contract_number": "C008",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "H02",
    "station_to": "S06",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-03-29",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A048",
    "contract_number": "C008",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S13",
    "station_to": "S14",
    "track_bound": "EB",
    "total_accesses": 3,
    "planned_start_date": "2027-01-04",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A049",
    "contract_number": "C008",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "H02",
    "station_to": "S16",
    "track_bound": "WB",
    "total_accesses": 5,
    "planned_start_date": "2027-02-22",
    "predecessor_activity_id": "A048"
  },
  {
    "activity_id": "A050",
    "contract_number": "C008",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S03",
    "station_to": "H01",
    "track_bound": "WB",
    "total_accesses": 2,
    "planned_start_date": "2027-04-26",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A051",
    "contract_number": "C008",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S17",
    "station_to": "S18",
    "track_bound": "WB",
    "total_accesses": 2,
    "planned_start_date": "2027-06-28",
    "predecessor_activity_id": "A050"
  },
  {
    "activity_id": "A054",
    "contract_number": "C009",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 2,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S04",
    "station_to": "S05",
    "track_bound": "EB",
    "total_accesses": 2,
    "planned_start_date": "2027-04-26",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A055",
    "contract_number": "C009",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 1,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S13",
    "station_to": "H02",
    "track_bound": "EB",
    "total_accesses": 1,
    "planned_start_date": "2027-04-19",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A056",
    "contract_number": "C009",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 2,
    "nature_of_works": "Non-live (Others)",
    "station_from": "H02",
    "station_to": "S07",
    "track_bound": "WB",
    "total_accesses": 2,
    "planned_start_date": "2027-05-03",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A057",
    "contract_number": "C009",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "H02",
    "station_to": "S16",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-04-12",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A058",
    "contract_number": "C010",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S03",
    "station_to": "H02",
    "track_bound": "WB",
    "total_accesses": 7,
    "planned_start_date": "2027-01-11",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A059",
    "contract_number": "C010",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S06",
    "station_to": "S08",
    "track_bound": "WB",
    "total_accesses": 7,
    "planned_start_date": "2027-04-05",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A060",
    "contract_number": "C010",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 2,
    "nature_of_works": "Non-live (Others)",
    "station_from": "H02",
    "station_to": "S16",
    "track_bound": "EB",
    "total_accesses": 3,
    "planned_start_date": "2027-03-29",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A061",
    "contract_number": "C010",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 1,
    "nature_of_works": "Non-live (Others)",
    "station_from": "H01",
    "station_to": "S15",
    "track_bound": "EB",
    "total_accesses": 7,
    "planned_start_date": "2027-01-25",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A063",
    "contract_number": "C010",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S14",
    "station_to": "H02",
    "track_bound": "EB",
    "total_accesses": 1,
    "planned_start_date": "2027-02-01",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A064",
    "contract_number": "C010",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S15",
    "station_to": "S16",
    "track_bound": "WB",
    "total_accesses": 1,
    "planned_start_date": "2027-04-19",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A065",
    "contract_number": "C011",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S12",
    "station_to": "S13",
    "track_bound": "WB",
    "total_accesses": 1,
    "planned_start_date": "2027-05-10",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A066",
    "contract_number": "C011",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 3,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S02",
    "station_to": "H01",
    "track_bound": "WB",
    "total_accesses": 1,
    "planned_start_date": "2027-06-21",
    "predecessor_activity_id": "A065"
  },
  {
    "activity_id": "A069",
    "contract_number": "C011",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S03",
    "station_to": "H02",
    "track_bound": "WB",
    "total_accesses": 2,
    "planned_start_date": "2027-03-01",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A070",
    "contract_number": "C011",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S03",
    "station_to": "H01",
    "track_bound": "WB",
    "total_accesses": 5,
    "planned_start_date": "2027-03-15",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A071",
    "contract_number": "C011",
    "line_code": "BET",
    "activity_type": "Renewal",
    "priority": 1,
    "nature_of_works": "Non-live (Consist)",
    "station_from": "S15",
    "station_to": "S17",
    "track_bound": "EB",
    "total_accesses": 1,
    "planned_start_date": "2027-04-12",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A072",
    "contract_number": "C012",
    "line_code": "ALP",
    "activity_type": "Construction",
    "priority": 2,
    "nature_of_works": "Non-live (Others)",
    "station_from": "S04",
    "station_to": "H02",
    "track_bound": "EB",
    "total_accesses": 1,
    "planned_start_date": "2027-06-07",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A073",
    "contract_number": "C012",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Non-live (Others)",
    "station_from": "H01",
    "station_to": "S15",
    "track_bound": "EB",
    "total_accesses": 1,
    "planned_start_date": "2027-05-31",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A074",
    "contract_number": "C013",
    "line_code": "ALP",
    "activity_type": "Renewal",
    "priority": 2,
    "nature_of_works": "Live",
    "station_from": "H01",
    "station_to": "H02",
    "track_bound": "EB",
    "total_accesses": 1,
    "planned_start_date": "2027-05-10",
    "predecessor_activity_id": null
  },
  {
    "activity_id": "A075",
    "contract_number": "C014",
    "line_code": "BET",
    "activity_type": "Construction",
    "priority": 3,
    "nature_of_works": "Live",
    "station_from": "H01",
    "station_to": "H02",
    "track_bound": "WB",
    "total_accesses": 1,
    "planned_start_date": "2027-06-14",
    "predecessor_activity_id": null
  }
];
