import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import AgentBrain from '../components/shared/AgentBrain';
import ActionsMenu from '../components/shared/ActionsMenu';
import { PandaTable } from '../components/ui/PandaTable';
import { SecurityBadge, StatusBadge, ScoreBadge } from '../components/ui/StatusBadge';
import { useApi } from '../hooks/useApi';
import { getMatches, getAgentTasks, submitFeedback } from '../services/api';
import { AGENTS, AGENT_COLORS } from '../config/agents';

const GROUP_OPTIONS = [
  { value: null,             label: 'ללא קיבוץ'   },
  { value: 'candidate_name', label: 'לפי מועמד'   },
  { value: 'job_title',      label: 'לפי משרה'    },
  { value: 'created_at',     label: 'לפי תאריך'   },
];

export default function AgentView() {
  const { agentType } = useParams();
  const agentCfg = AGENTS.find(a => a.type === agentType) || AGENTS[0];
  const colors   = AGENT_COLORS[agentCfg.color];

  const [groupBy, setGroupBy] = useState(null);

  // Load matches filtered by agent
  const { data: matches = [], loading, refetch } = useApi(
    () => getMatches({ agent_name: agentType }),
    [agentType]
  );

  // Load latest agent task for brain status
  const { data: tasks = [] } = useApi(
    () => getAgentTasks({ agent_type: agentType, limit: 1 }),
    [agentType]
  );
  const latestTask = tasks[0];

  const agentBrainData = {
    name:          agentCfg.labelHe,
    status:        latestTask?.status === 'running' ? 'running' : 'idle',
    currentAction: latestTask?.status === 'running'
      ? `מעבד: ${latestTask?.input_data?.candidate_name ?? '...'}`
      : `ממתין למשימות חדשות (${agentCfg.description})`,
    focusedJob:    latestTask?.input_data?.job_title
      ? { title: latestTask.input_data.job_title, company: 'Pandatech' }
      : null,
    instructions:  null,  // future: load from settings
    lastActivity:  latestTask?.updated_at ?? latestTask?.created_at,
  };

  const handleFeedback = async ({ matchId, feedback, action }) => {
    if (action !== 'remove') {
      await submitFeedback({ match_id: matchId, was_correct: false, feedback_text: feedback });
    }
    refetch();
  };

  const columns = [
    {
      key: 'candidate', label: 'מועמד', accessor: 'candidate_name',
      render: r => (
        <div>
          <p className="text-sm font-medium text-white">{r.candidate_name || '—'}</p>
          <p className="text-xs text-surface-400">{r.candidate_email || ''}</p>
        </div>
      ),
    },
    {
      key: 'job', label: 'משרה', accessor: 'job_title',
      render: r => <span className="text-sm text-surface-200">{r.job_title || '—'}</span>,
    },
    {
      key: 'score', label: 'ציון', accessor: 'match_score',
      render: r => <ScoreBadge score={r.match_score} />,
    },
    {
      key: 'security', label: 'סיווג', accessor: 'security_level', sortable: false,
      render: r => <SecurityBadge level={r.security_level} />,
    },
    {
      key: 'status', label: 'סטטוס', accessor: 'status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'reason', label: 'נימוק הסוכן', sortable: false,
      render: r => (
        <div className="max-w-xs">
          <p className="text-xs text-surface-300 line-clamp-2">{r.agent_reasoning || '—'}</p>
          {r.cv_age_warning && (
            <span className="badge bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 mt-1">
              ⚠ קו״ח ישנים
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'date', label: 'תאריך', accessor: 'created_at',
      render: r => (
        <span className="text-xs text-surface-400 font-mono">
          {r.created_at ? new Date(r.created_at).toLocaleDateString('he-IL') : '—'}
        </span>
      ),
    },
  ];

  const AgentIcon = agentCfg.icon;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={
          <span className="flex items-center gap-2">
            <span className={`p-1 rounded-md ${colors.bg}`}>
              <AgentIcon size={14} className={colors.text} />
            </span>
            סוכן {agentCfg.labelHe}
          </span>
        }
        subtitle={agentCfg.description}
      />

      <main className="flex-1 overflow-y-auto p-6">
        {/* Agent brain */}
        <AgentBrain agent={agentBrainData} accentColor={colors} />

        {/* Stats strip */}
        <div className={`flex items-center gap-6 mb-5 px-4 py-3 rounded-xl ${colors.bg} border ${colors.border}`}>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{matches.length}</p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">התאמות</p>
          </div>
          <div className="w-px h-8 bg-surface-700" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">
              {matches.filter(m => m.status === 'approved').length}
            </p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">אושרו</p>
          </div>
          <div className="w-px h-8 bg-surface-700" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">
              {matches.length > 0
                ? Math.round(matches.reduce((s, m) => s + (m.match_score || 0), 0) / matches.length * 100)
                : 0}%
            </p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">ציון ממוצע</p>
          </div>
          <div className="w-px h-8 bg-surface-700" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">
              {matches.filter(m => m.cv_age_warning).length}
            </p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">קו״ח ישנים</p>
          </div>
        </div>

        {/* Group controls */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-surface-400">קיבוץ לפי:</span>
          {GROUP_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => setGroupBy(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                groupBy === opt.value
                  ? `${colors.bg} ${colors.text} border ${colors.border}`
                  : 'bg-surface-800 text-surface-300 hover:bg-surface-700 border border-surface-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Matches table */}
        <PandaTable
          columns={columns}
          data={matches}
          loading={loading}
          groupBy={groupBy}
          rowActions={row => <ActionsMenu row={row} onFeedback={handleFeedback} />}
          emptyTitle={`סוכן ${agentCfg.labelHe} לא מצא התאמות עדיין`}
          emptyDesc="וודא שמשרות בתחום זה קיימות ושסריקת המיילים פעילה."
        />
      </main>
    </div>
  );
}
