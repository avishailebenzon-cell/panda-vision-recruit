import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ShieldCheck, User as UserIcon, Monitor, LogIn, Search, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

const eventTypeLabels = {
  login_success: { label: 'כניסה למערכת', icon: LogIn, color: 'bg-green-100 text-green-800' },
  page_visit: { label: 'כניסה למסך', icon: Monitor, color: 'bg-blue-100 text-blue-800' },
  agent_started: { label: 'הפעלת סוכן', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-800' },
  agent_stopped: { label: 'הפסקת סוכן', icon: ShieldCheck, color: 'bg-orange-100 text-orange-800' }
};

const pageNameLabels = {
  Dashboard: 'דאשבורד',
  Jobs: 'משרות',
  Candidates: 'מועמדים',
  CandidatesMap: 'מפת מועמדים',
  Search: 'חיפוש',
  Clients: 'לקוחות',
  Management: 'ניהול',
  AccessLog: 'לוג גישה',
  Home: 'דף הבית',
  FeedbackReport: 'דיווח תקלות'
};

export default function AccessLogPage() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [cleanupMessage, setCleanupMessage] = useState('');

  const loadLogs = useCallback(async () => {
    try {
        const logData = await base44.entities.AccessLog.list('-created_date');
        setLogs(logData);
        setFilteredLogs(logData);
    } catch (error) {
        console.error("Error loading logs:", error);
    }
  }, []);

  const runLogCleanup = useCallback(async () => {
    try {
        const currentUser = await base44.auth.me();
        if (currentUser.role !== 'admin') {
            return;
        }

        const lastCheck = localStorage.getItem('log_cleanup_last_check');
        const oneDayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);
        if (lastCheck && new Date(parseInt(lastCheck)).getTime() > oneDayAgo) {
            return;
        }
        localStorage.setItem('log_cleanup_last_check', new Date().getTime().toString());

        const oldestLogArr = await base44.entities.AccessLog.list('created_date', 1); 
        if (!oldestLogArr || oldestLogArr.length === 0) {
            return;
        }
        const oldestLogDate = new Date(oldestLogArr[0].created_date);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (oldestLogDate > oneYearAgo) {
            return;
        }
        
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const logsToDelete = await base44.entities.AccessLog.filter({ created_date: { '$lt': threeMonthsAgo.toISOString() } });

        if (logsToDelete.length > 0) {
            setCleanupMessage(`מנקה ${logsToDelete.length} רשומות לוג ישנות יותר מ-3 חודשים...`);
            
            for (const log of logsToDelete) {
                await base44.entities.AccessLog.delete(log.id);
            }

            setCleanupMessage(`הושלם! נמחקו ${logsToDelete.length} רשומות לוג ישנות.`);
            setTimeout(() => setCleanupMessage(''), 5000);
            
            await loadLogs();
        }

    } catch (error) {
        console.error("Error during log cleanup:", error);
        setCleanupMessage('שגיאה בתהליך ניקוי הלוגים האוטומטי.');
        setTimeout(() => setCleanupMessage(''), 5000);
    }
  }, [loadLogs]);

  useEffect(() => {
    const checkUserAndLoadLogs = async () => {
      setLoading(true);
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (currentUser.role !== 'admin') {
          setLoading(false);
          return;
        }
        await loadLogs();
        await runLogCleanup();
      } catch (error) {
        console.error("Error loading data:", error);
      }
      setLoading(false);
    };
    checkUserAndLoadLogs();
  }, [loadLogs, runLogCleanup]);

  useEffect(() => {
    let filtered = [...logs];

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.event_type === eventTypeFilter);
    }

    if (userFilter.trim()) {
      filtered = filtered.filter(log => 
        log.user_name?.toLowerCase().includes(userFilter.toLowerCase()) ||
        log.user_email?.toLowerCase().includes(userFilter.toLowerCase())
      );
    }

    if (pageFilter.trim()) {
      filtered = filtered.filter(log => 
        log.page_name?.toLowerCase().includes(pageFilter.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, eventTypeFilter, userFilter, pageFilter]);

  if (loading) {
    return <div className="h-full w-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }
  
  if (!user || user.role !== 'admin') {
    return <Navigate to={createPageUrl("Dashboard")} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <div>
              <CardTitle className="text-2xl">לוג פעילות המערכת</CardTitle>
              <p className="text-gray-600">תיעוד כל הכניסות למערכת ומעבר בין מסכים</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cleanupMessage && (
            <Alert className="mb-4 bg-blue-50 border-blue-200">
                <Trash2 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">{cleanupMessage}</AlertDescription>
            </Alert>
          )}
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">סוג אירוע</label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל האירועים</SelectItem>
                  <SelectItem value="login_success">כניסות למערכת</SelectItem>
                  <SelectItem value="page_visit">כניסות למסכים</SelectItem>
                  <SelectItem value="agent_started">הפעלת סוכנים</SelectItem>
                  <SelectItem value="agent_stopped">הפסקת סוכנים</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">חיפוש משתמש</label>
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="שם או אימייל..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="pr-10 w-48"
                />
              </div>
            </div>

            {eventTypeFilter === 'page_visit' && (
              <div>
                <label className="block text-sm font-medium mb-1">חיפוש מסך</label>
                <Input
                  placeholder="שם מסך..."
                  value={pageFilter}
                  onChange={(e) => setPageFilter(e.target.value)}
                  className="w-48"
                />
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="mb-4 text-sm text-gray-600">
            מציג {filteredLogs.length} מתוך {logs.length} רשומות
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך ושעה</TableHead>
                  <TableHead>משתמש</TableHead>
                  <TableHead>תפקיד</TableHead>
                  <TableHead>סוג אירוע</TableHead>
                  <TableHead>מסך</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map(log => {
                    const eventInfo = eventTypeLabels[log.event_type] || {};
                    const EventIcon = eventInfo.icon || Monitor;
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.created_date).toLocaleString('he-IL')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-500" />
                            <div>
                              <div className="font-medium text-sm">{log.user_name}</div>
                              <div className="text-xs text-gray-500">{log.user_email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.app_role === 'admin' ? 'destructive' : 'secondary'} className="text-xs">
                            {log.app_role || log.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${eventInfo.color} text-xs`}>
                            <EventIcon className="w-3 h-3 ml-1" />
                            {eventInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.event_type === 'page_visit' ? (
                            <div>
                              <div className="font-medium">
                                {pageNameLabels[log.page_name] || log.page_name}
                              </div>
                              <div className="text-xs text-gray-500">{log.page_url}</div>
                            </div>
                          ) : (log.event_type === 'agent_started' || log.event_type === 'agent_stopped') ? (
                            <div>
                              <div className="font-medium">
                                {log.page_name}
                              </div>
                              {log.page_url && (
                                <div className="text-xs text-gray-500">{log.page_url}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan="5" className="text-center py-8">
                      לא נמצאו רשומות לוג מתאימות למסננים הנבחרים.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}