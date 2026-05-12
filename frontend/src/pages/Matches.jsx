import { useState } from 'react';
import Header from '../components/layout/Header';
import { PandaTable } from '../components/ui/PandaTable';
import { SecurityBadge, StatusBadge, ScoreBadge } from '../components/ui/StatusBadge';
import ActionsMenu from '../components/shared/ActionsMenu';
import { useApi } from '../hooks/useApi';
import { getMatches, submitFeedback } from '../services/api';

const GROUP_OPTIONS = [
  { value: null,             label: 'ללא קיבוץ'   },
  { value: 'candidate_name', label: 'לפי מועמד'   },
  { value: 'job_title',      label: 'לפי משרה'    },
  { value: 'agent_name',     label: 'לפי סוכן'    },
];

export default function Matches() {
  const { data: matches = [], loading, refetch } = useApi(getMatches);
  const [groupBy, setGroupBy] = useState(null);

  const handleFeedback = async ({ matchId, feedback }) => {
    await submitFeedback({ match_id: matchId, was_correct: false, feedback_text: feedback });
    refetch();
  };

  const columns = [
    {
      key: 'candidate', label: 'מועמד', accessor: 'candidate_name',
      render: r => <div><p className="text-sm font-medium text-white">{r.candidate_name || '—'}</p><p className="text-xs text-surface-400">{r.candidate_email}</p></div>,
    },
    { key: 'job',    label: 'משרה',   accessor: 'job_title',      render: r => <span className="text-sm text-surface-200">{r.job_title || '—'}</span> },
    { key: 'agent',  label: 'סוכן',   accessor: 'agent_name',     render: r => <span className="text-xs text-brand-300 font-mono">{r.agent_name || '—'}</span> },
    { key: 'score',  label: 'ציון',   accessor: 'match_score',    render: r => <ScoreBadge score={r.match_score} /> },
    { key: 'security', label: 'סיווג', accessor: 'security_level', render: r => <SecurityBadge level={r.security_level} /> },
    { key: 'status', label: 'סטטוס', accessor: 'status',          render: r => <StatusBadge status={r.status} /> },
    {
      key: 'reason', label: 'נימוק', accessor: 'agent_reasoning', sortable: false,
      render: r => (
        <div className="max-w-xs">
          <p className="text-xs text-surface-300 line-clamp-2">{r.agent_reasoning || '—'}</p>
          {r.cv_age_warning && <span className="badge bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 mt-1">⚠ קו"ח ישנים</span>}
        </div>
      ),
    },
    {
      key: 'date', label: 'תאריך', accessor: 'created_at',
      render: r => <span className="text-xs text-surface-400 font-mono">{r.created_at ? new Date(r.created_at).toLocaleDateString('he-IL') : '—'}</span>,
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="דואר נכנס — התאמות" subtitle={`${matches?.length ?? 0} התאמות בסך הכל`} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-surface-400">קיבוץ:</span>
          {GROUP_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => setGroupBy(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${groupBy === opt.value ? 'bg-brand-600 text-white' : 'bg-surface-800 text-surface-300 hover:bg-surface-700 border border-surface-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <PandaTable
          columns={columns}
          data={matches}
          loading={loading}
          groupBy={groupBy}
          rowActions={row => <ActionsMenu row={row} onFeedback={handleFeedback} />}
          emptyTitle="אין התאמות"
          emptyDesc="הסוכנים עדיין לא מצאו התאמות. וודא שסריקת המיילים פעילה."
        />
      </main>
    </div>
  );
}
