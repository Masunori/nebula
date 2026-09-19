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
      <div
        className="rounded-2xl border p-16 text-center space-y-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: "var(--bg-muted)", color: "var(--ink-500)" }}
        >
          <Train className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold" style={{ color: "var(--ink-900)" }}>
          Network Topology Empty (Database Flushed)
        </h3>
        <p className="text-xs max-w-md mx-auto" style={{ color: "var(--ink-500)" }}>
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

  // Distinct line colors and glow definitions
  const LINE_THEMES: Record<string, { stroke: string; glow: string; filterId: string; fill: string; light: string; name: string }> = {
    ALP: { stroke: "#06b6d4", glow: "rgba(6, 182, 212, 0.4)", filterId: "cyan-glow", fill: "#0891b2", light: "#cffafe", name: "Line Alpha" },
    BET: { stroke: "#10b981", glow: "rgba(16, 185, 129, 0.4)", filterId: "emerald-glow", fill: "#059669", light: "#d1fae5", name: "Line Beta" },
    GAM: { stroke: "#a855f7", glow: "rgba(168, 85, 247, 0.4)", filterId: "purple-glow", fill: "#9333ea", light: "#f3e8ff", name: "Line Gamma" },
    DEL: { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)", filterId: "amber-glow", fill: "#d97706", light: "#fef3c7", name: "Line Delta" },
    EPS: { stroke: "#ec4899", glow: "rgba(236, 72, 153, 0.4)", filterId: "pink-glow", fill: "#db2777", light: "#fce7f3", name: "Line Epsilon" },
  };

  const getLineTheme = (lineCode: string) => {
    return (
      LINE_THEMES[lineCode] || {
        stroke: "#38bdf8",
        glow: "rgba(56, 189, 248, 0.4)",
        filterId: "cyan-glow",
        fill: "#0284c7",
        light: "#e0f2fe",
        name: `Line ${lineCode}`,
      }
    );
  };

  // Unique line codes present in the active dataset
  const uniqueLineCodes = useMemo(() => {
    const set = new Set<string>();
    stations.forEach((s) => set.add(s.line_code));
    return Array.from(set).sort();
  }, [stations]);

  const numLines = Math.max(1, uniqueLineCodes.length);
  const trackSpacing = numLines <= 2 ? 160 : 95;
  const hubY = numLines <= 2 ? 230 : 70 + ((numLines - 1) / 2) * trackSpacing;
  const svgHeight = Math.max(460, 70 + numLines * trackSpacing + 50);

  // Dynamic multi-track node positioning
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; isInterchange: boolean; name: string; line: string }>();

    uniqueLineCodes.forEach((lineCode, lineIdx) => {
      const lineStations = stations
        .filter((s) => s.line_code === lineCode)
        .sort((a, b) => a.seq_order - b.seq_order);

      const lineY = numLines <= 2
        ? (lineCode === "ALP" ? 140 : 320)
        : 70 + lineIdx * trackSpacing;

      lineStations.forEach((st, idx) => {
        let x = 60 + idx * 105;
        let y = lineY;

        if (st.station_id === "H01") {
          x = 480;
          y = hubY;
        } else if (st.station_id === "H02") {
          x = 600;
          y = hubY;
        } else if (idx >= 6) {
          x = 600 + (idx - 5) * 105;
        }

        positions.set(`${lineCode}:${st.station_id}`, {
          x,
          y,
          isInterchange: st.station_id === "H01" || st.station_id === "H02",
          name: st.station_name,
          line: lineCode,
        });
      });
    });

    return positions;
  }, [stations, uniqueLineCodes, numLines, trackSpacing, hubY]);

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
    <div className="space-y-6">
      {/* Visualizer Controls Bar */}
      <div
        className="rounded-2xl border transition-all"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
          padding: "20px 28px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Left: Line Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-500)", marginRight: 4 }}>
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
        <div className="flex items-center gap-5">
          <div className="hidden lg:flex items-center gap-3.5 text-xs font-medium" style={{ color: "var(--ink-600)" }}>
            {uniqueLineCodes.map((c) => {
              const th = getLineTheme(c);
              return (
                <span key={c} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: th.stroke }}></span>
                  {th.name}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block ring-2 ring-purple-400/40" style={{ backgroundColor: "#a855f7" }}></span>
              Interchange Hub ★
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 inline-block rounded" style={{ backgroundColor: "#f43f5e" }}></span>
              Bottleneck (Cap: 1)
            </span>
          </div>

          <div
            className="flex items-center gap-1.5 p-1.5 rounded-xl"
            style={{ backgroundColor: "var(--bg-muted)", border: "1px solid var(--border-default)" }}
          >
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.6))}
              title="Zoom In"
              className="p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
              style={{ color: "var(--ink-600)" }}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="px-1.5 text-xs font-mono font-semibold" style={{ color: "var(--ink-700)" }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.7))}
              title="Zoom Out"
              className="p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
              style={{ color: "var(--ink-600)" }}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom"
              className="p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
              style={{ color: "var(--ink-600)" }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Railway Graph Canvas */}
      <div
        className="rounded-2xl border relative overflow-x-auto transition-all"
        style={{
          padding: 24,
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
        }}
      >
        {/* Active Sector Selection Banner */}
        {selectedSectorId && (
          <div
            className="absolute top-6 left-6 z-10 px-4 py-2 rounded-xl text-xs flex items-center gap-2.5 shadow-md animate-in fade-in"
            style={{
              backgroundColor: "var(--teal-050)",
              border: "1px solid var(--border-teal)",
              color: "var(--teal-900)",
            }}
          >
            <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
            <span>Filtering Activity Grid to Sector:</span>
            <strong className="font-mono text-sm text-teal-800">{selectedSectorId}</strong>
            <button
              onClick={() => onSelectSector && onSelectSector("")}
              className="ml-3 font-semibold text-teal-700 hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* Hover Inspector Tooltip */}
        {(hoveredNode || hoveredEdge) && (
          <div
            className="rounded-xl border p-4"
            style={{
              position: "absolute",
              bottom: 24,
              right: 24,
              zIndex: 10,
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-default)",
              boxShadow: "0 10px 25px -5px rgba(15, 25, 35, 0.12)",
              maxWidth: 320,
            }}
          >
            {hoveredNode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-sm" style={{ color: "var(--ink-900)" }}>{hoveredNode.id}</span>
                  <span className="badge badge--pending font-mono text-xs">
                    {hoveredNode.line}
                  </span>
                </div>
                <p className="font-medium text-xs" style={{ color: "var(--ink-700)" }}>{hoveredNode.name}</p>
                <div className="text-xs flex items-center gap-1 pt-1" style={{ color: "var(--ink-500)" }}>
                  <span>Platform Capacity:</span>
                  <strong style={{ color: "var(--teal-700)" }}>{hoveredNode.cap} slots/night</strong>
                </div>
              </div>
            )}
            {hoveredEdge && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs" style={{ color: "var(--ink-900)" }}>{hoveredEdge.id}</span>
                  <span
                    className={`badge font-bold font-mono text-xs ${
                      hoveredEdge.cap === 1 ? "badge--invalid" : "badge--valid"
                    }`}
                  >
                    Cap: {hoveredEdge.cap}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "var(--ink-600)" }}>
                  {hoveredEdge.cap === 1
                    ? "Single-track bottleneck between interchange stations H01 and H02."
                    : "Standard double-track tunnel sector."}
                </p>
                <p className="text-[11px] font-semibold" style={{ color: "var(--teal-700)", paddingTop: 2 }}>Click track to isolate activities in data grid</p>
              </div>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 1080 ${svgHeight}`}
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.15s ease-out" }}
          className="w-full h-auto min-w-[900px] select-none"
        >
          <defs>
            {/* Grid dot pattern */}
            <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.2" fill="var(--border-default)" />
            </pattern>

            {/* Glow filters for all lines */}
            <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.7" />
            </filter>
            <filter id="emerald-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.7" />
            </filter>
            <filter id="purple-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#a855f7" floodOpacity="0.7" />
            </filter>
            <filter id="amber-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.7" />
            </filter>
            <filter id="pink-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ec4899" floodOpacity="0.7" />
            </filter>
            <filter id="rose-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f43f5e" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Background grid */}
          <rect width="1080" height={svgHeight} fill="url(#dot-grid)" />

          {/* 1. SECTOR EDGES (TRACKS) */}
          <g className="edges">
            {visibleSectors.map((sector) => {
              const fromPos = nodePositions.get(`${sector.line_code}:${sector.from_station_id}`);
              const toPos = nodePositions.get(`${sector.line_code}:${sector.to_station_id}`);
              if (!fromPos || !toPos) return null;

              const isBottleneck = sector.sector_id.includes("H01_H02");
              const isSelected = selectedSectorId === sector.sector_id;
              const cap = getSectorCapacity(sector.sector_id, selectedBound);
              const theme = getLineTheme(sector.line_code);

              const strokeColor = isBottleneck ? "#f43f5e" : theme.stroke;
              const filterUrl = isSelected || isBottleneck
                ? isBottleneck ? "url(#rose-glow)" : `url(#${theme.filterId})`
                : undefined;

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
                    opacity={isSelected ? 1 : 0.8}
                    filter={filterUrl}
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
              const theme = getLineTheme(node.line);
              const strokeColor = isHub ? "#a855f7" : theme.stroke;
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
                      opacity="0.5"
                      className="hub-pulse-ring pointer-events-none"
                    />
                  )}

                  {/* Main Station Circle - Anchored without scale/jumping */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHub ? 17 : 13}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isHub ? 3 : 2.5}
                    className="station-node-anchored cursor-pointer"
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
