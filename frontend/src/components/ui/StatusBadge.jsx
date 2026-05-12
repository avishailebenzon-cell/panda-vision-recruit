const SECURITY = {
  top_secret:   { label: 'סודי ביותר', color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  secret:       { label: 'סודי',       color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  confidential: { label: 'חסוי',       color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  no_security:  { label: 'ללא',        color: 'bg-surface-700/60 text-surface-400 border-surface-600' },
};

const STATUS = {
  pending:   { label: 'ממתין',    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  approved:  { label: 'אושר',     color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  rejected:  { label: 'נדחה',     color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  reviewing: { label: 'בבדיקה',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  active:    { label: 'פעיל',     color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  inactive:  { label: 'לא פעיל', color: 'bg-surface-700/60 text-surface-400 border-surface-600' },
  running:   { label: 'רץ',       color: 'bg-brand-500/20 text-brand-300 border-brand-500/40' },
  idle:      { label: 'ממתין',    color: 'bg-surface-700/60 text-surface-400 border-surface-600' },
  error:     { label: 'שגיאה',    color: 'bg-red-500/20 text-red-400 border-red-500/40' },
};

export function SecurityBadge({ level }) {
  const cfg = SECURITY[level] || SECURITY.no_security;
  return (
    <span className={`badge border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  const cfg = STATUS[status] || { label: status, color: 'bg-surface-700/60 text-surface-400 border-surface-600' };
  return (
    <span className={`badge border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export function ScoreBadge({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400';
  const bg    = pct >= 80 ? 'bg-green-500/10' : pct >= 60 ? 'bg-yellow-500/10' : 'bg-red-500/10';
  return (
    <span className={`badge border border-transparent ${bg} ${color} font-mono`}>
      {pct}%
    </span>
  );
}
