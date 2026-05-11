import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { formatDateTimeIL, formatDateIL } from "@/utils/dateUtils";
import { ClipboardList, Calendar, Briefcase, Loader2, AlertTriangle, Plus, Pencil, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";

const PRIORITY_COLORS = {
  נמוך: "bg-blue-100 text-blue-700",
  בינוני: "bg-yellow-100 text-yellow-700",
  גבוה: "bg-red-100 text-red-700",
};

const STATUS_COLORS = {
  פתוחה: "bg-green-100 text-green-700",
  "בטיפול": "bg-yellow-100 text-yellow-700",
  סגורה: "bg-gray-100 text-gray-500",
};

export default function CandidateTasksDialog({ open, onClose, candidate, match }) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showCreateTask, setShowCreateTask] = useState(false);

  useEffect(() => {
    if (open && candidate?.id) {
      loadTasks();
    }
  }, [open, candidate?.id]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Get all tasks and filter by candidate_id - no additional filter
      const allTasks = await base44.entities.UserTask.list('-opened_at');
      const filtered = allTasks.filter(t => t.candidate_id === candidate.id);
      setTasks(filtered);
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
      toast.error("שגיאה בעדכון הסטטוס");
    }
    setUpdatingId(null);
  };

  const handleCompleted = async (taskId, completed) => {
    setUpdatingId(taskId);
    try {
      const newStatus = completed ? "סגורה" : "פתוחה";
      await base44.entities.UserTask.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success(completed ? "משימה סומנה כבוצעה" : "משימה סומנה כפתוחה");
    } catch (e) {
      toast.error("שגיאה בעדכון הסטטוס");
    }
    setUpdatingId(null);
  };

  const formatDate = (d) => formatDateTimeIL(d) || d;
  const formatDue = (d) => formatDateIL(d) || d;

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              משימות – {candidate?.full_name || candidate?.candidate_name || ""}
            </DialogTitle>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 gap-1.5 ml-4"
              onClick={() => setShowCreateTask(true)}
            >
              <Plus className="w-4 h-4" />
              משימה חדשה
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>אין משימות פתוחות למועמד זה</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`border rounded-lg p-4 cursor-pointer hover:border-blue-300 transition-colors ${task.status === "סגורה" ? "opacity-60 bg-gray-50" : "bg-white"}`}
                onClick={() => setEditingTask(task)}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={task.status === "סגורה"}
                      onCheckedChange={(checked) => handleCompleted(task.id, checked)}
                      disabled={updatingId === task.id}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{task.task_name}</span>
                      <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] || "bg-gray-100 text-gray-600"}`}>
                        <AlertTriangle className="w-3 h-3 ml-1" />
                        {task.priority}
                      </Badge>
                      <Badge className={`text-xs ${STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600"}`}>
                        {task.status}
                      </Badge>
                    </div>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{task.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        נפתח: {formatDate(task.opened_at)}
                      </span>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 font-medium ${new Date(task.due_date) < new Date() && task.status !== "סגורה" ? "text-red-600" : ""}`}>
                          <Calendar className="w-3 h-3" />
                          יעד: {formatDue(task.due_date)}
                          {new Date(task.due_date) < new Date() && task.status !== "סגורה" && " (באיחור!)"}
                        </span>
                      )}
                      {task.job_title && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {task.job_title}
                        </span>
                      )}
                      {task.candidate_status_at_open && (
                        <span>מצב בפתיחה: {task.candidate_status_at_open}</span>
                      )}
                      {task.opened_by_user_name && (
                        <span>נפתח ע"י: {task.opened_by_user_name}</span>
                      )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    {updatingId === task.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <Select value={task.status} onValueChange={v => { v !== undefined && handleStatusChange(task.id, v); }} onClick={e => e.stopPropagation()}>
                        <SelectTrigger className="w-28 h-8 text-xs" onClick={e => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="פתוחה">פתוחה</SelectItem>
                          <SelectItem value="בטיפול">בטיפול</SelectItem>
                          <SelectItem value="סגורה">סגורה</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={e => { e.stopPropagation(); setEditingTask(task); }} title="ערוך משימה">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t mt-3">
          <Button variant="outline" onClick={onClose}>סגור</Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Edit Task Dialog */}
    {editingTask && (
      <CreateTaskDialog
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        candidate={candidate}
        match={match || null}
        task={editingTask}
        onTaskCreated={() => {
          setEditingTask(null);
          loadTasks();
          toast.success("המשימה עודכנה");
        }}
      />
    )}

    {/* Create Task Dialog */}
    {showCreateTask && (
      <CreateTaskDialog
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        candidate={candidate}
        match={match || null}
        onTaskCreated={() => {
          setShowCreateTask(false);
          loadTasks();
        }}
      />
    )}
    </>
  );
}