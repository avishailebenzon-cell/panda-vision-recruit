import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase,
  Settings, Zap, Mail, ChevronDown, ChevronRight, Bot,
} from 'lucide-react';
import { AGENTS, AGENT_COLORS } from '../../config/agents';

const TOP_NAV = [
  { to: '/',           label: 'דשבורד',      icon: LayoutDashboard },
  { to: '/matches',    label: 'התאמות',      icon: Zap             },
  { to: '/candidates', label: 'מועמדים',     icon: Users           },
  { to: '/jobs',       label: 'משרות',       icon: Briefcase       },
  { to: '/inbox',      label: 'דואר נכנס',  icon: Mail            },
];

export default function Sidebar() {
  const [agentsOpen, setAgentsOpen] = useState(true);

  return (
    <aside className="w-60 flex-shrink-0 bg-surface-900 border-r border-surface-700/60 flex flex-col h-screen sticky top-0">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-700/40">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-glow flex-shrink-0">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Panda-Vision</p>
          <p className="text-[10px] text-surface-400 mt-0.5">Recruit Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">

        {/* Top nav items */}
        {TOP_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={15} className="flex-shrink-0" />
            <span className="text-[13px]">{label}</span>
          </NavLink>
        ))}

        {/* Agents section */}
        <div className="pt-2">
          <button
            onClick={() => setAgentsOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-300 transition-colors"
          >
            <Bot size={12} />
            <span className="flex-1 text-right">סוכני גיוס</span>
            {agentsOpen
              ? <ChevronDown size={12} />
              : <ChevronRight size={12} />
            }
          </button>

          {agentsOpen && (
            <div className="space-y-0.5 animate-fade-in">
              {AGENTS.map((agent) => {
                const colors = AGENT_COLORS[agent.color];
                const Icon   = agent.icon;
                return (
                  <NavLink
                    key={agent.type}
                    to={`/agents/${agent.type}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer select-none ${
                        isActive
                          ? `${colors.bg} ${colors.text} border ${colors.border}`
                          : 'text-surface-400 hover:text-white hover:bg-surface-700/60'
                      }`
                    }
                  >
                    <Icon size={13} className="flex-shrink-0" />
                    <span className="flex-1">{agent.labelHe}</span>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot} opacity-60`} />
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="pt-1">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Settings size={15} className="flex-shrink-0" />
            <span className="text-[13px]">הגדרות מערכת</span>
          </NavLink>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-700/40">
        <p className="text-[10px] text-surface-600 text-center">v0.1.0 · Pandatech</p>
      </div>
    </aside>
  );
}
