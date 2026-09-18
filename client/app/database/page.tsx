"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw, UploadCloud, Train, Database } from "lucide-react";
import { useDatabaseStore } from "@/lib/database-store";
import { DatabaseHeader } from "./components/DatabaseHeader";
import { NetworkTopologyViewer } from "./components/NetworkTopologyViewer";
import { ActivitySpatialFootprint } from "./components/ActivitySpatialFootprint";
import { ActivityDataGrid } from "./components/ActivityDataGrid";
import { DependencyDAGViewer } from "./components/DependencyDAGViewer";
import { RulesAndParametersDeck } from "./components/RulesAndParametersDeck";
import { EntryCreationDrawer } from "./components/EntryCreationDrawer";
import { DatabaseOperationsModal } from "./components/DatabaseOperationsModal";
import { StagedChangesBar } from "./components/StagedChangesBar";

export default function DatabaseStudioPage() {
  const store = useDatabaseStore();

  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isOperationsModalOpen, setIsOperationsModalOpen] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [showFootprintInActivities, setShowFootprintInActivities] = useState(true);

  const activeFootprint = store.getActivityFootprint(store.selectedActivityId);

  const handleToggleBound = () => {
    store.setSelectedTrackBound(store.selectedTrackBound === "EB" ? "WB" : "EB");
  };

  const handleSelectSector = (sectorId: string) => {
    setSectorFilter(sectorId);
    store.setActiveTab("activities");
  };

  const isDatabaseFlushed = store.state.activities.length === 0;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", color: "var(--ink-900)", paddingBottom: 110 }}>
      {/* 1. Global Navigation & User Account Header */}
      <DatabaseHeader
        overview={store.overview}
        activeTab={store.activeTab}
        setActiveTab={store.setActiveTab}
        selectedBound={store.selectedTrackBound}
        onToggleBound={handleToggleBound}
        personaMode={store.personaMode}
        onSelectPersona={store.setPersonaMode}
        onOpenCreateDrawer={() => setIsCreateDrawerOpen(true)}
        onOpenOperationsModal={() => setIsOperationsModalOpen(true)}
      />

      {/* 2. Main Studio Content View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-4">
        {/* Flushed Database Status Banner */}
        {isDatabaseFlushed && (
          <div
            className="section"
            style={{
              padding: 16,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderLeft: "4px solid var(--orange-500)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "var(--orange-500)" }} />
              <div>
                <strong style={{ display: "block", color: "var(--ink-900)", fontSize: 13, fontWeight: 600 }}>
                  Database Flushed & Empty (0 records)
                </strong>
                <span style={{ color: "var(--ink-500)", fontSize: 12 }}>
                  All railway tables have been cleared. Reload the official baseline dataset or ingest custom CSV files.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => store.loadPresetDataset("DEFAULT")}
                className="btn btn--primary btn--sm"
              >
                Reload Baseline Dataset
              </button>
              <button
                onClick={() => setIsOperationsModalOpen(true)}
                className="btn btn--secondary btn--sm"
              >
                Upload CSVs
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Network Graph Visualizer */}
        {store.activeTab === "topology" && (
          <div className="space-y-4 animate-in fade-in">
            <NetworkTopologyViewer
              lines={store.state.lines}
              stations={store.state.stations}
              sectors={store.state.sectors}
              locationSupply={store.state.locationSupply}
              selectedBound={store.selectedTrackBound}
              interchangeHubs={store.overview.interchange_hubs}
              selectedSectorId={sectorFilter}
              onSelectSector={handleSelectSector}
            />
          </div>
        )}

        {/* Tab 2: Contracts & Workloads Data Grid */}
        {store.activeTab === "activities" && (
          <div className="space-y-4 animate-in fade-in">
            <ActivityDataGrid
              activities={store.state.activities}
              selectedActivityId={store.selectedActivityId}
              onSelectActivity={store.setSelectedActivityId}
              onUpdateActivity={store.stageUpdateActivity}
              onOpenCreateDrawer={() => setIsCreateDrawerOpen(true)}
              personaMode={store.personaMode}
              filterSector={sectorFilter}
              onClearSectorFilter={() => setSectorFilter(null)}
            />

            {/* Collapsible 1D Spatial Footprint Inspector */}
            {activeFootprint && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    Spatial Safety Footprint (Linear Working Reach & Buffer Envelope)
                  </span>
                  <button
                    onClick={() => setShowFootprintInActivities(!showFootprintInActivities)}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    {showFootprintInActivities ? "Hide Footprint Bar" : "Show Footprint Bar"}
                  </button>
                </div>
                {showFootprintInActivities && (
                  <ActivitySpatialFootprint
                    footprint={activeFootprint}
                    activities={store.state.activities}
                    selectedActivityId={store.selectedActivityId}
                    onSelectActivity={store.setSelectedActivityId}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Predecessor DAG Structural Graph */}
        {store.activeTab === "dag" && (
          <div className="space-y-4 animate-in fade-in">
            <DependencyDAGViewer
              dagReport={store.dagReport}
              activities={store.state.activities}
              onBreakCycle={store.breakDagCycle}
              onSelectActivity={(id) => {
                store.setSelectedActivityId(id);
                store.setActiveTab("activities");
              }}
            />
          </div>
        )}

        {/* Tab 4: Rules & Parameters Tuning Deck */}
        {store.activeTab === "parameters" && (
          <div className="space-y-4 animate-in fade-in">
            <RulesAndParametersDeck
              bufferRules={store.state.bufferRules}
              parameters={store.state.parameters}
              onUpdateBufferRule={store.stageUpdateBufferRule}
              onUpdateParameter={store.stageUpdateParameter}
            />
          </div>
        )}

        {/* Tab 5: Ingestion & Flush Management Center */}
        {store.activeTab === "operations" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="section" style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--radius-lg)",
                  backgroundColor: "var(--teal-50)",
                  border: "1px solid var(--border-teal)",
                  color: "var(--teal-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-900)" }}>
                  Database Operations & Lifecycle Management
                </h2>
                <p style={{ fontSize: 13, color: "var(--ink-500)", maxWidth: 520, margin: "6px auto 0 auto" }}>
                  Ingest custom CSV datasets, switch between benchmark scenarios, swap individual workload files, or flush records completely.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 8 }}>
                <button
                  onClick={() => setIsOperationsModalOpen(true)}
                  className="btn btn--primary"
                >
                  Open Operations & Ingestion Center
                </button>
                <button
                  onClick={() => store.loadPresetDataset("DEFAULT")}
                  className="btn btn--secondary"
                >
                  Reload Default Baseline
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Slide-Over Entry Creation Drawer */}
      <EntryCreationDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        onAddActivity={store.stageAddActivity}
        contracts={store.state.contracts}
        stations={store.state.stations}
        bufferRules={store.state.bufferRules}
        existingActivities={store.state.activities}
      />

      {/* 4. Database Operations & Ingestion Modal */}
      <DatabaseOperationsModal
        isOpen={isOperationsModalOpen}
        onClose={() => setIsOperationsModalOpen(false)}
        onValidateUpload={store.validateUpload}
        onFlushDatabase={store.flushDatabase}
        onLoadPreset={store.loadPresetDataset}
        onIngestFiles={store.parseAndIngestCsvFiles}
      />

      {/* 5. Persistent Staged Changes Bottom Dock */}
      <StagedChangesBar
        stagedChanges={store.stagedChanges}
        onCommit={store.commitChanges}
        onDiscard={store.discardChanges}
      />
    </div>
  );
}
