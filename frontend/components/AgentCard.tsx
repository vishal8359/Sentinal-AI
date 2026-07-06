'use client';

import React from 'react';
import {
  formatLogAnalysisOutput,
  formatKnowledgeOutput,
  formatRootCauseOutput,
  formatRemediationOutput,
  formatCoordinatorOutput,
} from '../app/incidents/[id]/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentCardProps {
  agentName: string;
  status: string;
  output: string;
  confidence: number | null;
}

// ─── Confidence Ring SVG ─────────────────────────────────────────────────────

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);

  const color =
    pct >= 85
      ? '#34d399'   // emerald-400
      : pct >= 60
        ? '#fbbf24'  // amber-400
        : '#f87171'; // rose-400

  return (
    <div className="confidence-ring" title={`${pct}% confidence`}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={radius} fill="none" strokeWidth="3" className="ring-track" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          strokeWidth="3"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="ring-fill"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold" style={{ color }}>
        {pct}
      </span>
    </div>
  );
}

// ─── Skeleton placeholder ────────────────────────────────────────────────────

function SkeletonBody() {
  return (
    <div className="mt-3 space-y-2">
      <div className="skeleton-line h-3 w-full" />
      <div className="skeleton-line h-3 w-4/5" />
      <div className="skeleton-line h-3 w-3/5" />
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const tone = (() => {
    switch (status) {
      case 'done':
      case 'resolved':
      case 'approved':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'running':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30 running-glow';
      case 'pending':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      default:
        return 'bg-slate-700/60 text-slate-200 border-slate-600/30';
    }
  })();

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${tone}`}>
      {status}
    </span>
  );
}

// ─── Formatted body per agent type ───────────────────────────────────────────

function LogAnalysisBody({ output }: { output: string }) {
  const data = formatLogAnalysisOutput(output);
  if (!data) return <p className="text-sm text-slate-500 italic">No data yet</p>;

  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-200">{data.summary}</p>
      {data.anomalies.length > 0 && (
        <ul className="list-disc list-inside space-y-0.5 text-slate-400">
          {data.anomalies.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Component: <span className="text-slate-400">{data.component}</span>
        {data.timestamps.length > 0 && (
          <> · First seen: <span className="text-slate-400">{data.timestamps[0].replace('T', ' ').replace('Z', '')}</span></>
        )}
      </p>
    </div>
  );
}

function KnowledgeBody({ output }: { output: string }) {
  const data = formatKnowledgeOutput(output);
  if (!data) return <p className="text-sm text-slate-500 italic">No data yet</p>;

  return (
    <div className="space-y-2 text-sm">
      {data.snippets.map((s, i) => (
        <div key={i} className="rounded-lg border border-white/5 bg-slate-900/40 px-3 py-2">
          <span className="font-medium text-cyan-300">{s.title}</span>
          <span className="text-slate-400"> — {s.content}</span>
        </div>
      ))}
    </div>
  );
}

function RootCauseBody({ output }: { output: string }) {
  const data = formatRootCauseOutput(output);
  if (!data) return <p className="text-sm text-slate-500 italic">No data yet</p>;

  return (
    <div className="space-y-1.5 text-sm">
      {data.hypotheses.map((h) => (
        <div key={h.rank} className="flex items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-semibold text-cyan-300">
            {h.rank}
          </span>
          <p className="text-slate-200">
            <span className="font-medium">{h.cause}</span>
            <span className="text-cyan-400"> ({Math.round(h.confidence * 100)}%)</span>
            <span className="text-slate-400"> — {h.justification}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function RemediationBody({ output }: { output: string }) {
  const data = formatRemediationOutput(output);
  if (!data) return <p className="text-sm text-slate-500 italic">No data yet</p>;

  return (
    <div className="space-y-1.5 text-sm">
      {data.actions.map((a, i) => (
        <p key={i} className="text-slate-200">
          <span className="font-medium">{a.action}</span>
          <span className="text-slate-400"> — risk: </span>
          <span className={a.risk === 'low' ? 'text-emerald-400' : a.risk === 'medium' ? 'text-amber-400' : 'text-rose-400'}>
            {a.risk}
          </span>
          <span className="text-slate-400">, downtime: {a.downtime}</span>
        </p>
      ))}
    </div>
  );
}

function CoordinatorBody({ output }: { output: string }) {
  const data = formatCoordinatorOutput(output);
  if (!data) return <p className="text-sm text-slate-500 italic">No data yet</p>;

  return (
    <div className="text-sm">
      <p className="text-slate-200">{data.summary}</p>
    </div>
  );
}

function AgentBody({ agentName, output }: { agentName: string; output: string }) {
  switch (agentName) {
    case 'Log Analysis':
      return <LogAnalysisBody output={output} />;
    case 'Knowledge':
      return <KnowledgeBody output={output} />;
    case 'Root Cause':
      return <RootCauseBody output={output} />;
    case 'Remediation':
      return <RemediationBody output={output} />;
    case 'Coordinator':
      return <CoordinatorBody output={output} />;
    default:
      return <p className="text-sm text-slate-400">{output || 'Awaiting update'}</p>;
  }
}

// ─── Main AgentCard ──────────────────────────────────────────────────────────

export default function AgentCard({ agentName, status, output, confidence }: AgentCardProps) {
  const isRunning = status === 'running';
  const isPending = status === 'pending';

  return (
    <article className="relative rounded-2xl border border-white/10 bg-slate-950/60 p-4 min-h-[140px] flex flex-col transition-all duration-300">
      {/* Progress bar for running state */}
      {isRunning && <div className="progress-bar-track absolute top-0 left-4 right-4 rounded-t-2xl" />}

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-slate-100">{agentName}</h3>
        <div className="flex items-center gap-2">
          {confidence != null && status === 'done' && <ConfidenceRing value={confidence} />}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Body */}
      <div className="mt-3 flex-1">
        {isRunning || isPending ? <SkeletonBody /> : <AgentBody agentName={agentName} output={output} />}
      </div>
    </article>
  );
}
