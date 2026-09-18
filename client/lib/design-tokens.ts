// =============================================================================
// NebulaX Semantic Design Tokens
// Decoupled styling architecture ready for teammate's style_guide document
// =============================================================================

export const DESIGN_TOKENS = {
  // Domain Role & Priority Palette
  role: {
    maintainerP1: {
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      accent: "text-rose-400",
      border: "border-rose-500/50",
      bg: "bg-rose-950/20",
      glow: "shadow-[0_0_12px_rgba(244,63,94,0.3)]",
    },
    commercialP2: {
      badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      accent: "text-cyan-400",
      border: "border-cyan-500/50",
      bg: "bg-cyan-950/20",
      glow: "shadow-[0_0_12px_rgba(6,182,212,0.3)]",
    },
    routineP3: {
      badge: "bg-slate-700/40 text-slate-300 border-slate-600/40",
      accent: "text-slate-400",
      border: "border-slate-700/50",
      bg: "bg-slate-900/30",
      glow: "none",
    },
    liveTrack: {
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      accent: "text-amber-400",
      border: "border-amber-500/50",
      bg: "bg-amber-950/20",
      indicator: "bg-amber-500 animate-pulse",
    },
    bufferEnvelope: {
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      bar: "bg-amber-500/25 border-amber-400/50 text-amber-300",
    },
    interchangeHub: {
      badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      accent: "text-purple-400",
      border: "border-purple-500/50",
      bg: "bg-purple-950/30",
      node: "#c084fc",
    },
  },

  // Lines & Network Topology
  track: {
    lineAlpha: {
      name: "Line Alpha",
      code: "ALP",
      color: "#06b6d4", // Cyan
      badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      border: "border-cyan-500",
      text: "text-cyan-400",
    },
    lineBeta: {
      name: "Line Beta",
      code: "BET",
      color: "#10b981", // Emerald
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      border: "border-emerald-500",
      text: "text-emerald-400",
    },
    singleTrackBottleneck: {
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      accent: "text-rose-400",
    },
    doubleTrackStandard: {
      badge: "bg-slate-800 text-slate-300 border-slate-700",
      accent: "text-slate-400",
    },
  },

  // Interaction State Feedback
  state: {
    cleanDAG: {
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      text: "text-emerald-400",
    },
    cycleError: {
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse",
      text: "text-rose-400",
    },
    stagedDraft: {
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      text: "text-amber-400",
    },
  },
};
