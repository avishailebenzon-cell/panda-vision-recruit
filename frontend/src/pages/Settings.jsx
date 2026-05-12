import { useState } from 'react';
import { RefreshCw, Plus, Trash2, Play, Square, CheckCircle, AlertCircle, Plug, Mail, BookOpen, Activity, Clock, ChevronDown, ChevronUp, MailOpen } from 'lucide-react';
import Header from '../components/layout/Header';
import { PandaCard } from '../components/ui/PandaCard';
import { syncPipedrive, triggerEmailScan, startEmailScan, stopEmailScan, getSchedulerStatus, getSynonyms, createSynonym, deleteSynonym, getEmailLogs } from '../services/api';
import { useApi } from '../hooks/useApi';

const TABS = [
  { id: 'pipedrive', label: 'Pipedrive Setup',    icon: Plug       },
  { id: 'mail',      label: 'Mail & Processing',  icon: Mail       },
  { id: 'dictionary',label: 'Global Dictionary',  icon: BookOpen   },
  { id: 'health',    label: 'System Health',       icon: Activity   },
];

function PipedriveTab() {
  const [syncing, setSyncing] = useState(false);
  const [result,  setResult]  = useState(null);

  const doSync = async () => {
    setSyncing(true); setResult(null);
    try {
      const r = await syncPipedrive();
      setResult({ ok: true, msg: `סונכרנו ${r.synced ?? 0} משרות בהצלחה.` });
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <PandaCard title="סינכרון Pipedrive" subtitle="טעינה ידנית של משרות ואנשי קשר">
        <div className="flex items-center gap-3">
          <button onClick={doSync} disabled={syncing} className="panda-btn-primary disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'מסנכרן...' : 'סנכרן עכשיו'}
          </button>
          {result && (
            <div className={`flex items-center gap-1.5 text-sm ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
              {result.ok ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
              {result.msg}
            </div>
          )}
        </div>
        <p className="text-xs text-surface-500 mt-3">הסינכרון ייבא אנשי קשר כמועמדים ויעדכן את רשימת המשרות הפתוחות.</p>
      </PandaCard>

      <PandaCard title="הגדרות API">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Pipedrive API Key</label>
            <input className="panda-input font-mono" placeholder="מוגדר ב-.env" disabled value="••••••••••••••••" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">Base URL</label>
            <input className="panda-input font-mono" disabled value="https://api.pipedrive.com/v1" />
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-3">לשינוי ה-API Key עדכן את קובץ ה-.env והפעל מחדש.</p>
      </PandaCard>
    </div>
  );
}

function MailTab() {
  const [scanning, setScanning]   = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const { data: schedulerStatus, refetch: refetchStatus } = useApi(getSchedulerStatus);

  const emailJob    = schedulerStatus?.jobs?.find(j => j.id === 'email_scan_job');
  const isActive    = emailJob?.active ?? true;
  const nextRun     = emailJob?.next_run
    ? new Date(emailJob.next_run).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : null;

  const doScan = async () => {
    setScanning(true); setScanResult(null);
    try {
      const r = await triggerEmailScan();
      const d = r.details ?? {};
      setScanResult({ ok: true, msg: `נסרקו ${d.total_emails_scanned ?? 0} מיילים — ${d.candidates_created ?? 0} חדשים, ${d.candidates_updated ?? 0} עודכנו` });
    } catch (e) {
      setScanResult({ ok: false, msg: e.message });
    } finally {
      setScanning(false);
    }
  };

  const toggleScan = async () => {
    setToggling(true);
    try {
      if (isActive) await stopEmailScan();
      else          await startEmailScan();
      await refetchStatus();
    } catch (e) {
      setScanResult({ ok: false, msg: e.message });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Auto scan control */}
      <PandaCard title="סריקה אוטומטית" subtitle={`תיבת דואר: jobs@pandatech.co.il`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-white font-medium">
              {isActive ? '🟢 פעיל — סריקה אוטומטית כל 30 דקות' : '🔴 מושהה — הסריקה האוטומטית עצורה'}
            </p>
            {isActive && nextRun && (
              <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1">
                <Clock size={11}/> סריקה הבאה בשעה {nextRun}
              </p>
            )}
          </div>
          <button
            onClick={toggleScan}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
              isActive
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
            }`}
          >
            {isActive ? <Square size={14}/> : <Play size={14}/>}
            {toggling ? 'מעדכן...' : isActive ? 'עצור סריקה' : 'הפעל סריקה'}
          </button>
        </div>

        {/* Manual scan */}
        <div className="flex items-center gap-3 pt-3 border-t border-surface-700/50">
          <button onClick={doScan} disabled={scanning} className="panda-btn-secondary disabled:opacity-50">
            <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'סורק...' : 'סרוק עכשיו ידנית'}
          </button>
          {scanResult && (
            <div className={`flex items-center gap-1.5 text-sm ${scanResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {scanResult.ok ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
              {scanResult.msg}
            </div>
          )}
        </div>
      </PandaCard>

      <PandaCard title="הגדרות סריקה">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">תדירות סריקה (דקות)</label>
            <input className="panda-input" disabled value="30" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">מגבלת מיילים לסריקה</label>
            <input className="panda-input" disabled value="50" />
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-3">לשינוי: עדכן EMAIL_SCAN_INTERVAL_MINUTES ו-EMAIL_SCAN_LIMIT ב-.env</p>
      </PandaCard>
    </div>
  );
}

function DictionaryTab() {
  const { data: synonyms = [], loading, refetch } = useApi(getSynonyms);
  const [newCat, setNewCat]  = useState('');
  const [newKw,  setNewKw]   = useState('');

  const add = async () => {
    if (!newCat.trim() || !newKw.trim()) return;
    await createSynonym({ category: newCat, synonyms: newKw.split(',').map(s => s.trim()) });
    setNewCat(''); setNewKw('');
    refetch();
  };

  return (
    <div className="space-y-4">
      <PandaCard title="הוסף מילים נרדפות">
        <div className="flex gap-3">
          <input className="panda-input w-40" placeholder="קטגוריה (למשל: DevOps)" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <input className="panda-input flex-1" placeholder="מילים מופרדות בפסיק: kubernetes, k8s, kube" value={newKw} onChange={e => setNewKw(e.target.value)} />
          <button onClick={add} className="panda-btn-primary">
            <Plus size={14} /> הוסף
          </button>
        </div>
      </PandaCard>

      <PandaCard title="המילון הנוכחי">
        {loading ? (
          <p className="text-sm text-surface-400 text-center py-6">טוען...</p>
        ) : synonyms.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-6">המילון ריק. הוסף קטגוריות ראשונות.</p>
        ) : (
          <div className="space-y-2">
            {synonyms.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-surface-900/60 rounded-lg border border-surface-700/50">
                <div>
                  <span className="text-xs font-semibold text-brand-300 mr-2">{s.category}</span>
                  <span className="text-xs text-surface-400">{Array.isArray(s.synonyms) ? s.synonyms.join(', ') : s.synonyms}</span>
                </div>
                <button onClick={async () => { await deleteSynonym(s.id); refetch(); }} className="panda-btn-danger p-1.5">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </PandaCard>
    </div>
  );
}

// ── Scan log row ─────────────────────────────────────────────────────────────
function ScanLogRow({ log }) {
  const [open, setOpen] = useState(false);

  const statusMeta = {
    completed:  { label: 'הצליחה',   cls: 'bg-green-500/15 text-green-400 border-green-500/30',  dot: 'bg-green-400'   },
    failed:     { label: 'נכשלה',    cls: 'bg-red-500/15   text-red-400   border-red-500/30',    dot: 'bg-red-400'     },
    processing: { label: 'בתהליך',   cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400 animate-pulse' },
  };
  const meta = statusMeta[log.status] ?? statusMeta.processing;

  const startDt  = new Date(log.scan_start_time);
  const dateStr  = startDt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr  = startDt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  const duration = log.scan_end_time
    ? Math.round((new Date(log.scan_end_time) - startDt) / 1000)
    : null;

  return (
    <div className="border border-surface-700/50 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 bg-surface-900/60 hover:bg-surface-800/60 transition-colors text-right"
      >
        {/* Status badge */}
        <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.cls} flex-shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>

        {/* Date + time */}
        <span className="text-xs text-surface-300 font-medium flex-shrink-0">{dateStr} · {timeStr}</span>

        {/* Quick counts */}
        {log.status === 'completed' && (
          <span className="text-xs text-surface-400 flex-shrink-0">
            {log.total_emails_scanned ?? 0} מיילים ·{' '}
            <span className="text-green-400 font-medium">{log.candidates_created ?? 0} נוצרו</span>{' '}·{' '}
            <span className="text-brand-300 font-medium">{log.candidates_updated ?? 0} עודכנו</span>
          </span>
        )}
        {log.status === 'failed' && (
          <span className="text-xs text-red-400 truncate flex-1 text-right">{log.error_message?.split('\n')[0]?.slice(0, 60) ?? 'שגיאה לא ידועה'}</span>
        )}

        {duration !== null && (
          <span className="text-[11px] text-surface-500 flex-shrink-0 mr-auto">{duration}s</span>
        )}

        {open ? <ChevronUp size={13} className="text-surface-500 flex-shrink-0" /> : <ChevronDown size={13} className="text-surface-500 flex-shrink-0" />}
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-4 py-3 bg-surface-950/40 border-t border-surface-700/40 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-surface-500">מיילים שנסרקו</span>
              <span className="text-white font-medium">{log.total_emails_scanned ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">קבצים שנמצאו</span>
              <span className="text-white font-medium">{log.attachments_found ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">מועמדים נוצרו</span>
              <span className="text-green-400 font-medium">{log.candidates_created ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">מועמדים עודכנו</span>
              <span className="text-brand-300 font-medium">{log.candidates_updated ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">מועמדים דולגו</span>
              <span className="text-surface-400 font-medium">{log.candidates_skipped ?? 0}</span>
            </div>
            {duration !== null && (
              <div className="flex justify-between">
                <span className="text-surface-500">משך הסריקה</span>
                <span className="text-surface-400 font-medium">{duration} שניות</span>
              </div>
            )}
          </div>

          {log.error_message && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-[11px] text-surface-400 mb-1 font-medium">שגיאה:</p>
              <p className="text-xs text-red-400 font-mono break-all">{log.error_message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HealthTab() {
  const { data: logsData, loading: logsLoading, refetch: refetchLogs } = useApi(() => getEmailLogs({ limit: 50 }));
  const logs = logsData?.logs ?? [];

  const completed = logs.filter(l => l.status === 'completed').length;
  const failed    = logs.filter(l => l.status === 'failed').length;
  const totalCreated = logs.reduce((s, l) => s + (l.candidates_created ?? 0), 0);

  return (
    <div className="space-y-4">

      {/* Scan history ──────────────────────────────────────────────────────── */}
      <PandaCard
        title="היסטוריית סריקות מייל"
        subtitle={`${logsData?.total ?? 0} סריקות · ${completed} הצליחו · ${failed} נכשלו · ${totalCreated} מועמדים נוספו`}
      >
        <div className="flex justify-end mb-3">
          <button onClick={refetchLogs} className="panda-btn-secondary py-1 px-3 text-xs">
            <RefreshCw size={11} /> רענן
          </button>
        </div>

        {logsLoading ? (
          <p className="text-sm text-surface-400 text-center py-8">טוען...</p>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-surface-500">
            <MailOpen size={28} className="opacity-30" />
            <p className="text-sm">אין היסטוריית סריקות עדיין</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {logs.map(log => <ScanLogRow key={log.id} log={log} />)}
          </div>
        )}
      </PandaCard>

      {/* Service status ────────────────────────────────────────────────────── */}
      <PandaCard title="סטטוס שירותים">
        {[
          { name: 'PostgreSQL (Supabase)',   status: 'active' },
          { name: 'Supabase Storage',         status: 'active' },
          { name: 'Azure Mail Graph',         status: 'active' },
          { name: 'Pipedrive API',            status: 'active' },
          { name: 'Claude AI (Anthropic)',    status: 'active' },
          { name: 'Watchdog',                 status: 'active' },
        ].map(svc => (
          <div key={svc.name} className="flex items-center justify-between py-2.5 border-b border-surface-700/40 last:border-0">
            <span className="text-sm text-surface-200">{svc.name}</span>
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              פעיל
            </div>
          </div>
        ))}
      </PandaCard>

      <PandaCard title="כפתורי שליטה">
        <div className="flex gap-3 flex-wrap">
          <button className="panda-btn-secondary">
            <RefreshCw size={13} /> הפעל Watchdog
          </button>
          <button className="panda-btn-secondary">
            <Play size={13} /> הרץ אבחון מלא
          </button>
          <button className="panda-btn-danger">
            <AlertCircle size={13} /> נקה לוגים ישנים
          </button>
        </div>
      </PandaCard>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('pipedrive');
  const TAB_CONTENT = { pipedrive: PipedriveTab, mail: MailTab, dictionary: DictionaryTab, health: HealthTab };
  const ActiveTab = TAB_CONTENT[tab];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="הגדרות מערכת" subtitle="System Ops Center" />

      <main className="flex-1 overflow-y-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-900 p-1 rounded-xl border border-surface-700 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-brand-600 text-white shadow-glow'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in">
          <ActiveTab />
        </div>
      </main>
    </div>
  );
}
