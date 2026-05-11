import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import TaskCompletedActionDialog from "./TaskCompletedActionDialog";

export default function TaskEditDialog({ task, open, onClose, onTaskUpdated, onAddNote, onCreateNewTask }) {
  const [form, setForm] = useState(task || {});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [showCompletedDialog, setShowCompletedDialog] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(null);

  useEffect(() => {
    if (open && task) {
      setForm(task);
      setPreviousStatus(task.status);
      loadUsers();
    }
  }, [open, task]);

  const loadUsers = async () => {
    try {
      const userList = await base44.entities.User.list();
      setUsers(userList);
    } catch (e) {
      console.error("Error loading users", e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if task was marked as completed
      const wasCompleted = previousStatus !== 'סגורה' && form.status === 'סגורה';
      
      await base44.entities.UserTask.update(task.id, {
        task_name: form.task_name,
        description: form.description,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        assigned_to_user_id: form.assigned_to_user_id || null,
        assigned_to_user_name: form.assigned_to_user_name || null,
      });
      
      toast.success("המשימה עודכנה בהצלחה");
      onTaskUpdated?.();
      onClose();
      
      // Show next action dialog if task was completed
      if (wasCompleted) {
        setShowCompletedDialog(true);
      }
    } catch (e) {
      toast.error("שגיאה בעדכון המשימה");
    }
    setSaving(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            עריכת משימה – {form.candidate_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">שם המשימה</Label>
            <Input
              value={form.task_name || ""}
              onChange={(e) => setForm({ ...form, task_name: e.target.value })}
            />
          </div>

          <div>
            <Label className="mb-1 block">תיאור</Label>
            <Textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">דחיפות</Label>
              <Select value={form.priority} onValueChange={(val) => setForm({ ...form, priority: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="נמוך">נמוך</SelectItem>
                  <SelectItem value="בינוני">בינוני</SelectItem>
                  <SelectItem value="גבוה">גבוה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block">סטטוס</Label>
              <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="פתוחה">פתוחה</SelectItem>
                  <SelectItem value="בטיפול">בטיפול</SelectItem>
                  <SelectItem value="סגורה">סגורה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">תאריך יעד</Label>
              <Input
                type="date"
                value={form.due_date || ""}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>

            <div>
              <Label className="mb-1 block">אחראי</Label>
              <Select value={form.assigned_to_user_id || ""} onValueChange={(val) => {
                const u = users.find(user => user.id === val);
                setForm({ ...form, assigned_to_user_id: val, assigned_to_user_name: u?.full_name || u?.email || "" });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר משתמש" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>לא שויך</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? "מעדכן..." : "עדכן משימה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TaskCompletedActionDialog
      open={showCompletedDialog}
      onClose={() => setShowCompletedDialog(false)}
      onAddNote={() => onAddNote?.(task)}
      onCreateTask={() => onCreateNewTask?.(task)}
      candidateName={task?.candidate_name}
    />
    </>
  );
}