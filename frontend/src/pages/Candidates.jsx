import Header from '../components/layout/Header';
import { PandaTable } from '../components/ui/PandaTable';
import { SecurityBadge, StatusBadge } from '../components/ui/StatusBadge';
import { useApi } from '../hooks/useApi';
import { getCandidates } from '../services/api';
import { FileText, Calendar } from 'lucide-react';

export default function Candidates() {
  const { data: candidates = [], loading } = useApi(getCandidates);

  const columns = [
    {
      key: 'name', label: 'שם', accessor: 'first_name',
      render: r => (
        <div>
          <p className="text-sm font-medium text-white">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</p>
          <p className="text-xs text-surface-400">{r.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'טלפון', accessor: 'phone', render: r => <span className="text-sm font-mono text-surface-300 dir-ltr">{r.phone || '—'}</span> },
    { key: 'security', label: 'סיווג', accessor: 'security_level', render: r => <SecurityBadge level={r.security_level} /> },
    { key: 'status',   label: 'סטטוס', accessor: 'status',         render: r => <StatusBadge   status={r.status} /> },
    {
      key: 'cv', label: 'קורות חיים', sortable: false,
      render: r => r.resume_url
        ? <a href={r.resume_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-400 hover:text-brand-300 text-xs"><FileText size={12}/> פתח</a>
        : <span className="text-surface-600 text-xs">—</span>,
    },
    {
      key: 'date', label: 'תאריך קליטה', accessor: 'created_at',
      render: r => (
        <span className="flex items-center gap-1 text-xs text-surface-400 font-mono">
          <Calendar size={11}/>
          {r.created_at ? new Date(r.created_at).toLocaleDateString('he-IL') : '—'}
        </span>
      ),
    },
    {
      key: 'notes', label: 'הערות', accessor: 'notes', sortable: false,
      render: r => <span className="text-xs text-surface-400 line-clamp-1 max-w-[200px]">{r.notes || '—'}</span>,
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="מועמדים" subtitle={`${candidates?.length ?? 0} מועמדים בבסיס הנתונים`} />
      <main className="flex-1 overflow-y-auto p-6">
        <PandaTable columns={columns} data={candidates} loading={loading} emptyTitle="אין מועמדים" emptyDesc="שלח מייל עם קורות חיים לכתובת jobs@ לקליטה אוטומטית." />
      </main>
    </div>
  );
}
