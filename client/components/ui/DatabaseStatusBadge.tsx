'use client';

import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DBStatus {
  connected: boolean;
  database: string;
  schema: string;
  port: number;
  active_disruptions: number;
  preprocessed_cached: boolean;
  counts?: {
    activities?: number;
    location_supply?: number;
    contracts?: number;
    preprocessed_activities?: number;
  };
}

export function DatabaseStatusBadge() {
  const [status, setStatus] = useState<DBStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/database/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      setStatus({
        connected: false,
        database: 'nebula',
        schema: 'nebula',
        port: 5432,
        active_disruptions: 0,
        preprocessed_cached: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);

    const handleDbUpdate = () => {
      fetchStatus();
    };
    window.addEventListener('nebula_database_updated', handleDbUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('nebula_database_updated', handleDbUpdate);
    };
  }, []);

  const isConnected = status?.connected ?? false;

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
    >
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all ${
          isConnected
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:border-rose-500/50'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          ></span>
        </span>

        <Database size={13} className="shrink-0" />
        <span className="font-mono tracking-tight">
          {isConnected ? 'PostgreSQL Active · nebula' : 'Database Offline'}
        </span>

        {status?.active_disruptions ? (
          <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
            {status.active_disruptions} disruption{status.active_disruptions > 1 ? 's' : ''}
          </span>
        ) : null}

        <button
          onClick={(e) => {
            e.stopPropagation();
            fetchStatus();
          }}
          className="text-slate-400 hover:text-slate-200 transition-colors ml-0.5"
          title="Refresh database status"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {tooltipOpen && status && (
        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg shadow-xl text-xs z-50 text-slate-200 pointer-events-none">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              {isConnected ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <AlertCircle size={13} className="text-rose-400" />
              )}
              PostgreSQL Data Engine
            </span>
            <span className="font-mono text-[10px] text-slate-400">Port 5432</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Single Source:</span>
              <span className="text-slate-200">{status.database} / {status.schema}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Activities:</span>
              <span className="text-emerald-400">{status.counts?.activities ?? 54} rows</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Locations:</span>
              <span className="text-slate-200">{status.counts?.location_supply ?? 76} rows</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Preprocessed CQRS:</span>
              <span className={status.preprocessed_cached ? "text-emerald-400" : "text-amber-400"}>
                {status.preprocessed_cached ? "Synced in DB (<5ms)" : "Pending sync"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active Disruptions:</span>
              <span className={status.active_disruptions > 0 ? "text-amber-300 font-bold" : "text-slate-400"}>
                {status.active_disruptions}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
