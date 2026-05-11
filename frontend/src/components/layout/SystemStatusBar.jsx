import React, { useState, useEffect, useRef } from 'react';
import { formatDateTimeIL } from '@/utils/dateUtils';
import { MailScanStatus } from '@/entities/MailScanStatus';
import { AccessLog } from '@/entities/AccessLog';
import { base44 } from '@/api/base44Client';
import { 
  Mail, 
  Users, 
  Bot, 
  CheckCircle, 
  XCircle,
  Loader2,
  Briefcase,
  Building,
  Settings,
  UserCheck,
  Send,
  FileText,
  Heart,
  Upload,
  X,
  StopCircle,
  Clock
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
// Agent configuration with images and colors
const AGENTS = {
  naama: {
    name: 'נעמה',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=20&h=20&fit=crop&crop=face',
    color: 'bg-orange-500',
    textColor: 'text-orange-400',
    role: 'מתאמת מועמדים למשרות'
  },

  rotem: {
    name: 'טל',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=20&h=20&fit=crop&crop=face',
    color: 'bg-green-500',
    textColor: 'text-green-400',
    role: 'קשרי מועמדים בוואטסאפ'
  },
  raviv: {
    name: 'רביב',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=20&h=20&fit=crop&crop=face',
    color: 'bg-gray-500',
    textColor: 'text-gray-400',
    icon: Settings,
    role: 'ניטור מערכת'
  },
  hila: {
    name: 'הילה',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=20&h=20&fit=crop&crop=face',
    color: 'bg-pink-500',
    textColor: 'text-pink-400',
    icon: Send,
    role: 'הפצת משרות לעובדים'
  },
  carmit: {
    name: 'כרמית',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=20&h=20&fit=crop&crop=face',
    color: 'bg-purple-500',
    textColor: 'text-purple-400',
    icon: UserCheck,
    role: 'מנהלת גיוס'
  },
  elad: {
    name: 'אלעד',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=20&h=20&fit=crop&crop=face',
    color: 'bg-blue-600',
    textColor: 'text-blue-400',
    icon: Building,
    role: 'ניהול לקוחות'
  },
  noa: {
    name: 'נועה',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=20&h=20&fit=crop&crop=face',
    color: 'bg-green-600',
    textColor: 'text-green-400',
    icon: Briefcase,
    role: 'ניהול משרות'
  },
  shiri: {
    name: 'שירי',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=20&h=20&fit=crop&crop=face',
    color: 'bg-rose-500',
    textColor: 'text-rose-400',
    icon: Heart,
    role: 'קשרי עובדים'
  },
  inbar: {
    name: 'ענבר',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=20&h=20&fit=crop&crop=face',
    color: 'bg-violet-500',
    textColor: 'text-violet-400',
    role: 'תוכנית משאן'
  },
  dana: {
    name: 'דנה',
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=20&h=20&fit=crop&crop=face',
    color: 'bg-cyan-500',
    textColor: 'text-cyan-400',
    role: 'סנכרון פייפדרייב'
  },
  yotam: {
    name: 'יותם',
    image: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=20&h=20&fit=crop&crop=face',
    color: 'bg-cyan-500',
    textColor: 'text-cyan-400',
    role: 'תפיסת מועמדים חמים'
  },
  rami: {
    name: 'רמי',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=20&h=20&fit=crop&crop=face',
    color: 'bg-red-500',
    textColor: 'text-red-400',
    role: 'מומחה רמה 1'
  },
  alik: {
    name: 'אליק',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=20&h=20&fit=crop&crop=face',
    color: 'bg-teal-500',
    textColor: 'text-teal-400',
    role: 'מומחה אלקטרוניקה'
  },
  itay: {
    name: 'איתי',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=20&h=20&fit=crop&crop=face',
    color: 'bg-indigo-500',
    textColor: 'text-indigo-400',
    role: 'מומחה IT'
  },
  lior: {
    name: 'ליאור',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=20&h=20&fit=crop&crop=face',
    color: 'bg-amber-500',
    textColor: 'text-amber-400',
    role: 'מומחה הנדסת מערכת'
  },
  ofir: {
    name: 'אופיר',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=20&h=20&fit=crop&crop=face',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-400',
    role: 'מומחה הנדסת מכונות'
  },
  meni: {
    name: 'מני',
    image: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=20&h=20&fit=crop&crop=face',
    color: 'bg-purple-500',
    textColor: 'text-purple-400',
    role: 'מכירות אפקטיביות'
  },
  eitan: {
    name: 'איתן',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=20&h=20&fit=crop&crop=face',
    color: 'bg-blue-500',
    textColor: 'text-blue-400',
    role: 'בדיקות איכות'
  }
};

export default function SystemStatusBar() {
  const [mailStatus, setMailStatus] = useState(null);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [activeUsers, setActiveUsers] = useState(0);
  const [activeUsersList, setActiveUsersList] = useState([]);
  const [jobsSyncStatus, setJobsSyncStatus] = useState(null);
  const [orgsSyncStatus, setOrgsSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  
  // Manual upload state (received via window event)
  const [manualUploadState, setManualUploadState] = useState(null);
  
  // Listen for manual upload status updates
  useEffect(() => {
    const handleUploadStatus = (e) => {
      setManualUploadState(e.detail);
    };
    window.addEventListener('manual-upload-status', handleUploadStatus);
    return () => window.removeEventListener('manual-upload-status', handleUploadStatus);
  }, []);

  useEffect(() => {
    const loadStatuses = async () => {
      // Load all statuses in parallel - much faster than sequential with delays
      const promises = [];
      
      // Mail scan status
      promises.push(
        MailScanStatus.list('-updated_date', 1)
          .then(mailStatuses => {
            if (mailStatuses.length > 0) setMailStatus(mailStatuses[0]);
          })
          .catch(() => {})
      );

      // Agent statuses
      promises.push(
        import('@/entities/AgentRunStatus')
          .then(({ AgentRunStatus }) => AgentRunStatus.list('-updated_date', 10))
          .then(statuses => {
            const statusMap = {};
            (statuses || []).forEach(s => {
              if (s.agent_name) statusMap[s.agent_name] = s;
            });
            setAgentStatuses(statusMap);
          })
          .catch(() => {})
      );

      // Active users count - includes current user (reduced limit to avoid rate limiting)
       promises.push(
         Promise.all([
           AccessLog.list('-created_date', 30),
           base44.auth.me()
         ])
          .then(([recentLogins, currentUser]) => {
            const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
            const recentUsers = recentLogins.filter(log => 
              (log.event_type === 'page_visit' || log.event_type === 'login_success') && 
              new Date(log.created_date).getTime() > thirtyMinutesAgo
            );
            
            // Build user list with names
            const usersMap = new Map();
            recentUsers.forEach(log => {
              if (!usersMap.has(log.user_email)) {
                usersMap.set(log.user_email, {
                  email: log.user_email,
                  name: log.user_name,
                  lastActivity: new Date(log.created_date)
                });
              } else {
                const existing = usersMap.get(log.user_email);
                if (new Date(log.created_date) > existing.lastActivity) {
                  existing.lastActivity = new Date(log.created_date);
                }
              }
            });
            
            // Always include current user
            if (currentUser?.email) {
              if (!usersMap.has(currentUser.email)) {
                usersMap.set(currentUser.email, {
                  email: currentUser.email,
                  name: currentUser.full_name,
                  lastActivity: new Date()
                });
              }
            }
            
            const usersList = Array.from(usersMap.values()).sort((a, b) => 
              b.lastActivity - a.lastActivity
            );
            
            setActiveUsers(usersList.length);
            setActiveUsersList(usersList);
          })
          .catch(() => {
            // Fallback: at least show 1 (current user)
            setActiveUsers(1);
            setActiveUsersList([]);
          })
      );

      // Pipedrive sync statuses
      promises.push(
        import('@/entities/PipedriveSyncStatus')
          .then(({ PipedriveSyncStatus }) => PipedriveSyncStatus.list('-last_run_time', 5))
          .then(syncStatuses => {
            const jobsSync = syncStatuses.find(s => s.sync_type === 'jobs');
            const orgsSync = syncStatuses.find(s => s.sync_type === 'organizations');
            if (jobsSync) setJobsSyncStatus(jobsSync);
            if (orgsSync) setOrgsSyncStatus(orgsSync);
          })
          .catch(() => {})
      );

      await Promise.all(promises);
      setLoading(false);
    };

    // Initial load with small delay to let critical components load first
    const initialTimeout = setTimeout(loadStatuses, 3000);
    
    // Refresh every 30 seconds to keep data current
    const interval = setInterval(loadStatuses, 30000);
    
    // Trigger scheduledMasterProcess every 30 minutes for automation
    const triggerScheduler = async () => {
      try {
        await base44.functions.invoke('scheduledMasterProcess', {});
        console.log('Scheduler triggered successfully');
      } catch (e) {
        console.log('Scheduler trigger (background):', e.message);
      }
    };
    
    // Trigger scheduler on app load (after 10 seconds)
    const schedulerInitialTimeout = setTimeout(triggerScheduler, 10000);
    
    // Then trigger every 30 minutes
    const schedulerInterval = setInterval(triggerScheduler, 30 * 60 * 1000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(schedulerInitialTimeout);
      clearInterval(interval);
      clearInterval(schedulerInterval);
    };
  }, []);

  // Build status items for the marquee
  const buildStatusItems = () => {
    const items = [];
    const isMailScanning = mailStatus?.is_running || mailStatus?.is_reverse_running;

    // Mail scanning status - regular (with detailed message)
    items.push({
      key: 'mail',
      icon: <Mail className="w-3.5 h-3.5 text-blue-400" />,
      label: mailStatus?.is_running 
        ? (mailStatus.current_scanner_message || 
           (mailStatus.current_processing_file 
            ? `מנתח: ${mailStatus.current_processing_file.substring(0, 30)}...` 
            : 'סורק מיילים (רגיל)...'))
        : 'סריקה רגילה: לא פעיל',
      isActive: mailStatus?.is_running,
      color: 'bg-blue-500'
    });

    // Mail scanning status - reverse (with detailed message)
    items.push({
      key: 'mail_reverse',
      icon: <Mail className="w-3.5 h-3.5 text-purple-400" />,
      label: mailStatus?.is_reverse_running 
        ? (mailStatus.current_scanner_message_reverse || 
           (mailStatus.current_processing_file_reverse 
            ? `מנתח (הפוך): ${mailStatus.current_processing_file_reverse.substring(0, 30)}...` 
            : 'סורק מיילים (הפוך)...'))
        : 'סריקה הפוכה: לא פעיל',
      isActive: mailStatus?.is_reverse_running,
      color: 'bg-purple-500'
    });

    // Manual upload status
    if (manualUploadState?.isUploading) {
      items.push({
        key: 'manual_upload',
        icon: <Upload className="w-3.5 h-3.5 text-purple-400" />,
        label: manualUploadState.statusMessage || `מעלה קבצים ידנית... (${manualUploadState.currentFileIndex}/${manualUploadState.totalFiles})`,
        isActive: true,
        color: 'bg-purple-500'
      });
    }

    // Active agents
    Object.entries(AGENTS).forEach(([agentKey, agent]) => {
      const status = agentStatuses[agentKey];
      if (status?.is_running) {
        items.push({
          key: agentKey,
          image: agent.image,
          label: status.current_action || `${agent.name} פעיל...`,
          isActive: true,
          color: agent.color
        });
      }
    });

    // Jobs sync
    items.push({
      key: 'jobs_sync',
      icon: <Briefcase className="w-3.5 h-3.5 text-purple-400" />,
      label: jobsSyncStatus?.status === 'success' ? 'סנכרון משרות: תקין' : 'סנכרון משרות: לא תקין',
      isActive: jobsSyncStatus?.status === 'success',
      color: jobsSyncStatus?.status === 'success' ? 'bg-green-500' : 'bg-red-500'
    });

    // Orgs sync
    items.push({
      key: 'orgs_sync',
      icon: <Building className="w-3.5 h-3.5 text-indigo-400" />,
      label: orgsSyncStatus?.status === 'success' ? 'סנכרון לקוחות: תקין' : 'סנכרון לקוחות: לא תקין',
      isActive: orgsSyncStatus?.status === 'success',
      color: orgsSyncStatus?.status === 'success' ? 'bg-green-500' : 'bg-red-500'
    });

    // Add ALL agents with their status
    Object.entries(AGENTS).forEach(([agentKey, agent]) => {
      const status = agentStatuses[agentKey];
      // Skip agents already added as active
      if (status?.is_running) return;
      
      let statusText = 'מוכן';
      let isHealthy = true;
      
      if (status) {
        if (status.last_error) {
          statusText = 'שגיאה';
          isHealthy = false;
        } else if (status.last_action) {
          statusText = status.last_action;
        } else if (status.matches_created) {
          statusText = `${status.matches_created} התאמות`;
        } else if (status.last_run_end) {
          const lastRun = new Date(status.last_run_end);
          const hoursSince = Math.floor((Date.now() - lastRun.getTime()) / (1000 * 60 * 60));
          if (hoursSince < 1) {
            statusText = 'רץ לאחרונה';
          } else if (hoursSince < 24) {
            statusText = `לפני ${hoursSince} שעות`;
          } else {
            statusText = `לפני ${Math.floor(hoursSince / 24)} ימים`;
          }
        }
      }
      
      items.push({
        key: `${agentKey}_status`,
        image: agent.image,
        label: `${agent.name}: ${statusText}`,
        isActive: false,
        isHealthy,
        color: isHealthy ? 'bg-gray-500' : 'bg-red-500'
      });
    });

    return items;
  };

  const StatusItem = ({ item }) => (
    <div className={`flex items-center gap-2 px-4 whitespace-nowrap ${item.isActive ? 'animate-pulse' : ''}`}>
      {item.image ? (
        <img 
          src={item.image} 
          alt="" 
          className={`w-5 h-5 rounded-full object-cover border-2 ${
            item.isActive ? 'border-yellow-400' : 
            item.isHealthy === false ? 'border-red-500' : 'border-gray-600'
          }`}
        />
      ) : (
        item.icon
      )}
      <div className={`w-2 h-2 rounded-full ${
        item.isActive ? item.color : 
        item.isHealthy === false ? 'bg-red-500' : 'bg-gray-500'
      } ${item.isActive ? 'animate-ping' : ''}`} 
           style={{ animationDuration: '1.5s' }} />
      <span className={`text-xs ${
        item.isActive ? 'text-white font-medium' : 
        item.isHealthy === false ? 'text-red-400' : 'text-gray-400'
      }`}>
        {item.label}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-8 bg-gray-800 text-white text-xs flex items-center justify-center z-50">
        <Loader2 className="w-3 h-3 animate-spin mr-2" />
        טוען סטטוס...
      </div>
    );
  }

  const statusItems = buildStatusItems();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-gray-800 text-white text-xs z-50 border-t border-gray-700 overflow-hidden">
      <div className="flex items-center h-full">
        {/* Fixed users section */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-3 border-l border-gray-700 bg-gray-800 z-10 flex-shrink-0 hover:bg-gray-700 transition-colors cursor-pointer">
              <Users className="w-3.5 h-3.5 text-green-400" />
              <span>{activeUsers} מחוברים</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end" side="top">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm mb-3">משתמשים מחוברים</h4>
              {activeUsersList.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activeUsersList.map((user, idx) => (
                    <div key={user.email} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                        {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{user.name || user.email}</div>
                        <div className="text-xs text-gray-500">
                          {Math.floor((Date.now() - user.lastActivity.getTime()) / 60000) === 0 
                            ? 'כרגע' 
                            : `לפני ${Math.floor((Date.now() - user.lastActivity.getTime()) / 60000)} דק׳`}
                        {' · '}{formatDateTimeIL(user.lastActivity)}
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">אין משתמשים מחוברים</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Manual upload controls - only show when uploading */}
        {manualUploadState?.isUploading && (
          <div className="flex items-center gap-2 px-3 border-l border-gray-700 bg-purple-900 z-10 flex-shrink-0">
            <Upload className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span className="text-purple-100 font-medium">
              {manualUploadState.currentFileName ? manualUploadState.currentFileName.substring(0, 30) : 'מעלה...'}
            </span>
            <span className="text-purple-300">
              {manualUploadState.currentFileIndex}/{manualUploadState.totalFiles}
            </span>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('stop-manual-upload'))}
              className="p-1 hover:bg-purple-800 rounded transition-colors"
              title="עצור העלאה"
            >
              <StopCircle className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        )}

        {/* Scrolling marquee */}
        <div className="flex-1 overflow-hidden relative">
          <div 
            ref={scrollRef}
            className="flex items-center h-full marquee-container"
          >
            {/* Triple duplicate for seamless continuous loop */}
            {[0, 1, 2].map((setIndex) => (
              <div key={setIndex} className="flex items-center marquee-content">
                {statusItems.map((item) => (
                  <StatusItem key={`${item.key}-${setIndex}`} item={item} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSS for seamless marquee animation */}
      <style>{`
        .marquee-container {
          display: flex;
          animation: marquee-scroll 25s linear infinite;
        }
        .marquee-content {
          display: flex;
          flex-shrink: 0;
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}