import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  Loader2, 
  RefreshCw, 
  Briefcase, 
  User, 
  Clock,
  Activity,
  Zap,
  CheckCircle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const AGENT_PAGES = {
  naama: 'NaamaPage',
  rami: 'RamiPage',
  alik: 'AlikPage',
  itay: 'ItayPage',
  lior: 'LiorPage',
  ofir: 'OfirPage',
  dganit: 'DganitPage',
  gc: 'GcPage',
  etgar: 'EtgarPage',
  carmit: 'Dashboard',
};

export default function AgentThinkingLog() {
  const navigate = useNavigate();
  const [agentStatuses, setAgentStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const agentConfig = {
    naama: {
      name: 'נעמה',
      role: 'מומחית תוכנה',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face',
      color: 'orange'
    },
    rami: {
      name: 'רמי',
      role: 'מומחה רמה 1',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=60&h=60&fit=crop&crop=face',
      color: 'red'
    },
    alik: {
      name: 'אליק',
      role: 'מומחה אלקטרוניקה',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face',
      color: 'teal'
    },
    itay: {
      name: 'איתי',
      role: 'מומחה IT',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&fit=crop&crop=face',
      color: 'indigo'
    },
    lior: {
      name: 'ליאור',
      role: 'מומחה הנדסת מערכת',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face',
      color: 'amber'
    },
    ofir: {
      name: 'אופיר',
      role: 'מומחה הנדסת מכונות',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face',
      color: 'emerald'
    },
    dganit: {
      name: 'דגנית',
      role: 'מומחית QA',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=60&h=60&fit=crop&crop=face',
      color: 'violet'
    },
    gc: {
      name: 'GC',
      role: 'סוכן כללי',
      image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=60&h=60&fit=crop&crop=face',
      color: 'gray'
    },
    etgar: {
      name: 'אתגר',
      role: 'סוכן ביטחוני',
      image: 'https://images.unsplash.com/photo-1534308143272-a3ea2d31b401?w=60&h=60&fit=crop&crop=face',
      color: 'orange'
    },
    carmit: {
      name: 'כרמית',
      role: 'מנהלת הגיוס',
      image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=60&h=60&fit=crop&crop=face',
      color: 'purple'
    }
  };

  const loadStatuses = async () => {
    try {
      const statuses = await base44.entities.AgentRunStatus.list();
      setAgentStatuses(statuses);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading agent statuses:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStatuses();
    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(loadStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setLoading(true);
    await loadStatuses();
  };

  const getTimeSince = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return `לפני ${seconds} שניות`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `לפני ${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    const days = Math.floor(hours / 24);
    return `לפני ${days} ימים`;
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-right">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            לוג מחשבתי - מה הסוכנים עושים עכשיו
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                עדכון אחרון: {lastUpdate.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' })}
              </span>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                if (!confirm('למחוק את כל הלוגים הישנים של הסוכנים?')) return;
                setLoading(true);
                try {
                  const statusesToClear = agentStatuses.filter(s => s.detailed_log);
                  for (const status of statusesToClear) {
                    await base44.entities.AgentRunStatus.update(status.id, {
                      detailed_log: ''
                    });
                  }
                  await loadStatuses();
                } catch (error) {
                  console.error('Error clearing logs:', error);
                }
              }}
              disabled={loading}
              className="text-red-600 hover:text-red-700"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              נקה לוגים
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManualRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              רענן
            </Button>
          </div>
        </CardTitle>
        <p className="text-sm text-gray-600 text-right">
          מעקב בזמן אמת אחר פעילות כל סוכן - עדכון אוטומטי כל 5 שניות
        </p>
      </CardHeader>
      <CardContent>
        {loading && agentStatuses.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentStatuses
              .filter(status => agentConfig[status.agent_name])
              .sort((a, b) => {
                if (a.agent_name === 'carmit') return -1;
                if (b.agent_name === 'carmit') return 1;
                return 0;
              })
              .map((status) => {
                const config = agentConfig[status.agent_name];
                const isActive = status.is_running;
                const hasFocus = status.focused_job_title || status.focused_candidate_name;
                const isCarmit = status.agent_name === 'carmit';

                const agentPage = AGENT_PAGES[status.agent_name];
                return (
                  <div 
                    key={status.id}
                    onClick={() => agentPage && navigate(createPageUrl(agentPage))}
                    className={`
                      relative p-4 rounded-lg transition-all
                      ${agentPage ? 'cursor-pointer hover:scale-[1.02]' : ''}
                      ${isCarmit
                        ? `border-4 border-purple-500 bg-purple-50/50 shadow-xl shadow-purple-200 carmit-glow`
                        : `border-2 ${isActive 
                            ? `bg-${config.color}-50 border-${config.color}-300 shadow-lg` 
                            : 'bg-gray-50 border-gray-200'
                          }`
                      }
                    `}
                    style={isCarmit ? { animation: 'carmitPulse 2.5s ease-in-out infinite' } : {}}
                  >
                    <style>{`
                      @keyframes carmitPulse {
                        0%, 100% { box-shadow: 0 0 8px 2px rgba(168, 85, 247, 0.3), 0 4px 24px rgba(168, 85, 247, 0.15); border-color: rgb(168, 85, 247); }
                        50% { box-shadow: 0 0 18px 6px rgba(168, 85, 247, 0.6), 0 4px 32px rgba(168, 85, 247, 0.3); border-color: rgb(192, 132, 252); }
                      }
                    `}</style>
                    {/* Agent Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <img 
                        src={config.image}
                        alt={config.name}
                        className={`w-12 h-12 rounded-full object-cover border-2 border-${config.color}-300 ${isActive ? 'ring-2 ring-offset-2 ring-' + config.color + '-400 animate-pulse' : ''}`}
                      />
                      <div className="flex-1">
                        <h3 className={`font-semibold text-${config.color}-900`}>{config.name}</h3>
                        <p className="text-xs text-gray-600">{config.role}</p>
                      </div>
                      {isActive && (
                        <Badge className={`bg-${config.color}-500 text-white animate-pulse`}>
                          <Activity className="w-3 h-3 ml-1" />
                          פעיל
                        </Badge>
                      )}
                    </div>

                    {/* Current Activity */}
                    {isActive && status.current_activity && (
                      <div className={`mb-3 p-3 bg-white/70 rounded-lg border border-${config.color}-200 text-right`}>
                        <div className="flex items-start gap-2">
                          <Zap className={`w-4 h-4 text-${config.color}-600 mt-0.5 flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 mb-1">פעילות נוכחית:</p>
                            <p className="text-sm text-gray-900">{status.current_activity}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detailed Log - Last Actions */}
                    {status.detailed_log && (
                      <div className={`mb-3 p-3 ${status.agent_name === 'carmit' ? 'bg-purple-50 border-2 border-purple-300' : 'bg-white border border-' + config.color + '-200'} rounded-lg ${status.agent_name === 'carmit' ? 'max-h-96' : 'max-h-32'} overflow-y-auto text-right`}>
                        <p className={`${status.agent_name === 'carmit' ? 'text-sm' : 'text-xs'} font-semibold text-${config.color}-700 mb-2 flex items-center gap-1`}>
                          <Activity className={`${status.agent_name === 'carmit' ? 'w-4 h-4' : 'w-3 h-3'}`} />
                          לוג פעולות מפורט:
                        </p>
                        <div className={`space-y-1 ${status.agent_name === 'carmit' ? 'text-sm' : 'text-xs'} text-gray-700 ${status.agent_name === 'carmit' ? '' : 'font-mono'}`}>
                          {status.detailed_log.split('\n').slice(status.agent_name === 'carmit' ? -40 : -8).map((line, idx) => (
                            <div key={idx} className={`${status.agent_name === 'carmit' ? 'leading-relaxed py-0.5' : 'leading-tight'} ${line.includes('✓') || line.includes('✅') ? 'text-green-700 font-medium' : line.includes('→') || line.includes('יצרתי') ? 'text-blue-700 font-medium' : line.includes('דחיתי') || line.includes('⏭️') ? 'text-red-600' : line.includes('💭') ? 'text-purple-600 italic' : ''}`}>
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Focused Job/Candidate */}
                    {hasFocus && (
                      <div className="space-y-2 mb-3 text-right">
                        {status.focused_job_title && (
                          <div className={`p-2 bg-white rounded border border-${config.color}-200`}>
                            <div className="flex items-center gap-2">
                              <Briefcase className={`w-4 h-4 text-${config.color}-600 flex-shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-600">משרה ממוקדת:</p>
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {status.focused_job_title}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {status.focused_candidate_name && (
                          <div className={`p-2 bg-white rounded border border-${config.color}-200`}>
                            <div className="flex items-center gap-2">
                              <User className={`w-4 h-4 text-${config.color}-600 flex-shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-600">מועמד ממוקד:</p>
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {status.focused_candidate_name}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {status.focus_matches_found !== undefined && status.focus_matches_found > 0 && (
                          <div className={`p-2 bg-${config.color}-100 rounded`}>
                            <p className="text-xs text-center">
                              <CheckCircle className="w-3 h-3 inline ml-1" />
                              {status.focus_matches_found} התאמות נמצאו
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status Footer */}
                    <div className="space-y-2 text-xs text-right">
                      {status.last_run_end && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>
                            {isActive 
                              ? `התחיל ${getTimeSince(status.last_run_start)}`
                              : `הושלם ${getTimeSince(status.last_run_end)}`
                            }
                          </span>
                        </div>
                      )}
                      
                      {status.matches_created > 0 && (
                        <div className={`flex items-center gap-2 text-${config.color}-700`}>
                          <CheckCircle className="w-3 h-3" />
                          <span>{status.matches_created} התאמות בריצה האחרונה</span>
                        </div>
                      )}

                      {!isActive && !status.current_activity && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Activity className="w-3 h-3" />
                          <span>מחכה למשימה הבאה...</span>
                        </div>
                      )}
                    </div>

                    {/* Running Indicator */}
                    {isActive && (
                      <div className="absolute top-2 left-2">
                        <div className={`w-3 h-3 bg-${config.color}-500 rounded-full animate-pulse`}></div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {agentStatuses.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p>אין נתוני סטטוס עבור הסוכנים</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}