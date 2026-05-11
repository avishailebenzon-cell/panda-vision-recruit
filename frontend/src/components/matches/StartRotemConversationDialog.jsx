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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageCircle, 
  Send, 
  Loader2,
  User,
  Briefcase,
  Phone,
  CheckCircle,
  AlertCircle,
  Edit2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";


export default function StartRotemConversationDialog({ 
  isOpen, 
  onClose, 
  match,
  user,
  onSuccess
}) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  const [initialMessage, setInitialMessage] = useState('');
  const [conversationStarted, setConversationStarted] = useState(false);
  const [error, setError] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isOpen && match) {
      loadData();
    } else {
      // Reset on close
      setInitialMessage('');
      setConversationStarted(false);
      setError('');
      setManualPhone('');
      setShowPhoneInput(false);
    }
  }, [isOpen, match]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [candidateData, jobData] = await Promise.all([
        match.candidate_id ? base44.entities.Candidate.get(match.candidate_id) : null,
        match.job_id ? base44.entities.Job.get(match.job_id) : null
      ]);
      
      setCandidate(candidateData);
      setJob(jobData);

      // Build default initial message for Rotem
      const candidateName = candidateData ? `${candidateData.first_name} ${candidateData.last_name}` : match.candidate_name;
      const jobTitle = jobData?.title || match.job_title || 'משרה';
      const clientName = jobData?.client_name || '';

      // Build the message Rotem will send to the candidate
      setInitialMessage(`שלום ${candidateData?.first_name || candidateName.split(' ')[0]},

אני טל מחברת פנדה-טק 🐼

ראיתי את הפרופיל שלך ונראה לי שיש לנו משרה שיכולה להתאים לך מאוד:
*${jobTitle}*${clientName ? ` ב${clientName}` : ''}

האם תהיה/י מעוניין/ת לשמוע פרטים נוספים?`);

    } catch (err) {
      console.error("Error loading data:", err);
      setError("שגיאה בטעינת נתונים");
    }
    setLoading(false);
  };

  // Get the phone to use (manual or from candidate)
  const getPhoneToUse = () => {
    if (manualPhone) return manualPhone;
    return candidate?.phone_primary || '';
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
      const candidateName = candidate ? `${candidate.first_name} ${candidate.last_name}` : match.candidate_name;
      const jobTitle = job?.title || match.job_title || 'משרה';
      const whatsappMessage = initialMessage.trim();

      console.log("Sending WhatsApp to:", phoneToUse);

      // Clean phone number for consistency
      let cleanPhone = phoneToUse.replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
      if (cleanPhone.startsWith('0')) cleanPhone = '972' + cleanPhone.substring(1);

      // 0. CRITICAL: Stop any other active tasks with this candidate FIRST
      if (candidate?.id) {
        const otherActiveTasks = await base44.entities.RotemTask.filter({
          candidate_id: candidate.id,
          status: 'בתהליך'
        });
        
        for (const otherTask of otherActiveTasks) {
          if (otherTask.id !== match.id) {
            await base44.entities.RotemTask.update(otherTask.id, {
              status: 'שיחה נעצרה',
              notes: (otherTask.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] שיחה נעצרה - התחילה שיחה ידנית חדשה עבור משרה אחרת`
            });
            console.log(`Stopped task ${otherTask.id} before starting new conversation`);
          }
        }
      }

      // 1. Check for existing active conversation or create new one
      let conversationId = '';
      let agentConversationId = '';

      const existingConvs = await base44.entities.WhatsappConversation.filter({
        candidate_phone: cleanPhone, // Using clean phone is safer for matching
        status: 'active'
      });

      if (existingConvs && existingConvs.length > 0) {
        // Use existing
        conversationId = existingConvs[0].id;
        agentConversationId = existingConvs[0].agent_conversation_id;

        // CRITICAL: Get task_number from RotemTask
        let taskNumber = null;
        try {
          const rotemTask = await base44.entities.RotemTask.get(match.id);
          taskNumber = rotemTask?.task_number;
        } catch (e) {
          console.log('Could not get task number:', e);
        }

        // Update existing conversation
        await base44.entities.WhatsappConversation.update(conversationId, {
          last_message_preview: whatsappMessage.substring(0, 100),
          last_message_direction: 'outgoing',
          last_message_date: new Date().toISOString(),
          messages_count: (existingConvs[0].messages_count || 0) + 1,
          job_id: job?.id,
          job_title: jobTitle,
          task_number: taskNumber
        });
      } else {
        // CRITICAL: Get task_number from RotemTask
        let taskNumber = null;
        try {
          const rotemTask = await base44.entities.RotemTask.get(match.id);
          taskNumber = rotemTask?.task_number;
        } catch (e) {
          console.log('Could not get task number:', e);
        }

        // Create new conversation
        const whatsappRecord = await base44.entities.WhatsappConversation.create({
          candidate_id: candidate?.id || match.candidate_id,
          candidate_name: candidateName,
          candidate_phone: phoneToUse,
          job_id: job?.id,
          job_title: jobTitle,
          task_number: taskNumber,
          match_id: match.id,
          status: 'active',
          messages_count: 1,
          last_message_preview: whatsappMessage.substring(0, 100),
          last_message_direction: 'outgoing',
          last_message_date: new Date().toISOString()
        });
        conversationId = whatsappRecord?.id;
      }

      // 2. Send actual WhatsApp message via Green API
      let messageSent = false;
      let greenApiMessageId = `local_${Date.now()}`;

      try {
        const sendResult = await base44.functions.invoke('sendWhatsappViaGreenApi', {
          phone: cleanPhone,
          message: whatsappMessage,
          originalRecipientName: candidateName,
          originalRecipientPhone: phoneToUse
        });

        if (sendResult.data?.success) {
          messageSent = true;
          greenApiMessageId = sendResult.data.messageId || greenApiMessageId;
          console.log('WhatsApp sent successfully:', greenApiMessageId);
        } else {
          console.error('Failed to send WhatsApp:', sendResult.data?.error);
        }
      } catch (sendErr) {
        console.error('Error calling sendWhatsappViaGreenApi:', sendErr);
      }

      // 3. Save the message record (linked to conversation)
      if (conversationId) {
        await base44.entities.WhatsappMessage.create({
            conversation_id: conversationId,
            candidate_phone: cleanPhone,
            direction: 'outgoing',
            content: whatsappMessage,
            message_id: greenApiMessageId,
            sender_name: 'טל',
            status: messageSent ? 'sent' : 'failed'
        });
      }

      if (!messageSent) {
        setError('שגיאה בשליחת ההודעה לוואטסאפ. נסה שוב.');
        setSending(false);
        return;
      }

      // 4. Sync to Agent System (so the Agent "knows" what was sent)
      try {
        // Get or Create Agent Conversation
        let agentConv = null;
        if (agentConversationId) {
          try {
            agentConv = await base44.agents.getConversation(agentConversationId);
          } catch (e) { console.log('Agent conv not found, creating new'); }
        }

        if (!agentConv) {
          const newConv = await base44.agents.createConversation({
            agent_name: 'rotem_whatsapp',
            metadata: {
              candidate_phone: cleanPhone,
              candidate_name: candidateName,
              source: 'manual_start'
            }
          });
          
          // Re-fetch to ensure full object structure for SDK compatibility
          try {
            agentConv = await base44.agents.getConversation(newConv.id);
          } catch (e) {
            agentConv = newConv; // Fallback if fetch fails immediately
          }
          
          // Link back to WhatsappConversation
          if (conversationId && agentConv?.id) {
            await base44.entities.WhatsappConversation.update(conversationId, {
              agent_conversation_id: agentConv.id
            });
          }
        }

        // Add the outgoing message to agent history as ASSISTANT role
        if (agentConv && agentConv.id) {
          // Ensure messages array exists and is iterable
          // Use JSON parse/stringify to ensure a clean plain object
          let safeAgentConv;
          try {
             safeAgentConv = JSON.parse(JSON.stringify(agentConv));
          } catch (e) {
             safeAgentConv = { ...agentConv };
          }
          
          // Ensure messages is always an array
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
      } catch (agentErr) {
        console.error("Error syncing to agent:", agentErr);
        // Don't fail the UI flow if agent sync fails
      }

      // Update the RotemTask to "בתהליך" if it exists
      if (match.id) {
        try {
          const taskData = await base44.entities.RotemTask.get(match.id);
          if (taskData && taskData.status === 'מאושר לשיחה') {
            await base44.entities.RotemTask.update(match.id, {
              status: 'בתהליך',
              last_outgoing_message_date: new Date().toISOString(),
              notes: (taskData.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] טל יצרה קשר ידנית`
            });
          }
        } catch (taskErr) {
          console.log('Could not update task status:', taskErr);
        }
      }

      setConversationStarted(true);
      toast.success("ההודעה נשלחה בהצלחה לוואטסאפ של המועמד!");

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

  if (!match) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img 
              src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face" 
              alt="טל" 
              className="w-12 h-12 rounded-full object-cover border-2 border-teal-200"
            />
            <div>
              <span>התחלת שיחה עם טל</span>
              <p className="text-sm font-normal text-gray-500">רכזת גיוס - תקשורת וואטסאפ עם מועמדים</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : conversationStarted ? (
          <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">השיחה נפתחה!</h3>
          <p className="text-gray-600">טל תפנה למועמד בוואטסאפ בהקדם.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Candidate Info */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{candidate ? `${candidate.first_name} ${candidate.last_name}` : match.candidate_name}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
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
                    <span className={candidate?.phone_primary ? "text-gray-700" : "text-red-500"}>
                      {candidate?.phone_primary || "לא נמצא מספר טלפון"}
                    </span>
                    {!candidate?.phone_primary && (
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
                {candidate?.phone_primary && !showPhoneInput && (
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
              {(job || match.job_title) && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-orange-600" />
                  <span>{job?.title || match.job_title}</span>
                </div>
              )}
              {match.match_score && (
                <Badge className="mt-2 bg-purple-100 text-purple-800">
                  ציון התאמה: {match.match_score}%
                </Badge>
              )}
            </div>

            {/* Initial Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                הודעה שטל תשלח למועמד
              </label>
              <Textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={6}
                placeholder="כתוב הנחיות לטל..."
              />
              <p className="text-xs text-gray-500 mt-1">
                ההודעה תישלח ישירות לוואטסאפ של המועמד
              </p>
            </div>

            {/* Info Alert */}
            <Alert className="bg-teal-50 border-teal-200">
              <MessageCircle className="w-4 h-4 text-teal-600" />
              <AlertDescription className="text-teal-800 text-sm">
                טל תשלח את ההודעה ישירות למועמד בוואטסאפ. ניתן לערוך את ההודעה לפני השליחה.
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
          {!conversationStarted && !loading && (
            <Button 
              onClick={handleStartConversation}
              disabled={sending || countdown > 0 || (!candidate?.phone_primary && !manualPhone)}
              className={`bg-teal-600 hover:bg-teal-700 ${countdown > 0 ? 'animate-pulse' : ''}`}
            >
              {countdown > 0 ? (
                <span className="font-bold text-lg">{countdown}</span>
              ) : sending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 ml-2" />
              )}
              {countdown > 0 ? 'שולח בעוד...' : 'שלח את טל למועמד'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}