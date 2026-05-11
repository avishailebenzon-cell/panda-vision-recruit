import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Search, 
  RefreshCw, 
  Loader2, 
  Send, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Briefcase,
  User as UserIcon,
  Plus,
  Mail,
  Inbox,
  SendHorizontal,
  MessageCircle,
  Building
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlurredText from "@/components/ui/BlurredText";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { MobileTabs, MobileTabsButtons, MobileTabButton, MobileTabsContent } from "@/components/ui/mobile-tabs";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import DirectOutreachTabElad from "@/components/elad/DirectOutreachTab";
import CandidateCommunicationHistory from "@/components/candidates/CandidateCommunicationHistory";
import ClientCommunicationHistory from "@/components/clients/ClientCommunicationHistory";

export default function EladPage() {
  const [activeTab, setActiveTab] = useState("");
  const [tasks, setTasks] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [approving, setApproving] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, task: null });
  
  // Form state for adding manual task
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [manualEmail, setManualEmail] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("בינונית");
  const [matchSearchOpen, setMatchSearchOpen] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [candidateCommunicationDialog, setCandidateCommunicationDialog] = useState({ isOpen: false, task: null });
  const [clientCommunicationDialog, setClientCommunicationDialog] = useState({ isOpen: false, task: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksList, matchesList] = await Promise.all([
        base44.entities.EladTask.list('-created_date', 1000),
        base44.entities.Match.filter({ ready_to_send_to_client: true })
      ]);
      setTasks(tasksList);
      setMatches(matchesList);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("שגיאה בטעינת הנתונים");
    }
    setLoading(false);
  };

  const handleAddTask = async () => {
    if (!selectedMatch || !manualEmail) {
      toast.error("יש לבחור התאמה ולהזין מייל לשליחה");
      return;
    }

    setAdding(true);
    try {
      // Get candidate and job details from match
      const [candidate, job] = await Promise.all([
        base44.entities.Candidate.get(selectedMatch.candidate_id),
        base44.entities.Job.get(selectedMatch.job_id)
      ]);

      if (!candidate || !job) {
        toast.error("לא נמצאו פרטי מועמד או משרה");
        setAdding(false);
        return;
      }

      // Get next task number
      const nextNumber = await base44.functions.invoke('getNextTaskNumber', {});
      const taskNumber = `ET-${String(nextNumber.data.nextNumber).padStart(5, '0')}`;
      
      // Get Rotem conversation summary if exists
      let rotemSummary = null;
      try {
        const rotemTask = await base44.entities.RotemTask.filter({ 
          candidate_id: selectedMatch.candidate_id,
          job_id: selectedMatch.job_id,
          form_status: 'מולא'
        });
        if (rotemTask.length > 0 && rotemTask[0].conversation_summary) {
          rotemSummary = rotemTask[0].conversation_summary;
        }
      } catch (err) {
        console.log("Could not fetch Rotem summary:", err);
      }
      
      await base44.entities.EladTask.create({
        task_number: taskNumber,
        job_id: selectedMatch.job_id,
        job_title: selectedMatch.job_title,
        client_id: job.client_id,
        client_company_name: job.client_name,
        client_email: manualEmail.trim(),
        candidate_id: selectedMatch.candidate_id,
        candidate_full_name: selectedMatch.candidate_name,
        candidate_cv_file_url: candidate.resume_file_url,
        match_id: selectedMatch.id,
        rotem_conversation_summary: rotemSummary,
        status: "לא החל",
        priority: selectedPriority,
        deadline: job.deadline || null,
        notes: `נוצרה ידנית - מייל בדיקה: ${manualEmail.trim()}`
      });
      
      setSelectedMatch(null);
      setManualEmail("");
      setSelectedPriority("בינונית");
      setMatchSearch("");
      loadData();
      toast.success("המשימה נוספה בהצלחה");
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("שגיאה בהוספת המשימה");
    }
    setAdding(false);
  };

  const handleApproveTask = async (task) => {
    setApproving(task.id);
    try {
      await base44.entities.EladTask.update(task.id, {
        status: 'מאושר לשליחה',
        approved_at: new Date().toISOString()
      });
      
      toast.success(`המשימה אושרה לשליחה - אלעד ישלח תוך 60 שניות`);
      loadData();
    } catch (error) {
      console.error("Error approving task:", error);
      toast.error("שגיאה באישור המשימה");
    }
    setApproving(null);
    setConfirmDialog({ isOpen: false, task: null });
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await base44.entities.EladTask.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success("הסטטוס עודכן");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("שגיאה בעדכון הסטטוס");
    }
  };

  const handlePriorityChange = async (taskId, newPriority) => {
    try {
      await base44.entities.EladTask.update(taskId, { priority: newPriority });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
      toast.success("עדיפות עודכנה");
    } catch (error) {
      console.error("Error updating priority:", error);
      toast.error("שגיאה בעדכון העדיפות");
    }
  };

  const filteredMatches = useMemo(() => {
    if (!matchSearch) return matches.slice(0, 20);
    const search = matchSearch.toLowerCase();
    return matches.filter(m => 
      m.candidate_name?.toLowerCase().includes(search) ||
      m.job_title?.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [matches, matchSearch]);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm ||
      task.candidate_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.client_company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || task.status === filterStatus;
    const matchesPriority = filterPriority === "all" || task.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort by priority and deadline
  // Split tasks into inbox (active) and outbox (completed)
  const inboxTasks = filteredTasks.filter(task => 
    task.status !== 'נשלח' && 
    task.status !== 'ידני-לא לשלוח' && 
    task.status !== 'התקבל מענה'
  );

  const outboxTasks = filteredTasks.filter(task => 
    task.status === 'נשלח' || 
    task.status === 'ידני-לא לשלוח' || 
    task.status === 'התקבל מענה'
  );

  const sortTasksByPriority = (tasks) => {
    return [...tasks].sort((a, b) => {
      const priorityOrder = { "גבוהה": 1, "בינונית": 2, "נמוכה": 3 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) return aPriority - bPriority;

      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }

      return new Date(b.created_date) - new Date(a.created_date);
    });
  };

  const sortedInboxTasks = sortTasksByPriority(inboxTasks);
  const sortedOutboxTasks = sortTasksByPriority(outboxTasks);

  // Count by status for stats
  const statsData = [
    { label: "לא החל", value: tasks.filter(t => t.status === "לא החל").length, color: "bg-gray-100" },
    { label: "מאושר לשליחה", value: tasks.filter(t => t.status === "מאושר לשליחה").length, color: "bg-purple-100" },
    { label: "טיפול ידני", value: tasks.filter(t => t.status === "טיפול ידני").length, color: "bg-orange-100" },
    { label: "ידני-לא לשלוח", value: tasks.filter(t => t.status === "ידני-לא לשלוח").length, color: "bg-slate-100" },
    { label: "נשלח", value: tasks.filter(t => t.status === "נשלח").length, color: "bg-blue-100" },
    { label: "התקבל מענה", value: tasks.filter(t => t.status === "התקבל מענה").length, color: "bg-green-100" },
    { label: "תקלה", value: tasks.filter(t => t.status === "תקלה בשליחה").length, color: "bg-red-100" }
  ];

  const statusColors = {
    "לא החל": "bg-gray-100 text-gray-800",
    "מאושר לשליחה": "bg-purple-100 text-purple-800",
    "טיפול ידני": "bg-orange-100 text-orange-800",
    "ידני-לא לשלוח": "bg-slate-100 text-slate-800",
    "נשלח": "bg-blue-100 text-blue-800",
    "התקבל מענה": "bg-green-100 text-green-800",
    "תקלה בשליחה": "bg-red-100 text-red-800"
  };

  const statusIcons = {
    "לא החל": Clock,
    "מאושר לשליחה": Send,
    "טיפול ידני": AlertTriangle,
    "ידני-לא לשלוח": AlertTriangle,
    "נשלח": CheckCircle,
    "התקבל מענה": CheckCircle,
    "תקלה בשליחה": AlertTriangle
  };

  if (loading) {
    return <LoadingSpinner message="טוען דף אלעד..." />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" 
            alt="אלעד" 
            className="w-16 h-16 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
          />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">אלעד - שליחת מועמדים</h1>
            <p className="text-sm md:text-base text-gray-600">סוכן AI לשליחת קורות חיים ללקוחות</p>
          </div>
        </div>
      </div>

      {/* Important Notice Alert */}
      <Alert className="bg-blue-50 border-blue-300 border-2">
        <AlertTriangle className="w-5 h-5 text-blue-700" />
        <AlertDescription className="text-blue-900">
          <strong className="text-lg">⚠️ שימו לב:</strong> 
          <ul className="list-disc mr-6 mt-2 space-y-1">
            <li>העברה לסטטוס <strong>"מאושר לשליחה"</strong> תגרום לאלעד לשלוח את המייל ללקוח <strong>תוך דקה</strong> (התהליך האוטומטי רץ כל דקה).</li>
            <li>הסטטוס <strong className="text-green-700">"נשלח"</strong> מעיד שהמייל נשלח בהצלחה.</li>
            <li>הסטטוס <strong className="text-red-700">"תקלה בשליחה"</strong> מעיד על כישלון - בדקו את השגיאה בטבלה.</li>
            <li>הסטטוס <strong className="text-orange-700">"טיפול ידני"</strong> - אלעד זיהה שזו <strong>חברת חשמל</strong> שדורשת מסמך BID מיוחד במקום קורות חיים רגילים. המשימה לא תישלח אוטומטית ודורשת טיפול ידני.</li>
            <li>הסטטוס <strong className="text-slate-700">"ידני-לא לשלוח"</strong> - מצב שנקבע ידנית על ידי המשתמש. <strong>אלעד לא ישלח</strong> משימות במצב זה אוטומטית - דורש החלטה נוספת.</li>
            <li>אלעד ישתמש בהגדרות השליחה שהוגדרו בניהול מערכת (תבניות מייל, PDF ממותג, וכו').</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Add Task Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            הוספת משימת שליחה חדשה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Priority Select */}
              <div className="w-full md:w-32">
                <Label>עדיפות</Label>
                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="עדיפות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="גבוהה">🔴 גבוהה</SelectItem>
                    <SelectItem value="בינונית">🟡 בינונית</SelectItem>
                    <SelectItem value="נמוכה">⚪ נמוכה</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Match Search */}
              <div className="flex-1">
                <Label>בחר התאמה מוכנה</Label>
                <Popover open={matchSearchOpen} onOpenChange={setMatchSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <UserIcon className="w-4 h-4 ml-2 text-gray-500" />
                      {selectedMatch ? `${selectedMatch.candidate_name} → ${selectedMatch.job_title}` : "בחר התאמה..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="חפש התאמה..." 
                        value={matchSearch}
                        onValueChange={setMatchSearch}
                      />
                      <CommandList>
                        <CommandEmpty>לא נמצאו התאמות מוכנות</CommandEmpty>
                        <CommandGroup>
                          {filteredMatches.map(match => (
                            <CommandItem
                              key={match.id}
                              value={`${match.candidate_name} ${match.job_title}`}
                              onSelect={() => {
                                setSelectedMatch(match);
                                setMatchSearchOpen(false);
                              }}
                            >
                              <div className="flex flex-col w-full">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{match.candidate_name}</span>
                                  {match.match_score && (
                                    <Badge className="bg-purple-100 text-purple-800">
                                      {match.match_score}%
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">{match.job_title}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Email Input & Add Button */}
            {selectedMatch && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="manual-email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    מייל לשליחה (בדיקה/ידני)
                  </Label>
                  <Input
                    id="manual-email"
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="הזן מייל לשליחה (לא ישלח ללקוח האמיתי)"
                    dir="ltr"
                  />
                  <p className="text-xs text-blue-600">
                    💡 המייל יישלח לכתובת זו במקום למייל הלקוח - שימושי לבדיקות
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSelectedMatch(null);
                      setManualEmail("");
                      setSelectedPriority("בינונית");
                      setMatchSearch("");
                    }}
                    className="flex-1"
                  >
                    ביטול
                  </Button>
                  <Button 
                    onClick={handleAddTask} 
                    disabled={!selectedMatch || !manualEmail.trim() || adding}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {adding ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Plus className="w-4 h-4 ml-2" />}
                    הוסף משימת שליחה
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="חיפוש לפי מועמד, משרה או לקוח..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="עדיפות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל העדיפויות</SelectItem>
              <SelectItem value="גבוהה">גבוהה</SelectItem>
              <SelectItem value="בינונית">בינונית</SelectItem>
              <SelectItem value="נמוכה">נמוכה</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="סנן לפי סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    <SelectItem value="לא החל">לא החל</SelectItem>
                    <SelectItem value="מאושר לשליחה">מאושר לשליחה</SelectItem>
                    <SelectItem value="טיפול ידני">טיפול ידני</SelectItem>
                    <SelectItem value="ידני-לא לשלוח">ידני-לא לשלוח</SelectItem>
                    <SelectItem value="נשלח">נשלח</SelectItem>
                    <SelectItem value="התקבל מענה">התקבל מענה</SelectItem>
                    <SelectItem value="תקלה בשליחה">תקלה בשליחה</SelectItem>
                  </SelectContent>
                </Select>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 ml-2" />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {statsData.map((stat, idx) => (
          <Card key={idx}>
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color} rounded px-2 py-1 inline-block`}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tasks Tabs */}
      <MobileTabs value={activeTab} onValueChange={setActiveTab}>
        <MobileTabsButtons>
          <MobileTabButton value="inbox" icon={Inbox} label={`דואר נכנס (${sortedInboxTasks.length})`} color="indigo" />
          <MobileTabButton value="outbox" icon={SendHorizontal} label={`דואר יוצא (${sortedOutboxTasks.length})`} color="blue" />
          <MobileTabButton value="direct_outreach" icon={Send} label="דואר יוצא ישירות גייסות" color="purple" />
        </MobileTabsButtons>

        {/* Inbox Tab */}
        <MobileTabsContent tabValue="inbox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>משימות לביצוע</span>
                <Badge variant="outline">{sortedInboxTasks.length} משימות</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מס׳ משימה</TableHead>
                      <TableHead>עדיפות</TableHead>
                      <TableHead>מועמד</TableHead>
                      <TableHead>משרה</TableHead>
                      <TableHead>לקוח</TableHead>
                      <TableHead>דד-ליין</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>תאריך יצירה</TableHead>
                      <TableHead>תקשורת</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedInboxTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין משימות בדואר הנכנס
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedInboxTasks.map((task) => {
                        const StatusIcon = statusIcons[task.status] || Clock;
                        const isDeadlinePassed = task.deadline && new Date(task.deadline) < new Date();
                        
                        return (
                          <TableRow key={task.id}>
                            <TableCell className="font-mono text-xs">
                              {task.task_number || '—'}
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={task.priority || "בינונית"} 
                                onValueChange={(val) => handlePriorityChange(task.id, val)}
                              >
                                <SelectTrigger className="w-24 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="גבוהה">🔴 גבוהה</SelectItem>
                                  <SelectItem value="בינונית">🟡 בינונית</SelectItem>
                                  <SelectItem value="נמוכה">⚪ נמוכה</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="w-3 h-3 text-blue-600" />
                                  <span className="text-sm"><BlurredText type="name">{task.candidate_full_name}</BlurredText></span>
                                </div>
                                {task.rotem_conversation_summary && (
                                  <div className="text-xs text-gray-600 bg-blue-50 p-1 rounded max-w-xs">
                                    💬 {task.rotem_conversation_summary.substring(0, 100)}...
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Briefcase className="w-3 h-3 text-orange-600" />
                                <span className="text-sm">{task.job_title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium"><BlurredText type="name">{task.client_company_name}</BlurredText></span>
                                <span className="text-xs text-gray-500"><BlurredText type="email">{task.client_email}</BlurredText></span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {task.deadline ? (
                                <Badge 
                                  variant="outline" 
                                  className={isDeadlinePassed ? "bg-red-50 text-red-700 border-red-300" : "bg-blue-50 text-blue-700"}
                                >
                                  {new Date(task.deadline).toLocaleDateString('he-IL')}
                                  {isDeadlinePassed && " ⚠️"}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-xs">לא הוגדר</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select 
                                key={`status-${task.id}-${task.status}`}
                                value={task.status} 
                                onValueChange={(val) => handleStatusChange(task.id, val)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="לא החל">לא החל</SelectItem>
                                  <SelectItem value="מאושר לשליחה">מאושר לשליחה</SelectItem>
                                  <SelectItem value="טיפול ידני">טיפול ידני</SelectItem>
                                  <SelectItem value="ידני-לא לשלוח">ידני-לא לשלוח</SelectItem>
                                  <SelectItem value="נשלח">נשלח</SelectItem>
                                  <SelectItem value="התקבל מענה">התקבל מענה</SelectItem>
                                  <SelectItem value="תקלה בשליחה">תקלה בשליחה</SelectItem>
                                </SelectContent>
                              </Select>
                              {task.status === 'מאושר לשליחה' && (
                                <Badge className="bg-purple-100 text-purple-800 animate-pulse text-xs mt-1">
                                  ממתין לשליחה...
                                </Badge>
                              )}
                              {task.last_error && (
                                <div className="text-xs text-red-600 mt-1 max-w-xs">
                                  {task.last_error}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {new Date(task.created_date).toLocaleDateString('he-IL')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setCandidateCommunicationDialog({ isOpen: true, task })}
                                  className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  title="תקשורת עם מועמד"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setClientCommunicationDialog({ isOpen: true, task })}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="תקשורת עם לקוח"
                                >
                                  <Building className="w-4 h-4" />
                                </Button>
                                {task.status === 'לא החל' && !isDeadlinePassed && (
                                  <Button
                                    size="sm"
                                    onClick={() => setConfirmDialog({ isOpen: true, task })}
                                    disabled={approving === task.id}
                                    className="bg-green-600 hover:bg-green-700 h-8"
                                    title="אשר לשליחה מהירה"
                                  >
                                    {approving === task.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="w-3 h-3 ml-1" />
                                        אשר
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
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

        {/* Outbox Tab */}
        <MobileTabsContent tabValue="outbox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>משימות שהושלמו</span>
                <Badge variant="outline">{sortedOutboxTasks.length} משימות</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מס׳ משימה</TableHead>
                      <TableHead>עדיפות</TableHead>
                      <TableHead>מועמד</TableHead>
                      <TableHead>משרה</TableHead>
                      <TableHead>לקוח</TableHead>
                      <TableHead>דד-ליין</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>תאריך יצירה</TableHead>
                      <TableHead>תאריך שליחה</TableHead>
                      <TableHead>תקשורת</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOutboxTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          <SendHorizontal className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין משימות בדואר היוצא
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedOutboxTasks.map((task) => {
                        const StatusIcon = statusIcons[task.status] || Clock;
                        const isDeadlinePassed = task.deadline && new Date(task.deadline) < new Date();
                        
                        return (
                          <TableRow key={task.id}>
                            <TableCell className="font-mono text-xs">
                              {task.task_number || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                task.priority === "גבוהה" ? "bg-red-100 text-red-800" :
                                task.priority === "נמוכה" ? "bg-gray-100 text-gray-800" :
                                "bg-yellow-100 text-yellow-800"
                              }>
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="w-3 h-3 text-blue-600" />
                                  <span className="text-sm"><BlurredText type="name">{task.candidate_full_name}</BlurredText></span>
                                </div>
                                {task.rotem_conversation_summary && (
                                  <div className="text-xs text-gray-600 bg-blue-50 p-1 rounded max-w-xs">
                                    💬 {task.rotem_conversation_summary.substring(0, 100)}...
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Briefcase className="w-3 h-3 text-orange-600" />
                                <span className="text-sm">{task.job_title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium"><BlurredText type="name">{task.client_company_name}</BlurredText></span>
                                <span className="text-xs text-gray-500"><BlurredText type="email">{task.client_email}</BlurredText></span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {task.deadline ? (
                                <Badge 
                                  variant="outline" 
                                  className={isDeadlinePassed ? "bg-red-50 text-red-700 border-red-300" : "bg-blue-50 text-blue-700"}
                                >
                                  {new Date(task.deadline).toLocaleDateString('he-IL')}
                                  {isDeadlinePassed && " ⚠️"}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-xs">לא הוגדר</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[task.status]}>
                                <StatusIcon className="w-3 h-3 ml-1" />
                                {task.status}
                              </Badge>
                              {task.last_error && (
                                <div className="text-xs text-red-600 mt-1 max-w-xs">
                                  {task.last_error}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {new Date(task.created_date).toLocaleDateString('he-IL')}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {task.sent_date ? new Date(task.sent_date).toLocaleDateString('he-IL') : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setCandidateCommunicationDialog({ isOpen: true, task })}
                                  className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  title="תקשורת עם מועמד"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setClientCommunicationDialog({ isOpen: true, task })}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="תקשורת עם לקוח"
                                >
                                  <Building className="w-4 h-4" />
                                </Button>
                              </div>
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

        {/* Direct Outreach Tab */}
        <MobileTabsContent tabValue="direct_outreach">
          <DirectOutreachTabElad />
        </MobileTabsContent>
      </MobileTabs>

      {/* Confirm Approval Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, task: null })}
        onConfirm={() => handleApproveTask(confirmDialog.task)}
        title="אישור שליחת מועמד"
        message={confirmDialog.task ? `האם לאשר שליחת ${confirmDialog.task.candidate_full_name} למשרת "${confirmDialog.task.job_title}" ב-${confirmDialog.task.client_company_name}? המייל יישלח תוך 60 שניות.` : ""}
        confirmText="אשר לשליחה"
        cancelText="ביטול"
        variant="default"
      />

      {/* Candidate Communication History Dialog */}
      <CandidateCommunicationHistory
        candidateId={candidateCommunicationDialog.task?.candidate_id}
        candidateName={candidateCommunicationDialog.task?.candidate_full_name || ''}
        open={candidateCommunicationDialog.isOpen}
        onClose={() => setCandidateCommunicationDialog({ isOpen: false, task: null })}
      />

      {/* Client Communication History Dialog */}
      <ClientCommunicationHistory
        jobId={clientCommunicationDialog.task?.job_id}
        jobTitle={clientCommunicationDialog.task?.job_title || ''}
        open={clientCommunicationDialog.isOpen}
        onClose={() => setClientCommunicationDialog({ isOpen: false, task: null })}
      />
    </div>
  );
}