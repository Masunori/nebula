"use client";

import React, { useState } from "react";
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

  const activeFootprint = store.getActivityFootprint(store.selectedActivityId);

  const handleToggleBound = () => {
    store.setSelectedTrackBound(store.selectedTrackBound === "EB" ? "WB" : "EB");
  };

  const handleSelectSector = (sectorId: string) => {
    setSectorFilter(sectorId);
    store.setActiveTab("activities");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      {/* 1. Global Navigation & Overview Header */}
      <DatabaseHeader
        overview={store.overview}
        activeTab={store.activeTab}
        setActiveTab={store.setActiveTab}
        selectedBound={store.selectedTrackBound}
        onToggleBound={handleToggleBound}
        onOpenCreateDrawer={() => setIsCreateDrawerOpen(true)}
        onOpenOperationsModal={() => setIsOperationsModalOpen(true)}
      />

      {/* 2. Main Studio Content View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Tab 1: Network Topology & Static Supply */}
        {store.activeTab === "topology" && (
          <div className="space-y-6 animate-in fade-in">
            <NetworkTopologyViewer
              lines={store.state.lines}
              stations={store.state.stations}
              sectors={store.state.sectors}
              locationSupply={store.state.locationSupply}
              selectedBound={store.selectedTrackBound}
              interchangeHubs={store.overview.interchange_hubs}
              onSelectSector={handleSelectSector}
            />

            {/* Accompanying 1D Spatial Footprint Inspector */}
            <ActivitySpatialFootprint
              footprint={activeFootprint}
              activities={store.state.activities}
              selectedActivityId={store.selectedActivityId}
              onSelectActivity={store.setSelectedActivityId}
            />
          </div>
        )}

        {/* Tab 2: Contracts & Workloads Data Grid */}
        {store.activeTab === "activities" && (
          <div className="space-y-6 animate-in fade-in">
            <ActivityDataGrid
              activities={store.state.activities}
              selectedActivityId={store.selectedActivityId}
              onSelectActivity={store.setSelectedActivityId}
              onUpdateActivity={store.stageUpdateActivity}
              onOpenCreateDrawer={() => setIsCreateDrawerOpen(true)}
              filterSector={sectorFilter}
            />

            {/* Accompanying 1D Spatial Footprint Inspector */}
            <ActivitySpatialFootprint
              footprint={activeFootprint}
              activities={store.state.activities}
              selectedActivityId={store.selectedActivityId}
              onSelectActivity={store.setSelectedActivityId}
            />
          </div>
        )}

        {/* Tab 3: Predecessor DAG Structural Graph */}
        {store.activeTab === "dag" && (
          <div className="space-y-6 animate-in fade-in">
            <DependencyDAGViewer
              dagReport={store.dagReport}
              activities={store.state.activities}
              onSelectActivity={(id) => {
                store.setSelectedActivityId(id);
                store.setActiveTab("activities");
              }}
            />
          </div>
        )}

        {/* Tab 4: Rules & Parameters Tuning Deck */}
        {store.activeTab === "parameters" && (
          <div className="space-y-6 animate-in fade-in">
            <RulesAndParametersDeck
              bufferRules={store.state.bufferRules}
              parameters={store.state.parameters}
              onUpdateBufferRule={store.stageUpdateBufferRule}
              onUpdateParameter={store.stageUpdateParameter}
            />
          </div>
        )}

        {/* Tab 5: Operations & Ingestion Center */}
        {store.activeTab === "operations" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="p-6 bg-slate-900/80 rounded-2xl border border-slate-800 text-center space-y-4">
              <h2 className="text-base font-bold text-white">Database Operations Center</h2>
              <p className="text-xs text-slate-400 max-w-xl mx-auto">
                Manage your railway dataset lifecycle: ingest official 8-CSV datasets, swap individual work packages, or run benchmark stress tests.
              </p>
              <button
                onClick={() => setIsOperationsModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 cursor-pointer"
              >
                Launch Operations & Ingestion Modal
              </button>
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
        onLoadDataset={(ds) => {
          store.discardChanges();
        }}
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
