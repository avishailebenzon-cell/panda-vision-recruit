import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, X, AlertTriangle, Calendar, User, Briefcase, ChevronRight, ChevronUp, ChevronDown, ClipboardList, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";

const PRIORITY_COLORS = {
  גבוה: "bg-red-100 text-red-700 border-red-300",
  בינוני: "bg-yellow-100 text-yellow-700 border-yellow-300",
  נמוך: "bg-blue-100 text-blue-700 border-blue-300",
};

export default function TaskNotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const panelRef = useRef(null);
  const scrollRef = useRef(null);

  const scrollUp = () => {
    scrollRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
  };

  const scrollDown = () => {
    scrollRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
  };
  const navigate = useNavigate();

  useEffect(() => {
    loadTasks();
    // Initial load only - due time checking handles intervals separately
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const allTasks = await base44.entities.UserTask.list('-opened_at', 200);
      // Only open/in-progress tasks
      const openTasks = allTasks.filter(t => t.status !== "סגורה");
      setTasks(openTasks);
    } catch (e) {
      console.error("Error loading notifications", e);
    }
    setLoading(false);
  };

  // Parse a task's due date+time as Israel local time (Asia/Jerusalem)
  const parseDueAsIsrael = (due_date, due_time) => {
    // Build an Israel-local date string and use Intl to get the UTC offset
    const dateStr = due_time ? `${due_date}T${due_time}:00` : `${due_date}T23:59:59`;
    // Use Intl to find Israel's UTC offset at that moment
    const tempDate = new Date(dateStr); // parsed as local - we'll correct below
    const ilFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    // Get current Israel time to compare
    const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const dueIL = new Date(new Date(dateStr).toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    return { nowIL, dueIL };
  };

  const isOverdue = (task) => {
    if (!task.due_date) return false;
    const { nowIL, dueIL } = parseDueAsIsrael(task.due_date, task.due_time);
    return dueIL < nowIL;
  };

  const isDueTimeReached = (task) => {
    if (!task.due_date || !task.due_time) return false;
    const { nowIL, dueIL } = parseDueAsIsrael(task.due_date, task.due_time);
    return dueIL <= nowIL;
  };

  const formatDue = (task) => {
    if (!task.due_date) return null;
    try {
      const base = format(new Date(task.due_date), "dd/MM/yyyy", { locale: he });
      return task.due_time ? `${base} ${task.due_time}` : base;
    } catch { return task.due_date; }
  };

  // Check for tasks whose due_time just arrived and show toast
  useEffect(() => {
    const checkDueTimes = () => {
      tasks.forEach(task => {
        if (task.due_date && task.due_time && !task.due_time_alerted && task.status !== "סגורה") {
          if (isDueTimeReached(task)) {
            toast.warning(`⏰ הגיעה שעת הסגירה: ${task.task_name}`, {
              description: task.candidate_name ? `מועמד: ${task.candidate_name}` : undefined,
              duration: 8000,
            });
            // Mark as alerted to avoid repeat
            base44.entities.UserTask.update(task.id, { due_time_alerted: true }).catch(() => {});
          }
        }
      });
    };
    if (tasks.length > 0) checkDueTimes();
    // Check every minute
    const interval = setInterval(() => {
      loadTasks();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  // Sort: overdue first, then high priority, then by due date
  const priorityOrder = { גבוה: 0, בינוני: 1, נמוך: 2 };
  const sortedTasks = [...tasks].sort((a, b) => {
    const aOverdue = isOverdue(a) ? 0 : 1;
    const bOverdue = isOverdue(b) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const ap = priorityOrder[a.priority] ?? 3;
    const bp = priorityOrder[b.priority] ?? 3;
    return ap - bp;
  });

  const handleComplete = async (e, task) => {
    e.stopPropagation();
    setCompletingIds(prev => new Set(prev).add(task.id));
    try {
      await base44.entities.UserTask.update(task.id, { status: 'סגורה' });
      setTasks(prev => prev.filter(t => t.id !== task.id));
      toast.success(`המשימה "${task.task_name}" סומנה כבוצעה`);
    } catch (err) {
      console.error('Error completing task', err);
    }
    setCompletingIds(prev => { const s = new Set(prev); s.delete(task.id); return s; });
  };

  const overdueCount = tasks.filter(t => isOverdue(t)).length;
  const notificationCount = tasks.length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        className="relative gap-1.5 text-gray-600 hover:text-gray-900"
        onClick={() => { setOpen(prev => !prev); if (!open) loadTasks(); }}
        title="התראות משימות"
      >
        <div className="relative">
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${overdueCount > 0 ? "bg-red-500 animate-pulse" : "bg-blue-500"}`}>
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </div>
        <span className="text-xs hidden sm:inline">משימות</span>
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-gray-800">התראות משימות</span>
              {notificationCount > 0 && (
                <Badge className="bg-blue-600 text-white text-xs px-1.5">{notificationCount}</Badge>
              )}
              {overdueCount > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 animate-pulse">
                  {overdueCount} באיחור
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 h-7 px-2"
                onClick={() => { navigate(createPageUrl("UserTasksCenter")); setOpen(false); }}
              >
                כל המשימות
                <ChevronRight className="w-3 h-3 mr-1" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">אין משימות פתוחות</p>
            </div>
          ) : (
            <div className="relative">
              {/* Scroll Up Button */}
              <button
                onClick={scrollUp}
                className="absolute top-1 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 rounded-full shadow p-0.5 hover:bg-gray-50 text-gray-500"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto pt-6 pb-6">
              <div className="divide-y" dir="rtl">
                {sortedTasks.map(task => (
                   <div
                      key={task.id}
                      onClick={() => { setEditingTask(task); }}
                      className={`px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer ${isOverdue(task) ? "bg-red-50/60" : ""}`}
                      dir="rtl"
                    >
                     <div className="flex items-start gap-2">
                       {/* Complete checkbox */}
                       <button
                         onClick={(e) => handleComplete(e, task)}
                         className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-green-500 transition-colors"
                         title="סמן כבוצע"
                       >
                         {completingIds.has(task.id)
                           ? <Loader2 className="w-3 h-3 animate-spin text-green-400" />
                           : <CheckCircle2 className="w-3 h-3" />
                         }
                       </button>
                       {isOverdue(task) && (
                         <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                       )}
                       <div className="flex-1 min-w-0">
                         <div className="mb-1">
                           <p className="font-semibold text-xs text-gray-900 leading-snug break-words">{task.task_name}</p>
                         </div>
                         <div className="flex items-center gap-1 flex-wrap mb-0.5">
                           {isOverdue(task) && (
                             <Badge className="bg-red-500 text-white text-[9px] px-1 py-0">באיחור!</Badge>
                           )}
                           <Badge className={`text-[9px] border px-0.5 py-0 ${PRIORITY_COLORS[task.priority] || "bg-gray-100"}`}>
                             {task.priority}
                           </Badge>
                           <Badge className={`text-[9px] px-0.5 py-0 ${task.status === "בטיפול" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                             {task.status}
                           </Badge>
                         </div>

                         <div className="space-y-0.5 text-[10px] text-gray-500">
                           <div className="flex flex-wrap gap-1.5">
                             {task.candidate_name && (
                               <span className="flex items-center gap-0.5">
                                 <User className="w-2.5 h-2.5" />{task.candidate_name}
                               </span>
                             )}
                             {task.job_title && (
                               <span className="flex items-center gap-0.5">
                                 <Briefcase className="w-2.5 h-2.5" />{task.job_title}
                               </span>
                             )}
                           </div>
                           <div className="flex flex-wrap gap-1.5">
                             {task.due_date && (
                               <span className={`flex items-center gap-0.5 font-medium ${isOverdue(task) ? "text-red-600" : ""}`}>
                                 {task.due_time ? <Clock className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                                 יעד: {formatDue(task)}
                               </span>
                             )}
                             {task.assigned_to_user_name && (
                               <span className="flex items-center gap-0.5 text-blue-600">
                                 <User className="w-2.5 h-2.5" />אחראי: {task.assigned_to_user_name}
                               </span>
                             )}
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                ))}
              </div>
              </div>
              {/* Scroll Down Button */}
              <button
                onClick={scrollDown}
                className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 rounded-full shadow p-0.5 hover:bg-gray-50 text-gray-500"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Footer */}
          {sortedTasks.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50 rounded-b-xl text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 w-full"
                onClick={() => { navigate(createPageUrl("UserTasksCenter")); setOpen(false); }}
              >
                <ClipboardList className="w-3 h-3 ml-1" />
                עבור לריכוז המשימות לטיפול
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit Task Dialog */}
      {editingTask && (
        <CreateTaskDialog
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          candidate={{ id: editingTask.candidate_id, full_name: editingTask.candidate_name }}
          match={{ job_id: editingTask.job_id, job_title: editingTask.job_title }}
          task={editingTask}
          onTaskCreated={() => { loadTasks(); setEditingTask(null); }}
          agentName="עריכה"
        />
      )}
    </div>
  );
}