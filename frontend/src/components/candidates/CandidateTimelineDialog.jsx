import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, UserPlus, Briefcase, Tag, Edit3, StickyNote, Trash2, RefreshCw, X, Clock, Star, ClipboardList, Pencil, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

const EVENT_TYPES = {
  level1_classification: {
    label: "זיהוי רמה 1",
    icon: Star,
    dotColor: "bg-emerald-500",
    cardClass: "bg-emerald-50 border-emerald-200 text-emerald-900",
  },
  candidate_created: {
    label: "קליטת מועמד במערכת",
    icon: UserPlus,
    dotColor: "bg-green-500",
    cardClass: "bg-green-50 border-green-200 text-green-900",
  },
  match_created: {
    label: "שיוך למשרה",
    icon: Briefcase,
    dotColor: "bg-blue-500",
    cardClass: "bg-blue-50 border-blue-200 text-blue-900",
  },
  auto_recommendation: {
    label: "המלצה אוטומטית",
    icon: Star,
    dotColor: "bg-indigo-500",
    cardClass: "bg-indigo-50 border-indigo-200 text-indigo-900",
  },
  status_changed: {
    label: "שינוי מצב",
    icon: Tag,
    dotColor: "bg-purple-500",
    cardClass: "bg-purple-50 border-purple-200 text-purple-900",
  },
  note_added: {
    label: "הערה",
    icon: StickyNote,
    dotColor: "bg-yellow-500",
    cardClass: "bg-yellow-50 border-yellow-200 text-yellow-900",
  },
  match_removed: {
    label: "הסרה מהתאמה",
    icon: X,
    dotColor: "bg-orange-500",
    cardClass: "bg-orange-50 border-orange-200 text-orange-900",
  },
  candidate_rejected: {
    label: "הסרה מכל ההתאמות",
    icon: Trash2,
    dotColor: "bg-red-500",
    cardClass: "bg-red-50 border-red-200 text-red-900",
  },
  cv_updated: {
    label: "עדכון קורות חיים",
    icon: RefreshCw,
    dotColor: "bg-teal-500",
    cardClass: "bg-teal-50 border-teal-200 text-teal-900",
  },
  field_updated: {
    label: "עדכון שדה",
    icon: Edit3,
    dotColor: "bg-gray-400",
    cardClass: "bg-gray-50 border-gray-200 text-gray-800",
  },
  task_open: {
    label: "משימה נפתחה",
    icon: ClipboardList,
    dotColor: "bg-blue-600",
    cardClass: "bg-blue-50 border-blue-200 text-blue-900",
  },
  task_completed: {
    label: "משימה הושלמה",
    icon: ClipboardList,
    dotColor: "bg-green-600",
    cardClass: "bg-green-50 border-green-200 text-green-900",
  },
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function formatTs(ts) {
  if (!ts) return "תאריך לא ידוע";
  try {
    return format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: he });
  } catch {
    return String(ts);
  }
}

function TimelineEvent({ event, isLast, onUpdate }) {
  const config = EVENT_TYPES[event.type] || EVENT_TYPES.field_updated;
  const Icon = config.icon;
  const [editing, setEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(event.description || "");
  const [editedTaskName, setEditedTaskName] = useState(event.taskName || "");
  const [editedStatus, setEditedStatus] = useState(event.taskStatus || "");
  const [saving, setSaving] = useState(false);

  const canEdit = (event.type === "note_added" || event.type === "task_open" || event.type === "task_completed") && event.entityId;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (event.type === "note_added") {
        await base44.entities.MatchNote.update(event.entityId, {
          note_text: editedDescription,
          updated_by: (await base44.auth.me()).full_name,
          updated_date: new Date().toISOString()
        });
        toast.success("ההערה עודכנה בהצלחה");
      } else if (event.type === "task_open" || event.type === "task_completed") {
        await base44.entities.UserTask.update(event.entityId, {
          task_name: editedTaskName,
          description: editedDescription,
          status: editedStatus,
          updated_by: (await base44.auth.me()).full_name
        });
        toast.success("המשימה עודכנה בהצלחה");
      }
      setEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("שגיאה בשמירה");
    }
    setSaving(false);
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow ${config.dotColor}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {!isLast && <div className="w-0.5 bg-gray-200 flex-1 my-1 min-h-[16px]" />}
      </div>
      <div className={`mb-4 flex-1 border rounded-lg p-3 text-sm ${config.cardClass}`}>
        <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
          <span className="font-semibold">{config.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-60 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTs(event.timestamp)}
            </span>
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="ערוך"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        
        {editing ? (
          <div className="space-y-2 mt-2">
            {(event.type === "task_open" || event.type === "task_completed") && (
              <>
                <Input
                  value={editedTaskName}
                  onChange={(e) => setEditedTaskName(e.target.value)}
                  placeholder="שם המשימה"
                  className="text-xs"
                />
                <select
                  value={editedStatus}
                  onChange={(e) => setEditedStatus(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-xs"
                >
                  <option value="פתוחה">פתוחה</option>
                  <option value="סגורה">סגורה</option>
                </select>
              </>
            )}
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={3}
              className="text-xs resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setEditedDescription(event.description);
                  setEditedTaskName(event.taskName || "");
                  setEditedStatus(event.taskStatus || "");
                }}
                disabled={saving}
              >
                ביטול
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Check className="w-3 h-3 ml-1" />}
                שמור
              </Button>
            </div>
          </div>
        ) : (
          <>
            {event.taskName && <div className="font-medium text-xs mb-1">{event.taskName}</div>}
            <div className="text-xs opacity-80 leading-relaxed whitespace-pre-wrap">{event.description}</div>
          </>
        )}
        
        {event.actor && (
          <div className="mt-1 text-xs opacity-50">בוצע על ידי: {event.actor}</div>
        )}
        
        {event.updatedDate && event.updatedBy && (
          <div className="mt-1 text-xs opacity-40 italic">
            נוצר ב-{formatTs(event.timestamp)} • נערך ב-{formatTs(event.updatedDate)} על ידי {event.updatedBy}
          </div>
        )}
      </div>
    </div>
  );
}

const ALL_FILTER_TYPES = [
  { key: "level1_classification", label: "זיהוי רמה 1" },
  { key: "candidate_created", label: "קליטה" },
  { key: "match_created", label: "שיוך למשרה" },
  { key: "auto_recommendation", label: "המלצה אוטומטית" },
  { key: "status_changed", label: "שינוי מצב" },
  { key: "note_added", label: "הערות" },
  { key: "match_removed", label: "הסרה מהתאמה" },
  { key: "cv_updated", label: "עדכון קו\"ח" },
  { key: "field_updated", label: "עדכונים נוספים" },
  { key: "task_open", label: "משימות" },
  { key: "task_completed", label: "משימות שהושלמו" },
];

export default function CandidateTimelineDialog({ candidate, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [activeFilters, setActiveFilters] = useState(new Set());

  useEffect(() => {
    if (open && candidate?.id) {
      setActiveFilters(new Set());
      loadTimeline();
    }
    if (!open) {
      setEvents([]);
    }
  }, [open, candidate?.id]);

  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleEvents = activeFilters.size === 0
    ? events
    : events.filter((e) => activeFilters.has(e.type));

  const loadTimeline = async () => {
    setLoading(true);
    const allEvents = [];

    // --- Always add candidate creation first (no API call needed) ---
    const candName = candidate.full_name || `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || candidate.candidate_name || "לא ידוע";
    allEvents.push({
      type: "candidate_created",
      timestamp: candidate.created_date,
      description: `המועמד ${candName} נקלט למערכת${candidate.source_email_subject ? ` ממייל: "${candidate.source_email_subject}"` : ""}`,
      actor: candidate.created_by || "מערכת",
    });

    // Level 1 classification (if detected)
    if (candidate.overall_seniority_level === "Expert" || candidate.main_discipline === "תוכנה" && candidate.years_experience >= 5) {
      allEvents.push({
        type: "level1_classification",
        timestamp: candidate.cv_enhancement_date || candidate.cv_received_date || candidate.created_date,
        description: `המערכת זיהתה את המועמד כרמה 1 בהתחום "${candidate.main_discipline || "טכנולוגיה"}" בעלת ניסיון של ${candidate.years_experience || "מספר"} שנים`,
        actor: "מערכת - AI",
      });
    }

    // CV received from email scan
    if (candidate.cv_received_date) {
      allEvents.push({
        type: "cv_updated",
        timestamp: candidate.cv_received_date,
        description: `קורות חיים התקבלו בסריקת מיילים${candidate.source_email_subject ? `: "${candidate.source_email_subject}"` : ""}`,
        actor: "מערכת - סריקת מיילים",
      });
    }

    // CV enhancement
    if (candidate.cv_enhancement_date) {
      allEvents.push({
        type: "cv_updated",
        timestamp: candidate.cv_enhancement_date,
        description: `קורות החיים עובדו ועודכנו על ידי AI (גרסה ${candidate.cv_enhancement_version || 1})`,
        actor: "מערכת - עיבוד AI",
      });
    }

    // Onboarding form
    if (candidate.onboarding_form_completed && candidate.onboarding_form_date) {
      allEvents.push({
        type: "field_updated",
        timestamp: candidate.onboarding_form_date,
        description: "טופס קליטה הושלם על ידי המועמד",
        actor: candName,
      });
    }

    // Show immediately with what we have
    setEvents(sortEvents([...allEvents]));
    setLoading(false);

    // --- Load matches (with rate-limit-safe sequential fetching) ---
    try {
      await delay(300);
      const matches = await base44.entities.Match.filter({ candidate_id: candidate.id });

      for (const match of matches) {
        // Match created (manual or auto recommendation)
        if (match.is_automatic_recommendation) {
          allEvents.push({
            type: "auto_recommendation",
            timestamp: match.created_date,
            description: `המלצה אוטומטית למשרה: ${match.job_title || match.job_id}${match.match_score != null ? ` (ציון: ${match.match_score}%)` : ""}`,
            actor: "סוכן AI",
          });
        } else {
          allEvents.push({
            type: "match_created",
            timestamp: match.created_date,
            description: `שויך למשרה: ${match.job_title || match.job_id}`,
            actor: match.user_name || "סוכן AI",
          });
        }

        // Status change (if the match has a status that was set after creation)
        if (match.status && match.updated_date && match.updated_date !== match.created_date) {
          allEvents.push({
            type: "status_changed",
            timestamp: match.updated_date,
            description: `מצב בהתאמה "${match.job_title || match.job_id}" שונה ל: ${match.status}`,
            actor: match.user_name || "מערכת",
          });
        }

        // Match rejected/removed
        if (match.is_rejected_feedback) {
          allEvents.push({
            type: "match_removed",
            timestamp: match.updated_date || match.created_date,
            description: `הוסר מהתאמה למשרה: ${match.job_title || match.job_id}${match.rejection_reason ? ` – ${match.rejection_reason}` : ""}`,
            actor: match.user_name || "משתמש",
          });
        }
      }

      setEvents(sortEvents([...allEvents]));

      // --- Load notes for matches (sequential, avoid rate limit) ---
      // Load notes for ALL matches, not just first 8
      for (let i = 0; i < matches.length; i++) {
        await delay(150);
        try {
          const notes = await base44.entities.MatchNote.filter({ match_id: matches[i].id });
          for (const note of (notes || [])) {
            allEvents.push({
              type: "note_added",
              timestamp: note.created_date,
              description: note.note_text,
              actor: note.user_name || "משתמש",
              entityId: note.id,
              updatedDate: note.updated_date,
              updatedBy: note.updated_by,
            });
          }
        } catch (e) {
          console.warn(`Failed to load notes for match ${matches[i].id}:`, e.message);
        }
      }

      setEvents(sortEvents([...allEvents]));

      // --- Load Rotem tasks ---
      await delay(300);
      try {
        const rotemTasks = await base44.entities.RotemTask.filter({ candidate_id: candidate.id });
        for (const task of (rotemTasks || [])) {
          if (task.status === "completed" || task.status === "sent" || task.status === "approved") {
            allEvents.push({
              type: "field_updated",
              timestamp: task.updated_date || task.created_date,
              description: `פנייה למועמד בוצעה (${task.message_type || "WhatsApp"})${task.job_title ? ` לגבי משרה: ${task.job_title}` : ""}`,
              actor: "טל - קשרי מועמדים",
            });
          }
        }
        setEvents(sortEvents([...allEvents]));
      } catch (e) { /* skip */ }

      // --- Load UserTasks ---
      await delay(300);
      try {
        const userTasks = await base44.entities.UserTask.filter({ candidate_id: candidate.id });
        for (const task of (userTasks || [])) {
          const priorityLabel = task.priority ? ` (עדיפות: ${task.priority})` : "";
          const jobLabel = task.job_title ? ` | משרה: ${task.job_title}` : "";
          // Task opened event
          allEvents.push({
            type: "task_open",
            timestamp: task.opened_at || task.created_date,
            description: task.description || "",
            taskName: task.task_name,
            taskStatus: task.status,
            actor: task.opened_by_user_name || task.created_by || "משתמש",
            entityId: task.id,
            updatedDate: task.updated_date !== task.created_date ? task.updated_date : null,
            updatedBy: task.updated_by,
          });
          // Task completed event
          if (task.status === "סגורה") {
            allEvents.push({
              type: "task_completed",
              timestamp: task.updated_date,
              description: task.description || "",
              taskName: task.task_name,
              taskStatus: task.status,
              actor: task.assigned_to_user_name || task.opened_by_user_name || "משתמש",
              entityId: task.id,
              updatedDate: task.updated_date !== task.created_date ? task.updated_date : null,
              updatedBy: task.updated_by,
            });
          }
        }
        setEvents(sortEvents([...allEvents]));
      } catch (e) {
        console.warn("Failed to load UserTasks:", e.message);
      }

    } catch (e) {
      console.warn("Timeline: some data could not be loaded", e?.message);
    }
  };

  const sortEvents = (arr) =>
    [...arr].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  const candName = candidate
    ? (candidate.full_name || `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || candidate.candidate_name || "לא ידוע")
    : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="w-5 h-5 text-blue-600" />
            ציר זמן – {candName}
          </DialogTitle>
        </DialogHeader>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 pb-2 border-b">
          {ALL_FILTER_TYPES.map((ft) => {
            const count = events.filter((e) => e.type === ft.key).length;
            if (count === 0) return null;
            const active = activeFilters.has(ft.key);
            return (
              <button
                key={ft.key}
                onClick={() => toggleFilter(ft.key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {ft.label} ({count})
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <>
              <button
                onClick={() => setActiveFilters(new Set())}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-400 transition-all"
              >
                נקה סינון
              </button>
              <button
                onClick={() => setActiveFilters(new Set(ALL_FILTER_TYPES.map(ft => ft.key)))}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all"
              >
                הצג הכול
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="py-4 pl-1">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{visibleEvents.length} אירועים</Badge>
                {activeFilters.size > 0 && (
                  <span className="text-xs text-blue-600">מסונן מתוך {events.length}</span>
                )}
                <span className="text-xs text-gray-400">מסודר מהחדש לישן</span>
              </div>
              {visibleEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-3" />
                  <p>לא נמצאו אירועים בסינון הנוכחי</p>
                </div>
              ) : (
                visibleEvents.map((event, idx) => (
                  <TimelineEvent key={idx} event={event} isLast={idx === visibleEvents.length - 1} onUpdate={loadTimeline} />
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}