import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Search, Calendar, Briefcase, AlertTriangle, Loader2, RefreshCw, User, Grid, Layout, CheckCircle2, Trash2, CalendarClock, X } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const PRIORITY_COLORS = {
  נמוך: "bg-blue-100 text-blue-700 border-blue-200",
  בינוני: "bg-yellow-100 text-yellow-700 border-yellow-200",
  גבוה: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_COLORS = {
  פתוחה: "bg-green-100 text-green-700",
  "בטיפול": "bg-yellow-100 text-yellow-700",
  סגורה: "bg-gray-100 text-gray-500",
};

export default function UserTasksCenter() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("פתוחה");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignedTo, setFilterAssignedTo] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [editingTask, setEditingTask] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkDueTime, setBulkDueTime] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const [allUsers, setAllUsers] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [currentUser, allTasks, userList] = await Promise.all([
        base44.auth.me(),
        base44.entities.UserTask.list('-opened_at', 200),
        base44.entities.User.list(),
      ]);
      setUser(currentUser);
      setTasks(allTasks);
      setAllUsers(userList);
    } catch (e) {
      console.error("Error loading tasks", e);
    }
    setLoading(false);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    setUpdatingId(taskId);
    try {
      await base44.entities.UserTask.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success("הסטטוס עודכן");
    } catch (e) {
      toast.error("שגיאה בעדכון");
    }
    setUpdatingId(null);
  };

  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`למחוק ${selectedIds.size} משימות?`)) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map(id => base44.entities.UserTask.delete(id)));
      setTasks(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} משימות נמחקו`);
    } catch {
      toast.error("שגיאה במחיקה");
    }
    setBulkLoading(false);
  };

  const handleBulkDateUpdate = async () => {
    if (!bulkDueDate) { toast.error("יש לבחור תאריך"); return; }
    const dateStr = bulkDueTime ? `${bulkDueDate}T${bulkDueTime}` : bulkDueDate;
    setBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map(id => base44.entities.UserTask.update(id, { due_date: dateStr })));
      setTasks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, due_date: dateStr } : t));
      setSelectedIds(new Set());
      setShowDateDialog(false);
      setBulkDueDate("");
      setBulkDueTime("");
      toast.success("תאריך היעד עודכן");
    } catch {
      toast.error("שגיאה בעדכון");
    }
    setBulkLoading(false);
  };

  const handleComplete = async (e, task) => {
    e.stopPropagation();
    if (task.status === "סגורה") return;
    setUpdatingId(task.id);
    try {
      await base44.entities.UserTask.update(task.id, { status: "סגורה" });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "סגורה" } : t));
      toast.success(`המשימה "${task.task_name}" סומנה כבוצעה`);
    } catch (e) {
      toast.error("שגיאה בעדכון");
    }
    setUpdatingId(null);
  };



  // Unique assignees for filter dropdown
  const assigneeOptions = Array.from(new Set(tasks.map(t => t.assigned_to_user_name).filter(Boolean)));

  const filtered = tasks.filter(t => {
    const matchSearch = !search ||
      t.task_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.job_title?.toLowerCase().includes(search.toLowerCase()) ||
      t.assigned_to_user_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.opened_by_user_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    const matchAssigned = filterAssignedTo === "all" || t.assigned_to_user_name === filterAssignedTo || (filterAssignedTo === "unassigned" && !t.assigned_to_user_name);
    return matchSearch && matchStatus && matchPriority && matchAssigned;
  });

  const formatDate = (d) => {
    if (!d) return null;
    try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: he }); } catch { return d; }
  };
  const formatDue = (d) => {
    if (!d) return null;
    try { return format(new Date(d), "dd/MM/yyyy", { locale: he }); } catch { return d; }
  };

  const isOverdue = (task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== "סגורה";

  const openCount = tasks.filter(t => t.status !== "סגורה").length;

  if (loading) return <LoadingSpinner message="טוען משימות..." />;

  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
         <div className="flex items-center gap-3">
           <ClipboardList className="w-8 h-8 text-blue-600" />
           <div>
             <h1 className="text-2xl md:text-3xl font-bold text-gray-800">ריכוז משימות משתמש</h1>
             <p className="text-sm text-gray-500">
               סה"כ {tasks.length} משימות | {openCount} פתוחות
             </p>
           </div>
         </div>
         <div className="flex gap-2">
           <Button
             variant={viewMode === "table" ? "default" : "outline"}
             size="sm"
             onClick={() => setViewMode("table")}
             className="gap-2"
           >
             <Layout className="w-4 h-4" />
             טבלה
           </Button>
           <Button
             variant={viewMode === "cards" ? "default" : "outline"}
             size="sm"
             onClick={() => setViewMode("cards")}
             className="gap-2"
           >
             <Grid className="w-4 h-4" />
             כרטיסים
           </Button>
           <Button variant="outline" onClick={loadData} className="gap-2">
             <RefreshCw className="w-4 h-4" />
             רענן
           </Button>
         </div>
       </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pr-9"
            placeholder="חיפוש לפי שם משימה, מועמד, משרה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="פתוחה">פתוחה</SelectItem>
            <SelectItem value="בטיפול">בטיפול</SelectItem>
            <SelectItem value="סגורה">סגורה</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="עדיפות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל העדיפויות</SelectItem>
            <SelectItem value="גבוה">גבוה</SelectItem>
            <SelectItem value="בינוני">בינוני</SelectItem>
            <SelectItem value="נמוך">נמוך</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="אחראי" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל האחראים</SelectItem>
            <SelectItem value="unassigned">לא שויך</SelectItem>
            {assigneeOptions.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "גבוהה", key: "גבוה", color: "bg-red-50 border-red-200 text-red-700" },
          { label: "בינונית", key: "בינוני", color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
          { label: "נמוכה", key: "נמוך", color: "bg-blue-50 border-blue-200 text-blue-700" },
        ].map(({ label, key, color }) => (
          <Card key={key} className={`border ${color}`}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{tasks.filter(t => t.priority === key && t.status !== "סגורה").length}</div>
              <div className="text-xs">דחיפות {label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex-wrap">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} משימות נבחרו</span>
          <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100" onClick={() => setShowDateDialog(true)}>
            <CalendarClock className="w-4 h-4" />
            שנה תאריך יעד
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50" onClick={handleBulkDelete} disabled={bulkLoading}>
            {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            מחק נבחרים
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 text-gray-500" onClick={() => setSelectedIds(new Set())}>
            <X className="w-4 h-4" />
            בטל בחירה
          </Button>
        </div>
      )}

      {/* Task List */}
       {filtered.length === 0 ? (
         <Card>
           <CardContent className="py-16 text-center text-gray-400">
             <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
             <p>לא נמצאו משימות</p>
           </CardContent>
         </Card>
       ) : viewMode === "table" ? (
         <div className="overflow-x-auto">
           <table className="w-full text-sm border-collapse">
             <thead>
               <tr className="bg-gray-100 border-b">
                 <th className="p-3 w-8">
                   <input
                     type="checkbox"
                     checked={filtered.length > 0 && selectedIds.size === filtered.length}
                     onChange={toggleSelectAll}
                     className="cursor-pointer w-4 h-4"
                     title="בחר הכל"
                   />
                 </th>
                 <th className="p-3 w-8"></th>
                 <th className="p-3 text-right font-bold">שם משימה</th>
                 <th className="p-3 text-right font-bold">מועמד</th>
                 <th className="p-3 text-right font-bold">משרה</th>
                 <th className="p-3 text-right font-bold">עדיפות</th>
                 <th className="p-3 text-right font-bold">סטטוס</th>
                 <th className="p-3 text-right font-bold">יעד</th>
                 <th className="p-3 text-right font-bold">אחראי</th>
                 <th className="p-3 text-right font-bold">פעולה</th>
               </tr>
             </thead>
             <tbody>
               {filtered.map(task => (
                 <tr key={task.id} onClick={() => setEditingTask(task)} className={`border-b cursor-pointer ${task.status === "סגורה" ? "opacity-60" : ""} ${selectedIds.has(task.id) ? "bg-blue-50" : isOverdue(task) ? "bg-red-50" : "hover:bg-gray-50"}`}>
                   <td className="p-3" onClick={e => e.stopPropagation()}>
                     <input
                       type="checkbox"
                       checked={selectedIds.has(task.id)}
                       onChange={e => toggleSelect(e, task.id)}
                       className="cursor-pointer w-4 h-4"
                     />
                   </td>
                   <td className="p-3" onClick={e => e.stopPropagation()}>
                     {updatingId === task.id ? (
                       <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                     ) : (
                       <button
                         onClick={e => handleComplete(e, task)}
                         title="סמן כבוצע"
                         className={`transition-colors ${task.status === "סגורה" ? "text-green-500" : "text-gray-300 hover:text-green-500"}`}
                       >
                         <CheckCircle2 className="w-5 h-5" />
                       </button>
                     )}
                   </td>
                   <td className="p-3 font-medium">{task.task_name}</td>
                   <td className="p-3 text-gray-600">{task.candidate_name}</td>
                   <td className="p-3 text-gray-600 truncate">{task.job_title || "-"}</td>
                   <td className="p-3">
                     <Badge className={`text-xs border ${PRIORITY_COLORS[task.priority] || "bg-gray-100"}`}>
                       {task.priority}
                     </Badge>
                   </td>
                   <td className="p-3">
                     <Badge className={`text-xs ${STATUS_COLORS[task.status] || "bg-gray-100"}`}>
                       {task.status}
                     </Badge>
                   </td>
                   <td className="p-3 text-gray-600">{task.due_date ? formatDue(task.due_date) : "-"}</td>
                   <td className="p-3 text-gray-600">{task.assigned_to_user_name || "לא שויך"}</td>
                   <td className="p-3">
                     {updatingId === task.id ? (
                       <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                     ) : (
                       <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v)}>
                         <SelectTrigger className="w-28 h-8 text-xs">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="פתוחה">פתוחה</SelectItem>
                           <SelectItem value="בטיפול">בטיפול</SelectItem>
                           <SelectItem value="סגורה">סגורה</SelectItem>
                         </SelectContent>
                       </Select>
                     )}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       ) : (
         <div className="space-y-3">
          {filtered.map(task => (
            <Card
              key={task.id}
              className={`${task.status === "סגורה" ? "opacity-60" : ""} ${isOverdue(task) ? "border-red-300 bg-red-50" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <button
                        onClick={e => handleComplete(e, task)}
                        title="סמן כבוצע"
                        className={`flex-shrink-0 transition-colors ${task.status === "סגורה" ? "text-green-500" : "text-gray-300 hover:text-green-500"}`}
                      >
                        {updatingId === task.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      </button>
                      <span className="font-bold text-gray-900 text-base">{task.task_name}</span>
                      {isOverdue(task) && (
                        <Badge className="bg-red-600 text-white text-xs animate-pulse">באיחור!</Badge>
                      )}
                      <Badge className={`text-xs border ${PRIORITY_COLORS[task.priority] || "bg-gray-100"}`}>
                        <AlertTriangle className="w-3 h-3 ml-1" />
                        {task.priority}
                      </Badge>
                      <Badge className={`text-xs ${STATUS_COLORS[task.status] || "bg-gray-100"}`}>
                        {task.status}
                      </Badge>
                    </div>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap line-clamp-3">{task.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-medium text-gray-700">
                        <User className="w-3 h-3" />
                        {task.candidate_name}
                      </span>
                      {task.job_title && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {task.job_title}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        נפתח: {formatDate(task.opened_at)}
                      </span>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 font-medium ${isOverdue(task) ? "text-red-600" : ""}`}>
                          <Calendar className="w-3 h-3" />
                          יעד: {formatDue(task.due_date)}
                        </span>
                      )}
                      {task.candidate_status_at_open && (
                        <span>מצב בפתיחה: {task.candidate_status_at_open}</span>
                      )}
                      {task.opened_by_user_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          נפתח ע"י: <strong className="text-gray-700">{task.opened_by_user_name}</strong>
                        </span>
                      )}
                      {task.assigned_to_user_name ? (
                        <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                          <User className="w-3 h-3" />
                          אחראי: <strong>{task.assigned_to_user_name}</strong>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full border border-gray-200">
                          <User className="w-3 h-3" />
                          לא שויך לאחראי
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {updatingId === task.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v)}>
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="פתוחה">פתוחה</SelectItem>
                          <SelectItem value="בטיפול">בטיפול</SelectItem>
                          <SelectItem value="סגורה">סגורה</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}

        {/* Bulk Date Dialog */}
        <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader>
              <DialogTitle>עדכון תאריך יעד ל-{selectedIds.size} משימות</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">תאריך יעד</label>
                <Input type="date" value={bulkDueDate} onChange={e => setBulkDueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">שעת יעד (אופציונלי)</label>
                <Input type="time" value={bulkDueTime} onChange={e => setBulkDueTime(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2 flex-row-reverse">
              <Button onClick={handleBulkDateUpdate} disabled={bulkLoading} className="gap-2">
                {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                עדכן
              </Button>
              <Button variant="outline" onClick={() => setShowDateDialog(false)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
         {editingTask && (
           <CreateTaskDialog
             open={!!editingTask}
             onClose={() => setEditingTask(null)}
             candidate={{ id: editingTask.candidate_id, full_name: editingTask.candidate_name, status: editingTask.candidate_status_at_open }}
             match={{ job_id: editingTask.job_id, job_title: editingTask.job_title }}
             onTaskCreated={() => loadData()}
             agentName={editingTask.opened_by_user_name}
             task={editingTask}
           />
         )}
        </div>
        );
        }