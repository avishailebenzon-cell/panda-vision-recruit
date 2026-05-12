import { Users, Zap, Briefcase, TrendingUp, Bot, Mail, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Header from '../components/layout/Header';
import { StatCard, PandaCard } from '../components/ui/PandaCard';
import { useApi } from '../hooks/useApi';
import { getCandidates, getMatches, getJobs, getEmailLogs } from '../services/api';

const MOCK_PERF = [
  { name: 'ראשון', approved: 4, rejected: 1 },
  { name: 'שני',   approved: 7, rejected: 2 },
  { name: 'שלישי', approved: 5, rejected: 3 },
  { name: 'רביעי', approved: 9, rejected: 1 },
  { name: 'חמישי', approved: 6, rejected: 2 },
  { name: 'שישי',  approved: 3, rejected: 0 },
];

export default function Dashboard() {
  const { data: candidates }    = useApi(getCandidates);
  const { data: matches }       = useApi(getMatches);
  const { data: jobs }          = useApi(getJobs);
  const { data: scanLogsData }  = useApi(() => getEmailLogs({ limit: 200 }));

  const total      = candidates?.length ?? 0;
  const totalM     = matches?.length    ?? 0;
  const approvedM  = matches?.filter(m => m.status === 'approved').length ?? 0;
  const activeJobs = jobs?.filter(j => j.is_active !== false).length ?? 0;

  // ── Email scan aggregates ──────────────────────────────────────────────────
  const scanLogs       = scanLogsData?.logs ?? [];
  const completedScans = scanLogs.filter(l => l.status === 'completed');
  const failedScans    = scanLogs.filter(l => l.status === 'failed');
  const totalCreated   = completedScans.reduce((s, l) => s + (l.candidates_created ?? 0), 0);
  const totalUpdated   = completedScans.reduce((s, l) => s + (l.candidates_updated ?? 0), 0);

  // ── Chart: last 10 scans (oldest → newest) ────────────────────────────────
  const scanChartData = [...completedScans]
    .slice(-10)
    .map(l => ({
      name: new Date(l.scan_start_time).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
      נוצרו: l.candidates_created ?? 0,
      עודכנו: l.candidates_updated ?? 0,
    }));

  const hasRealChartData = scanChartData.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="דשבורד" subtitle="סקירה כללית של מערכת הגיוס" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Row 1 — core stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="מועמדים סה״כ"  value={total}      icon={Users}      color="brand"  sub="בבסיס הנתונים" />
          <StatCard label="התאמות סה״כ"   value={totalM}     icon={Zap}        color="green"  sub="כל הסוכנים" />
          <StatCard label="התאמות אושרו"  value={approvedM}  icon={TrendingUp} color="blue"   trend={12} />
          <StatCard label="משרות פתוחות"  value={activeJobs} icon={Briefcase}  color="yellow" sub="מ-Pipedrive" />
        </div>

        {/* Row 2 — email scan stats */}
        <div className="grid grid-cols-3 gap-4">
          {/* Candidates added via scan */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-500/15 flex items-center justify-center flex-shrink-0">
              <UserPlus size={18} className="text-brand-400" />
            </div>
            <div>
              <p className="text-xs text-surface-400 mb-0.5">מועמדים שנוספו מסריקת מייל</p>
              <p className="text-2xl font-bold text-white">{totalCreated}</p>
              <p className="text-xs text-surface-500">{totalUpdated} עודכנו · {completedScans.length} סריקות הצליחו</p>
            </div>
          </div>

          {/* Successful scans */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-xs text-surface-400 mb-0.5">סריקות מייל שהצליחו</p>
              <p className="text-2xl font-bold text-white">{completedScans.length}</p>
              <p className="text-xs text-surface-500">
                {completedScans.length + failedScans.length} סריקות סה״כ
              </p>
            </div>
          </div>

          {/* Failed scans */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${failedScans.length > 0 ? 'bg-red-500/15' : 'bg-surface-700'}`}>
              <XCircle size={18} className={failedScans.length > 0 ? 'text-red-400' : 'text-surface-500'} />
            </div>
            <div>
              <p className="text-xs text-surface-400 mb-0.5">סריקות שנכשלו</p>
              <p className={`text-2xl font-bold ${failedScans.length > 0 ? 'text-red-400' : 'text-white'}`}>
                {failedScans.length}
              </p>
              <p className="text-xs text-surface-500">
                {failedScans.length > 0 ? 'בדוק לוג מערכת' : 'הכל תקין'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">

          {/* Agent performance */}
          <PandaCard title="ביצועי סוכנים — השבוע" subtitle="התאמות שאושרו לעומת שנפסלו" className="col-span-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MOCK_PERF} barGap={4}>
                <XAxis dataKey="name" tick={{ fill: '#6b7194', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7194', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e2235', border: '1px solid #363b5e', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e4f0', fontSize: 12 }}
                  itemStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="approved" name="אושר" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="rejected" name="נדחה" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </PandaCard>

          {/* Daily scan trend — real data */}
          <PandaCard title="מועמדים מסריקות מייל" subtitle="10 הסריקות האחרונות">
            {hasRealChartData ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scanChartData} barGap={2}>
                  <XAxis dataKey="name" tick={{ fill: '#6b7194', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7194', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e2235', border: '1px solid #363b5e', borderRadius: 8 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="נוצרו"  fill="#6366f1" radius={[3,3,0,0]} />
                  <Bar dataKey="עודכנו" fill="#10b981" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] gap-2 text-surface-500">
                <Mail size={28} className="opacity-40" />
                <p className="text-xs">אין נתוני סריקה עדיין</p>
              </div>
            )}
          </PandaCard>
        </div>

        {/* Active agents status */}
        <PandaCard title="סטטוס סוכנים פעילים">
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'סוכן ראשי (Orchestrator)', status: 'running', tasks: 3 },
              { name: 'סוכן פיתוח',               status: 'idle',    tasks: 0 },
              { name: 'סוכן אבטחה',               status: 'running', tasks: 1 },
            ].map(agent => (
              <div key={agent.name} className="flex items-center gap-3 p-3 rounded-lg bg-surface-900/60 border border-surface-700/50">
                <div className="relative">
                  <Bot size={20} className="text-brand-400" />
                  <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-900 ${agent.status === 'running' ? 'bg-green-400' : 'bg-surface-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{agent.name}</p>
                  <p className="text-[11px] text-surface-400">{agent.tasks} משימות פעילות</p>
                </div>
              </div>
            ))}
          </div>
        </PandaCard>

      </main>
    </div>
  );
}
