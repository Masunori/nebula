"use client";

import React, { useState } from "react";
import { Sliders, Calendar, ShieldCheck, ShieldAlert, Save, CheckCircle2 } from "lucide-react";
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* 1. Safety Buffer Rules Control Deck */}
      <div
        className="rounded-2xl border transition-all"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
          padding: "28px 32px",
        }}
      >
        <div className="flex items-center gap-3 pb-5 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div
            style={{
              padding: 10,
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--teal-050)",
              border: "1px solid var(--border-teal)",
              color: "var(--teal-700)",
            }}
          >
            <Sliders size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: "var(--ink-900)" }}>
              Spatial Safety Buffer Policies
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
              Sector protection radii and opposing bound isolation rules per work classification
            </p>
          </div>
        </div>

        <div className="space-y-5 pt-6">
          {bufferRules.map((rule) => {
            const isLive =
              rule.nature_of_works.toLowerCase().includes("live") &&
              !rule.nature_of_works.toLowerCase().includes("non-live");

            return (
              <div
                key={rule.nature_of_works}
                className="p-5 rounded-xl border space-y-4 transition-all"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-page)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isLive ? "bg-rose-500 animate-pulse" : "bg-teal-500"
                      }`}
                    ></span>
                    <strong className="text-sm font-semibold" style={{ color: "var(--ink-900)" }}>
                      {rule.nature_of_works}
                    </strong>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-md font-mono font-semibold"
                    style={{
                      backgroundColor: "var(--teal-050)",
                      border: "1px solid var(--border-teal)",
                      color: "var(--teal-700)",
                    }}
                  >
                    {rule.buffer_sectors} Sector Buffer Margin
                  </span>
                </div>

                {/* Buffer sectors slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs" style={{ color: "var(--ink-600)" }}>
                    <span>Upstream & Downstream Buffer:</span>
                    <span className="font-mono font-bold" style={{ color: "var(--teal-700)" }}>
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
                    className="w-full accent-teal-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono" style={{ color: "var(--ink-400)" }}>
                    <span>0 (Consist Only)</span>
                    <span>1 Sector (1km)</span>
                    <span>2 Sectors (2km)</span>
                    <span>3 Sectors (3km)</span>
                  </div>
                </div>

                {/* Opposite bound checkbox */}
                <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border-default)" }}>
                  <span className="text-xs flex items-center gap-2" style={{ color: "var(--ink-700)" }}>
                    {rule.requires_opposite_bound ? (
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>Enforce Opposite Bound Blockade:</span>
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
                    style={{
                      backgroundColor: rule.requires_opposite_bound ? "var(--status-red-bg)" : "var(--bg-muted)",
                      color: rule.requires_opposite_bound ? "var(--status-red)" : "var(--ink-700)",
                      border: `1px solid ${rule.requires_opposite_bound ? "var(--status-red-border)" : "var(--border-default)"}`,
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer"
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
      <div
        className="rounded-2xl border transition-all"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
          padding: "28px 32px",
        }}
      >
        <div className="flex items-center gap-3 pb-5 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div
            style={{
              padding: 10,
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--teal-050)",
              border: "1px solid var(--border-teal)",
              color: "var(--teal-700)",
            }}
          >
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: "var(--ink-900)" }}>
              System Calendar & Horizon Parameters
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
              Macro planning time horizon parameters controlling schedule bounds and penalties
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveParameters} className="space-y-5 pt-6">
          {/* Horizon Weeks Input */}
          <div
            className="p-5 rounded-xl border space-y-2"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-page)",
            }}
          >
            <label className="block text-xs font-semibold" style={{ color: "var(--ink-900)" }}>
              Operational Horizon Window (Weeks):
            </label>
            <input
              type="number"
              min={4}
              max={52}
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg font-mono text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-surface)",
                color: "var(--ink-900)",
              }}
            />
            <p className="text-xs" style={{ color: "var(--ink-500)" }}>
              Official competition default is 30 weeks. Solver optimizes possession nights across this range.
            </p>
          </div>

          {/* Horizon Start Date */}
          <div
            className="p-5 rounded-xl border space-y-2"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-page)",
            }}
          >
            <label className="block text-xs font-semibold" style={{ color: "var(--ink-900)" }}>
              Calendar Horizon Start Date (Week 1 Monday):
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg font-mono text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-surface)",
                color: "var(--ink-900)",
              }}
            />
            <p className="text-xs" style={{ color: "var(--ink-500)" }}>
              Start date for Week 1 Day 1 (Monday night possession).
            </p>
          </div>

          {/* Calendar Calculated Summary */}
          <div
            className="p-5 rounded-xl border font-mono text-xs space-y-3"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-muted)",
            }}
          >
            <div className="flex justify-between" style={{ color: "var(--ink-600)" }}>
              <span>Horizon Start:</span>
              <strong style={{ color: "var(--ink-900)" }}>{startDate} (W01 D1)</strong>
            </div>
            <div className="flex justify-between" style={{ color: "var(--ink-600)" }}>
              <span>Horizon End:</span>
              <strong style={{ color: "var(--ink-900)" }}>{endDate} (W{weeks.padStart(2, "0")} D7)</strong>
            </div>
            <div className="flex justify-between pt-3 border-t" style={{ borderColor: "var(--border-default)", color: "var(--ink-600)" }}>
              <span>Total Available Nights:</span>
              <strong style={{ color: "var(--teal-700)" }}>{(parseInt(weeks, 10) || 30) * 7} calendar days</strong>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            style={{ width: "100%", justifyContent: "center", gap: 8, padding: "12px 20px" }}
          >
            {paramSaved ? (
              <>
                <CheckCircle2 size={16} />
                <span>Parameters Staged Successfully!</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Stage Parameter Updates</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
