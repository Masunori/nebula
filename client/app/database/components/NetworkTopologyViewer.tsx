"use client";

import React, { useState } from "react";
import { Train, ShieldCheck, AlertCircle, Info, Filter } from "lucide-react";
import type { Line, Station, Sector, LocationSupply, TrackBound } from "@/lib/types";

interface NetworkTopologyViewerProps {
  lines: Line[];
  stations: Station[];
  sectors: Sector[];
  locationSupply: LocationSupply[];
  selectedBound: TrackBound;
  interchangeHubs: string[];
  onSelectSector?: (sectorId: string) => void;
}

export function NetworkTopologyViewer({
  lines,
  stations,
  sectors,
  locationSupply,
  selectedBound,
  interchangeHubs,
  onSelectSector,
}: NetworkTopologyViewerProps) {
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Group stations by line
  const lineStationsMap = new Map<string, Station[]>();
  lines.forEach((l) => {
    lineStationsMap.set(
      l.line_code,
      stations
        .filter((s) => s.line_code === l.line_code)
        .sort((a, b) => a.seq_order - b.seq_order)
    );
  });

  // Map sector capacities
  const getSectorCapacity = (secId: string, bound: TrackBound) => {
    const locId = `${secId}:${bound}`;
    const entry = locationSupply.find((ls) => ls.location_id === locId);
    return entry ? entry.supply_capacity : secId.includes("H01_H02") ? 1 : 4;
  };

  const getPlatformCapacity = (stId: string, lineCode: string, bound: TrackBound) => {
    const locId = `PLAT:${lineCode}:${stId}:${bound}`;
    const entry = locationSupply.find((ls) => ls.location_id === locId);
    return entry ? entry.supply_capacity : 2;
  };

  return (
    <div className="space-y-4">
      {/* Schematic Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Train className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Physical Railway Track Schematic & Supply</h2>
            <p className="text-xs text-slate-400">
              Interactive multi-line topology displaying static track capacities (Cap) independent of schedules
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-500/20 border border-cyan-400"></span>
            <span>Station Platform (Cap 2)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500/30 border border-purple-400"></span>
            <span>Interchange Hub ★</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 bg-emerald-500 rounded"></span>
            <span>Double Track (Cap 4)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 bg-rose-500 rounded"></span>
            <span>Bottleneck (Cap 1)</span>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-Line Stacked Schematic Container */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 overflow-x-auto space-y-8">
        {lines.map((line) => {
          const lineSts = lineStationsMap.get(line.line_code) || [];
          const isAlpha = line.line_code === "ALP";
          const lineColor = isAlpha ? "#06b6d4" : "#10b981";

          return (
            <div key={line.line_code} className="space-y-3 min-w-[760px]">
              {/* Line Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: lineColor }}
                  ></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {line.line_name} ({line.line_code})
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                    {lineSts.length} Stations &middot; {lineSts.length - 1} Tunnel Sectors
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                  <span>Track Direction:</span>
                  <span className="text-amber-400 font-semibold">
                    {selectedBound === "EB" ? "S01 → S10 [Eastbound]" : "S10 → S01 [Westbound]"}
                  </span>
                </div>
              </div>

              {/* Stacked Track Layout: Stations & Sectors */}
              <div className="flex items-center relative py-4">
                {lineSts.map((station, idx) => {
                  const isInterchange = interchangeHubs.includes(station.station_id);
                  const platCap = getPlatformCapacity(station.station_id, line.line_code, selectedBound);
                  const isLast = idx === lineSts.length - 1;
                  const nextStation = isLast ? null : lineSts[idx + 1];

                  // Corresponding Sector
                  let sectorId = "";
                  let secCap = 4;
                  if (nextStation) {
                    sectorId = `SEC:${line.line_code}:${station.station_id}_${nextStation.station_id}`;
                    secCap = getSectorCapacity(sectorId, selectedBound);
                  }

                  return (
                    <React.Fragment key={station.station_id}>
                      {/* Station Node */}
                      <div
                        className="flex flex-col items-center relative group cursor-pointer"
                        onMouseEnter={() => setHoveredLocation(station.station_id)}
                        onMouseLeave={() => setHoveredLocation(null)}
                        onClick={() => setSelectedLocation(station.station_id)}
                      >
                        {/* Station Box */}
                        <div
                          className={`px-3 py-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
                            isInterchange
                              ? "bg-purple-950/40 border-purple-500/80 text-purple-200 shadow-md shadow-purple-900/30 ring-1 ring-purple-500/40"
                              : "bg-slate-800/90 border-slate-700 text-slate-200 hover:border-cyan-500/60 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs font-bold">{station.station_id}</span>
                            {isInterchange && (
                              <span className="text-xs text-purple-400 font-black animate-pulse">★</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Cap: {platCap}
                          </span>
                        </div>

                        {/* Station Label & Coordinate info */}
                        <div className="absolute top-12 flex flex-col items-center text-center whitespace-nowrap">
                          <span className="text-[11px] font-medium text-slate-300">
                            {station.station_name}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            Coord {2 * station.seq_order - 1}
                          </span>
                        </div>
                      </div>

                      {/* Connecting Tunnel Sector */}
                      {!isLast && (
                        <div
                          className="flex-1 flex flex-col items-center px-1.5 cursor-pointer group"
                          onClick={() => onSelectSector && onSelectSector(sectorId)}
                          onMouseEnter={() => setHoveredLocation(sectorId)}
                          onMouseLeave={() => setHoveredLocation(null)}
                        >
                          <div className="w-full flex items-center relative">
                            {/* Track Rail Line */}
                            <div
                              className={`h-1.5 w-full rounded-full transition-all ${
                                secCap === 1
                                  ? "bg-rose-500/80 shadow-sm shadow-rose-900 group-hover:h-2"
                                  : "bg-slate-700 group-hover:bg-cyan-500/80 group-hover:h-2"
                              }`}
                            ></div>
                          </div>

                          {/* Sector Capacity Pill */}
                          <div className="mt-1 flex items-center gap-1">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                secCap === 1
                                  ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                                  : "bg-slate-800 text-slate-400 border border-slate-700/80 group-hover:text-cyan-300 group-hover:border-cyan-700"
                              }`}
                            >
                              Cap: {secCap}
                            </span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Location Details Card */}
      {hoveredLocation && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300">
              Inspecting Location: <strong className="text-white font-mono">{hoveredLocation}</strong>
            </span>
            {interchangeHubs.includes(hoveredLocation) && (
              <span className="px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700 text-[10px] font-bold">
                Multi-Line Interchange Junction
              </span>
            )}
          </div>
          <span className="text-slate-400 text-[11px]">
            Click any sector to filter contracts & activities in the data table below
          </span>
        </div>
      )}
    </div>
  );
}
