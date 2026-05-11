import { Brain, Target, MessageSquare, Activity, Clock } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

export default function AgentBrain({ agent }) {
  const { name, status = 'idle', currentAction, focusedJob, instructions, lastActivity } = agent || {};

  return (
    <div className="panda-card p-0 overflow-hidden mb-5">
      {/* Header strip */}
      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-brand-950/80 to-surface-800 border-b border-surface-700">
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${status === 'running' ? 'bg-green-400' : 'bg-surface-500'}`} />
          {status === 'running' && (
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-75" />
          )}
        </div>
        <Brain size={15} className="text-brand-400" />
        <span className="text-sm font-semibold text-white">המוח של הסוכן — {name}</span>
        <StatusBadge status={status} />
        {lastActivity && (
          <span className="mr-auto flex items-center gap-1 text-[11px] text-surface-500">
            <Clock size={11} />
            {new Date(lastActivity).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="grid grid-cols-3 divide-x divide-surface-700/60 rtl:divide-x-reverse">

        {/* Current action */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity size={12} className="text-green-400" />
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">כאן ועכשיו</span>
          </div>
          <p className="text-sm text-white leading-relaxed">
            {currentAction || <span className="text-surface-500 italic">לא פעיל</span>}
          </p>
        </div>

        {/* Focused job */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Target size={12} className="text-yellow-400" />
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">משרה ממוקדת</span>
          </div>
          {focusedJob ? (
            <div>
              <p className="text-sm font-medium text-white">{focusedJob.title}</p>
              <p className="text-xs text-surface-400 mt-0.5">{focusedJob.company}</p>
            </div>
          ) : (
            <p className="text-sm text-surface-500 italic">לא מוגדרת</p>
          )}
        </div>

        {/* Manager instructions */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare size={12} className="text-brand-400" />
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">הנחיות מנהל</span>
          </div>
          {instructions ? (
            <p className="text-sm text-brand-200 leading-relaxed bg-brand-950/40 px-3 py-2 rounded-lg border border-brand-800/40">
              {instructions}
            </p>
          ) : (
            <p className="text-sm text-surface-500 italic">אין הנחיות מיוחדות</p>
          )}
        </div>
      </div>
    </div>
  );
}
