import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import Header from '../components/layout/Header';
import { PandaCard } from '../components/ui/PandaCard';
import { StatusBadge } from '../components/ui/StatusBadge';

const MOCK_AGENTS = [
  { id: 1, name: 'סוכן פיתוח',   status: 'running', lastMatch: 'דנה לוי → Senior React Dev',   minutesAgo: 2  },
  { id: 2, name: 'סוכן אבטחה',   status: 'running', lastMatch: 'מיכאל ברק → Security Analyst', minutesAgo: 7  },
  { id: 3, name: 'סוכן ניהול',   status: 'idle',    lastMatch: 'רחל גרין → Team Lead',          minutesAgo: 45 },
];

const INIT_LOG = [
  { id: 1, from: 'orchestrator', text: 'מערכת מוכנה. סוכנים פעילים: 2/3.', time: '13:00' },
  { id: 2, from: 'agent', agent: 'סוכן פיתוח', text: 'מצאתי 4 מועמדים חדשים למשרת Senior React Dev. שולח להתאמה.', time: '13:02' },
  { id: 3, from: 'orchestrator', text: 'אישור. המשך לסרוק. תן עדיפות ל-TypeScript + 5 שנות ניסיון.', time: '13:03' },
  { id: 4, from: 'agent', agent: 'סוכן אבטחה', text: 'מועמד חדש: מיכאל ברק, ציון 87%, ניסיון SOC 6 שנים, סיווג סודי.', time: '13:07' },
  { id: 5, from: 'orchestrator', text: 'מצוין! העבר לסקירה ידנית. אחוז ההתאמה גבוה.', time: '13:07' },
];

export default function OrchestratorView() {
  const [log,  setLog]  = useState(INIT_LOG);
  const [msg,  setMsg]  = useState('');
  const endRef           = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);

  const sendMsg = () => {
    if (!msg.trim()) return;
    const now = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    setLog(l => [...l, { id: Date.now(), from: 'orchestrator', text: msg, time: now }]);
    setMsg('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Mission Control — Orchestrator" subtitle="מרכז שליטה ותקשורת בזמן אמת" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-5 mb-5">

          {/* Agent status cards */}
          {MOCK_AGENTS.map(agent => (
            <div key={agent.id} className="panda-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bot size={18} className="text-brand-400" />
                    <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface-800 ${
                      agent.status === 'running' ? 'bg-green-400' : 'bg-surface-500'
                    }`} />
                  </div>
                  <span className="text-sm font-semibold text-white">{agent.name}</span>
                </div>
                <StatusBadge status={agent.status} />
              </div>
              <div className="text-xs text-surface-400 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Activity size={11} className="text-green-400" />
                  <span className="text-surface-200 truncate">{agent.lastMatch}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock size={11} />
                  לפני {agent.minutesAgo} דקות
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Chat log */}
        <PandaCard title="לוג תקשורת" subtitle="שיחה בזמן אמת בין Orchestrator לסוכנים" noPad>
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {log.map(entry => (
              <div
                key={entry.id}
                className={`flex gap-2.5 animate-fade-in ${entry.from === 'orchestrator' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  entry.from === 'orchestrator'
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-700 text-surface-200'
                }`}>
                  {entry.from === 'orchestrator' ? 'O' : (entry.agent?.[2] || 'A')}
                </div>
                <div className={`max-w-[70%] ${entry.from === 'orchestrator' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {entry.agent && <span className="text-[10px] text-surface-500 px-1">{entry.agent}</span>}
                  <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    entry.from === 'orchestrator'
                      ? 'bg-brand-600/30 text-brand-100 rounded-tr-none'
                      : 'bg-surface-700/60 text-surface-200 rounded-tl-none'
                  }`}>
                    {entry.text}
                  </div>
                  <span className="text-[10px] text-surface-600 px-1">{entry.time}</span>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 p-4 border-t border-surface-700">
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMsg()}
              placeholder="הוראה לסוכנים..."
              className="panda-input flex-1"
            />
            <button onClick={sendMsg} className="panda-btn-primary px-4">
              <Send size={14} />
            </button>
          </div>
        </PandaCard>
      </main>
    </div>
  );
}
