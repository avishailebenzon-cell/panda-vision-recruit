import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  RefreshCw,
  Loader2,
  Search,
  Bot,
  User,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Users,
  Briefcase,
  Building,
  UserCheck,
  Send,
  FileText,
  Database,
  MessageSquare
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const AGENT_CONFIG = {
  naama: {
    name: 'נעמה',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
    color: 'bg-orange-100 text-orange-800'
  },
  roee: {
    name: 'רועי',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
    color: 'bg-blue-100 text-blue-800'
  },
  raviv: {
    name: 'רביב',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
    color: 'bg-gray-100 text-gray-800'
  },
  hila: {
    name: 'הילה',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face',
    color: 'bg-pink-100 text-pink-800'
  },
  carmit: {
    name: 'כרמית',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face',
    color: 'bg-purple-100 text-purple-800'
  },
  elad: {
    name: 'אלעד',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    color: 'bg-blue-100 text-blue-800'
  },
  noa: {
    name: 'נועה',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=40&h=40&fit=crop&crop=face',
    color: 'bg-green-100 text-green-800'
  }
};

const ACTION_ICONS = {
  email_scan: Mail,
  candidate_created: Users,
  candidate_updated: Users,
  job_created: Briefcase,
  job_updated: Briefcase,
  match_created: UserCheck,
  match_updated: UserCheck,
  client_created: Building,
  client_updated: Building,
  pipedrive_sync: Database,
  draft_created: FileText,
  draft_approved: CheckCircle,
  draft_rejected: XCircle,
  email_sent: Send,
  whatsapp_sent: MessageSquare,
  system_check: Settings,
  data_cleanup: Database,
  schedule_run: Clock,
  other: Activity
};

const ACTION_LABELS = {
  email_scan: 'סריקת מיילים',
  candidate_created: 'יצירת מועמד',
  candidate_updated: 'עדכון מועמד',
  job_created: 'יצירת משרה',
  job_updated: 'עדכון משרה',
  match_created: 'יצירת התאמה',
  match_updated: 'עדכון התאמה',
  client_created: 'יצירת לקוח',
  client_updated: 'עדכון לקוח',
  pipedrive_sync: 'סנכרון Pipedrive',
  draft_created: 'יצירת טיוטה',
  draft_approved: 'אישור טיוטה',
  draft_rejected: 'דחיית טיוטה',
  email_sent: 'שליחת מייל',
  whatsapp_sent: 'שליחת וואטסאפ',
  system_check: 'בדיקת מערכת',
  data_cleanup: 'ניקוי נתונים',
  schedule_run: 'ריצה מתוזמנת',
  other: 'פעולה אחרת'
};

const STATUS_CONFIG = {
  success: { label: 'הצלחה', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  failed: { label: 'נכשל', icon: XCircle, color: 'bg-red-100 text-red-800' },
  in_progress: { label: 'בביצוע', icon: Clock, color: 'bg-blue-100 text-blue-800' }
};

export default function SystemActivityLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    loadLogs();
    
    // Auto-refresh every 5 seconds for real-time updates
    const interval = setInterval(() => {
      loadLogsQuiet();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadLogsQuiet = async () => {
    try {
      const allLogs = await base44.entities.SystemActivityLog.list('-created_date', 200);
      setLogs(allLogs);
    } catch (e) {
      console.error('Error loading activity logs:', e);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await base44.entities.SystemActivityLog.list('-created_date', 200);
      setLogs(allLogs);
    } catch (e) {
      console.error('Error loading activity logs:', e);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.action_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesActor = actorFilter === 'all' || log.actor_type === actorFilter;
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;

    return matchesSearch && matchesActor && matchesAction;
  });

  const getActorDisplay = (log) => {
    const agentKey = log.actor_name?.toLowerCase();
    const agentConfig = AGENT_CONFIG[agentKey];

    if (log.actor_type === 'agent' && agentConfig) {
      return (
        <div className="flex items-center gap-2">
          <img 
            src={agentConfig.image} 
            alt={agentConfig.name}
            className="w-8 h-8 rounded-full object-cover border-2 border-white shadow"
          />
          <div>
            <div className="font-medium text-sm">{agentConfig.name}</div>
            <Badge variant="outline" className={`text-xs ${agentConfig.color}`}>
              <Bot className="w-3 h-3 mr-1" />
              סוכן AI
            </Badge>
          </div>
        </div>
      );
    }

    if (log.actor_type === 'system') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <Settings className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <div className="font-medium text-sm">מערכת</div>
            <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700">
              <Settings className="w-3 h-3 mr-1" />
              אוטומטי
            </Badge>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <div className="font-medium text-sm">{log.actor_name || 'משתמש'}</div>
          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
            <User className="w-3 h-3 mr-1" />
            משתמש
          </Badge>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              לוג פעולות מערכת
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                עדכון בזמן אמת
              </div>
              <Button variant="outline" size="sm" onClick={loadLogs}>
                <RefreshCw className="w-4 h-4 ml-2" />
                רענן
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש בפעולות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={actorFilter} onValueChange={setActorFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="סוג מבצע" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המבצעים</SelectItem>
                <SelectItem value="agent">סוכנים</SelectItem>
                <SelectItem value="system">מערכת</SelectItem>
                <SelectItem value="user">משתמשים</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="סוג פעולה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הפעולות</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{logs.length}</div>
              <div className="text-xs text-blue-600">סה"כ פעולות</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-700">
                {logs.filter(l => l.actor_type === 'agent').length}
              </div>
              <div className="text-xs text-purple-600">פעולות סוכנים</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-700">
                {logs.filter(l => l.actor_type === 'system').length}
              </div>
              <div className="text-xs text-gray-600">פעולות מערכת</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">
                {logs.filter(l => l.status === 'success').length}
              </div>
              <div className="text-xs text-green-600">הצלחות</div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-48">מבצע</TableHead>
                  <TableHead className="w-36">סוג פעולה</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead className="w-32">ישות</TableHead>
                  <TableHead className="w-24">סטטוס</TableHead>
                  <TableHead className="w-40">זמן</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      אין פעולות להצגה
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => {
                    const ActionIcon = ACTION_ICONS[log.action_type] || Activity;
                    const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.success;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={log.id} className="hover:bg-gray-50">
                        <TableCell>{getActorDisplay(log)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ActionIcon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">{ACTION_LABELS[log.action_type] || log.action_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.action_description}</div>
                          {log.error_message && (
                            <div className="text-xs text-red-600 mt-1">{log.error_message}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.entity_name ? (
                            <div className="text-sm">
                              <div className="font-medium">{log.entity_name}</div>
                              <div className="text-xs text-gray-500">{log.entity_type}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(log.created_date).toLocaleString('he-IL', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}