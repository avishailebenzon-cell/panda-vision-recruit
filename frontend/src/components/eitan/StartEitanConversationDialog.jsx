import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageCircle, 
  Send, 
  Loader2,
  User,
  Building,
  Phone,
  CheckCircle,
  AlertCircle,
  Edit2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function StartEitanConversationDialog({ 
  isOpen, 
  onClose, 
  task,
  onSuccess
}) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');
  const [conversationStarted, setConversationStarted] = useState(false);
  const [error, setError] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isOpen && task) {
      buildInitialMessage();
    } else {
      // Reset on close
      setInitialMessage('');
      setConversationStarted(false);
      setError('');
      setManualPhone('');
      setShowPhoneInput(false);
    }
  }, [isOpen, task]);

  const buildInitialMessage = () => {
    if (!task) return;

    const contactFirstName = task.client_contact_name?.split(' ')[0] || 'שלום';
    const employeeName = task.employee_name || 'העובד';
    const clientName = task.client_name || 'החברה';

    setInitialMessage(`שלום ${contactFirstName},

אני איתן מחברת פנדה-טק 🐼

אני מבצע בדיקת איכות שירות באופן תקופתי.

אשמח לשמוע ממך על איכות השירות של ${employeeName} שעובד/ת אצלכם ב${clientName}.

האם יש לך כמה דקות לשיחה קצרה?`);
  };

  // Get the phone to use (manual or from task)
  const getPhoneToUse = () => {
    if (manualPhone) return manualPhone;
    return task?.client_contact_phone || '';
  };

  const handleStartConversation = async () => {
    const phoneToUse = getPhoneToUse();
    if (!phoneToUse) {
      setError("יש להזין מספר טלפון");
      return;
    }

    // Start countdown
    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(0);

    setSending(true);
    setError('');

    try {
      const whatsappMessage = initialMessage.trim();

      // Clean phone number for consistency
      let cleanPhone = phoneToUse.replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
      if (cleanPhone.startsWith('0')) cleanPhone = '972' + cleanPhone.substring(1);

      // 1. Create Agent Conversation
      const agentConv = await base44.agents.createConversation({
        agent_name: 'eitan_quality',
        metadata: {
          employee_id: task.employee_id,
          employee_name: task.employee_name,
          client_contact_phone: cleanPhone,
          client_contact_name: task.client_contact_name,
          client_name: task.client_name,
          manager_name: task.manager_name,
          source: 'quality_check'
        }
      });

      // 2. Send WhatsApp message
      let messageSent = false;
      let greenApiMessageId = `local_${Date.now()}`;

      try {
        const sendResult = await base44.functions.invoke('sendWhatsappViaGreenApi', {
          phone: cleanPhone,
          message: whatsappMessage,
          originalRecipientName: task.client_contact_name,
          originalRecipientPhone: phoneToUse
        });

        if (sendResult.data?.success) {
          messageSent = true;
          greenApiMessageId = sendResult.data.messageId || greenApiMessageId;
        }
      } catch (sendErr) {
        console.error('Error sending WhatsApp:', sendErr);
      }

      // 3. Add message to agent conversation
      if (agentConv && agentConv.id) {
        const safeAgentConv = JSON.parse(JSON.stringify(agentConv));
        if (!Array.isArray(safeAgentConv.messages)) {
          safeAgentConv.messages = [];
        }

        try {
          await base44.agents.addMessage(safeAgentConv, {
            role: 'assistant',
            content: whatsappMessage
          });
        } catch (addMsgErr) {
          console.warn("Could not add message to agent:", addMsgErr.message);
        }
      }

      // 4. Update task status
      await base44.entities.EitanTask.update(task.id, {
        status: 'בתהליך',
        agent_conversation_id: agentConv?.id,
        last_outgoing_message_date: new Date().toISOString(),
        notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] איתן יצר קשר אוטומטי עם ${task.client_contact_name}`
      });

      if (!messageSent) {
        setError('שגיאה בשליחת ההודעה לוואטסאפ. נסה שוב.');
        setSending(false);
        return;
      }

      setConversationStarted(true);
      toast.success("ההודעה נשלחה בהצלחה!");

      // Close after a short delay
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);

    } catch (err) {
      console.error("Error starting conversation:", err);
      setError(err.message || "שגיאה בשליחת ההודעה");
    }
    setSending(false);
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face" 
              alt="איתן" 
              className="w-12 h-12 rounded-full object-cover border-2 border-blue-200"
            />
            <div>
              <span>התחלת בדיקת איכות עם איתן</span>
              <p className="text-sm font-normal text-gray-500">בדיקת איכות שירות מול איש קשר בלקוח</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {conversationStarted ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">השיחה נפתחה!</h3>
            <p className="text-gray-600">איתן יפנה לאיש הקשר בלקוח בוואטסאפ בהקדם.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Task Info */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-medium">עובד: {task.employee_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-purple-600" />
                <span className="font-medium">לקוח: {task.client_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-green-600" />
                <span>איש קשר: {task.client_contact_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-600" />
                {showPhoneInput ? (
                  <Input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="הזן מספר טלפון (לדוגמה: 0501234567)"
                    className="flex-1 text-left"
                    dir="ltr"
                  />
                ) : (
                  <>
                    <span className={task.client_contact_phone ? "text-gray-700" : "text-red-500"}>
                      {task.client_contact_phone || "לא נמצא מספר טלפון"}
                    </span>
                    {!task.client_contact_phone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPhoneInput(true)}
                        className="text-blue-600 h-6 px-2"
                      >
                        <Edit2 className="w-3 h-3 ml-1" />
                        הזן ידנית
                      </Button>
                    )}
                  </>
                )}
                {task.client_contact_phone && !showPhoneInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPhoneInput(true)}
                    className="text-gray-500 h-6 px-2"
                    title="שנה מספר"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                )}
                {showPhoneInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPhoneInput(false);
                      setManualPhone('');
                    }}
                    className="text-gray-500 h-6 px-2"
                  >
                    ביטול
                  </Button>
                )}
              </div>
            </div>

            {/* Initial Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                הודעה שאיתן ישלח לאיש הקשר
              </label>
              <Textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={8}
                placeholder="כתוב הנחיות לאיתן..."
              />
              <p className="text-xs text-gray-500 mt-1">
                ההודעה תישלח ישירות לוואטסאפ של איש הקשר בלקוח
              </p>
            </div>

            {/* Info Alert */}
            <Alert className="bg-blue-50 border-blue-200">
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                איתן ישלח את ההודעה לאיש הקשר בלקוח ויבצע בדיקת איכות שירות. ניתן לערוך את ההודעה לפני השליחה.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {conversationStarted ? 'סגור' : 'ביטול'}
          </Button>
          {!conversationStarted && (
            <Button 
              onClick={handleStartConversation}
              disabled={sending || countdown > 0 || (!task.client_contact_phone && !manualPhone)}
              className={`bg-blue-600 hover:bg-blue-700 ${countdown > 0 ? 'animate-pulse' : ''}`}
            >
              {countdown > 0 ? (
                <span className="font-bold text-lg">{countdown}</span>
              ) : sending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 ml-2" />
              )}
              {countdown > 0 ? 'שולח בעוד...' : 'שלח את איתן לבדיקת איכות'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}