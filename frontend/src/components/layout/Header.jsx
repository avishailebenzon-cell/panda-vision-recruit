import { useState, useEffect } from 'react';
import { RefreshCw, Shield, Wifi, WifiOff } from 'lucide-react';
import { getHealth } from '../../services/api';

export default function Header({ title, subtitle }) {
  const [health,    setHealth]    = useState(null);
  const [lastSync,  setLastSync]  = useState(null);
  const [online,    setOnline]    = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const h = await getHealth();
        setHealth(h);
        setOnline(true);
        setLastSync(new Date());
      } catch {
        setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60 bg-surface-900/50 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="text-base font-semibold text-white leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4 text-xs text-surface-400">
        {/* Watchdog status */}
        <div className="flex items-center gap-1.5">
          <Shield size={13} className={health?.watchdog === 'active' ? 'text-green-400' : 'text-surface-500'} />
          <span>Watchdog {health?.watchdog === 'active' ? 'פעיל' : 'לא פעיל'}</span>
        </div>

        {/* Last sync */}
        {lastSync && (
          <div className="flex items-center gap-1.5">
            <RefreshCw size={12} className="text-surface-500" />
            <span>
              סנכרון: {lastSync.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Connection indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${online ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{online ? 'מחובר' : 'מנותק'}</span>
        </div>
      </div>
    </header>
  );
}
