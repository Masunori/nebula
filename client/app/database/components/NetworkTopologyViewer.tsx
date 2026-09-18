"use client";

import React, { useState, useMemo } from "react";
import {
  Train,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Line, Station, Sector, LocationSupply, TrackBound } from "@/lib/types";

interface NetworkTopologyViewerProps {
  lines: Line[];
  stations: Station[];
  sectors: Sector[];
  locationSupply: LocationSupply[];
  selectedBound: TrackBound;
  interchangeHubs: string[];
  selectedSectorId?: string | null;
  onSelectSector?: (sectorId: string) => void;
}

export function NetworkTopologyViewer({
  lines,
  stations,
  sectors,
  locationSupply,
  selectedBound,
  interchangeHubs,
  selectedSectorId,
  onSelectSector,
}: NetworkTopologyViewerProps) {
  const [activeLineFilter, setActiveLineFilter] = useState<string>("ALL");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredNode, setHoveredNode] = useState<{ id: string; name: string; line: string; cap: number } | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ id: string; cap: number; type: string } | null>(null);

  // Handle empty database state
  if (!lines || lines.length === 0 || !stations || stations.length === 0) {
    return (
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <Train className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">Network Topology Empty (Database Flushed)</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          No railway lines, stations, or tunnel sectors are currently loaded. Use the Ingest / Flush menu to load the Official Baseline or upload custom CSV datasets.
        </p>
      </div>
    );
  }

  // Calculate sector capacity
  const getSectorCapacity = (secId: string, bound: TrackBound) => {
    const locId = `${secId}:${bound}`;
    const entry = locationSupply.find((ls) => ls.location_id === locId);
    return entry ? entry.supply_capacity : secId.includes("H01_H02") ? 1 : 4;
  };

  // Node position calculation for SVG Railway Graph Visualizer
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; isInterchange: boolean; name: string; line: string }>();

    // Stations for ALP
    const alpStations = stations.filter((s) => s.line_code === "ALP").sort((a, b) => a.seq_order - b.seq_order);
    alpStations.forEach((st, idx) => {
      let x = 60 + idx * 105;
      let y = 140;

      if (st.station_id === "H01") {
        x = 480;
        y = 230;
      } else if (st.station_id === "H02") {
        x = 600;
        y = 230;
      } else if (idx > 5) {
        x = 600 + (idx - 5) * 105;
      }

      positions.set(`ALP:${st.station_id}`, {
        x,
        y,
        isInterchange: st.station_id === "H01" || st.station_id === "H02",
        name: st.station_name,
        line: "ALP",
      });
    });

    // Stations for BET
    const betStations = stations.filter((s) => s.line_code === "BET").sort((a, b) => a.seq_order - b.seq_order);
    betStations.forEach((st, idx) => {
      let x = 60 + idx * 105;
      let y = 320;

      if (st.station_id === "H01") {
        x = 480;
        y = 230;
      } else if (st.station_id === "H02") {
        x = 600;
        y = 230;
      } else if (idx > 5) {
        x = 600 + (idx - 5) * 105;
      }

      positions.set(`BET:${st.station_id}`, {
        x,
        y,
        isInterchange: st.station_id === "H01" || st.station_id === "H02",
        name: st.station_name,
        line: "BET",
      });
    });

    // Additional lines if any (e.g. GAM)
    const otherStations = stations.filter((s) => s.line_code !== "ALP" && s.line_code !== "BET");
    otherStations.forEach((st, idx) => {
      positions.set(`${st.line_code}:${st.station_id}`, {
        x: 60 + (idx % 10) * 105,
        y: 400 + Math.floor(idx / 10) * 80,
        isInterchange: false,
        name: st.station_name,
        line: st.line_code,
      });
    });

    return positions;
  }, [stations]);

  // Filtered sectors to render
  const visibleSectors = useMemo(() => {
    return sectors.filter((s) => {
      if (activeLineFilter === "ALL") return true;
      return s.line_code === activeLineFilter;
    });
  }, [sectors, activeLineFilter]);

  // Unique visual stations for nodes
  const visibleNodes = useMemo(() => {
    const list: { key: string; id: string; x: number; y: number; isInterchange: boolean; name: string; line: string }[] =
      [];
    const renderedIds = new Set<string>();

    nodePositions.forEach((pos, key) => {
      const [lineCode, stId] = key.split(":");
      if (activeLineFilter !== "ALL" && lineCode !== activeLineFilter) return;

      // If it's an interchange hub and already rendered, skip duplicate node
      if (pos.isInterchange && renderedIds.has(stId)) return;
      renderedIds.add(stId);

      list.push({
        key,
        id: stId,
        x: pos.x,
        y: pos.y,
        isInterchange: pos.isInterchange,
        name: pos.name,
        line: lineCode,
      });
    });

    return list;
  }, [nodePositions, activeLineFilter]);

  return (
    <div className="space-y-3">
      {/* Visualizer Controls Bar */}
      <div
        className="section"
        style={{
          padding: "12px 16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Left: Line Filter Pills */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-500)", marginRight: 4 }}>
            Graph Focus:
          </span>
          <button
            onClick={() => setActiveLineFilter("ALL")}
            className={`btn btn--sm ${activeLineFilter === "ALL" ? "btn--primary" : "btn--secondary"}`}
          >
            Full Network (All Lines)
          </button>
          {lines.map((l) => (
            <button
              key={l.line_code}
              onClick={() => setActiveLineFilter(l.line_code)}
              className={`btn btn--sm ${
                activeLineFilter === l.line_code
                  ? "btn--primary"
                  : "btn--secondary"
              }`}
            >
              {l.line_name} ({l.line_code})
            </button>
          ))}
        </div>

        {/* Right: Legend & Zoom Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 text-[11px]" style={{ color: "var(--ink-500)" }}>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: "#06b6d4" }}></span>
              Line Alpha
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: "#10b981" }}></span>
              Line Beta
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block ring-2 ring-purple-400/40" style={{ backgroundColor: "#a855f7" }}></span>
              Interchange Hub ★
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-1 inline-block rounded" style={{ backgroundColor: "#f43f5e" }}></span>
              Bottleneck (Cap: 1)
            </span>
          </div>

          <div
            className="flex items-center gap-1 p-1 rounded-lg"
            style={{ backgroundColor: "var(--bg-muted)", border: "1px solid var(--border-default)" }}
          >
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.6))}
              title="Zoom In"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[10px] font-mono" style={{ color: "var(--ink-500)" }}>{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.7))}
              title="Zoom Out"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Railway Graph Canvas */}
      <div
        className="section relative overflow-x-auto shadow-inner"
        style={{ padding: 12, backgroundColor: "var(--bg-surface)" }}
      >
        {/* Active Sector Selection Banner */}
        {selectedSectorId && (
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-cyan-950/90 border border-cyan-500/80 text-cyan-200 text-xs flex items-center gap-2 shadow-lg backdrop-blur-sm animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Filtering Activity Grid to Sector:</span>
            <strong className="font-mono text-white">{selectedSectorId}</strong>
            <button
              onClick={() => onSelectSector && onSelectSector("")}
              className="ml-2 text-cyan-400 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* Hover Inspector Tooltip */}
        {(hoveredNode || hoveredEdge) && (
          <div
            className="dialog-box"
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              zIndex: 10,
              padding: 12,
              boxShadow: "var(--shadow-lg)",
              maxWidth: 320,
            }}
          >
            {hoveredNode && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-sm" style={{ color: "var(--ink-900)" }}>{hoveredNode.id}</span>
                  <span className="badge badge--pending font-mono text-[10px]">
                    {hoveredNode.line}
                  </span>
                </div>
                <p className="font-medium text-xs" style={{ color: "var(--ink-700)" }}>{hoveredNode.name}</p>
                <div className="text-[11px] flex items-center gap-1 pt-1" style={{ color: "var(--ink-500)" }}>
                  <span>Platform Capacity:</span>
                  <strong style={{ color: "var(--teal-700)" }}>{hoveredNode.cap} slots/night</strong>
                </div>
              </div>
            )}
            {hoveredEdge && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs" style={{ color: "var(--ink-900)" }}>{hoveredEdge.id}</span>
                  <span
                    className={`badge font-bold font-mono text-[10px] ${
                      hoveredEdge.cap === 1 ? "badge--invalid" : "badge--valid"
                    }`}
                  >
                    Cap: {hoveredEdge.cap}
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--ink-500)" }}>
                  {hoveredEdge.cap === 1
                    ? "Single-track bottleneck between interchange stations H01 and H02."
                    : "Standard double-track tunnel sector."}
                </p>
                <p className="text-[10px]" style={{ color: "var(--teal-700)", paddingTop: 2 }}>Click track to isolate activities in data grid</p>
              </div>
            )}
          </div>
        )}

        <svg
          viewBox="0 0 1080 460"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.15s ease-out" }}
          className="w-full h-auto min-w-[900px] select-none"
        >
          <defs>
            {/* Grid dot pattern */}
            <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.2" fill="var(--border-default)" />
            </pattern>

            {/* Glow filters */}
            <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.6" />
            </filter>
            <filter id="emerald-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.6" />
            </filter>
            <filter id="rose-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f43f5e" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Background grid */}
          <rect width="1080" height="460" fill="url(#dot-grid)" />

          {/* 1. SECTOR EDGES (TRACKS) */}
          <g className="edges">
            {visibleSectors.map((sector) => {
              const fromPos = nodePositions.get(`${sector.line_code}:${sector.from_station_id}`);
              const toPos = nodePositions.get(`${sector.line_code}:${sector.to_station_id}`);
              if (!fromPos || !toPos) return null;

              const isBottleneck = sector.sector_id.includes("H01_H02");
              const isSelected = selectedSectorId === sector.sector_id;
              const cap = getSectorCapacity(sector.sector_id, selectedBound);
              const isAlpha = sector.line_code === "ALP";

              const strokeColor = isBottleneck
                ? "#f43f5e"
                : isAlpha
                ? "#06b6d4"
                : "#10b981";

              // Curving path calculation
              const dx = toPos.x - fromPos.x;
              const dy = toPos.y - fromPos.y;
              const midX = (fromPos.x + toPos.x) / 2;
              const midY = (fromPos.y + toPos.y) / 2;

              return (
                <g
                  key={sector.sector_id}
                  onClick={() => onSelectSector && onSelectSector(isSelected ? "" : sector.sector_id)}
                  onMouseEnter={() =>
                    setHoveredEdge({
                      id: sector.sector_id,
                      cap,
                      type: isBottleneck ? "Single Track Bottleneck" : "Double Track",
                    })
                  }
                  onMouseLeave={() => setHoveredEdge(null)}
                  className="cursor-pointer group"
                >
                  {/* Invisible wide track for easy hover & clicking */}
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke="transparent"
                    strokeWidth={18}
                  />

                  {/* Visual Railway Track Line */}
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 6 : isBottleneck ? 4 : 3}
                    strokeDasharray={isBottleneck ? "6,4" : undefined}
                    opacity={isSelected ? 1 : 0.75}
                    filter={isSelected || isBottleneck ? (isBottleneck ? "url(#rose-glow)" : isAlpha ? "url(#cyan-glow)" : "url(#emerald-glow)") : undefined}
                    className="transition-all group-hover:opacity-100 group-hover:stroke-width-5"
                  />

                  {/* Capacity Badge on Edge Midpoint */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-18"
                      y="-8"
                      width="36"
                      height="16"
                      rx="8"
                      fill={isBottleneck ? "#881337" : "#0f172a"}
                      stroke={isBottleneck ? "#f43f5e" : "#334155"}
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill={isBottleneck ? "#fecdd3" : "#cbd5e1"}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {isBottleneck ? "★ 1" : `C:${cap}`}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* 2. STATION NODES */}
          <g className="nodes">
            {visibleNodes.map((node) => {
              const isHub = node.isInterchange;
              const isAlpha = node.line === "ALP";
              const strokeColor = isHub ? "#a855f7" : isAlpha ? "#06b6d4" : "#10b981";
              const fillColor = isHub ? "#7e22ce" : "var(--bg-surface)";

              return (
                <g
                  key={node.key}
                  onMouseEnter={() =>
                    setHoveredNode({
                      id: node.id,
                      name: node.name,
                      line: node.line,
                      cap: 2,
                    })
                  }
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer group"
                >
                  {/* Outer pulsing ring for Interchange Hubs */}
                  {isHub && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="22"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2"
                      opacity="0.4"
                      className="animate-pulse"
                    />
                  )}

                  {/* Main Station Circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHub ? 17 : 13}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isHub ? 3 : 2.5}
                    className="transition-transform group-hover:scale-110"
                  />

                  {/* Station Code Label */}
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill={isHub ? "#ffffff" : "var(--ink-900)"}
                    fontSize={isHub ? "10" : "9"}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {node.id}
                  </text>

                  {/* Station Name Underneath */}
                  <text
                    x={node.x}
                    y={node.y + (isHub ? 30 : 25)}
                    textAnchor="middle"
                    fill="var(--ink-700)"
                    fontSize="9.5"
                    fontWeight="500"
                  >
                    {node.name.replace("Station ", "")}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
