import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Users, 
  Building,
  Send,
  Settings,
  MessageCircle,
  UserCheck,
  Calendar,
  Zap,
  Home
} from "lucide-react";
import { motion } from "framer-motion";

const AGENT_CONFIG = {
  naama: {
    name: "נעמה - רכזת תוכנה",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-orange-500 to-orange-600",
    glowColor: "shadow-orange-500/50",
    counterLabel: "התאמות שנוצרו",
    actionExamples: ["מחפשת מועמדים מתאימים", "מנתחת פרופילים", "יוצרת התאמות חכמות"],
    page: "NaamaPage"
  },
  rami: {
    name: "רמי - רכז רמה 1",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-red-500 to-red-600",
    glowColor: "shadow-red-500/50",
    counterLabel: "התאמות רמה 1",
    actionExamples: ["מנתח משרות רמה 1", "מחפש מועמדי רמה 1", "יוצר התאמות מומחיות"],
    page: "RamiPage"
  },
  alik: {
    name: "אליק - רכז אלקטרוניקה",
    image: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-teal-500 to-teal-600",
    glowColor: "shadow-teal-500/50",
    counterLabel: "התאמות אלקטרוניקה",
    actionExamples: ["מנתח משרות אלקטרוניקה", "מחפש מועמדי חומרה", "יוצר התאמות מומחיות"],
    page: "AlikPage"
  },
  itay: {
    name: "איתי - רכז IT",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-indigo-500 to-indigo-600",
    glowColor: "shadow-indigo-500/50",
    counterLabel: "התאמות IT",
    actionExamples: ["מנתח משרות IT", "מחפש מועמדי תשתיות", "יוצר התאמות מומחיות"],
    page: "ItayPage"
  },
  lior: {
    name: "ליאור - רכז הנדסת מערכת",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-amber-500 to-amber-600",
    glowColor: "shadow-amber-500/50",
    counterLabel: "התאמות הנדסת מערכת",
    actionExamples: ["מנתח משרות מערכת", "מחפש מהנדסי מערכת", "יוצר התאמות מומחיות"],
    page: "LiorPage"
  },
  ofir: {
    name: "אופיר - רכז הנדסת מכונות",
    image: "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-emerald-500 to-emerald-600",
    glowColor: "shadow-emerald-500/50",
    counterLabel: "התאמות הנדסת מכונות",
    actionExamples: ["מנתח משרות מכניות", "מחפש מהנדסי מכונות", "יוצר התאמות מומחיות"],
    page: "OfirPage"
  },
  dganit: {
    name: "דגנית - רכזת QA",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-violet-500 to-violet-600",
    glowColor: "shadow-violet-500/50",
    counterLabel: "התאמות QA",
    actionExamples: ["מנתחת משרות QA", "מחפשת מועמדי בדיקות", "יוצרת התאמות מומחיות"],
    page: "DganitPage"
  },
  gc: {
    name: "GC - סוכן כללי",
    image: "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-gray-500 to-gray-600",
    glowColor: "shadow-gray-500/50",
    counterLabel: "התאמות כלליות",
    actionExamples: ["מנתח משרות לא מסווגות", "מחפש מועמדים רב-תחומיים", "יוצר התאמות גנריות"],
    page: "GcPage"
  },

  rotem: {
    name: "טל - קשרי מועמדים",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    icon: MessageCircle,
    color: "from-green-500 to-green-600",
    glowColor: "shadow-green-500/50",
    counterLabel: "משימות ממתינות",
    actionExamples: ["מתקשרת עם מועמדים", "מעדכנת סטטוסים", "שולחת הודעות"],
    page: "RotemPage"
  },
  carmit: {
    name: "כרמית - מנהלת גיוס",
    image: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=100&h=100&fit=crop&crop=face",
    icon: Users,
    color: "from-purple-500 to-purple-600",
    glowColor: "shadow-purple-500/50",
    counterLabel: "תהליכים בניהול",
    actionExamples: ["מנתחת ביצועים", "מפקחת על תהליכים", "מייעלת זרימת עבודה"],
    page: "Dashboard"
  },
  meni: {
    name: "מני - מכירות אפקטיביות",
    image: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-purple-500 to-pink-600",
    glowColor: "shadow-purple-500/50",
    counterLabel: "התאמות יצירתיות",
    actionExamples: ["חושב מחוץ לקופסה", "מוצא זוויות חדשות", "יוצר התאמות מפתיעות"],
    page: "MeniPage"
  },
  eitan: {
    name: "איתן - בדיקות איכות",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-blue-500 to-cyan-600",
    glowColor: "shadow-blue-500/50",
    counterLabel: "בדיקות שבוצעו",
    actionExamples: ["בודק איכות שירות", "מנתח תהליכים", "משפר ביצועים"],
    page: "EitanManagement"
  },
  hila: {
    name: "הילה - הפצת משרות",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    icon: Send,
    color: "from-pink-500 to-pink-600",
    glowColor: "shadow-pink-500/50",
    counterLabel: "משרות שהופצו",
    actionExamples: ["מכינה הפצות", "שולחת למועמדים", "מנתחת תגובות"],
    page: "HilaManagement"
  },
  raviv: {
    name: "רביב - ניטור מערכת",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    icon: Settings,
    color: "from-gray-500 to-gray-600",
    glowColor: "shadow-gray-500/50",
    counterLabel: "בדיקות מערכת",
    actionExamples: ["עוקב אחר תקינות", "מנטר ביצועים", "בודק אינטגרציות"],
    page: "Management"
  },
  elad: {
    name: "אלעד - ניהול לקוחות",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    icon: Building,
    color: "from-indigo-500 to-indigo-600",
    glowColor: "shadow-indigo-500/50",
    counterLabel: "לקוחות פעילים",
    actionExamples: ["מעדכן פרטי לקוחות", "בודק נתונים חסרים", "מסנכרן עם מערכות"],
    page: "EladPage"
  },



  inbar: {
    name: "ענבר - תוכנית משא״ן",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    icon: Calendar,
    color: "from-violet-500 to-violet-600",
    glowColor: "shadow-violet-500/50",
    counterLabel: "אירועים מתוזמנים",
    actionExamples: ["מתזמנת אירועים", "שולחת תזכורות", "מנהלת לו״ז"],
    page: "InbarManagement"
  },
  etgar: {
    name: "אתגר - סוכן ביטחוני",
    image: "https://images.unsplash.com/photo-1614028674026-a65e31bfd27c?w=100&h=100&fit=crop&crop=face",
    icon: UserCheck,
    color: "from-orange-600 to-red-700",
    glowColor: "shadow-orange-600/50",
    counterLabel: "התאמות ביטחוניות",
    actionExamples: ["מנתח פרופילי ביטחון", "מחפש מועמדי חפשנים", "יוצר התאמות מסווגות"],
    page: "EtgarPage"
  },
  dana: {
    name: "דנה - סנכרון פייפדרייב",
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&h=100&fit=crop&crop=face",
    icon: Activity,
    color: "from-cyan-500 to-cyan-600",
    glowColor: "shadow-cyan-500/50",
    counterLabel: "סנכרונים שבוצעו",
    actionExamples: ["מסנכרנת עם פייפדרייב", "מעדכנת נתונים", "מייבאת עסקאות"],
    page: "DanaManagement"
  },
};

export default function CommandCenter() {
  const [agentStatuses, setAgentStatuses] = useState({});
  const [agentToggles, setAgentToggles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgentStatuses();
    const interval = setInterval(loadAgentStatuses, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAgentStatuses = async () => {
    try {
      const [statuses, scanStatuses, scanLogs, rotemPendingTasks, rotemActiveTasks, toggleConfigs] = await Promise.all([
        base44.entities.AgentRunStatus.filter({}),
        base44.entities.MailScanStatus.list(),
        base44.entities.EmailScanLog.list('-created_date', 10),
        base44.entities.RotemTask.filter({ status: { $in: ['לא החל', 'מאושר לשיחה'] } }),
        base44.entities.RotemTask.filter({ status: 'בתהליך' }),
        base44.entities.AgentToggleConfig.filter({})
      ]);
      
      const statusMap = {};
      
      (statuses || []).forEach(status => {
        if (status.agent_name) {
          statusMap[status.agent_name] = status;
        }
      });
      
      // Add Raviv's email scanner status
      const scanStatus = scanStatuses?.[0];
      if (scanStatus) {
        // Get the most recent completed scan log to show last run stats
        const lastCompletedLog = scanLogs?.find(log => log.status === 'Completed');
        
        statusMap.raviv = {
          agent_name: 'raviv',
          is_running: scanStatus.is_running || scanStatus.is_reverse_running,
          current_action: scanStatus.is_running 
            ? 'סורק מיילים חדשים לקורות חיים' 
            : scanStatus.is_reverse_running 
              ? 'סורק מיילים ישנים (סריקה הפוכה)'
              : null,
          matches_created: lastCompletedLog?.candidates_created || 0,
          last_run_end: scanStatus.last_run_time || scanStatus.last_reverse_run_time,
          last_error: scanStatus.last_error
        };
      }
      
      // Add Rotem's pending tasks count and active calls
      const isOnCall = rotemActiveTasks && rotemActiveTasks.length > 0;
      const activeCandidates = isOnCall ? rotemActiveTasks.map(t => t.candidate_name) : [];
      
      statusMap.rotem = {
        agent_name: 'rotem',
        matches_created: rotemPendingTasks?.length || 0,
        is_running: isOnCall,
        active_candidates: activeCandidates
      };
      
      // Load agent toggle states
      const togglesMap = {};
      (toggleConfigs || []).forEach(config => {
        if (config.agent_name && config.agent_name !== 'master') {
          togglesMap[config.agent_name] = config.is_enabled;
        }
      });
      
      setAgentStatuses(statusMap);
      setAgentToggles(togglesMap);
    } catch (error) {
      console.error('Error loading agent statuses:', error);
    }
    setLoading(false);
  };

  const getAgentData = (agentKey) => {
    const config = AGENT_CONFIG[agentKey];
    const status = agentStatuses[agentKey] || {};
    
    const isActive = status.is_running || false;
    const activeCandidates = status.active_candidates || [];
    const currentAction = status.current_action || (isActive ? config.actionExamples[Math.floor(Math.random() * config.actionExamples.length)] : null);
    
    // Get total counter (cumulative)
    const counter = status.matches_created || status.jobs_processed || status.tasks_completed || 0;
    
    // If agent is running, show start time, otherwise show end time
    const lastRun = isActive ? status.last_run_start : status.last_run_end;
    
    // Get focused job title for naama, alik, itay, lior, ofir, and gc
    const focusedJobTitle = ['naama', 'alik', 'itay', 'lior', 'ofir', 'gc'].includes(agentKey) 
      ? status.focused_job_title 
      : null;
    
    // Don't show as error if agent was just stopped or completed successfully
    const hasRealError = status.last_error && 
      !status.last_error.includes('הופסק') && 
      !status.last_error.includes('stopped') &&
      !status.last_error.includes('בוטל') &&
      !status.last_error.includes('הועבר למנוחה') &&
      !status.last_error.includes('הושלם') &&
      !status.last_error.includes('completed') &&
      !status.last_error.includes('נקבע לביקור נוסף') &&
      !status.last_error.includes('אין משרות פעילות') &&
      !status.last_error.includes('לא נמצאו') &&
      status.last_error.toLowerCase().includes('error');
    
    return {
      ...config,
      isActive,
      currentAction,
      counter,
      lastRun,
      hasError: hasRealError,
      focusedJobTitle,
      activeCandidates
    };
  };

  const filteredAgents = Object.keys(AGENT_CONFIG).sort((a, b) => {
    // Sort by: active first, then by counter (descending)
    const agentA = getAgentData(a);
    const agentB = getAgentData(b);
    
    if (agentA.isActive && !agentB.isActive) return -1;
    if (!agentA.isActive && agentB.isActive) return 1;
    
    return agentB.counter - agentA.counter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 font-mono">טוען מערכת פיקוד...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `
          linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }} />

      {/* Animated corner accents */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/10 blur-3xl rounded-full animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="border-b border-cyan-500/30 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('MainMenu')}>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/20 gap-1.5"
              >
                <Home className="w-4 h-4" />
                חדרי עבודה
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2 font-mono">
                מרכז הפיקוד – HRAI
              </h1>
              <p className="text-cyan-400/60 text-sm font-mono">Pandatech AI Operations Center</p>
            </div>
          </div>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAgents.map((agentKey, index) => {
            const agent = getAgentData(agentKey);
            return <AgentTile key={agentKey} agent={agent} agentKey={agentKey} agentStatuses={agentStatuses} agentToggles={agentToggles} index={index} />;
          })}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-20">
            <Zap className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 font-mono">לא נמצאו סוכנים תואמים</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentTile({ agent, agentKey, agentStatuses, agentToggles, index }) {
  const Icon = agent.icon;
  const navigate = useNavigate();
  const isDisabled = agentToggles[agentKey] === false;
  
  const handleClick = () => {
    if (agent.page) {
      navigate(createPageUrl(agent.page));
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className={`
        relative bg-gray-900/80 backdrop-blur-sm
        border rounded-2xl overflow-visible
        transition-all duration-300 hover:scale-105 cursor-pointer
        ${isDisabled
          ? 'border-gray-700/30 opacity-50'
          : agent.isActive 
            ? `border-green-400 shadow-lg ${agent.glowColor}` 
            : agent.hasError 
              ? 'border-red-400/50 shadow-lg shadow-red-500/30'
              : 'border-gray-700/50 hover:border-gray-600'
        }
      `}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${agent.color} opacity-5 rounded-2xl`} />
      
      {/* Active pulse animation */}
      {agent.isActive && (
        <div className="absolute inset-0 border-2 border-green-400/50 rounded-2xl animate-ping" style={{ animationDuration: '2s' }} />
      )}

      <div className="relative flex flex-col p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-bold text-white leading-tight flex-1">{agent.name}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
            {isDisabled && (
              <Badge className="bg-red-900/50 text-red-400 border border-red-600/50 text-[10px] px-1.5 py-0.5">
                ⏸ כבוי
              </Badge>
            )}
            {agent.isActive && !isDisabled && (
              <>
                {agentKey === 'rotem' && (
                  <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 animate-pulse">
                    🔴 LIVE
                  </Badge>
                )}
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full opacity-70" />
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full opacity-40" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Agent Image and Status Side by Side */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`relative w-16 h-16 rounded-full overflow-hidden border-3 flex-shrink-0 ${
            agent.isActive ? 'border-green-400' : agent.hasError ? 'border-red-400' : 'border-gray-600'
          }`}>
            <img 
              src={agent.image} 
              alt={agent.name}
              className="w-full h-full object-cover"
            />
            {agent.isActive && (
              <motion.div
                className="absolute inset-0 bg-black"
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
          </div>

          <div className="flex-1 space-y-2">
            {/* Status Badge */}
            <Badge className={`${
              isDisabled
                ? 'bg-red-900/30 text-red-400 border-red-600/50'
                : agent.isActive 
                  ? 'bg-green-500/20 text-green-400 border-green-400/50' 
                  : agentStatuses[agentKey]?.last_error?.includes('הועבר למנוחה')
                    ? 'bg-purple-500/20 text-purple-400 border-purple-400/50'
                    : agent.hasError
                      ? 'bg-red-500/20 text-red-400 border-red-400/50'
                      : 'bg-gray-700/50 text-gray-400 border-gray-600/50'
            } font-mono text-xs border w-full justify-center`}>
              {isDisabled ? '⏸ כבוי' : agent.isActive ? '● פעיל' : agentStatuses[agentKey]?.last_error?.includes('הועבר למנוחה') ? '○ במנוחה' : agent.hasError ? '● שגיאה' : '○ לא פעיל'}
            </Badge>

            {/* Current Action / Focused Job / Active Calls */}
            <div className="text-xs text-gray-500 font-mono text-center">
              {agent.isActive && agent.currentAction ? (
                <span className="text-cyan-400">פועל...</span>
              ) : agentStatuses[agentKey]?.last_error?.includes('הועבר למנוחה') ? (
                <span className="text-purple-400">הועבר למנוחה ע״י רביב</span>
              ) : (
                <span>במנוחה</span>
              )}
            </div>
            {agent.focusedJobTitle && (
              <div className="text-[10px] text-purple-400 font-mono text-center mt-1 truncate px-1" title={agent.focusedJobTitle}>
                📋 {agent.focusedJobTitle}
              </div>
            )}
            {agentKey === 'rotem' && agent.isActive && agent.activeCandidates?.length > 0 && (
              <div className="mt-2 overflow-hidden bg-gray-800/80 rounded-md border border-green-400/30 h-6 flex items-center">
                <motion.div
                  animate={{ x: ['100%', '-100%'] }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="whitespace-nowrap text-[10px] text-green-400 font-mono px-2"
                >
                  📞 {agent.activeCandidates.join(' • ')}
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* Counter Section */}
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-mono">{agent.counterLabel}</span>
            <span className={`text-xl font-bold font-mono ${
              agent.counter > 0 ? 'text-cyan-400' : 'text-gray-600'
            }`}>
              {agent.counter}
            </span>
          </div>
          
          {/* Activity bar */}
          <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: agent.isActive ? '100%' : `${Math.min((agent.counter / 1000) * 100, 100)}%` }}
              transition={{ duration: 1 }}
              className={`h-full bg-gradient-to-r ${agent.color}`}
            />
          </div>

          {/* Last activity */}
          <div className="text-xs text-gray-500 font-mono text-center">
            {agent.lastRun 
              ? new Date(agent.lastRun).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
              : 'טרם רץ'
            }
          </div>
        </div>
      </div>

      {/* Corner accent - smaller */}
      <div className={`absolute top-0 left-0 w-8 h-8 bg-gradient-to-br ${agent.color} opacity-10 rounded-br-full`} />
      <div className={`absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-tl ${agent.color} opacity-10 rounded-tl-full`} />
    </motion.div>
  );
}