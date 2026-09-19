'use client';

import React, { useState } from 'react';
import type { Scenario } from '@/types/planning';
import {
  Cpu,
  Clock,
  Play,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Layers,
  ArrowRight,
  Sliders,
} from 'lucide-react';

export interface SchedulePreCalculationCardProps {
  selectedScenario: Scenario;
  onScenarioChange: (scenario: Scenario) => void;
  timeBudgetSeconds: number;
  onTimeBudgetChange: (seconds: number) => void;
  onCalculate: () => void;
  isCalculating?: boolean;
}

interface ScenarioMeta {
  scenario: Scenario;
  title: string;
  badge: string;
  tagline: string;
  description: string;
  capacityRule: string;
  ecloRule: string;
  objectiveFocus: string;
  badgeClass: string;
}

const SCENARIOS: ScenarioMeta[] = [
  {
    scenario: 'A',
    title: 'Scenario A: Strict Supply / Flexible Schedule',
    badge: 'Supply Inelastic',
    tagline: 'Minimizes delivery delays under strict possession limits',
    description:
      'Rigid maintenance capacity limits (Cap: 2, Bottleneck: 1). ECLO closures are strictly prohibited. The solver focuses purely on minimising priority-weighted contract completion overruns.',
    capacityRule: 'Strictly Capped (No Overdraft)',
    ecloRule: 'Forbidden (0h)',
    objectiveFocus: 'Priority Delay Penalty',
    badgeClass: 'badge--scenario-a',
  },
  {
    scenario: 'B',
    title: 'Scenario B: Strict Schedule / Flexible Supply',
    badge: 'Zero Delay',
    tagline: 'Enforces hard completion deadlines by unlocking excess shifts',
    description:
      'Contract target completion dates are strictly binding (0 delay tolerance). The solver expands capacity via excess access night shifts and continuous ECLO blocks to guarantee timely handover.',
    capacityRule: 'Elastic (+Excess Night Shifts)',
    ecloRule: 'Allowed (Weekend ECLO)',
    objectiveFocus: 'Excess Supply & ECLO Cost',
    badgeClass: 'badge--scenario-b',
  },
  {
    scenario: 'C',
    title: 'Scenario C: Balanced Multi-Objective Trade-off',
    badge: 'Pareto Optimal',
    tagline: 'Joint optimization across delays, excess capacity, and ECLO',
    description:
      'Balances competing operational costs: penalises delivery delay overruns, excess possession shifts, and continuous ECLO disruption hours according to official weighting coefficients.',
    capacityRule: 'Moderately Elastic',
    ecloRule: 'Selective (High-Priority)',
    objectiveFocus: 'Joint Cost Objective',
    badgeClass: 'badge--scenario-c',
  },
];

const TIME_BUDGETS = [
  {
    sec: 10,
    label: '10s',
    sublabel: 'Fast',
    desc: 'Greedy heuristic & rapid feasibility validation',
  },
  {
    sec: 30,
    label: '30s',
    sublabel: 'Standard',
    desc: 'Recommended: Balanced branch-and-bound optimization',
  },
  {
    sec: 60,
    label: '60s',
    sublabel: 'Deep',
    desc: 'Extensive Large Neighborhood Search (LNS) refinement',
  },
  {
    sec: 120,
    label: '120s',
    sublabel: 'Full',
    desc: 'Exhaustive search approaching proven global optimality',
  },
];

export function SchedulePreCalculationCard({
  selectedScenario,
  onScenarioChange,
  timeBudgetSeconds,
  onTimeBudgetChange,
  onCalculate,
  isCalculating = false,
}: SchedulePreCalculationCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const activeMeta = SCENARIOS.find((s) => s.scenario === selectedScenario) || SCENARIOS[0];

  return (
    <div className="schedule-precalc-container">
      {/* 1. Mandatory Transparency Banner */}
      <div className="precalc-integrity-banner" role="status" aria-live="polite">
        <div className="integrity-banner-icon">
          <ShieldCheck size={20} className="text-teal-600" />
        </div>
        <div className="integrity-banner-body">
          <div className="integrity-banner-title">
            Pre-Calculation State · Master Scheduler Awaiting Optimization
          </div>
          <p className="integrity-banner-text">
            Before calculation, the master scheduler renders nothing until the engine returns verified results.
            Speculative, uncomputed, or uncertified allocations are strictly suppressed to guarantee mathematical
            integrity across all 8 hard constraints.
          </p>
        </div>
      </div>

      {/* 2. Weightless Spatial Glassmorphism Card */}
      <div className="glass-card precalc-card">
        {/* Card Header */}
        <div className="precalc-card-header">
          <div className="precalc-header-brand">
            <div className="precalc-engine-badge">
              <Cpu size={14} className="engine-icon-pulse" />
              <span>Google OR-Tools CP-SAT</span>
            </div>
            <h2 className="precalc-title">Configure Schedule Optimization Run</h2>
            <p className="precalc-subtitle">
              Select an operational policy scenario and computational time budget to trigger the discrete-event
              CP-SAT solver.
            </p>
          </div>
        </div>

        <div className="precalc-card-body">
          {/* Section A: Scenario Selector Dropdown */}
          <div className="precalc-section">
            <div className="precalc-label-row">
              <label htmlFor="scenario-select" className="precalc-label">
                Operational Policy Scenario:
              </label>
              <span className={`badge ${activeMeta.badgeClass}`}>
                {activeMeta.badge}
              </span>
            </div>

            {/* Custom Interactive Dropdown */}
            <div className="scenario-dropdown-wrap">
              <button
                type="button"
                id="scenario-select"
                className="scenario-dropdown-trigger"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
              >
                <div className="trigger-content">
                  <span className="trigger-scenario-letter">
                    Scenario {activeMeta.scenario}
                  </span>
                  <span className="trigger-scenario-title">
                    {activeMeta.title.replace(`Scenario ${activeMeta.scenario}: `, '')}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`trigger-chevron ${dropdownOpen ? 'rotated' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="scenario-dropdown-menu" role="listbox">
                  {SCENARIOS.map((s) => {
                    const isSelected = s.scenario === selectedScenario;
                    return (
                      <button
                        key={s.scenario}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`scenario-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          onScenarioChange(s.scenario);
                          setDropdownOpen(false);
                        }}
                      >
                        <div className="option-header">
                          <span className="option-letter">Scenario {s.scenario}</span>
                          <span className={`badge ${s.badgeClass}`}>{s.badge}</span>
                        </div>
                        <div className="option-title">{s.title}</div>
                        <div className="option-tagline">{s.tagline}</div>
                        <div className="option-meta-chips">
                          <span className="meta-chip">Cap: {s.capacityRule}</span>
                          <span className="meta-chip">ECLO: {s.ecloRule}</span>
                          <span className="meta-chip">Obj: {s.objectiveFocus}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Scenario Detailed Trade-off Card */}
            <div className="scenario-tradeoff-box">
              <div className="tradeoff-desc">{activeMeta.description}</div>
              <div className="tradeoff-grid">
                <div className="tradeoff-cell">
                  <span className="tradeoff-key">Capacity Limit:</span>
                  <strong className="tradeoff-val">{activeMeta.capacityRule}</strong>
                </div>
                <div className="tradeoff-cell">
                  <span className="tradeoff-key">ECLO Windows:</span>
                  <strong className="tradeoff-val">{activeMeta.ecloRule}</strong>
                </div>
                <div className="tradeoff-cell">
                  <span className="tradeoff-key">Primary Metric:</span>
                  <strong className="tradeoff-val">{activeMeta.objectiveFocus}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Time Budget Selector */}
          <div className="precalc-section">
            <div className="precalc-label-row">
              <label className="precalc-label">
                <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
                CP-SAT Time Budget:
              </label>
              <span className="font-mono text-xs text-ink-500">
                Wall Limit: {timeBudgetSeconds}s
              </span>
            </div>

            <div className="time-budget-grid" role="radiogroup" aria-label="Solver Time Budget">
              {TIME_BUDGETS.map((tb) => {
                const isSelected = timeBudgetSeconds === tb.sec;
                return (
                  <button
                    key={tb.sec}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`time-budget-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => onTimeBudgetChange(tb.sec)}
                  >
                    <div className="time-budget-sec">{tb.label}</div>
                    <div className="time-budget-sublabel">{tb.sublabel}</div>
                    <div className="time-budget-desc">{tb.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card Footer / Action Button */}
        <div className="precalc-card-footer">
          <div className="footer-notice">
            <AlertCircle size={14} className="text-teal-600" />
            <span>
              Solves {activeMeta.title.split(':')[0]} using exact constraint programming. Syncs assignments to PostgreSQL.
            </span>
          </div>

          <button
            type="button"
            className="btn btn--lg btn--glowing-gradient precalc-action-btn"
            onClick={onCalculate}
            disabled={isCalculating}
          >
            {isCalculating ? (
              <>
                <span className="btn-spinner" />
                <span>Optimizing Schedule (CP-SAT)...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Calculate Schedule (CP-SAT Engine)</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
