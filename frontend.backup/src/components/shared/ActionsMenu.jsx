import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, FileText, Briefcase, Trash2, ThumbsDown, X, Send } from 'lucide-react';

export default function ActionsMenu({ row, onFeedback }) {
  const [open,     setOpen]     = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [text,     setText]     = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setFeedback(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleFeedbackSubmit = () => {
    if (text.trim() && onFeedback) onFeedback({ matchId: row.id, feedback: text });
    setText('');
    setFeedback(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setFeedback(false); }}
        className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div className="absolute left-0 top-8 z-50 w-52 bg-surface-800 border border-surface-700 rounded-xl shadow-panel animate-fade-in overflow-hidden">
          {!feedback ? (
            <>
              {/* Open CV */}
              {row.cv_url && (
                <a
                  href={row.cv_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-surface-200 hover:bg-surface-700 hover:text-white transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <FileText size={14} className="text-brand-400" />
                  פתח קורות חיים
                </a>
              )}

              {/* Open job */}
              {row.job_id && (
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-surface-200 hover:bg-surface-700 hover:text-white transition-colors"
                  onClick={() => { window.open(`/jobs/${row.job_id}`, '_blank'); setOpen(false); }}
                >
                  <Briefcase size={14} className="text-yellow-400" />
                  פתח הגדרת משרה
                </button>
              )}

              <hr className="border-surface-700" />

              {/* Wrong match feedback */}
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-orange-400 hover:bg-orange-500/10 transition-colors"
                onClick={() => setFeedback(true)}
              >
                <ThumbsDown size={14} />
                התאמה שגויה (עם משוב)
              </button>

              {/* Remove candidate */}
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                onClick={() => { onFeedback?.({ matchId: row.id, action: 'remove' }); setOpen(false); }}
              >
                <Trash2 size={14} />
                הסר מועמד
              </button>
            </>
          ) : (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-300">משוב לסוכן</span>
                <button onClick={() => setFeedback(false)} className="text-surface-500 hover:text-white">
                  <X size={13} />
                </button>
              </div>
              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="מה הייתה הטעות? זה יעזור לסוכן ללמוד..."
                className="panda-input text-xs h-20 resize-none"
              />
              <button
                onClick={handleFeedbackSubmit}
                disabled={!text.trim()}
                className="panda-btn-primary w-full justify-center mt-2 disabled:opacity-40"
              >
                <Send size={12} />
                שלח משוב
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
