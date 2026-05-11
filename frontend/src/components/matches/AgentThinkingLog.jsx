import React, { useState, useEffect } from 'react';
import { formatDateTimeIL } from '@/utils/dateUtils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Activity,
  Target,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

export default function AgentThinkingLog({ agentName, agentDisplayName, agentColor = 'blue' }) {
  const [agentStatus, setAgentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadAgentStatus = async () => {
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: agentName });
      if (statuses.length > 0) {
        setAgentStatus(statuses[0]);
      }
    } catch (error) {
      console.error(`Error loading ${agentName} status:`, error);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Delay initial load by 4 seconds to avoid competing with page's own data loading
    const initialTimer = setTimeout(loadAgentStatus, 4000);
    
    // Auto-refresh every 10 seconds only if agent is running
    const interval = setInterval(() => {
      if (autoRefresh && agentStatus?.is_running) {
        loadAgentStatus();
      }
    }, 10000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [agentName, autoRefresh, agentStatus?.is_running]);

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-gray-400 py-1"><Loader2 className="w-3 h-3 animate-spin" /> טוען...</div>;
  }

  if (!agentStatus) {
    return <div className="text-xs text-gray-400 py-1">{agentDisplayName} טרם התחיל לפעול</div>;
  }

  const isRunning = agentStatus.is_running;

  return (
    <div className={`flex items-center gap-3 flex-wrap border rounded-lg px-3 py-2 text-sm ${
      isRunning ? 'border-green-300 bg-green-50' : `border-${agentColor}-200 bg-${agentColor}-50/30`
    }`}>
      {/* Status */}
      <div className="flex items-center gap-1.5 font-medium">
        {isRunning ? (
          <><Activity className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">פעיל</span></>
        ) : (
          <><CheckCircle className="w-3.5 h-3.5 text-gray-500" /><span className="text-gray-500">במנוחה</span></>
        )}
      </div>

      {/* Focused job */}
      {agentStatus.focused_job_title && (
        <div className="flex items-center gap-1 text-orange-700 max-w-xs">
          <Target className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate text-xs" title={agentStatus.focused_job_title}>{agentStatus.focused_job_title}</span>
        </div>
      )}

      {/* Current activity */}
      {agentStatus.current_activity && (
        <div className="flex items-center gap-1 text-gray-600 flex-1 min-w-0">
          {isRunning ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" /> : <Clock className="w-3 h-3 flex-shrink-0" />}
          <span className="truncate text-xs" title={agentStatus.current_activity}>{agentStatus.current_activity}</span>
        </div>
      )}

      {/* Stats */}
      {agentStatus.matches_created > 0 && (
        <span className="text-xs text-blue-600 flex items-center gap-1 flex-shrink-0">
          <CheckCircle className="w-3 h-3" />{agentStatus.matches_created} התאמות
        </span>
      )}
      {agentStatus.focus_matches_found > 0 && (
        <span className="text-xs text-purple-600 flex items-center gap-1 flex-shrink-0">
          <TrendingUp className="w-3 h-3" />{agentStatus.focus_matches_found} מועמדים
        </span>
      )}

      {/* Error */}
      {agentStatus.last_error && (
        <span className="text-xs text-red-600 flex items-center gap-1 flex-shrink-0" title={agentStatus.last_error}>
          <AlertCircle className="w-3 h-3" />שגיאה
        </span>
      )}

      {/* Last run time */}
      {agentStatus.last_run_end && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          {formatDateTimeIL(agentStatus.last_run_end)}
        </span>
      )}

      {/* Refresh */}
      <button onClick={loadAgentStatus} className="mr-auto text-gray-400 hover:text-gray-600 flex-shrink-0">
        <RefreshCw className="w-3 h-3" />
      </button>

      {/* Expanded log */}
      {agentStatus.detailed_log && (
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          {expanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      )}

      {expanded && agentStatus.detailed_log && (
        <div className="w-full mt-1 bg-white border rounded p-2">
          <ScrollArea className="h-40">
            <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">{agentStatus.detailed_log}</pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}