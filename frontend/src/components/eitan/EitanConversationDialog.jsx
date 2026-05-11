import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageCircle, 
  Loader2,
  UserCog
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from 'react-markdown';

export default function EitanConversationDialog({ 
  isOpen, 
  onClose, 
  task,
  onSuccess
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingHandoff, setRequestingHandoff] = useState(false);

  useEffect(() => {
    if (isOpen && task?.agent_conversation_id) {
      loadConversation();
      
      // Subscribe to conversation updates
      const unsubscribe = base44.agents.subscribeToConversation(
        task.agent_conversation_id, 
        (data) => {
          setMessages(data.messages || []);
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, task]);

  const loadConversation = async () => {
    setLoading(true);
    try {
      const conversation = await base44.agents.getConversation(task.agent_conversation_id);
      setMessages(conversation.messages || []);
    } catch (err) {
      console.error("Error loading conversation:", err);
      toast.error("שגיאה בטעינת השיחה");
    }
    setLoading(false);
  };

  const handleRequestHandoff = async () => {
    setRequestingHandoff(true);
    try {
      // Get the conversation
      const conversation = await base44.agents.getConversation(task.agent_conversation_id);
      
      // Send handoff message
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: '[HANDOFF_REQUESTED]'
      });

      // Update task status
      await base44.entities.EitanTask.update(task.id, {
        status: 'הועבר לסוכן אנושי',
        notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] הועבר לסוכן אנושי`
      });

      toast.success("השיחה הועברה לסוכן אנושי");
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error requesting handoff:", err);
      toast.error("שגיאה בהעברה לסוכן אנושי");
    }
    setRequestingHandoff(false);
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <img 
                src="https://images.unsplash.com/photo-507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face" 
                alt="איתן" 
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-200"
              />
              <div>
                <span>שיחה עם איתן - {task.client_contact_name}</span>
                <p className="text-sm font-normal text-gray-500">בדיקת איכות שירות</p>
              </div>
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestHandoff}
              disabled={requestingHandoff || task.status === 'הועבר לסוכן אנושי'}
              className="gap-2"
            >
              {requestingHandoff ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCog className="w-4 h-4" />
              )}
              העבר לסוכן אנושי
            </Button>
          </div>
        </DialogHeader>

        {/* Task Info Bar */}
        <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
          <div><strong>עובד:</strong> {task.employee_name}</div>
          <div><strong>לקוח:</strong> {task.client_name}</div>
          <div><strong>איש קשר:</strong> {task.client_contact_name}</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] max-h-[400px] p-4 bg-gray-50 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>טרם החלה שיחה</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-white border border-gray-200'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none">
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {task.status === 'הועבר לסוכן אנושי' && (
          <Alert className="bg-orange-50 border-orange-200">
            <UserCog className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-800 text-sm">
              השיחה הועברה לטיפול סוכן אנושי. ניתן לצפות בהיסטוריית השיחה בלבד.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}