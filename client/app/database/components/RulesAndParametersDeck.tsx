"use client";

import React, { useState } from "react";
import { Sliders, Calendar, ShieldCheck, ShieldAlert, Save, RefreshCw, CheckCircle2 } from "lucide-react";
import type { BufferRule, SystemParameter } from "@/lib/types";

interface RulesAndParametersDeckProps {
  bufferRules: BufferRule[];
  parameters: SystemParameter[];
  onUpdateBufferRule: (nature: string, sectors: number, oppositeBound: boolean) => void;
  onUpdateParameter: (key: string, value: string) => void;
}

export function RulesAndParametersDeck({
  bufferRules,
  parameters,
  onUpdateBufferRule,
  onUpdateParameter,
}: RulesAndParametersDeckProps) {
  const horizonWeeksParam = parameters.find((p) => p.key === "horizon_weeks")?.value || "30";
  const horizonStartParam = parameters.find((p) => p.key === "horizon_start")?.value || "2027-01-04";

  const [weeks, setWeeks] = useState(horizonWeeksParam);
  const [startDate, setStartDate] = useState(horizonStartParam);
  const [paramSaved, setParamSaved] = useState(false);

  // Calculate horizon end date
  const calculateEndDate = (start: string, weekCount: number) => {
    try {
      const d = new Date(start);
      d.setDate(d.getDate() + weekCount * 7 - 1);
      return d.toISOString().split("T")[0];
    } catch {
      return "Invalid date";
    }
  };

  const endDate = calculateEndDate(startDate, parseInt(weeks, 10) || 30);

  const handleSaveParameters = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateParameter("horizon_weeks", weeks);
    onUpdateParameter("horizon_start", startDate);
    setParamSaved(true);
    setTimeout(() => setParamSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Safety Buffer Rules Control Deck */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Spatial Safety Buffer Policies</h3>
            <p className="text-xs text-slate-400">
              Sector protection radii and opposing bound isolation rules per work classification
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {bufferRules.map((rule) => {
            const isLive = rule.nature_of_works.toLowerCase().includes("live") && !rule.nature_of_works.toLowerCase().includes("non-live");

            return (
              <div
                key={rule.nature_of_works}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isLive ? "bg-rose-400 animate-pulse" : "bg-cyan-400"
                      }`}
                    ></span>
                    <strong className="text-xs text-white">{rule.nature_of_works}</strong>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-900 border border-slate-800 text-slate-400">
                    {rule.buffer_sectors} Sector Buffer Margin
                  </span>
                </div>

                {/* Buffer sectors slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Upstream & Downstream Buffer:</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {rule.buffer_sectors} Sectors ({rule.buffer_sectors * 1000}m)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={rule.buffer_sectors}
                    onChange={(e) =>
                      onUpdateBufferRule(
                        rule.nature_of_works,
                        Number(e.target.value),
                        rule.requires_opposite_bound
                      )
                    }
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                    <span>0 (Consist Only)</span>
                    <span>1 Sector (1km)</span>
                    <span>2 Sectors (2km)</span>
                    <span>3 Sectors (3km)</span>
                  </div>
                </div>

                {/* Opposite bound checkbox */}
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5">
                    {rule.requires_opposite_bound ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    Enforce Opposite Bound Blockade:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBufferRule(
                        rule.nature_of_works,
                        rule.buffer_sectors,
                        !rule.requires_opposite_bound
                      )
                    }
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                      rule.requires_opposite_bound
                        ? "bg-rose-950 text-rose-300 border border-rose-700"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                    }`}
                  >
                    {rule.requires_opposite_bound ? "ENFORCED (YES)" : "DISABLED (NO)"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. System Calendar & Horizon Settings */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">System Calendar & Horizon Parameters</h3>
            <p className="text-xs text-slate-400">
              Macro planning time horizon parameters controlling schedule bounds and penalties
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveParameters} className="space-y-4">
          {/* Horizon Weeks Input */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-slate-200 block">
              Operational Horizon Window (Weeks):
            </label>
            <input
              type="number"
              min={4}
              max={52}
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <p className="text-[11px] text-slate-400">
              Official competition default is 30 weeks. Solver optimizes possession nights across this range.
            </p>
          </div>

          {/* Horizon Start Date */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-slate-200 block">
              Calendar Horizon Start Date (Week 1 Monday):
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <p className="text-[11px] text-slate-400">
              Start date for Week 1 Day 1 (Monday night possession).
            </p>
          </div>

          {/* Calendar Calculated Summary */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-xs space-y-2 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Horizon Start:</span>
              <span className="text-white font-bold">{startDate} (W01 D1)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Horizon End:</span>
              <span className="text-white font-bold">{endDate} (W{weeks.padStart(2, "0")} D7)</span>
            </div>
            <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Total Available Nights:</span>
              <span className="text-cyan-400 font-bold">{(parseInt(weeks, 10) || 30) * 7} calendar days</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm shadow-cyan-900/50 transition-colors cursor-pointer"
          >
            {paramSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Parameters Staged Successfully!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Stage Parameter Updates</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
