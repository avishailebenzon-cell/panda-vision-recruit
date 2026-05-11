import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, X, Loader2, Phone, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import WhatsappConversationDialog from "@/components/rotem/WhatsappConversationDialog";

export default function CandidateAlertsPanel() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Get active rotem tasks (reduced limit to avoid rate limit)
      const allTasks = await base44.entities.RotemTask.list('-created_date', 100);
      const activeTasks = allTasks.filter(t =>
        t.status !== 'הסתיים' &&
        t.status !== 'הסתיים מוצלח' &&
        t.status !== 'לא ליצור קשר' &&
        t.status !== 'מועמד לא עונה' &&
        t.status !== 'התערבות- לא להתקשר'
      );

      const activeTaskIds = new Set(activeTasks.map(t => t.id));

      // Get recent incoming messages (last 24 hours)
      const recentMessages = await base44.entities.WhatsappMessage.filter(
        { direction: 'incoming' },
        '-created_date',
        300
      );

      const newMessages = recentMessages.filter(m =>
        new Date(m.created_date) > new Date(oneDayAgo)
      );

      // Group by conversation_id
      const messagesByTask = {};
      newMessages.forEach(msg => {
        const taskId = msg.conversation_id;
        if (!taskId || !activeTaskIds.has(taskId)) return;
        if (!messagesByTask[taskId]) messagesByTask[taskId] = [];
        messagesByTask[taskId].push(msg);
      });

      // Build alerts
      const newAlerts = [];
      activeTasks.forEach(task => {
        const taskMessages = messagesByTask[task.id];
        if (taskMessages && taskMessages.length > 0) {
          const latestMsg = [...taskMessages].sort(
            (a, b) => new Date(b.created_date) - new Date(a.created_date)
          )[0];
          newAlerts.push({ task, lastMessage: latestMsg, messageCount: taskMessages.length });
        }
      });

      newAlerts.sort((a, b) =>
        new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date)
      );

      setAlerts(newAlerts);
    } catch (e) {
      console.error("Error loading candidate alerts", e);
    }
    setLoading(false);
  };

  const alertCount = alerts.reduce((sum, a) => sum + a.messageCount, 0);

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative gap-1.5 text-gray-600 hover:text-gray-900"
        onClick={() => { setOpen(prev => !prev); if (!open) loadAlerts(); }}
        title="התראות מועמדים"
      >
        <div className="relative">
          <MessageCircle className="w-5 h-5" />
          {alertCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white bg-green-500 animate-pulse">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </div>
        <span className="text-xs hidden sm:inline">התראות מועמדים</span>
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <span className="font-bold text-gray-800">התראות מועמדים - טל</span>
              {alertCount > 0 && (
                <Badge className="bg-green-600 text-white text-xs px-1.5">{alertCount}</Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">אין הודעות חדשות ממועמדים</p>
              <p className="text-xs mt-1">הודעות נכנסות מהיום יופיעו כאן</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="divide-y">
                {alerts.map(({ task, lastMessage, messageCount }) => (
                  <div
                    key={task.id}
                    onClick={() => { setSelectedTask(task); setOpen(false); }}
                    className="px-4 py-3 hover:bg-green-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="font-semibold text-sm text-gray-900">{task.candidate_name}</span>
                          {messageCount > 1 && (
                            <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">
                              {messageCount} הודעות
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <Briefcase className="w-3 h-3" />
                          <span className="truncate">{task.job_title}</span>
                        </div>
                        <div className="text-xs text-gray-700 bg-green-50 border border-green-100 px-2 py-1 rounded truncate">
                          💬 {lastMessage.content}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          {new Date(lastMessage.created_date).toLocaleString('he-IL', {
                            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
                          })}
                        </div>
                      </div>
                      <Phone className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Conversation Dialog */}
      {selectedTask && (
        <WhatsappConversationDialog
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          onMessageSent={loadAlerts}
        />
      )}
    </div>
  );
}