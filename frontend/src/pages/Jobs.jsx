import { useState, useMemo } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, Search, MapPin, Briefcase, ShieldCheck, DollarSign, Calendar, Hash, Building2, User } from 'lucide-react';
import Header from '../components/layout/Header';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useApi } from '../hooks/useApi';
import { getJobs, syncPipedrive } from '../services/api';

// ── Priority badge ────────────────────────────────────────────────────────────
// Handles both raw Pipedrive Hebrew values ("עדיפות גיוס 1") and legacy English values
function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-surface-500 text-xs">—</span>;

  // Map raw Pipedrive priority labels to colour tiers by index
  const hebrewMatch = priority.match(/עדיפות גיוס (\d)/);
  if (hebrewMatch) {
    const tier = parseInt(hebrewMatch[1], 10);
    const cls =
      tier === 1 ? 'bg-red-500/20    text-red-400    border-red-500/30' :
      tier === 2 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
      tier === 3 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                   'bg-surface-700   text-surface-400 border-surface-600';
    return (
      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
        {priority}
      </span>
    );
  }

  // Legacy English values fallback
  const map = {
    urgent: { label: 'דחוף',   cls: 'bg-red-500/20    text-red-400    border-red-500/30'    },
    high:   { label: 'גבוה',   cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    medium: { label: 'בינוני', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    low:    { label: 'נמוך',   cls: 'bg-surface-700   text-surface-400 border-surface-600'  },
  };
  const m = map[priority.toLowerCase()] ?? { label: priority, cls: 'bg-surface-700 text-surface-400 border-surface-600' };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ── Security badge ────────────────────────────────────────────────────────────
// Displays raw Pipedrive security clearance text as-is
function SecurityBadge({ level }) {
  if (!level) return <span className="text-surface-500 text-xs">—</span>;
  // colour by rough keyword match
  const lower = level.toLowerCase();
  const cls =
    lower.includes('top') || lower.includes('מסווג') || lower.includes('חסוי ביותר')
      ? 'bg-red-500/20    text-red-400    border-red-500/30' :
    lower.includes('secret') || lower.includes('סודי')
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
    lower.includes('confidential') || lower.includes('חסוי')
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    lower.includes('no_security') || lower.includes('ללא')
      ? 'bg-surface-700   text-surface-400 border-surface-600' :
      'bg-surface-700   text-surface-400 border-surface-600';
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {level}
    </span>
  );
}

// ── Expandable job row ────────────────────────────────────────────────────────
function JobRow({ job }) {
  const [open, setOpen] = useState(false);

  const hasDetails = job.description || job.qualifications || job.salary_range;

  return (
    <>
      {/* Main row */}
      <tr
        className={`table-row ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setOpen(o => !o)}
      >
        {/* Expand indicator */}
        <td className="table-td w-8 text-center">
          {hasDetails
            ? open
              ? <ChevronUp   size={13} className="text-surface-400 mx-auto" />
              : <ChevronDown size={13} className="text-surface-500 mx-auto" />
            : null}
        </td>

        {/* תפקיד */}
        <td className="table-td">
          <span className="text-sm font-medium text-white">{job.title || '—'}</span>
        </td>

        {/* מיקום */}
        <td className="table-td">
          {job.location
            ? <span className="flex items-center gap-1 text-sm text-surface-300">
                <MapPin size={11} className="text-surface-500 flex-shrink-0" />
                {job.location}
              </span>
            : <span className="text-surface-500 text-xs">—</span>}
        </td>

        {/* ארגון */}
        <td className="table-td">
          {job.org_name
            ? <span className="flex items-center gap-1 text-sm text-surface-300">
                <Building2 size={11} className="text-surface-500 flex-shrink-0" />
                {job.org_name}
              </span>
            : <span className="text-surface-500 text-xs">—</span>}
        </td>

        {/* לקוח */}
        <td className="table-td">
          {job.contact_name
            ? <span className="flex items-center gap-1 text-sm text-surface-300">
                <User size={11} className="text-surface-500 flex-shrink-0" />
                {job.contact_name}
              </span>
            : <span className="text-surface-500 text-xs">—</span>}
        </td>

        {/* סיווג */}
        <td className="table-td">
          <SecurityBadge level={job.security_level} />
        </td>

        {/* עדיפות */}
        <td className="table-td">
          <PriorityBadge priority={job.priority} />
        </td>

        {/* סטטוס */}
        <td className="table-td">
          <StatusBadge status={job.is_active !== false ? 'active' : 'inactive'} />
        </td>

        {/* Pipedrive ID */}
        <td className="table-td">
          <span className="text-xs text-surface-500 font-mono">{job.pipedrive_deal_id || '—'}</span>
        </td>
      </tr>

      {/* Expanded details row */}
      {open && (
        <tr className="bg-surface-950/60">
          <td colSpan={10} className="px-6 py-4 border-b border-surface-700/40">
            <div className="grid grid-cols-2 gap-x-10 gap-y-4">

              {/* Description */}
              {job.description && (
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Briefcase size={10} /> תיאור המשרה
                  </p>
                  <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{job.description}</p>
                </div>
              )}

              {/* Qualifications */}
              {job.qualifications && (
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <ShieldCheck size={10} /> דרישות וכישורים
                  </p>
                  <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{job.qualifications}</p>
                </div>
              )}

              {/* Bottom meta row */}
              <div className="col-span-2 flex flex-wrap gap-6 pt-2 border-t border-surface-700/40">
                {job.org_name && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <Building2 size={11} className="text-surface-500" />
                    <span className="text-surface-500">ארגון:</span>
                    <span className="text-surface-200 font-medium">{job.org_name}</span>
                  </div>
                )}
                {job.contact_name && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <User size={11} className="text-surface-500" />
                    <span className="text-surface-500">לקוח:</span>
                    <span className="text-surface-200 font-medium">{job.contact_name}</span>
                  </div>
                )}
                {job.salary_range && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <DollarSign size={11} className="text-surface-500" />
                    <span className="text-surface-500">טווח שכר:</span>
                    <span className="text-surface-200 font-medium">{job.salary_range}</span>
                  </div>
                )}
                {job.department && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <Briefcase size={11} className="text-surface-500" />
                    <span className="text-surface-500">מחלקה:</span>
                    <span className="text-surface-200 font-medium">{job.department}</span>
                  </div>
                )}
                {job.location && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <MapPin size={11} className="text-surface-500" />
                    <span className="text-surface-500">מיקום:</span>
                    <span className="text-surface-200 font-medium">{job.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-surface-400">
                  <Hash size={11} className="text-surface-500" />
                  <span className="text-surface-500">Pipedrive ID:</span>
                  <span className="font-mono text-surface-300">{job.pipedrive_deal_id}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-surface-400 mr-auto">
                  <Calendar size={11} className="text-surface-500" />
                  <span className="text-surface-500">עודכן:</span>
                  <span className="text-surface-300">
                    {new Date(job.updated_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Jobs() {
  const { data: jobs = [], loading, refetch } = useApi(getJobs);
  const [syncing, setSyncing] = useState(false);
  const [search,  setSearch]  = useState('');

  const doSync = async () => {
    setSyncing(true);
    try { await syncPipedrive(); await refetch(); } finally { setSyncing(false); }
  };

  // Filter: only jobs with non-empty title (safety net on top of API filter)
  const filtered = useMemo(() => {
    const withTitle = jobs.filter(j => j.title?.trim());
    if (!search.trim()) return withTitle;
    const q = search.toLowerCase();
    return withTitle.filter(j =>
      [j.title, j.location, j.org_name, j.contact_name, j.description, j.qualifications, j.salary_range]
        .some(f => f?.toLowerCase().includes(q))
    );
  }, [jobs, search]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="משרות"
        subtitle={`${filtered.length} משרות פתוחות${jobs.length !== filtered.length ? ` (מתוך ${jobs.length} סה״כ)` : ''}`}
      />

      <main className="flex-1 overflow-y-auto p-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              className="panda-input pl-8 text-xs w-full"
              placeholder="חיפוש לפי תפקיד, מיקום, מחלקה..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={doSync} disabled={syncing} className="panda-btn-primary disabled:opacity-50 mr-auto">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'מסנכרן...' : 'סנכרן מ-Pipedrive'}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-surface-400 text-sm">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-surface-500">
            <Briefcase size={32} className="opacity-30" />
            <p className="text-sm">אין משרות להצגה</p>
            <p className="text-xs">לחץ "סנכרן מ-Pipedrive" לטעינת משרות פתוחות עם כותרת מוגדרת.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-700">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th w-8"></th>
                  <th className="table-th">תפקיד</th>
                  <th className="table-th">מיקום</th>
                  <th className="table-th">שם ארגון</th>
                  <th className="table-th">שם לקוח</th>
                  <th className="table-th">סיווג נדרש</th>
                  <th className="table-th">עדיפות</th>
                  <th className="table-th">סטטוס</th>
                  <th className="table-th">Pipedrive ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job, idx) => <JobRow key={job.id ?? idx} job={job} />)}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-surface-500 text-right mt-2">
          {filtered.length} רשומות
        </p>
      </main>
    </div>
  );
}
