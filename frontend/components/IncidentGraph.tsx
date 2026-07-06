'use client';

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentStatus {
  name: string;
  status: string; // 'pending' | 'running' | 'done'
}

interface IncidentGraphProps {
  agentStatuses: AgentStatus[];
}

// ─── Node styling by status ──────────────────────────────────────────────────

function getNodeStyle(status: string) {
  const base = {
    borderRadius: '12px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    border: '1px solid',
    minWidth: '140px',
    textAlign: 'center' as const,
    transition: 'all 0.3s ease',
  };

  switch (status) {
    case 'done':
      return {
        ...base,
        background: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(52, 211, 153, 0.4)',
        color: '#6ee7b7',
        boxShadow: '0 0 16px rgba(16, 185, 129, 0.1)',
      };
    case 'running':
      return {
        ...base,
        background: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(251, 191, 36, 0.4)',
        color: '#fcd34d',
        boxShadow: '0 0 16px rgba(245, 158, 11, 0.15)',
        animation: 'status-glow 2s ease-in-out infinite',
      };
    case 'pending':
    default:
      return {
        ...base,
        background: 'rgba(51, 65, 85, 0.5)',
        borderColor: 'rgba(148, 163, 184, 0.15)',
        color: '#94a3b8',
      };
  }
}

// ─── Static layout positions ─────────────────────────────────────────────────

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  Coordinator:     { x: 140, y: 0 },
  'Log Analysis':  { x: 20,  y: 100 },
  Knowledge:       { x: 260, y: 100 },
  'Root Cause':    { x: 140, y: 200 },
  Remediation:     { x: 140, y: 300 },
};

// ─── Edge definitions ────────────────────────────────────────────────────────

const EDGES: Edge[] = [
  { id: 'e-coord-log',   source: 'Coordinator',  target: 'Log Analysis',  animated: true, style: { stroke: '#38bdf8', strokeWidth: 1.5 } },
  { id: 'e-coord-know',  source: 'Coordinator',  target: 'Knowledge',     animated: true, style: { stroke: '#38bdf8', strokeWidth: 1.5 } },
  { id: 'e-log-root',    source: 'Log Analysis',  target: 'Root Cause',    animated: true, style: { stroke: '#38bdf8', strokeWidth: 1.5 } },
  { id: 'e-know-root',   source: 'Knowledge',     target: 'Root Cause',    animated: true, style: { stroke: '#38bdf8', strokeWidth: 1.5 } },
  { id: 'e-root-remed',  source: 'Root Cause',    target: 'Remediation',   animated: true, style: { stroke: '#38bdf8', strokeWidth: 1.5 } },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function IncidentGraph({ agentStatuses }: IncidentGraphProps) {
  const statusMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of agentStatuses) {
      map[agent.name] = agent.status;
    }
    return map;
  }, [agentStatuses]);

  const nodes: Node[] = useMemo(
    () =>
      ['Coordinator', 'Log Analysis', 'Knowledge', 'Root Cause', 'Remediation'].map((name) => ({
        id: name,
        data: { label: name },
        position: NODE_POSITIONS[name],
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: getNodeStyle(statusMap[name] || 'pending'),
      })),
    [statusMap],
  );

  return (
    <div className="h-[380px] w-full rounded-2xl border border-white/10 bg-slate-950/70 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={EDGES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(148,163,184,0.05)" gap={20} />
      </ReactFlow>
    </div>
  );
}
