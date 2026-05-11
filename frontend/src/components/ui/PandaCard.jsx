export function PandaCard({ children, className = '', title, subtitle, action, noPad = false }) {
  return (
    <div className={`panda-card ${noPad ? '' : 'p-5'} animate-fade-in ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title    && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {subtitle && <p  className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, trend, color = 'brand' }) {
  const colors = {
    brand:   'text-brand-400 bg-brand-500/10',
    green:   'text-green-400 bg-green-500/10',
    yellow:  'text-yellow-400 bg-yellow-500/10',
    red:     'text-red-400 bg-red-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
  };
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white mt-1">{value ?? '—'}</p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-1">
          {sub && <span className="text-xs text-surface-400">{sub}</span>}
          {trend !== undefined && (
            <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={40} className="text-surface-600 mb-3" />}
      <p className="text-sm font-medium text-surface-300">{title}</p>
      {description && <p className="text-xs text-surface-500 mt-1 max-w-xs">{description}</p>}
    </div>
  );
}

export function Spinner({ size = 'md' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size];
  return (
    <div className={`${s} border-2 border-surface-700 border-t-brand-500 rounded-full animate-spin`} />
  );
}
