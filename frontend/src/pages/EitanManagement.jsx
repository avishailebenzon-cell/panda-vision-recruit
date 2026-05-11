import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileTabs, MobileTabsButtons, MobileTabButton, MobileTabsContent } from '@/components/ui/mobile-tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  MessageSquare,
  Search,
  RefreshCw,
  Loader2,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Award,
  BarChart3,
  Eye,
  Plus,
  PlayCircle,
  Clock,
  UserCog,
  MessageCircle,
  Download,
  Play,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import StartEitanConversationDialog from '../components/eitan/StartEitanConversationDialog';
import EitanConversationDialog from '../components/eitan/EitanConversationDialog';
import ApproveTaskDialog from '../components/eitan/ApproveTaskDialog';
import EitanChatDialog from '../components/eitan/EitanChatDialog';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const SCORE_CONFIG = {
  5: { color: 'bg-green-100 text-green-800', label: 'מצוין', icon: Award },
  4: { color: 'bg-blue-100 text-blue-800', label: 'טוב', icon: CheckCircle },
  3: { color: 'bg-yellow-100 text-yellow-800', label: 'בינוני', icon: AlertCircle },
  2: { color: 'bg-orange-100 text-orange-800', label: 'חלש', icon: AlertCircle },
  1: { color: 'bg-red-100 text-red-800', label: 'גרוע', icon: AlertCircle }
};

const STATUS_CONFIG = {
  'בתהליך': { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  'הושלם': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'ממתין למעקב': { color: 'bg-orange-100 text-orange-800', icon: AlertCircle }
};

export default function EitanManagement() {
  const [activeTab, setActiveTab] = useState("");
  const [qualityChecks, setQualityChecks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [showCheckDialog, setShowCheckDialog] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showConversationDialog, setShowConversationDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [processLog, setProcessLog] = useState([]);
  const [showChatDialog, setShowChatDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [checksData, employeesData, conversationsData, tasksData] = await Promise.all([
        base44.entities.QualityCheck.list('-created_date', 200),
        base44.entities.Employee.list('-created_date', 200),
        base44.agents.listConversations({ agent_name: 'eitan_quality' }),
        base44.entities.EitanTask.list('-created_date', 200)
      ]);
      setQualityChecks(checksData || []);
      setEmployees(employeesData || []);
      setConversations(conversationsData || []);
      setTasks(tasksData || []);
    } catch (e) {
      console.error('Error loading data:', e);
      toast.error('שגיאה בטעינת הנתונים');
    }
    setLoading(false);
  };

  const createQualityCheckTasks = async () => {
    setCreatingTasks(true);
    const toastId = toast.loading('בודק עובדים פעילים ויוצר משימות...');
    
    try {
      // Filter active employees
      const activeEmployees = employees.filter(emp => emp.status === 'פעיל');
      
      console.log(`Found ${activeEmployees.length} active employees`);
      
      if (activeEmployees.length === 0) {
        toast.error('אין עובדים פעילים במערכת', { id: toastId });
        setCreatingTasks(false);
        return;
      }

      // Check existing tasks to avoid duplicates
      const existingTasks = await base44.entities.EitanTask.list('-created_date', 500);
      const existingKeys = new Set(existingTasks.map(t => `${t.employee_id}`));

      console.log(`Found ${existingTasks.length} existing tasks`);

      // Separate employees - only check for manager name
      const employeesWithManager = [];
      const employeesWithoutManager = [];
      const skippedDuplicates = [];

      for (const emp of activeEmployees) {
        // Skip duplicates
        if (existingKeys.has(emp.id)) {
          skippedDuplicates.push(emp.full_name);
          console.log(`Skipping duplicate: ${emp.full_name}`);
          continue;
        }

        // Only require manager name
        const hasManager = emp.manager_name;
        
        console.log(`${emp.full_name}: manager=${hasManager}, phone=${emp.client_contact_phone || 'none'}, email=${emp.client_contact_email || 'none'}`);

        if (!hasManager) {
          employeesWithoutManager.push(emp.full_name);
        } else {
          employeesWithManager.push(emp);
        }
      }

      console.log(`With manager: ${employeesWithManager.length}, Without manager: ${employeesWithoutManager.length}, Duplicates: ${skippedDuplicates.length}`);

      // Get next check number for the first task
      toast.loading('מייצר מספרי מבדק...', { id: toastId });
      const checkNumberResult = await base44.functions.invoke('getNextCheckNumber', {});
      let nextCheckNumber = checkNumberResult.data?.nextNumber || 1;

      // Create tasks for all employees with manager (even without contact details)
      const tasksToCreate = employeesWithManager.map(emp => {
        const checkNumber = `TST-${String(nextCheckNumber).padStart(5, '0')}`;
        nextCheckNumber++;
        
        return {
          check_number: checkNumber,
          employee_id: emp.id,
          employee_name: emp.full_name,
          manager_name: emp.manager_name,
          manager_phone: emp.manager_phone || '',
          client_id: emp.client_id || '',
          client_name: emp.client_name || '',
          client_contact_name: emp.manager_name,
          client_contact_phone: emp.client_contact_phone || '',
          client_contact_email: emp.client_contact_email || '',
          status: 'לא החל',
          priority: 'בינונית'
        };
      });

      if (tasksToCreate.length === 0) {
        const msg = skippedDuplicates.length > 0 
          ? `כל ${activeEmployees.length} העובדים הפעילים כבר קיימים במשימות`
          : employeesWithoutManager.length > 0
            ? `לא נוצרו משימות - כל ${employeesWithoutManager.length} העובדים חסרים מנהל ישיר`
            : 'לא נמצאו עובדים מתאימים';
        toast.info(msg, { id: toastId });
        setCreatingTasks(false);
        return;
      }

      toast.loading(`יוצר ${tasksToCreate.length} משימות...`, { id: toastId });
      await base44.entities.EitanTask.bulkCreate(tasksToCreate);
      
      // Build detailed summary
      const parts = [];
      parts.push(`✅ נוצרו ${tasksToCreate.length} משימות חדשות`);
      
      if (skippedDuplicates.length > 0) {
        parts.push(`⏭️ ${skippedDuplicates.length} עובדים כבר קיימים במשימות`);
      }
      
      if (employeesWithoutManager.length > 0) {
        parts.push(`⚠️ ${employeesWithoutManager.length} עובדים לא נוצרו - חסר מנהל ישיר`);
      }
      
      toast.success(parts.join('\n'), { 
        id: toastId,
        duration: 6000
      });
      
      await loadData();
    } catch (e) {
      console.error('Error creating tasks:', e);
      toast.error(`שגיאה ביצירת משימות: ${e.message}`, { id: toastId });
    }
    setCreatingTasks(false);
  };

  const handleApproveTask = (task) => {
    setSelectedTask(task);
    setShowApproveDialog(true);
  };

  const runAllChecksAutomatically = async () => {
    setRunningAll(true);
    setProcessLog([]);
    
    try {
      toast.info('מתחיל הפעלה אוטומטית של כל המבדקים...');
      
      const result = await base44.functions.invoke('runAllEitanChecks', {});
      
      if (result.data?.success) {
        const { tasksScheduled, errors, scheduled } = result.data;
        
        // Build log entries
        const logEntries = [];
        
        scheduled.forEach(s => {
          logEntries.push({
            type: 'success',
            message: `✅ ${s.check_number} (${s.employee_name}) - תוזמן לעוד ${s.delay_minutes} דקות`
          });
        });
        
        errors.forEach(e => {
          logEntries.push({
            type: 'error',
            message: `❌ ${e.check_number} (${e.employee_name}) - ${e.error}`
          });
        });
        
        setProcessLog(logEntries);
        
        toast.success(`הפעלה אוטומטית הושלמה: ${tasksScheduled} משימות תוזמנו, ${errors.length} שגיאות`, {
          duration: 5000
        });
        
        await loadData();
      } else {
        toast.error(result.data?.error || 'שגיאה בהפעלה אוטומטית');
      }
    } catch (e) {
      console.error('Error running all checks:', e);
      toast.error(`שגיאה בהפעלה אוטומטית: ${e.message}`);
    }
    
    setRunningAll(false);
  };

  const handleStartConversation = (task) => {
    setSelectedTask(task);
    setShowStartDialog(true);
  };

  const handleViewConversation = (task) => {
    setSelectedTask(task);
    setShowConversationDialog(true);
  };

  const filteredChecks = qualityChecks.filter(check => {
    const matchesSearch = !searchTerm || 
      check.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      check.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      check.check_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesScore = scoreFilter === 'all' || check.score?.toString() === scoreFilter;
    const matchesStatus = statusFilter === 'all' || check.status === statusFilter;
    return matchesSearch && matchesScore && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    total: qualityChecks.length,
    completed: qualityChecks.filter(c => c.status === 'הושלם').length,
    avgScore: qualityChecks.length > 0 
      ? (qualityChecks.filter(c => c.score).reduce((sum, c) => sum + c.score, 0) / qualityChecks.filter(c => c.score).length).toFixed(1)
      : 'N/A',
    excellent: qualityChecks.filter(c => c.score === 5).length,
    needsFollowup: qualityChecks.filter(c => c.follow_up_required).length
  };

  // Employee performance summary
  const employeeStats = {};
  qualityChecks.forEach(check => {
    if (!check.employee_name || !check.score) return;
    if (!employeeStats[check.employee_name]) {
      employeeStats[check.employee_name] = {
        count: 0,
        totalScore: 0,
        scores: []
      };
    }
    employeeStats[check.employee_name].count++;
    employeeStats[check.employee_name].totalScore += check.score;
    employeeStats[check.employee_name].scores.push(check.score);
  });

  const topEmployees = Object.entries(employeeStats)
    .map(([name, stats]) => ({
      name,
      avgScore: (stats.totalScore / stats.count).toFixed(1),
      count: stats.count
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10);

  if (loading) {
    return <LoadingSpinner message="טוען דף איתן..." />;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img 
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" 
          alt="איתן" 
          className="w-16 h-16 rounded-full object-cover border-4 border-purple-200 shadow-lg"
        />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">איתן - בדיקות איכות שירות</h1>
          <p className="text-gray-600">מנהל מבדקי איכות שירות מול לקוחות</p>
        </div>
        <div className="flex gap-2 mr-auto">
          <Button 
            variant="outline" 
            onClick={() => setShowChatDialog(true)}
            className="border-purple-500 text-purple-700 hover:bg-purple-50 gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            דבר עם איתן
          </Button>
          <Button variant="outline" className="gap-2" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-purple-700">{stats.total}</div>
            <div className="text-sm text-purple-600">סה"כ מבדקים</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{stats.completed}</div>
            <div className="text-sm text-green-600">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{stats.avgScore}</div>
            <div className="text-sm text-blue-600">ממוצע ציונים</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-yellow-700">{stats.excellent}</div>
            <div className="text-sm text-yellow-600">ציון 5</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-orange-700">{stats.needsFollowup}</div>
            <div className="text-sm text-orange-600">נדרש מעקב</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <MobileTabs value={activeTab} onValueChange={setActiveTab}>
        <MobileTabsButtons>
          <MobileTabButton value="tasks" icon={CheckCircle} label={`משימות בדיקה (${tasks.length})`} color="purple" />
          <MobileTabButton value="employees" icon={Users} label={`רשימת עובדים (${employees.length})`} color="blue" />
          <MobileTabButton value="checks" icon={BarChart3} label={`מבדקי איכות (${qualityChecks.length})`} color="green" />
          <MobileTabButton value="conversations" icon={MessageSquare} label={`שיחות (${conversations.length})`} color="indigo" />
          <MobileTabButton value="performance" icon={TrendingUp} label="ביצועי עובדים" color="teal" />
        </MobileTabsButtons>

        {/* Tasks Tab */}
        <MobileTabsContent tabValue="tasks">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="חיפוש עובד או לקוח..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9"
                  />
                </div>
                <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="לא החל">לא החל</SelectItem>
                    <SelectItem value="מאושר לשיחה">מאושר לשיחה</SelectItem>
                    <SelectItem value="בתהליך">בתהליך</SelectItem>
                    <SelectItem value="הושלם">הושלם</SelectItem>
                    <SelectItem value="הועבר לסוכן אנושי">הועבר לסוכן אנושי</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={createQualityCheckTasks}
                  disabled={creatingTasks}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  {creatingTasks ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  יצירת מבדק אוטומטי
                </Button>
                <Button 
                  onClick={runAllChecksAutomatically}
                  disabled={runningAll}
                  className="bg-purple-600 hover:bg-purple-700 gap-2"
                >
                  {runningAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  הפעלה אוטומטית של כל המבדקים
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Process Log */}
              {processLog.length > 0 && (
                <div className="mb-4 border rounded-lg p-4 bg-gray-50 max-h-48 overflow-y-auto">
                  <div className="text-sm font-medium text-gray-700 mb-2">לוג תהליך הפעלה אוטומטית:</div>
                  <div className="space-y-1 text-xs font-mono">
                    {processLog.map((log, idx) => (
                      <div 
                        key={idx} 
                        className={log.type === 'error' ? 'text-red-600' : 'text-green-600'}
                      >
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-28">מספר מבדק</TableHead>
                      <TableHead>עובד</TableHead>
                      <TableHead>לקוח</TableHead>
                      <TableHead>איש קשר</TableHead>
                      <TableHead className="w-20 text-center">ציון</TableHead>
                      <TableHead>עדיפות</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead className="w-32">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.filter(task => {
                      const matchesSearch = !searchTerm || 
                        task.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        task.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        task.client_contact_name?.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesStatus = taskStatusFilter === 'all' || task.status === taskStatusFilter;
                      return matchesSearch && matchesStatus;
                    }).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין משימות להצגה
                        </TableCell>
                      </TableRow>
                    ) : (
                      tasks.filter(task => {
                        const matchesSearch = !searchTerm || 
                          task.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.client_contact_name?.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesStatus = taskStatusFilter === 'all' || task.status === taskStatusFilter;
                        return matchesSearch && matchesStatus;
                      }).map((task) => (
                        <TableRow key={task.id} className="hover:bg-gray-50">
                          <TableCell className="font-mono text-xs text-gray-600">{task.check_number || '-'}</TableCell>
                          <TableCell className="font-medium">{task.employee_name}</TableCell>
                          <TableCell>{task.client_name}</TableCell>
                          <TableCell className="text-sm">{task.client_contact_name}</TableCell>
                          <TableCell className="text-center">
                            {task.quality_score ? (
                              <Badge className={
                                task.quality_score >= 9 ? 'bg-green-100 text-green-800' :
                                task.quality_score >= 7 ? 'bg-blue-100 text-blue-800' :
                                task.quality_score >= 5 ? 'bg-yellow-100 text-yellow-800' :
                                task.quality_score >= 3 ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {task.quality_score}/10
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              task.priority === 'גבוהה' ? 'bg-red-100 text-red-800' :
                              task.priority === 'נמוכה' ? 'bg-gray-100 text-gray-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              task.status === 'הושלם' ? 'bg-green-100 text-green-800' :
                              task.status === 'בתהליך' ? 'bg-blue-100 text-blue-800' :
                              task.status === 'מאושר לשיחה' ? 'bg-purple-100 text-purple-800' :
                              task.status === 'הועבר לסוכן אנושי' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {task.status === 'לא החל' && <Clock className="w-3 h-3 ml-1" />}
                              {task.status === 'מאושר לשיחה' && <PlayCircle className="w-3 h-3 ml-1" />}
                              {task.status === 'בתהליך' && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
                              {task.status === 'הושלם' && <CheckCircle className="w-3 h-3 ml-1" />}
                              {task.status === 'הועבר לסוכן אנושי' && <UserCog className="w-3 h-3 ml-1" />}
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {task.status === 'לא החל' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveTask(task)}
                                  className="gap-1 text-xs"
                                >
                                  <PlayCircle className="w-3 h-3" />
                                  אשר
                                </Button>
                              )}
                              {task.status === 'מאושר לשיחה' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleStartConversation(task)}
                                  className="bg-blue-600 hover:bg-blue-700 gap-1 text-xs"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  התחל
                                </Button>
                              )}
                              {(task.status === 'בתהליך' || task.status === 'הועבר לסוכן אנושי') && task.agent_conversation_id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewConversation(task)}
                                  className="gap-1 text-xs"
                                >
                                  <Eye className="w-3 h-3" />
                                  צפה
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </MobileTabsContent>

        {/* Employees Tab */}
        <MobileTabsContent tabValue="employees">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="חיפוש עובד, מנהל או לקוח..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9"
                  />
                </div>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      toast.info('מתחיל סנכרון מ-Pipedrive...');
                      const result = await base44.functions.invoke('syncPipedriveEmployees', {});
                      if (result.data?.success) {
                        toast.success(`סנכרון הושלם בהצלחה! ${result.data.employeesCreated} נוצרו, ${result.data.employeesUpdated} עודכנו, ${result.data.contactDetailsUpdated} עודכנו עם פרטי קשר`);
                        await loadData();
                      } else {
                        toast.error('שגיאה בסנכרון');
                      }
                    } catch (e) {
                      console.error('Sync error:', e);
                      toast.error(`שגיאה בסנכרון: ${e.message}`);
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {syncing ? 'מסנכרן...' : 'סנכרון מ-Pipedrive'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>שם עובד</TableHead>
                      <TableHead>מנהל ישיר</TableHead>
                      <TableHead>ארגון המנהל</TableHead>
                      <TableHead>טלפון לקוח</TableHead>
                      <TableHead>מייל לקוח</TableHead>
                      <TableHead className="w-24">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.filter(emp => {
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      return emp.full_name?.toLowerCase().includes(term) ||
                             emp.manager_name?.toLowerCase().includes(term) ||
                             emp.client_name?.toLowerCase().includes(term) ||
                             emp.client_contact_name?.toLowerCase().includes(term);
                    }).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין עובדים להצגה
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.filter(emp => {
                        if (!searchTerm) return true;
                        const term = searchTerm.toLowerCase();
                        return emp.full_name?.toLowerCase().includes(term) ||
                               emp.manager_name?.toLowerCase().includes(term) ||
                               emp.client_name?.toLowerCase().includes(term) ||
                               emp.client_contact_name?.toLowerCase().includes(term);
                      }).map((emp) => (
                        <TableRow key={emp.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{emp.full_name}</TableCell>
                          <TableCell className="text-sm">{emp.manager_name || '-'}</TableCell>
                          <TableCell className="text-xs text-gray-600">{emp.manager_organization || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {emp.client_contact_phone || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {emp.client_contact_email || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={emp.status === 'פעיל' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {emp.status || 'פעיל'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </MobileTabsContent>

        {/* Quality Checks Tab */}
        <MobileTabsContent tabValue="checks">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="חיפוש לפי עובד, לקוח או מספר מבדק..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9"
                  />
                </div>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="ציון" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הציונים</SelectItem>
                    <SelectItem value="5">5 - מצוין</SelectItem>
                    <SelectItem value="4">4 - טוב</SelectItem>
                    <SelectItem value="3">3 - בינוני</SelectItem>
                    <SelectItem value="2">2 - חלש</SelectItem>
                    <SelectItem value="1">1 - גרוע</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="בתהליך">בתהליך</SelectItem>
                    <SelectItem value="הושלם">הושלם</SelectItem>
                    <SelectItem value="ממתין למעקב">ממתין למעקב</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-28">מספר מבדק</TableHead>
                      <TableHead>עובד</TableHead>
                      <TableHead>לקוח</TableHead>
                      <TableHead>מנהל</TableHead>
                      <TableHead className="w-24 text-center">ציון</TableHead>
                      <TableHead className="w-28">סטטוס</TableHead>
                      <TableHead className="w-32">תאריך</TableHead>
                      <TableHead className="w-20">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChecks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין מבדקים להצגה
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredChecks.map((check) => {
                        const ScoreIcon = check.score ? SCORE_CONFIG[check.score].icon : Star;
                        const StatusIcon = STATUS_CONFIG[check.status]?.icon || AlertCircle;
                        return (
                          <TableRow key={check.id} className="hover:bg-gray-50">
                            <TableCell className="font-mono text-sm">{check.check_number || '-'}</TableCell>
                            <TableCell className="font-medium">{check.employee_name}</TableCell>
                            <TableCell>{check.client_name}</TableCell>
                            <TableCell className="text-sm text-gray-600">{check.manager_name || '-'}</TableCell>
                            <TableCell className="text-center">
                              {check.score ? (
                                <Badge className={SCORE_CONFIG[check.score].color}>
                                  <ScoreIcon className="w-3 h-3 ml-1" />
                                  {check.score}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_CONFIG[check.status]?.color || 'bg-gray-100'}>
                                <StatusIcon className="w-3 h-3 ml-1" />
                                {check.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {new Date(check.evaluation_date || check.created_date).toLocaleDateString('he-IL')}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { 
                                  setSelectedCheck(check); 
                                  setShowCheckDialog(true); 
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
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
        </MobileTabsContent>

        {/* Conversations Tab */}
        <MobileTabsContent tabValue="conversations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                שיחות איתן ({conversations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>אין שיחות פעילות</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <div 
                      key={conv.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => window.open(`https://dashboard.base44.com/conversations/${conv.id}`, '_blank')}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{conv.metadata?.name || 'שיחה ללא שם'}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(conv.created_date).toLocaleDateString('he-IL')}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {conv.messages?.length || 0} הודעות
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </MobileTabsContent>

        {/* Employee Performance Tab */}
        <MobileTabsContent tabValue="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                דירוג עובדים ({topEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>שם עובד</TableHead>
                      <TableHead className="text-center">ממוצע ציון</TableHead>
                      <TableHead className="text-center">מספר מבדקים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין נתוני ביצועים
                        </TableCell>
                      </TableRow>
                    ) : (
                      topEmployees.map((emp, idx) => (
                        <TableRow key={emp.name} className="hover:bg-gray-50">
                          <TableCell className="text-center font-bold text-gray-400">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              className={
                                emp.avgScore >= 4.5 ? 'bg-green-100 text-green-800' :
                                emp.avgScore >= 3.5 ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }
                            >
                              <Star className="w-3 h-3 ml-1" />
                              {emp.avgScore}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm text-gray-600">
                            {emp.count}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </MobileTabsContent>
      </MobileTabs>

      {/* Check Detail Dialog */}
      <Dialog open={showCheckDialog} onOpenChange={setShowCheckDialog}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              מבדק איכות {selectedCheck?.check_number}
            </DialogTitle>
          </DialogHeader>
          {selectedCheck && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">עובד</div>
                  <div className="font-medium">{selectedCheck.employee_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">מנהל</div>
                  <div>{selectedCheck.manager_name || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">לקוח</div>
                  <div className="font-medium">{selectedCheck.client_name}</div>
                </div>
                {selectedCheck.client_contact_name && (
                  <div>
                    <div className="text-sm text-gray-500">איש קשר</div>
                    <div>{selectedCheck.client_contact_name}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-500">תאריך המבדק</div>
                  <div>{new Date(selectedCheck.evaluation_date || selectedCheck.created_date).toLocaleDateString('he-IL')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">סטטוס</div>
                  <Badge className={STATUS_CONFIG[selectedCheck.status]?.color || 'bg-gray-100'}>
                    {selectedCheck.status}
                  </Badge>
                </div>
              </div>

              {selectedCheck.score && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-sm text-purple-700 mb-2">ציון איכות שירות</div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${SCORE_CONFIG[selectedCheck.score].color} text-lg px-4 py-2`}>
                      <Star className="w-4 h-4 ml-2" />
                      {selectedCheck.score} / 5 - {SCORE_CONFIG[selectedCheck.score].label}
                    </Badge>
                  </div>
                </div>
              )}

              {selectedCheck.details && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">פירוט המשוב</div>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap border">
                    {selectedCheck.details}
                  </div>
                </div>
              )}

              {selectedCheck.follow_up_required && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-orange-700 mb-2">נדרש מעקב</div>
                  {selectedCheck.follow_up_notes && (
                    <div className="text-sm text-gray-700">{selectedCheck.follow_up_notes}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Task Dialog */}
      <ApproveTaskDialog
        isOpen={showApproveDialog}
        onClose={() => {
          setShowApproveDialog(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSuccess={loadData}
      />

      {/* Start Conversation Dialog */}
      <StartEitanConversationDialog
        isOpen={showStartDialog}
        onClose={() => {
          setShowStartDialog(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSuccess={loadData}
      />

      {/* View Conversation Dialog */}
      <EitanConversationDialog
        isOpen={showConversationDialog}
        onClose={() => {
          setShowConversationDialog(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSuccess={loadData}
      />

      {/* Eitan Chat Dialog */}
      <EitanChatDialog 
        isOpen={showChatDialog}
        onClose={() => setShowChatDialog(false)}
      />
      </div>
      );
      }