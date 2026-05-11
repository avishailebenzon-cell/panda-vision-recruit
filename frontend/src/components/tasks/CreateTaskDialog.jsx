import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ClipboardList, Calendar, AlertTriangle, CheckSquare, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function CreateTaskDialog({ open, onClose, candidate, match, onTaskCreated, agentName = "user", task = null }) {
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    task_name: "",
    candidate_status_at_open: "",
    description: "",
    due_date: "",
    due_time: "",
    job_id: match?.job_id || "",
    job_title: match?.job_title || "",
    priority: "בינוני",
    assigned_to_user_id: "",
    assigned_to_user_name: "",
    completed: false,
  });

  useEffect(() => {
    if (open) {
      loadData();
      if (task) {
        // Extract date and time from task.due_date if it contains time
        let dateValue = "";
        let timeValue = "";
        if (task.due_date) {
          try {
            const dateObj = new Date(task.due_date);
            dateValue = dateObj.toISOString().split('T')[0];
            if (task.due_date.includes('T') || task.due_date.includes(':')) {
              timeValue = String(dateObj.getHours()).padStart(2, '0') + ':00';
            }
          } catch {
            dateValue = task.due_date.split('T')[0] || task.due_date;
          }
        }
        
        setForm({
          task_name: task.task_name || "",
          description: task.description || "",
          due_date: dateValue,
          due_time: timeValue || task.due_time || "",
          job_id: task.job_id || "",
          job_title: task.job_title || "",
          priority: task.priority || "בינוני",
          candidate_status_at_open: task.candidate_status_at_open || "",
          assigned_to_user_id: task.assigned_to_user_id || "",
          assigned_to_user_name: task.assigned_to_user_name || "",
          completed: task.status === "סגורה",
        });
      } else {
        setForm(prev => ({
          ...prev,
          job_id: match?.job_id || "",
          job_title: match?.job_title || "",
          task_name: "",
          description: "",
          due_date: "",
          due_time: "",
          priority: "בינוני",
          candidate_status_at_open: candidate?.status || "",
          assigned_to_user_id: "",
          assigned_to_user_name: "",
        }));
      }
    }
  }, [open, candidate, match, task]);

  const loadData = async () => {
    try {
      const [statusList, currentUser, userList] = await Promise.all([
        base44.entities.CandidateStatus.list(),
        base44.auth.me(),
        base44.entities.User.list(),
      ]);
      setStatuses(statusList.filter(s => s.is_active !== false));
      setUser(currentUser);
      setUsers(userList);

      // Load candidate's current status if not from match
      if (candidate?.id && !candidate?.status) {
        const cand = await base44.entities.Candidate.filter({ id: candidate.id });
        if (cand?.length > 0) {
          setForm(prev => ({ ...prev, candidate_status_at_open: cand[0].status || "" }));
        }
      }

      // Always load jobs for selection
      const jobList = await base44.entities.Job.filter({ status: "פעילה" });
      setJobs(jobList);
    } catch (e) {
      console.error("CreateTaskDialog loadData error", e);
    }
  };

  const handleJobChange = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setForm(prev => ({ ...prev, job_id: jobId, job_title: job?.title || "" }));
  };

  const handleAssignedUserChange = (userId) => {
    const u = users.find(u => u.id === userId);
    setForm(prev => ({ ...prev, assigned_to_user_id: userId, assigned_to_user_name: u?.full_name || u?.email || "" }));
  };

  const handleSave = async () => {
    if (!form.task_name.trim()) {
      toast.error("יש להזין שם משימה");
      return;
    }
    setSaving(true);
    try {
      if (task) {
        // Combine date and time into a single due_date value
        let finalDueDate = null;
        if (form.due_date) {
          if (form.due_time) {
            finalDueDate = `${form.due_date}T${form.due_time}:00`;
          } else {
            finalDueDate = form.due_date;
          }
        }
        
        await base44.entities.UserTask.update(task.id, {
          task_name: form.task_name.trim(),
          description: form.description,
          due_date: finalDueDate,
          assigned_to_user_id: form.assigned_to_user_id || null,
          assigned_to_user_name: form.assigned_to_user_name || null,
          candidate_status_at_open: form.candidate_status_at_open,
          priority: form.priority,
          status: form.completed ? "סגורה" : "פתוחה",
          job_id: form.job_id || null,
          job_title: form.job_title || null,
          updated_by: user?.full_name || user?.email || ""
        });
        toast.success("המשימה עודכנה בהצלחה");
      } else {
        const now = new Date().toISOString();
        
        // Combine date and time into a single due_date value
        let finalDueDate = null;
        if (form.due_date) {
          if (form.due_time) {
            finalDueDate = `${form.due_date}T${form.due_time}:00`;
          } else {
            finalDueDate = form.due_date;
          }
        }
        
        const newTask = await base44.entities.UserTask.create({
          task_name: form.task_name.trim(),
          candidate_id: candidate.id,
          candidate_name: candidate.full_name || `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || candidate.candidate_name || "",
          opened_by_user_id: user?.id || "",
          opened_by_user_name: user?.full_name || user?.email || "",
          assigned_to_user_id: form.assigned_to_user_id || null,
          assigned_to_user_name: form.assigned_to_user_name || null,
          opened_at: now,
          candidate_status_at_open: form.candidate_status_at_open,
          description: form.description,
          due_date: finalDueDate,
          due_time_alerted: false,
          job_id: form.job_id || null,
          job_title: form.job_title || null,
          priority: form.priority,
          status: form.completed ? "סגורה" : "פתוחה",
          match_id: match?.id || null,
        });
        
        console.log('Task created successfully:', newTask);
        
        // Create Pipedrive activity if task is related to a match
        if (match?.id) {
          try {
            await base44.functions.invoke('createPipedriveActivityFromTask', { task_id: newTask.id });
            console.log('Pipedrive activity created');
          } catch (pipedriveError) {
            console.warn('Failed to create Pipedrive activity:', pipedriveError);
            // Don't fail the task creation if Pipedrive sync fails
          }
        }
        
        toast.success("המשימה נוצרה בהצלחה");
      }
      onTaskCreated?.();
      onClose();
    } catch (e) {
      console.error('Error saving task:', e);
      toast.error(`שגיאה בשמירת המשימה: ${e.message || 'שגיאה לא ידועה'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await base44.entities.MatchNote.create({
        match_id: match?.id || null,
        candidate_id: candidate?.id || task?.candidate_id || null,
        user_id: user?.id || "",
        user_name: user?.full_name || user?.email || "",
        note_text: noteText.trim(),
        is_system_note: false,
      });
      toast.success("ההערה נשמרה בהצלחה");
      setNoteText("");
      setShowNote(false);
    } catch (e) {
      toast.error("שגיאה בשמירת ההערה");
    } finally {
      setSavingNote(false);
    }
  };

  const priorityColors = { נמוך: "bg-blue-100 text-blue-700", בינוני: "bg-yellow-100 text-yellow-700", גבוה: "bg-red-100 text-red-700" };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            {task ? "עדכון משימה" : "יצירת משימה"}
            {agentName && <span className="text-sm text-gray-600 mr-2">({agentName})</span>}
            – {candidate?.full_name || candidate?.candidate_name || task?.candidate_name || ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task name */}
          <div>
            <Label className="mb-1 block">שם המשימה *</Label>
            <Input
              placeholder="שם המשימה"
              value={form.task_name}
              onChange={e => setForm(p => ({ ...p, task_name: e.target.value }))}
            />
          </div>

          {/* Opened at - readonly */}
          <div>
            <Label className="mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              תאריך פתיחה
            </Label>
            <Input
              value={format(new Date(), "dd/MM/yyyy HH:mm")}
              readOnly
              className="bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Opened by - readonly auto */}
          <div>
            <Label className="mb-1 block">נפתח ע"י</Label>
            <Input
              value={user?.full_name || user?.email || "טוען..."}
              readOnly
              className="bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Assigned to */}
          <div>
            <Label className="mb-1 block">לביצוע ע"י (אחראי)</Label>
            <Select value={form.assigned_to_user_id} onValueChange={handleAssignedUserChange}>
              <SelectTrigger>
                <SelectValue placeholder="בחר משתמש..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>לא שויך</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Candidate status at open */}
          <div>
            <Label className="mb-1 block">מצב מועמד בפתיחת המשימה</Label>
            <Select value={form.candidate_status_at_open} onValueChange={v => setForm(p => ({ ...p, candidate_status_at_open: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="בחר מצב..." />
              </SelectTrigger>
              <SelectContent>
                {statuses.map(s => (
                  <SelectItem key={s.id} value={s.status_name}>{s.status_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label className="mb-1 block">פירוט המשימה</Label>
            <Textarea
              placeholder="פירוט..."
              rows={4}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          {/* Due date + time */}
          <div>
            <Label className="mb-1 block">תאריך ושעת יעד לסגירה</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                className="flex-1"
                value={form.due_date}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
              />
              <div className="w-32">
                <select
                  value={form.due_time}
                  onChange={e => setForm(p => ({ ...p, due_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">בחר שעה</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = String(i).padStart(2, '0');
                    return (
                      <option key={hour} value={`${hour}:00`}>
                        {hour}:00
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Job - always editable */}
          <div>
            <Label className="mb-1 block">משרה משויכת</Label>
            <Select value={form.job_id} onValueChange={handleJobChange}>
              <SelectTrigger>
                <SelectValue placeholder="בחר משרה (לא חובה)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>ללא משרה</SelectItem>
                {jobs.map(j => (
                  <SelectItem key={j.id} value={j.id}>{j.title} {j.job_code ? `(${j.job_code})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <Checkbox
              id="completed"
              checked={form.completed || false}
              onCheckedChange={(checked) => setForm(p => ({ ...p, completed: !!checked, status: checked ? "סגורה" : "פתוחה" }))}
            />
            <Label htmlFor="completed" className="cursor-pointer flex items-center gap-2 text-sm font-medium text-green-800">
              <CheckSquare className="w-4 h-4 text-green-600" />
              המשימה בוצעה
            </Label>
          </div>

          {/* Priority */}
          <div>
            <Label className="mb-1 block flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              רמת דחיפות
            </Label>
            <div className="flex gap-2">
              {["נמוך", "בינוני", "גבוה"].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.priority === p
                      ? priorityColors[p] + " border-current"
                      : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Note on candidate */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowNote(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-yellow-50 hover:bg-yellow-100 transition-colors text-yellow-800 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                הוסף הערה על המועמד
              </span>
              {showNote ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showNote && (
              <div className="p-3 space-y-2 bg-yellow-50/50">
                <Textarea
                  placeholder="כתוב הערה על המועמד..."
                  rows={3}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteText.trim()}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  {savingNote ? "שומר..." : "שמור הערה"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? "שומר..." : task ? "עדכן משימה" : "צור משימה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}