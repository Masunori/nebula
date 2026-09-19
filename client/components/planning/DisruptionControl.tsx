'use client';
import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Disruption {
  disruption_id: string;
  disruption_type: 'CAPACITY_REDUCTION' | 'ACTIVITY_DELAY' | 'SECTOR_CLOSURE' | 'EMERGENCY_POSSESSION';
  title: string;
  description?: string;
  location_id?: string;
  activity_id?: string;
  from_week: number;
  to_week: number;
  adjusted_capacity?: number;
  delay_weeks?: number;
  is_active: boolean;
  created_at?: string;
  created_by?: string;
}

interface DisruptionControlProps {
  onDisruptionApplied?: () => void;
}

export function DisruptionControl({ onDisruptionApplied }: DisruptionControlProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [impact, setImpact] = useState<string | null>(null);

  // Form fields
  const [disruptionType, setDisruptionType] = useState<Disruption['disruption_type']>('CAPACITY_REDUCTION');
  const [title, setTitle] = useState('');
  const [locationId, setLocationId] = useState('SEC:ALP:S02_S03:EB');
  const [activityId, setActivityId] = useState('A001');
  const [fromWeek, setFromWeek] = useState(1);
  const [toWeek, setToWeek] = useState(4);
  const [adjustedCapacity, setAdjustedCapacity] = useState(0);
  const [delayWeeks, setDelayWeeks] = useState(1);
  const [reason, setReason] = useState('');

  const fetchDisruptions = async () => {
    try {
      const res = await fetch('/api/disruptions', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setDisruptions(data.disruptions || []);
      }
    } catch {
      // offline fallback
    }
  };

  useEffect(() => {
    fetchDisruptions();
  }, []);

  const handleCreate = async () => {
    if (!title) {
      alert('Please enter a disruption title');
      return;
    }
    setLoading(true);
    setImpact(null);
    try {
      const payload = {
        disruption_type: disruptionType,
        title,
        description: reason,
        location_id: disruptionType === 'ACTIVITY_DELAY' ? null : locationId,
        activity_id: disruptionType === 'ACTIVITY_DELAY' ? activityId : null,
        from_week: fromWeek,
        to_week: toWeek,
        adjusted_capacity: disruptionType === 'CAPACITY_REDUCTION' || disruptionType === 'SECTOR_CLOSURE' ? adjustedCapacity : null,
        delay_weeks: disruptionType === 'ACTIVITY_DELAY' ? delayWeeks : 0,
        created_by: 'Train Controller',
      };

      const res = await fetch('/api/disruptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setTitle('');
        setReason('');
        setImpact('Disruption saved to PostgreSQL. Preprocessed problem recalibrated. Triggering recalculation...');
        await fetchDisruptions();
        window.dispatchEvent(new CustomEvent('nebula_database_updated'));
        onDisruptionApplied?.();
      } else {
        const err = await res.json();
        alert(`Failed to save disruption: ${err.detail || err.error || 'Server error'}`);
      }
    } catch (e: any) {
      alert(`Error saving disruption: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch(`/api/disruptions/${id}`, { method: 'POST' });
      if (res.ok) {
        await fetchDisruptions();
        window.dispatchEvent(new CustomEvent('nebula_database_updated'));
        onDisruptionApplied?.();
      }
    } catch (e: any) {
      alert(`Error toggling disruption: ${e.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/disruptions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchDisruptions();
        window.dispatchEvent(new CustomEvent('nebula_database_updated'));
        onDisruptionApplied?.();
      }
    } catch (e: any) {
      alert(`Error deleting disruption: ${e.message}`);
    }
  };

  const activeCount = disruptions.filter(d => d.is_active).length;

  return (
    <div className="disruption-panel mb-4 border border-slate-700/80 rounded-lg bg-slate-900/60 overflow-hidden shadow-sm">
      <div
        className="disruption-header flex items-center justify-between p-3.5 bg-slate-800/80 cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2.5">
          {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          <div className="flex items-center gap-2">
            <AlertOctagon size={16} className={activeCount > 0 ? "text-amber-400 animate-pulse" : "text-slate-400"} />
            <span className="font-semibold text-sm text-slate-100">
              Operational Disruptions & Network Change Input
            </span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {activeCount} active
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-slate-400">
          {open ? 'Collapse' : 'Expand to inject disruption signal'}
        </span>
      </div>

      {open && (
        <div className="p-4 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Inject operational incidents or track closures directly into PostgreSQL. When saved, the preprocessed optimization cache updates and the CP-SAT engine immediately reflects modified capacity or delayed activity release dates.
          </p>

          {/* Active Disruptions Table */}
          {disruptions.length > 0 && (
            <div className="border border-slate-700 rounded-md overflow-hidden bg-slate-950/40">
              <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700 font-semibold text-slate-300 flex justify-between items-center">
                <span>Active Network Disruptions</span>
                <span className="text-[11px] font-mono text-slate-400">{disruptions.length} total</span>
              </div>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                {disruptions.map((d) => (
                  <div key={d.disruption_id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-800/30">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${d.is_active ? 'bg-amber-400' : 'bg-slate-600'}`}></span>
                        <span className="font-semibold text-slate-200">{d.title}</span>
                        <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-800 rounded">
                          {d.disruption_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 font-mono">
                        <span>W{d.from_week}–W{d.to_week}</span>
                        {d.location_id && <span>Loc: {d.location_id}</span>}
                        {d.activity_id && <span>Activity: {d.activity_id}</span>}
                        {d.adjusted_capacity !== undefined && d.adjusted_capacity !== null && (
                          <span className="text-amber-400 font-bold">Cap: {d.adjusted_capacity}</span>
                        )}
                        {d.delay_weeks ? (
                          <span className="text-rose-400 font-bold">+{d.delay_weeks}w delay</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(d.disruption_id)}
                        className={`px-2 py-1 rounded text-[11px] font-medium border ${
                          d.is_active
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {d.is_active ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => handleDelete(d.disruption_id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete disruption"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-3">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Plus size={14} className="text-teal-400" />
              <span>Add New Disruption</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Disruption Type</label>
                <select
                  value={disruptionType}
                  onChange={(e) => setDisruptionType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="CAPACITY_REDUCTION">Track Capacity Reduction</option>
                  <option value="ACTIVITY_DELAY">Activity Release Delay</option>
                  <option value="SECTOR_CLOSURE">Total Sector Closure</option>
                  <option value="EMERGENCY_POSSESSION">Emergency Exclusive Possession</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Title / Event Summary</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Broken rail near S02, OLE repair"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              {disruptionType !== 'ACTIVITY_DELAY' ? (
                <>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Location ID</label>
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500 font-mono"
                    >
                      <option value="SEC:ALP:S01_S02:EB">SEC:ALP:S01_S02:EB</option>
                      <option value="SEC:ALP:S01_S02:WB">SEC:ALP:S01_S02:WB</option>
                      <option value="SEC:ALP:S02_S03:EB">SEC:ALP:S02_S03:EB</option>
                      <option value="SEC:ALP:S02_S03:WB">SEC:ALP:S02_S03:WB</option>
                      <option value="SEC:ALP:S03_S04:EB">SEC:ALP:S03_S04:EB</option>
                      <option value="STA:ALP:S02:EB">STA:ALP:S02:EB</option>
                      <option value="STA:ALP:S03:EB">STA:ALP:S03:EB</option>
                      <option value="SEC:BET:S11_S12:EB">SEC:BET:S11_S12:EB</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Adjusted Supply Capacity</label>
                    <input
                      type="number"
                      min={0}
                      max={4}
                      value={adjustedCapacity}
                      onChange={(e) => setAdjustedCapacity(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Activity ID</label>
                    <input
                      type="text"
                      value={activityId}
                      onChange={(e) => setActivityId(e.target.value)}
                      placeholder="e.g. A001"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Delay Weeks Added</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={delayWeeks}
                      onChange={(e) => setDelayWeeks(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-slate-400 text-[11px] mb-1">From Week</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={fromWeek}
                    onChange={(e) => setFromWeek(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-slate-400 text-[11px] mb-1">To Week</label>
                  <input
                    type="number"
                    min={fromWeek}
                    max={52}
                    value={toWeek}
                    onChange={(e) => setToWeek(parseInt(e.target.value, 10) || fromWeek)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Operational Notes / Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Root cause or safety directive"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="primary" onClick={handleCreate} loading={loading}>
                Save Disruption to PostgreSQL & Re-optimize
              </Button>
            </div>
          </div>

          {impact && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{impact}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
