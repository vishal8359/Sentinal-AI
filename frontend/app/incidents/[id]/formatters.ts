// ─── Shared Agent Output Formatters ──────────────────────────────────────────
// Used by both the agent cards AND the summary widgets (Root Cause table,
// Remediation card) so they always stay in sync — fixes Bug 3.
// Every formatter returns a typed object or null. The components decide how
// to render null (skeleton / "no data yet").

// ─── Safe parse ──────────────────────────────────────────────────────────────

export function parseAgentOutput(raw: string | null | undefined): any {
  if (!raw || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    // If the string looks like a Python repr (single-quoted dict), try
    // converting it. This is a safety net for legacy data already in the DB.
    try {
      const fixed = raw
        .replace(/'/g, '"')
        .replace(/None/g, 'null')
        .replace(/True/g, 'true')
        .replace(/False/g, 'false');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

// ─── Log Analysis ────────────────────────────────────────────────────────────

export interface LogAnalysisFormatted {
  summary: string;
  anomalies: string[];
  component: string;
  timestamps: string[];
}

export function formatLogAnalysisOutput(raw: string | null | undefined): LogAnalysisFormatted | null {
  const parsed = parseAgentOutput(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  return {
    summary: parsed.summary ?? 'No summary available.',
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
    component: parsed.likely_component ?? 'unknown',
    timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : [],
  };
}

// ─── Knowledge ───────────────────────────────────────────────────────────────

export interface KnowledgeSnippet {
  title: string;
  content: string; // truncated to ~100 chars
}

export interface KnowledgeFormatted {
  snippets: KnowledgeSnippet[];
}

export function formatKnowledgeOutput(raw: string | null | undefined): KnowledgeFormatted | null {
  const parsed = parseAgentOutput(raw);
  if (!parsed || !Array.isArray(parsed.snippets)) return null;

  return {
    snippets: parsed.snippets.map((s: any) => ({
      title: s.title ?? 'Untitled',
      content:
        typeof s.content === 'string'
          ? s.content.length > 100
            ? s.content.slice(0, 100) + '…'
            : s.content
          : 'No content',
    })),
  };
}

// ─── Root Cause ──────────────────────────────────────────────────────────────

export interface RootCauseHypothesis {
  rank: number;
  cause: string;
  confidence: number;
  justification: string;
}

export interface RootCauseFormatted {
  hypotheses: RootCauseHypothesis[];
}

export function formatRootCauseOutput(raw: string | null | undefined): RootCauseFormatted | null {
  const parsed = parseAgentOutput(raw);
  if (!parsed || !Array.isArray(parsed.hypotheses) || parsed.hypotheses.length === 0) return null;

  return {
    hypotheses: parsed.hypotheses.map((h: any, i: number) => ({
      rank: i + 1,
      cause: h.cause ?? 'Unknown',
      confidence: typeof h.confidence === 'number' ? h.confidence : 0,
      justification: h.justification ?? '',
    })),
  };
}

// ─── Remediation ─────────────────────────────────────────────────────────────

export interface RemediationAction {
  action: string;
  risk: string;
  downtime: string;
  confidence: number;
}

export interface RemediationFormatted {
  actions: RemediationAction[];
}

export function formatRemediationOutput(raw: string | null | undefined): RemediationFormatted | null {
  const parsed = parseAgentOutput(raw);
  if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) return null;

  return {
    actions: parsed.actions.map((a: any) => ({
      action: a.action ?? 'Unknown action',
      risk: a.risk ?? 'unknown',
      downtime: a.estimated_downtime ?? 'unknown',
      confidence: typeof a.confidence === 'number' ? a.confidence : 0,
    })),
  };
}

// ─── Coordinator ─────────────────────────────────────────────────────────────

export interface CoordinatorFormatted {
  summary: string;
  agentsDispatched: number;
  topCause: string;
  topConfidence: number;
}

export function formatCoordinatorOutput(raw: string | null | undefined): CoordinatorFormatted | null {
  const parsed = parseAgentOutput(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  if (parsed.summary) {
    return {
      summary: parsed.summary,
      agentsDispatched: parsed.agents_dispatched ?? 0,
      topCause: parsed.top_cause ?? '',
      topConfidence: typeof parsed.top_confidence === 'number' ? parsed.top_confidence : 0,
    };
  }

  return null;
}
