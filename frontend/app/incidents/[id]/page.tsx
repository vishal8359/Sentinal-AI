'use client';

import { useEffect, useMemo, useState } from 'react';

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

export default function IncidentPage({ params }: { params: { id: string } }) {
  const incidentId = params.id;
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const wsBase = apiBase.replace('http', 'ws');

  useEffect(() => {
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

    fetchIncident();
  }, [apiBase, incidentId]);

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
      }
      if (payload.type === 'approval') {
        setActionMessage(`Approval ${payload.status}`);
      }
    };
    return () => ws.close();
  }, [incidentId, wsBase]);

  useEffect(() => {
    if (!incident) return;
    const latest = incident.agent_runs.at(-1);
    if (latest) {
      setActionMessage(`${latest.agent_name} -> ${latest.status}`);
    }
  }, [incident]);

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
  }, [apiBase, incident, incidentId, isPreparing]);

  const latestRootCause = useMemo(() => {
    const rootCauseRun = incident?.agent_runs.find((run) => run.agent_name === 'Root Cause');
    if (!rootCauseRun) return null;
    try {
      return JSON.parse(rootCauseRun.output).hypotheses || [];
    } catch {
      return [];
    }
  }, [incident]);

  const remediationActions = useMemo(() => {
    const remediationRun = incident?.agent_runs.find((run) => run.agent_name === 'Remediation');
    if (!remediationRun) return [];
    try {
      return JSON.parse(remediationRun.output).actions || [];
    } catch {
      return [];
    }
  }, [incident]);

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

  const statusTone = (status: string) => {
    switch (status) {
      case 'done':
      case 'resolved':
      case 'approved':
        return 'bg-emerald-500/20 text-emerald-300';
      case 'running':
        return 'bg-amber-500/20 text-amber-300';
      case 'pending':
        return 'bg-sky-500/20 text-sky-300';
      default:
        return 'bg-slate-700/60 text-slate-200';
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),transparent_40%),linear-gradient(135deg,#020617,#111827)] p-6 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
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

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Live Agent Workspace</h2>
              <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-300">Streaming</div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {['Coordinator', 'Log Analysis', 'Knowledge', 'Root Cause', 'Remediation'].map((agentName) => {
                const latest = incident?.agent_runs.filter((run) => run.agent_name === agentName).at(-1);
                return (
                  <article key={agentName} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium text-slate-100">{agentName}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${statusTone(latest?.status || 'pending')}`}>
                        {latest?.status || 'pending'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">{latest?.output || 'Awaiting update'}</p>
                    {latest?.confidence != null ? <p className="mt-3 text-sm text-cyan-200">Confidence {Math.round(latest.confidence * 100)}%</p> : null}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Incident Graph</h2>
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-200">Coordinator → Log + Knowledge → Root Cause → Remediation</div>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">Coordinator</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">Log Analysis</div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">Knowledge</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">Root Cause</div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">Remediation + Approval Gate</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Root Cause Hypotheses</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Cause</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRootCause?.length ? latestRootCause.map((item: any, index: number) => (
                    <tr key={`${item.cause}-${index}`} className="border-t border-white/10 bg-slate-900/70">
                      <td className="px-4 py-3">{item.cause}</td>
                      <td className="px-4 py-3">{Math.round(item.confidence * 100)}%</td>
                      <td className="px-4 py-3 text-slate-400">{item.justification}</td>
                    </tr>
                  )) : <tr><td className="px-4 py-3 text-slate-400" colSpan={3}>No hypotheses yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Remediation Card</h2>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              {remediationActions.length ? remediationActions.map((action: any, index: number) => (
                <div key={`${action.action}-${index}`} className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-slate-100">{action.action}</h3>
                    <span className="text-sm text-cyan-300">{action.risk}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Estimated downtime: {action.estimated_downtime}</p>
                  <p className="mt-1 text-sm text-slate-400">Confidence: {Math.round(action.confidence * 100)}%</p>
                </div>
              )) : <p className="text-sm text-slate-400">No remediation steps yet.</p>}
              <div className="mt-5 flex gap-3">
                <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPreparing} onClick={() => triggerAction('approve')}>Approve</button>
                <button className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPreparing} onClick={() => triggerAction('reject')}>Reject</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
