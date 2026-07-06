'use client';

import { useEffect, useMemo, useState } from 'react';
import AgentCard from '@/components/AgentCard';
import IncidentGraph from '@/components/IncidentGraph';
import {
  formatRootCauseOutput,
  formatRemediationOutput,
} from './formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentRun {
  id: number;
  agent_name: string;
  status: string;
  input: string;
  output: string;
  confidence: number | null;
  timestamp: string;
}

interface IncidentDetail {
  incident: {
    id: string;
    title: string;
    severity: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
  };
  agent_runs: AgentRun[];
  approvals: Array<{ id: number; action: string; status: string; decided_at: string | null }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_NAMES = ['Coordinator', 'Log Analysis', 'Knowledge', 'Root Cause', 'Remediation'] as const;
const CHILD_AGENTS = ['Log Analysis', 'Knowledge', 'Root Cause', 'Remediation'] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function IncidentPage({ params }: { params: { id: string } }) {
  const incidentId = params.id;
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const wsBase = apiBase.replace('http', 'ws');

  // ── Fetch incident data ──────────────────────────────────────────────────

  const fetchIncident = async () => {
    try {
      const response = await fetch(`${apiBase}/incidents/${incidentId}`);
      if (!response.ok) throw new Error('Unable to reach backend');
      const data = await response.json();
      setIncident(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, incidentId]);

  // ── WebSocket for live updates ───────────────────────────────────────────

  useEffect(() => {
    const ws = new WebSocket(`${wsBase}/ws/incidents/${incidentId}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'connected') {
        setActionMessage('Live stream connected');
        return;
      }
      if (payload.type === 'workflow_complete') {
        setActionMessage('Coordinator completed a new investigation run');
        // Re-fetch so UI updates immediately
        fetchIncident();
      }
      if (payload.type === 'approval') {
        setActionMessage(`Approval ${payload.status}`);
        fetchIncident();
      }
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, wsBase]);

  // ── Latest action message ────────────────────────────────────────────────

  useEffect(() => {
    if (!incident) return;
    const latest = incident.agent_runs.at(-1);
    if (latest) {
      setActionMessage(`${latest.agent_name} → ${latest.status}`);
    }
  }, [incident]);

  // ── Auto-bootstrap investigation ────────────────────────────────────────

  useEffect(() => {
    if (!incident || !incidentId) return;
    const hasPendingApproval = incident.approvals.some((approval) => approval.status === 'pending');
    if (hasPendingApproval || incident.agent_runs.length > 0 || isPreparing) return;

    const bootstrapInvestigation = async () => {
      try {
        setIsPreparing(true);
        setActionMessage('Starting investigation...');
        const response = await fetch(`${apiBase}/incidents/${incidentId}/run`, { method: 'POST' });
        if (!response.ok) throw new Error('Investigation request failed');
        const refreshed = await fetch(`${apiBase}/incidents/${incidentId}`);
        if (!refreshed.ok) throw new Error('Unable to refresh incident');
        setIncident(await refreshed.json());
        setActionMessage('Investigation ready. Please approve or reject.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Investigation request failed');
      } finally {
        setIsPreparing(false);
      }
    };

    bootstrapInvestigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, incident, incidentId, isPreparing]);

  // ── Derived state: latest run per agent ──────────────────────────────────

  const latestRunByAgent = useMemo(() => {
    const map: Record<string, AgentRun> = {};
    if (!incident) return map;
    for (const run of incident.agent_runs) {
      map[run.agent_name] = run; // last one wins (ordered by timestamp ASC)
    }
    return map;
  }, [incident]);

  // ── Shared parsed data for Root Cause (Bug 3 fix) ────────────────────────

  const rootCauseData = useMemo(() => {
    const run = latestRunByAgent['Root Cause'];
    return run ? formatRootCauseOutput(run.output) : null;
  }, [latestRunByAgent]);

  // ── Shared parsed data for Remediation (Bug 3 fix) ──────────────────────

  const remediationData = useMemo(() => {
    const run = latestRunByAgent['Remediation'];
    return run ? formatRemediationOutput(run.output) : null;
  }, [latestRunByAgent]);

  // ── Agent statuses for graph ────────────────────────────────────────────

  const agentStatuses = useMemo(
    () =>
      AGENT_NAMES.map((name) => ({
        name,
        status: latestRunByAgent[name]?.status || 'pending',
      })),
    [latestRunByAgent],
  );

  // ── Approve / Reject ───────────────────────────────────────────────────

  const triggerAction = async (action: 'approve' | 'reject') => {
    try {
      const hasPendingApproval = incident?.approvals.some((approval) => approval.status === 'pending');
      if (!hasPendingApproval) {
        setActionMessage('Preparing the investigation workflow...');
        const runResponse = await fetch(`${apiBase}/incidents/${incidentId}/run`, { method: 'POST' });
        if (!runResponse.ok) throw new Error('Investigation setup failed');
        const refreshed = await fetch(`${apiBase}/incidents/${incidentId}`);
        if (!refreshed.ok) throw new Error('Unable to refresh incident');
        setIncident(await refreshed.json());
      }

      const response = await fetch(`${apiBase}/incidents/${incidentId}/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error('Approval request failed');
      const data = await response.json();
      setActionMessage(`${action}d incident ${data.status}`);
      const refreshed = await fetch(`${apiBase}/incidents/${incidentId}`);
      if (refreshed.ok) {
        setIncident(await refreshed.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval action failed');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),transparent_40%),linear-gradient(135deg,#020617,#111827)] p-6 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">SentinelAI</p>
              <h1 className="mt-2 text-3xl font-semibold">{incident?.incident.title || 'Payment Service incident'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">A live, human-in-the-loop incident response demo showing agents collaborate, then pause for approval before any simulated remediation runs.</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
              <div className="font-semibold">Status: {incident?.incident.status || 'open'}</div>
              <div className="mt-1 text-cyan-100/80">{actionMessage || 'Waiting for backend...'}</div>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">{error}</div> : null}

        {/* ── Agent Workspace + Graph ────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">

          {/* Live Agent Workspace */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Live Agent Workspace</h2>
              <div className="live-pulse rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-300">
                Streaming
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {AGENT_NAMES.map((agentName) => {
                const latest = latestRunByAgent[agentName];
                return (
                  <AgentCard
                    key={agentName}
                    agentName={agentName}
                    status={latest?.status || 'pending'}
                    output={latest?.output || ''}
                    confidence={latest?.confidence ?? null}
                  />
                );
              })}
            </div>
          </div>

          {/* Incident Graph (Bug 4 fix — React Flow) */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Incident Graph</h2>
            <div className="mt-6">
              <IncidentGraph agentStatuses={agentStatuses} />
            </div>
          </div>
        </section>

        {/* ── Root Cause Table + Remediation Card (Bug 3 fix) ─────── */}
        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">

          {/* Root Cause Hypotheses */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Root Cause Hypotheses</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Cause</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {rootCauseData?.hypotheses.length ? (
                    rootCauseData.hypotheses.map((h) => (
                      <tr key={h.rank} className="border-t border-white/10 bg-slate-900/70">
                        <td className="px-4 py-3 text-cyan-400 font-semibold">{h.rank}</td>
                        <td className="px-4 py-3 font-medium">{h.cause}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.round(h.confidence * 100)}%`,
                                  background: h.confidence >= 0.85 ? '#34d399' : h.confidence >= 0.6 ? '#fbbf24' : '#f87171',
                                }}
                              />
                            </div>
                            <span className="text-slate-300">{Math.round(h.confidence * 100)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{h.justification}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-3 text-slate-500 italic" colSpan={4}>No hypotheses yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remediation Card */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Remediation Card</h2>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              {remediationData?.actions.length ? (
                remediationData.actions.map((action, index) => (
                  <div key={`${action.action}-${index}`} className="mt-3 first:mt-0 rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium text-slate-100">{action.action}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        action.risk === 'low'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : action.risk === 'medium'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {action.risk} risk
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
                      <span>⏱ Downtime: {action.downtime}</span>
                      <span>
                        <span className="text-slate-500">Confidence: </span>
                        <span className="text-cyan-300">{Math.round(action.confidence * 100)}%</span>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No remediation steps yet.</p>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 hover:shadow-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPreparing}
                  onClick={() => triggerAction('approve')}
                >
                  ✓ Approve
                </button>
                <button
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition-all hover:bg-rose-500 hover:shadow-rose-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPreparing}
                  onClick={() => triggerAction('reject')}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
