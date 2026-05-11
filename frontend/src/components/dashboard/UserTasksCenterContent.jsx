import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskEditDialog from "@/components/tasks/TaskEditDialog";
import { ClipboardList, Search, Calendar, Briefcase, AlertTriangle, Loader2, RefreshCw, User, Grid, Layout, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

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

export default function UserTasksCenterContent({ candidateId, agentName = null }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("פתוחה");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignedTo, setFilterAssignedTo] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    loadData();
  }, [candidateId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allTasks, userList] = await Promise.all([
        candidateId 
          ? base44.entities.UserTask.filter({ candidate_id: candidateId }, '-opened_at', 200)
          : base44.entities.UserTask.list('-opened_at', 200),
        base44.entities.User.list(),
      ]);
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

  const handleEditTask = (task) => {
    // Handle editing existing task through CreateTaskDialog
    // Convert to format expected by CreateTaskDialog
    setEditingTask({
      ...task,
      isEditing: true
    });
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedTasks.length === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all(
        selectedTasks.map(taskId =>
          base44.entities.UserTask.update(taskId, { status: newStatus })
        )
      );
      setTasks(prev =>
        prev.map(t =>
          selectedTasks.includes(t.id) ? { ...t, status: newStatus } : t
        )
      );
      setSelectedTasks([]);
      toast.success(`עודכנו ${selectedTasks.length} משימות לסטטוס: ${newStatus}`);
    } catch (e) {
      toast.error("שגיאה בעדכון משימות");
    }
    setBulkUpdating(false);
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;
    if (!window.confirm(`האם אתה בטוח שתרצה למחוק ${selectedTasks.length} משימות?`)) return;
    setBulkUpdating(true);
    try {
      await Promise.all(
        selectedTasks.map(taskId =>
          base44.entities.UserTask.delete(taskId)
        )
      );
      setTasks(prev => prev.filter(t => !selectedTasks.includes(t.id)));
      setSelectedTasks([]);
      toast.success(`נמחקו ${selectedTasks.length} משימות`);
    } catch (e) {
      toast.error("שגיאה במחיקת משימות");
    }
    setBulkUpdating(false);
  };

  const toggleSelectTask = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTasks.length === filtered.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(filtered.map(t => t.id));
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">סה"כ {tasks.length} משימות | {openCount} פתוחות</p>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" />
          רענן
        </Button>
      </div>

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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center flex-1">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pr-9 h-8 text-sm" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="פתוחה">פתוחה</SelectItem>
              <SelectItem value="בטיפול">בטיפול</SelectItem>
              <SelectItem value="סגורה">סגורה</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל העדיפויות</SelectItem>
              <SelectItem value="גבוה">גבוה</SelectItem>
              <SelectItem value="בינוני">בינוני</SelectItem>
              <SelectItem value="נמוך">נמוך</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל האחראים</SelectItem>
              <SelectItem value="unassigned">לא שויך</SelectItem>
              {assigneeOptions.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          <Button 
            variant={viewMode === "table" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setViewMode("table")}
            className="h-8 gap-1"
          >
            <Layout className="w-3.5 h-3.5" />
            טבלה
          </Button>
          <Button 
            variant={viewMode === "cards" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setViewMode("cards")}
            className="h-8 gap-1"
          >
            <Grid className="w-3.5 h-3.5" />
            כרטיסיות
          </Button>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>לא נמצאו משימות</p>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
       <div className="space-y-3">
         {selectedTasks.length > 0 && (
           <div className="flex gap-2 items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
             <span className="text-sm font-medium text-blue-900">{selectedTasks.length} משימות נבחרו</span>
             <Select onValueChange={handleBulkStatusChange} disabled={bulkUpdating}>
               <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="בחר סטטוס" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="פתוחה">סטטוס: פתוחה</SelectItem>
                 <SelectItem value="בטיפול">סטטוס: בטיפול</SelectItem>
                 <SelectItem value="סגורה">סטטוס: סגורה</SelectItem>
               </SelectContent>
             </Select>
             <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkUpdating} className="gap-1">
               <Trash2 className="w-3.5 h-3.5" />
               מחק
             </Button>
             <Button size="sm" variant="outline" onClick={() => setSelectedTasks([])} disabled={bulkUpdating}>
               בטל בחירה
             </Button>
           </div>
         )}
         <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-right p-3 font-semibold text-gray-700 w-10">
                    <Checkbox
                      checked={selectedTasks.length === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-right p-3 font-semibold text-gray-700">משימה</th>
                <th className="text-right p-3 font-semibold text-gray-700">מועמד</th>
                <th className="text-right p-3 font-semibold text-gray-700">משרה</th>
                <th className="text-right p-3 font-semibold text-gray-700">דחיפות</th>
                <th className="text-right p-3 font-semibold text-gray-700">סטטוס</th>
                <th className="text-right p-3 font-semibold text-gray-700">תאריך יעד</th>
                <th className="text-right p-3 font-semibold text-gray-700">אחראי</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} className={`border-b ${task.status === "סגורה" ? "opacity-60" : ""} ${isOverdue(task) ? "bg-red-50" : "hover:bg-gray-50"}`}>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedTasks.includes(task.id)}
                      onCheckedChange={() => toggleSelectTask(task.id)}
                    />
                  </td>
                  <td className="p-3 cursor-pointer" onClick={() => handleEditTask(task)}>
                    <div className="font-medium text-gray-900">{task.task_name}</div>
                    {task.description && <div className="text-xs text-gray-500 line-clamp-1">{task.description}</div>}
                  </td>
                  <td className="p-3 text-gray-600">{task.candidate_name}</td>
                  <td className="p-3 text-gray-600 truncate">{task.job_title || "-"}</td>
                  <td className="p-3">
                    <Badge className={`text-xs border ${PRIORITY_COLORS[task.priority] || "bg-gray-100"}`}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {updatingId === task.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v)}>
                        <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="פתוחה">פתוחה</SelectItem>
                          <SelectItem value="בטיפול">בטיפול</SelectItem>
                          <SelectItem value="סגורה">סגורה</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className={`p-3 ${isOverdue(task) ? "text-red-600 font-medium" : "text-gray-600"}`}>
                    {task.due_date ? formatDue(task.due_date) : "-"}
                    {isOverdue(task) && " (באיחור!)"}
                  </td>
                  <td className="p-3 text-xs">
                    {task.assigned_to_user_name ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">{task.assigned_to_user_name}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            </div>
            </div>
            ) : (
              <div className="space-y-3">
                {selectedTasks.length > 0 && (
                 <div className="flex gap-2 items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                   <span className="text-sm font-medium text-blue-900">{selectedTasks.length} משימות נבחרו</span>
                   <Select onValueChange={handleBulkStatusChange} disabled={bulkUpdating}>
                     <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="בחר סטטוס" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="פתוחה">סטטוס: פתוחה</SelectItem>
                       <SelectItem value="בטיפול">סטטוס: בטיפול</SelectItem>
                       <SelectItem value="סגורה">סטטוס: סגורה</SelectItem>
                     </SelectContent>
                   </Select>
                   <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkUpdating} className="gap-1">
                     <Trash2 className="w-3.5 h-3.5" />
                     מחק
                   </Button>
                   <Button size="sm" variant="outline" onClick={() => setSelectedTasks([])} disabled={bulkUpdating}>
                     בטל בחירה
                   </Button>
                 </div>
                )}
                {filtered.map(task => (
                  <Card
                    key={task.id}
                    className={`${task.status === "סגורה" ? "opacity-60" : ""} ${isOverdue(task) ? "border-red-300 bg-red-50" : ""} cursor-pointer hover:shadow-md transition-shadow`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-2 flex-1">
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={() => toggleSelectTask(task.id)}
                            className="mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 cursor-pointer" onClick={() => handleEditTask(task)}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900 text-sm">{task.task_name}</span>
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
                      <p className="text-xs text-gray-600 mb-1 whitespace-pre-wrap line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-medium text-gray-700">
                        <User className="w-3 h-3" />{task.candidate_name}
                      </span>
                      {task.job_title && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />{task.job_title}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />נפתח: {formatDate(task.opened_at)}
                      </span>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 font-medium ${isOverdue(task) ? "text-red-600" : ""}`}>
                          <Calendar className="w-3 h-3" />יעד: {formatDue(task.due_date)}
                        </span>
                      )}
                      {task.assigned_to_user_name ? (
                        <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                          <User className="w-3 h-3" />אחראי: <strong>{task.assigned_to_user_name}</strong>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full border border-gray-200">
                          <User className="w-3 h-3" />לא שויך
                        </span>
                      )}
                    </div>
                    </div>
                    </div>
                    <div className="flex-shrink-0">
                    {updatingId === task.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                    <Select value={task.status} onValueChange={v => handleStatusChange(task.id, v)}>
                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
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

        {/* Edit Task using CreateTaskDialog - but for editing existing */}
        {editingTask && editingTask.isEditing && (
          <TaskEditDialog
            task={editingTask}
            open={!!editingTask}
            onClose={() => setEditingTask(null)}
            onTaskUpdated={() => { loadData(); setEditingTask(null); }}
          />
        )}
        </div>
        );
        }