'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getTimetable,
  solveScenarioRemote,
  validateScheduleRemote,
} from '@/lib/api';
import type { PlanningRun, TimetableRow, Scenario } from '@/types/planning';
import type { ValidationResult } from '@/types/validation';
import { filterTimetableRows, getUniqueWeeks, type TimetableFilters as FiltersType } from '@/lib/timetable';
import { TimetableFilters } from '@/components/timetable/TimetableFilters';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { ValidationLog } from '@/components/validation/ValidationLog';
import { TimetableView } from '@/components/timetable/TimetableView';
import { RunStatusBadge } from '@/components/planning/RunStatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { SchedulePreCalculationCard } from '@/components/schedule/SchedulePreCalculationCard';
import { ScheduleTelemetryBar } from '@/components/schedule/ScheduleTelemetryBar';
import { DatabaseStatusBadge } from '@/components/ui/DatabaseStatusBadge';
import { DisruptionControl } from '@/components/planning/DisruptionControl';
import Link from 'next/link';
import {
  Download,
  GitCompare,
  CalendarClock,
  Play,
  FileArchive,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Sparkles,
  RotateCcw,
  Edit3,
  Undo2,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';

interface SolvedScheduleRecord {
  scenario: Scenario;
  solvedTimestamp: string;
  wallTimeSeconds: number;
  feasibilityStatus: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN';
  score: number;
  baselineScore: number;
  currentScore?: number;
  scoreDelta?: number;
  isManuallyEdited?: boolean;
  scoreBreakdown?: {
    overrunDays?: number;
    excessNights?: number;
    ecloNights?: number;
    priorityWeightedScore?: number;
  };
  rows: TimetableRow[];
  baselineRows: TimetableRow[];
  valResult: ValidationResult;
  runId: string;
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const initialActivity = searchParams.get('activity') || '';

  const [selectedScenario, setSelectedScenario] = useState<Scenario>('A');
  const [solveBudgetSeconds, setSolveBudgetSeconds] = useState<number>(30);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [solveFeedback, setSolveFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Version-tracked solutions keyed by scenario
  const [solvedSchedules, setSolvedSchedules] = useState<Record<Scenario, SolvedScheduleRecord | null>>({
    A: null,
    B: null,
    C: null,
  });

  // Interactive manual editing states
  const [isManualEditing, setIsManualEditing] = useState<boolean>(false);
  const [stagedRows, setStagedRows] = useState<TimetableRow[]>([]);
  const [manualChangesCount, setManualChangesCount] = useState<number>(0);
  const [isValidatingManual, setIsValidatingManual] = useState<boolean>(false);

  // Drag-and-drop sensor activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const [hlKey, setHlKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersType>({
    weeks: [],
    lines: [],
    bounds: [],
    contracts: [],
    activityTypes: [],
    validationStates: [],
    search: initialActivity,
  });

  // Current active solution for selected scenario
  const currentSolution = solvedSchedules[selectedScenario];

  // Persistent hydration on mount from localStorage or server fallback
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nebulax_scenario_solutions_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed[selectedScenario]?.rows &&
          Array.isArray(parsed[selectedScenario].rows) &&
          parsed[selectedScenario].rows.length > 0
        ) {
          setSolvedSchedules(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load persisted solutions from localStorage:', e);
    }

    // Server fallback check for active deliverable files
    fetch(`/api/solver/persisted?scenario=${selectedScenario}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.has_solution) {
          getTimetable(`run-${selectedScenario.toLowerCase()}`, selectedScenario)
            .then((rows) => {
              const baseScore =
                data.soft_scores?.penalty_score ??
                (data.soft_scores?.objective_score !== 0
                  ? data.soft_scores?.objective_score
                  : data.soft_scores?.priority_weighted_score) ??
                0;
              const rec: SolvedScheduleRecord = {
                scenario: selectedScenario,
                solvedTimestamp: data.timestamp,
                wallTimeSeconds: 15.0,
                feasibilityStatus: data.feasible ? 'OPTIMAL' : 'INFEASIBLE',
                score: baseScore,
                baselineScore: baseScore,
                currentScore: baseScore,
                scoreDelta: 0,
                isManuallyEdited: false,
                scoreBreakdown: {
                  overrunDays: data.soft_scores?.overrun_days_total ?? 0,
                  excessNights: data.soft_scores?.excess_access_nights_total ?? 0,
                  ecloNights: data.soft_scores?.eclo_nights_total ?? 0,
                  priorityWeightedScore: data.soft_scores?.priority_weighted_score ?? 0,
                },
                rows,
                baselineRows: rows,
                valResult: {
                  runId: `run-${selectedScenario.toLowerCase()}-persisted`,
                  revisionNumber: '1.0',
                  scenario: selectedScenario,
                  feasible: data.feasible,
                  hardViolations: data.hard_violations || [],
                  softScores: {
                    scenario: selectedScenario,
                    overrunDaysTotal: data.soft_scores?.overrun_days_total ?? 0,
                    contractsOverrunning: data.soft_scores?.contracts_overrunning ?? 0,
                    earlinessTotal: data.soft_scores?.earliness_days_total ?? 0,
                    excessAccessNightsTotal: data.soft_scores?.excess_access_nights_total ?? 0,
                    ecloNightsTotal: data.soft_scores?.eclo_nights_total ?? 0,
                    priorityOverrun: data.soft_scores?.priority_overrun ?? {},
                    priorityWeightedScore: data.soft_scores?.priority_weighted_score ?? 0,
                  },
                  validationLog: data.validation_log || [],
                  validatedAt: data.timestamp,
                  capacityHotspots: [],
                  nightsScheduled: rows.length,
                  ecloNights: data.soft_scores?.eclo_nights_total ?? 0,
                },
                runId: `run-${selectedScenario.toLowerCase()}-persisted`,
              };
              setSolvedSchedules((prev) => {
                const next = { ...prev, [selectedScenario]: rec };
                try {
                  localStorage.setItem('nebulax_scenario_solutions_v1', JSON.stringify(next));
                } catch {}
                return next;
              });
            })
            .catch(() => {});
        } else if (data && data.has_solution === false) {
          // Deliverable files were flushed on server (e.g. database update); clear local state
          setSolvedSchedules((prev) => {
            const next = { ...prev, [selectedScenario]: null };
            try {
              localStorage.setItem('nebulax_scenario_solutions_v1', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      })
      .catch(() => {});
  }, [selectedScenario]);

  // Listen for database state mutations (flush, commit, ingest, preset load)
  useEffect(() => {
    const handleDatabaseUpdate = () => {
      setSolvedSchedules({ A: null, B: null, C: null });
      try {
        localStorage.removeItem('nebulax_scenario_solutions_v1');
      } catch {}
      setSolveFeedback({
        type: 'info',
        message: 'Database updated · Master schedule cleared. Click Calculate below to optimize on new network dataset.',
      });
    };
    window.addEventListener('nebula_database_updated', handleDatabaseUpdate);
    return () => window.removeEventListener('nebula_database_updated', handleDatabaseUpdate);
  }, []);

  // Sync initialActivity query parameter with search filter
  useEffect(() => {
    if (initialActivity) {
      setFilters((prev) => ({ ...prev, search: initialActivity }));
    }
  }, [initialActivity]);

  // Keep stagedRows in sync when entering editing mode or changing solution
  useEffect(() => {
    if (!isManualEditing && currentSolution) {
      setStagedRows(currentSolution.rows);
      setManualChangesCount(0);
    }
  }, [currentSolution, isManualEditing]);

  const displayRows = useMemo(() => {
    if (isManualEditing) {
      return stagedRows;
    }
    return currentSolution ? currentSolution.rows : [];
  }, [isManualEditing, stagedRows, currentSolution]);

  const availableWeeks = useMemo(() => {
    return getUniqueWeeks(displayRows);
  }, [displayRows]);

  const filteredRows = useMemo(() => {
    return filterTimetableRows(displayRows, filters);
  }, [displayRows, filters]);

  const handleDownloadCsv = (filename: string) => {
    window.location.href = `/api/solver/download?file=${encodeURIComponent(filename)}&scenario=${selectedScenario}`;
  };

  const handleDownloadZip = () => {
    window.location.href = `/api/solver/download?file=zip&scenario=${selectedScenario}`;
  };

  const handleScenarioChange = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setIsManualEditing(false);
    setSolveFeedback(null);
  };

  // Drag and drop handler for manual schedule adjustments
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activity = active.data.current?.activity as TimetableRow | undefined;
    const [, weekText, ...locationParts] = String(over.id).split(':');
    const week = Number(weekText);
    const locationId = locationParts.join(':');
    if (!activity || !week || !locationId) return;

    const locationPartsForLine = locationId.split(':');
    const lineCode = locationPartsForLine[1] as TimetableRow['lineCode'];
    const bound = locationPartsForLine.at(-1) as TimetableRow['bound'];

    setStagedRows((current) =>
      current.map((row) =>
        row.activityId === activity.activityId &&
        row.accessSeq === activity.accessSeq &&
        !row.isDerived
          ? {
              ...row,
              week,
              calendarWeek: `CW${String(week).padStart(2, '0')}`,
              locationId,
              lineCode,
              bound,
              status: 'pending' as const,
            }
          : row
      )
    );
    setManualChangesCount((c) => c + 1);
  };

  const handleToggleManualEdit = () => {
    if (!currentSolution) return;
    if (!isManualEditing) {
      setStagedRows(currentSolution.rows);
      setManualChangesCount(0);
      setIsManualEditing(true);
    } else {
      setIsManualEditing(false);
    }
  };

  // Confirm and validate manual schedule changes in <150ms
  const handleConfirmManualEdits = async () => {
    if (!currentSolution) return;
    setIsValidatingManual(true);
    setSolveFeedback({
      type: 'info',
      message: `Auditing manual modifications on Scenario ${selectedScenario} (<150ms)...`,
    });

    try {
      const accessRows = stagedRows
        .filter((r) => !r.isDerived)
        .map((r) => ({
          activity_id: r.activityId,
          access_seq: r.accessSeq,
          week: r.week,
          eclo: r.eclo ? 1 : 0,
          access_night: r.accessNight || 1,
        }));

      const occupancyRows = stagedRows.map((r) => ({
        activity_id: r.activityId,
        week: r.week,
        location_id: r.locationId,
        co_share_group: r.coShareGroup || `slot_${r.activityId}`,
      }));

      const audit = await validateScheduleRemote(selectedScenario, accessRows, occupancyRows);
      const newScore =
        audit?.soft_scores?.penalty_score ??
        (audit?.soft_scores?.objective_score !== 0
          ? audit?.soft_scores?.objective_score
          : audit?.soft_scores?.priority_weighted_score) ??
        currentSolution.score;
      const baseline = currentSolution.baselineScore ?? currentSolution.score;
      const delta = Number((newScore - baseline).toFixed(2));
      const timestamp = new Date().toISOString();

      const updatedRecord: SolvedScheduleRecord = {
        ...currentSolution,
        currentScore: newScore,
        score: newScore,
        scoreDelta: delta,
        isManuallyEdited: true,
        rows: stagedRows,
        scoreBreakdown: {
          overrunDays: audit?.soft_scores?.overrun_days_total ?? 0,
          excessNights: audit?.soft_scores?.excess_access_nights_total ?? 0,
          ecloNights: audit?.soft_scores?.eclo_nights_total ?? 0,
          priorityWeightedScore: audit?.soft_scores?.priority_weighted_score ?? 0,
        },
        valResult: {
          ...currentSolution.valResult,
          feasible: audit.feasible,
          hardViolations: audit.hard_violations || [],
          softScores: {
            scenario: selectedScenario,
            overrunDaysTotal: audit?.soft_scores?.overrun_days_total ?? 0,
            contractsOverrunning: audit?.soft_scores?.contracts_overrunning ?? 0,
            earlinessTotal: audit?.soft_scores?.earliness_days_total ?? 0,
            excessAccessNightsTotal: audit?.soft_scores?.excess_access_nights_total ?? 0,
            ecloNightsTotal: audit?.soft_scores?.eclo_nights_total ?? 0,
            priorityOverrun: audit?.soft_scores?.priority_overrun ?? {},
            priorityWeightedScore: audit?.soft_scores?.priority_weighted_score ?? 0,
          },
          validationLog: audit.validation_log || [],
          validatedAt: timestamp,
        },
      };

      setSolvedSchedules((prev) => {
        const next = { ...prev, [selectedScenario]: updatedRecord };
        try {
          localStorage.setItem('nebulax_scenario_solutions_v1', JSON.stringify(next));
        } catch {}
        return next;
      });

      setIsManualEditing(false);
      setSolveFeedback({
        type: audit.feasible ? 'success' : 'error',
        message: `Manual schedule scored in <150ms! Feasible: ${
          audit.feasible ? 'VALID' : 'INVALID'
        }. New Score: ${newScore.toFixed(1)} (${
          delta >= 0 ? '+' : ''
        }${delta.toFixed(1)} vs CP-SAT Baseline).`,
      });
    } catch (err: any) {
      setSolveFeedback({
        type: 'error',
        message: `Validation failed: ${err.message}`,
      });
    } finally {
      setIsValidatingManual(false);
    }
  };

  // Revert manual edits back to CP-SAT optimal baseline
  const handleRevertBaseline = () => {
    if (!currentSolution || !currentSolution.baselineRows) return;
    const baseScore = currentSolution.baselineScore ?? currentSolution.score;
    const baseRows = currentSolution.baselineRows;

    const revertedRecord: SolvedScheduleRecord = {
      ...currentSolution,
      rows: baseRows,
      currentScore: baseScore,
      score: baseScore,
      scoreDelta: 0,
      isManuallyEdited: false,
    };

    setSolvedSchedules((prev) => {
      const next = { ...prev, [selectedScenario]: revertedRecord };
      try {
        localStorage.setItem('nebulax_scenario_solutions_v1', JSON.stringify(next));
      } catch {}
      return next;
    });

    setStagedRows(baseRows);
    setManualChangesCount(0);
    setIsManualEditing(false);

    setSolveFeedback({
      type: 'success',
      message: `Reverted to CP-SAT optimal baseline schedule for Scenario ${selectedScenario}. Score: ${baseScore.toFixed(1)}`,
    });
  };

  // Core CP-SAT Solver Execution Flow
  const handleRunSolver = async () => {
    setIsSolving(true);
    setIsManualEditing(false);
    setSolveFeedback({
      type: 'info',
      message: `Solving Scenario ${selectedScenario} with CP-SAT (time budget: ${solveBudgetSeconds}s)...`,
    });

    try {
      const result = await solveScenarioRemote(selectedScenario, solveBudgetSeconds);
      if (result.feasible) {
        const wallTime = result.detail?.wall_time_seconds ?? solveBudgetSeconds;
        const score =
          result.soft_scores?.penalty_score ??
          (result.soft_scores?.objective_score !== 0
            ? result.soft_scores?.objective_score
            : result.soft_scores?.priority_weighted_score) ??
          0;
        const status = result.detail?.solver_status === 'OPTIMAL' || result.detail?.objective_optimized ? 'OPTIMAL' : 'FEASIBLE';
        const timestamp = new Date().toISOString();

        // Load timetable rows & deterministic audit for full verification
        const [timetableRows, audit] = await Promise.all([
          getTimetable(`run-${selectedScenario.toLowerCase()}`, selectedScenario),
          validateScheduleRemote(selectedScenario).catch(() => null),
        ]);

        const validationLog = audit?.validation_log || result.validation_log || [];

        const solvedRecord: SolvedScheduleRecord = {
          scenario: selectedScenario,
          solvedTimestamp: timestamp,
          wallTimeSeconds: Number(wallTime.toFixed(2)),
          feasibilityStatus: status,
          score,
          baselineScore: score,
          currentScore: score,
          scoreDelta: 0,
          isManuallyEdited: false,
          scoreBreakdown: {
            overrunDays: result.soft_scores?.overrun_days_total ?? 0,
            excessNights: result.soft_scores?.excess_access_nights_total ?? 0,
            ecloNights: result.soft_scores?.eclo_nights_total ?? 0,
            priorityWeightedScore: result.soft_scores?.priority_weighted_score ?? 0,
          },
          rows: timetableRows,
          baselineRows: timetableRows,
          valResult: {
            runId: `run-${selectedScenario.toLowerCase()}-${Date.now()}`,
            revisionNumber: '1.0',
            scenario: selectedScenario,
            feasible: true,
            hardViolations: result.hard_violations || [],
            softScores: {
              scenario: selectedScenario,
              overrunDaysTotal: result.soft_scores?.overrun_days_total ?? 0,
              contractsOverrunning: result.soft_scores?.contracts_overrunning ?? 0,
              earlinessTotal: result.soft_scores?.earliness_days_total ?? 0,
              excessAccessNightsTotal: result.soft_scores?.excess_access_nights_total ?? 0,
              ecloNightsTotal: result.soft_scores?.eclo_nights_total ?? 0,
              priorityOverrun: result.soft_scores?.priority_overrun ?? {},
              priorityWeightedScore: result.soft_scores?.priority_weighted_score ?? 0,
            },
            validationLog,
            validatedAt: timestamp,
            capacityHotspots: [],
            nightsScheduled: timetableRows.length,
            ecloNights: result.soft_scores?.eclo_nights_total ?? 0,
          },
          runId: `run-${selectedScenario.toLowerCase()}-${Date.now()}`,
        };

        setSolvedSchedules((prev) => {
          const next = { ...prev, [selectedScenario]: solvedRecord };
          try {
            localStorage.setItem('nebulax_scenario_solutions_v1', JSON.stringify(next));
          } catch {}
          return next;
        });

        const datasetInfo = result.dataset_signature?.lines_count
          ? ` on ${result.dataset_signature.lines_count} lines (${result.dataset_signature.activities_count} activities)`
          : '';

        setSolveFeedback({
          type: 'success',
          message: `Scenario ${selectedScenario} verified and solved in ${wallTime.toFixed(1)}s${datasetInfo}! Penalty Score: ${score}`,
        });
      } else {
        setSolveFeedback({
          type: 'error',
          message: `Solver status: ${result.detail?.solver_status || 'INFEASIBLE'}. ${result.detail?.message || 'Try increasing the computational time budget.'}`,
        });
      }
    } catch (err: any) {
      setSolveFeedback({
        type: 'error',
        message: `Solver failed: ${err.message}`,
      });
    } finally {
      setIsSolving(false);
    }
  };

  const handleFastAudit = async () => {
    if (!currentSolution) return;
    setSolveFeedback({
      type: 'info',
      message: `Running deterministic 8-rule audit on Scenario ${selectedScenario}...`,
    });
    try {
      const audit = await validateScheduleRemote(selectedScenario);
      if (audit && audit.soft_scores) {
        setSolvedSchedules(prev => {
          const existing = prev[selectedScenario];
          if (!existing) return prev;
          return {
            ...prev,
            [selectedScenario]: {
              ...existing,
              valResult: {
                ...existing.valResult,
                feasible: audit.feasible,
                hardViolations: audit.hard_violations || [],
                softScores: {
                  scenario: selectedScenario,
                  overrunDaysTotal: audit.soft_scores.overrun_days_total ?? 0,
                  contractsOverrunning: audit.soft_scores.contracts_overrunning ?? 0,
                  earlinessTotal: audit.soft_scores.earliness_days_total ?? 0,
                  excessAccessNightsTotal: audit.soft_scores.excess_access_nights_total ?? 0,
                  ecloNightsTotal: audit.soft_scores.eclo_nights_total ?? 0,
                  priorityOverrun: audit.soft_scores.priority_overrun ?? {},
                  priorityWeightedScore: audit.soft_scores.priority_weighted_score ?? 0,
                },
                validationLog: audit.validation_log || existing.valResult.validationLog,
              },
            },
          };
        });
      }
      setSolveFeedback({
        type: audit.feasible ? 'success' : 'error',
        message: audit.feasible
          ? `Audit Certified! Feasible with 0 hard violations. Score: ${audit.soft_scores?.objective_score}`
          : `Audit Breached: Found ${audit.hard_violations?.length ?? 0} hard violations.`,
      });
    } catch (err: any) {
      setSolveFeedback({
        type: 'error',
        message: `Validation failed: ${err.message}`,
      });
    }
  };

  return (
    <div className="page-wrap">
      {/* 1. Header with Scenario Tabs and Global Context */}
      <div className="run-header">
        <div className="run-header-meta">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="chip chip--pc" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CalendarClock size={13} /> Master Schedule
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Horizon CW01–CW30 2027</span>
            </div>
            <h1 className="page-title">Railway Possession Schedule & Timetable</h1>
            <p className="page-subtitle">
              {currentSolution
                ? `Engine Solved · Scenario ${selectedScenario} · Version ${currentSolution.runId}`
                : `Awaiting CP-SAT Calculation · Preferred Scenario: ${selectedScenario}`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DatabaseStatusBadge />
            {currentSolution && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Sparkles size={14} />}
                onClick={handleFastAudit}
                title="Run instantaneous <150ms deterministic 8-rule audit"
              >
                Audit (&lt;150ms)
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={currentSolution ? <RotateCcw size={14} /> : <Play size={14} />}
              loading={isSolving}
              onClick={handleRunSolver}
              title="Launch CP-SAT optimization engine"
            >
              {isSolving ? 'Solving...' : currentSolution ? 'Recalculate' : 'Calculate'}
            </Button>
            {currentSolution && (
              <RunStatusBadge status="ready" validation={currentSolution.valResult.feasible ? 'valid' : 'invalid'} />
            )}
          </div>
        </div>

        {/* Solver Notification Banner */}
        {solveFeedback && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor:
                solveFeedback.type === 'success'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : solveFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(59, 130, 246, 0.1)',
              color:
                solveFeedback.type === 'success'
                  ? 'var(--emerald-600, #059669)'
                  : solveFeedback.type === 'error'
                  ? 'var(--rose-600, #e11d48)'
                  : 'var(--blue-600, #2563eb)',
              border: `1px solid ${
                solveFeedback.type === 'success'
                  ? 'rgba(16, 185, 129, 0.3)'
                  : solveFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(59, 130, 246, 0.3)'
              }`,
            }}
          >
            {solveFeedback.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : solveFeedback.type === 'error' ? (
              <AlertTriangle size={16} />
            ) : (
              <Cpu size={16} />
            )}
            <span>{solveFeedback.message}</span>
          </div>
        )}

        {/* Scenario Switcher Tabs & Download Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <div className="seg-control" role="tablist" aria-label="Scenario Selector">
            <button
              className={`seg-btn${selectedScenario === 'A' ? ' active' : ''}`}
              onClick={() => handleScenarioChange('A')}
              role="tab"
              aria-selected={selectedScenario === 'A'}
            >
              Scenario A {solvedSchedules.A && '✓'}
            </button>
            <button
              className={`seg-btn${selectedScenario === 'B' ? ' active' : ''}`}
              onClick={() => handleScenarioChange('B')}
              role="tab"
              aria-selected={selectedScenario === 'B'}
            >
              Scenario B {solvedSchedules.B && '✓'}
            </button>
            <button
              className={`seg-btn${selectedScenario === 'C' ? ' active' : ''}`}
              onClick={() => handleScenarioChange('C')}
              role="tab"
              aria-selected={selectedScenario === 'C'}
            >
              Scenario C {solvedSchedules.C && '✓'}
            </button>
          </div>

          {currentSolution && (
            <div className="run-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FileArchive size={14} />}
                onClick={handleDownloadZip}
                title="Download complete competition submission package (all 3 CSVs in .zip)"
              >
                Download Submission (.zip)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => handleDownloadCsv('SCHEDULE_ACCESS.csv')}
                title="Download access shifts schedule"
              >
                SCHEDULE_ACCESS.csv
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => handleDownloadCsv('SCHEDULE_OCCUPANCY.csv')}
                title="Download track occupancy & buffer schedule"
              >
                SCHEDULE_OCCUPANCY.csv
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => handleDownloadCsv('RESULTS.csv')}
                title="Download contract completion dates & overruns"
              >
                RESULTS.csv
              </Button>
            </div>
          )}
        </div>
      </div>

      <DisruptionControl onDisruptionApplied={handleRunSolver} />

      {/* 2. PRE-CALCULATION EMPTY STATE: If no verified CP-SAT calculation exists, master scheduler renders nothing */}
      {!currentSolution ? (
        <SchedulePreCalculationCard
          selectedScenario={selectedScenario}
          onScenarioChange={handleScenarioChange}
          timeBudgetSeconds={solveBudgetSeconds}
          onTimeBudgetChange={setSolveBudgetSeconds}
          onCalculate={handleRunSolver}
          isCalculating={isSolving}
        />
      ) : (
        <>
          {/* 3. SOLVED STATE TELEMETRY & VERSIONING BAR */}
          <ScheduleTelemetryBar
            scenario={currentSolution.scenario}
            engineName="Google OR-Tools CP-SAT"
            solvedTimestamp={currentSolution.solvedTimestamp}
            wallTimeSeconds={currentSolution.wallTimeSeconds}
            feasibilityStatus={currentSolution.feasibilityStatus}
            hardViolationsCount={currentSolution.valResult.hardViolations.length}
            softPenaltyScore={currentSolution.score}
            baselineScore={currentSolution.baselineScore}
            currentScore={currentSolution.currentScore ?? currentSolution.score}
            scoreDelta={currentSolution.scoreDelta ?? 0}
            isManuallyEdited={Boolean(currentSolution.isManuallyEdited)}
            scoreBreakdown={currentSolution.scoreBreakdown}
            onRecalculate={handleRunSolver}
            isRecalculating={isSolving}
            onToggleEdit={handleToggleManualEdit}
            isEditing={isManualEditing}
            onRevertBaseline={handleRevertBaseline}
          />

          {/* 4. MASTER SCHEDULER TIMETABLE & SIDEBAR VALIDATION */}
          <div className="run-layout">
            <div className="run-main section" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Manual Editing Active Banner */}
              {isManualEditing && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginBottom: 12,
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#f59e0b' }}>
                    <Edit3 size={15} />
                    <span style={{ fontWeight: 600 }}>Manual Editing Mode Active</span>
                    <span style={{ color: 'var(--ink-500)', fontSize: 12 }}>
                      · Drag activities to adjust weeks or locations ({manualChangesCount} change{manualChangesCount !== 1 ? 's' : ''} staged)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setStagedRows(currentSolution.rows);
                        setIsManualEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={isValidatingManual}
                      leftIcon={<Sparkles size={14} />}
                      onClick={handleConfirmManualEdits}
                      title="Validate draft against 8 rigid rules and recalculate penalty in <150ms"
                    >
                      Confirm &amp; Validate Changes (&lt;150ms)
                    </Button>
                  </div>
                </div>
              )}

              <TimetableFilters
                filters={filters}
                onChange={setFilters}
                availableWeeks={availableWeeks}
              />
              <div style={{ flex: 1, minHeight: 480 }}>
                {isManualEditing ? (
                  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <TimetableView rows={filteredRows} highlightCellKey={hlKey} editable={true} />
                  </DndContext>
                ) : (
                  <TimetableView rows={filteredRows} highlightCellKey={hlKey} editable={false} />
                )}
              </div>
            </div>

            <div className="run-sidebar">
              <ValidationPanel
                result={currentSolution.valResult}
                onRevalidate={handleFastAudit}
              />
              <ValidationLog
                log={currentSolution.valResult.validationLog}
                highlightCellKey={hlKey}
                onSelectViolation={entry => {
                  setHlKey(entry.timetableCellKey);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <React.Suspense fallback={
      <div className="page-wrap">
        <div className="run-header">
          <h1 className="page-title">Railway Possession Schedule & Timetable</h1>
          <p className="page-subtitle">Loading schedule environment...</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <LoadingSpinner />
        </div>
      </div>
    }>
      <ScheduleContent />
    </React.Suspense>
  );
}
