import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, MessageCircle, ArrowUp, ArrowDown, Loader2, Calendar, Briefcase, Send, Plus, X, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';
import { useDraggableDialog } from '@/components/ui/useDraggableDialog';

export default function CandidateCommunicationHistory({ candidateId, candidateName, open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [candidatePhone, setCandidatePhone] = useState('');
  const [candidateData, setCandidateData] = useState(null);
  const [textareaRows, setTextareaRows] = useState(2);
  const scrollRef = useRef(null);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateStyle, setTemplateStyle] = useState('');
  const [messageStyleVariant, setMessageStyleVariant] = useState('whatsapp');
  const [templateContent, setTemplateContent] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [userTemplates, setUserTemplates] = useState({});
  const messagesEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    if (open && candidateId) {
      loadCommunicationHistory();
      loadTemplateData();
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [open, candidateId]);

  useEffect(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    if (open) {
      refreshIntervalRef.current = setInterval(() => {
        loadCommunicationHistory();
      }, 60000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [open, candidateId]);

  const loadTemplateData = async () => {
    try {
      const [user, statusList] = await Promise.all([
        base44.auth.me(),
        base44.entities.CandidateStatus.list('status_number')
      ]);
      setUserTemplates(user || {});
      setStatuses(statusList || []);
    } catch (e) {
      console.error('Error loading template data:', e);
    }
  };

  // Generate template content when style/variant changes
  useEffect(() => {
    if (!templateStyle) { setTemplateContent(''); return; }
    const key = `candidate_status_${templateStyle}_${messageStyleVariant}_template`;
    let content = userTemplates[key] || '';
    if (!content) {
      const status = statuses.find(s => s.status_number === parseInt(templateStyle));
      if (status) {
        if (messageStyleVariant === 'whatsapp') {
          content = `היי {candidate_name} 👋\n\nעדכון מהיר: הסטטוס שלך הוא כעת "${status.status_name}" 📊\n\nנמשיך לעדכן אותך!\n\nפנדה-טק 🐼`;
        } else {
          content = `שלום {candidate_name},\n\nזהו עדכון בנוגע לתהליך הגיוס שלך.\n\nהסטטוס הנוכחי הוא: ${status.status_name}\n\nבברכה,\nצוות הגיוס\nפנדה-טק`;
        }
      }
    }
    // Replace placeholders with real candidate data
    const cvDate = candidateData?.cv_received_date
      ? format(new Date(candidateData.cv_received_date), 'dd/MM/yyyy', { locale: he })
      : '';
    content = content.replace(/{candidate_name}/g, candidateName || '');
    content = content.replace(/{job_title}/g, '');
    content = content.replace(/{client_name}/g, '');
    content = content.replace(/{cv_received_date}/g, cvDate);
    content = content.replace(/{match_creation_date}/g, '');
    setTemplateContent(content);
  }, [templateStyle, messageStyleVariant, userTemplates, statuses, candidateName, candidateData]);

  const handleApplyTemplate = () => {
    if (templateContent.trim()) {
      setReplyText(templateContent);
    }
    setShowTemplatePicker(false);
  };

  const loadCommunicationHistory = async () => {
    setLoading(true);
    try {
      // First get candidate phone to search by phone too
      let candidatePhones = [];
      try {
        const candidateResult = await base44.entities.Candidate.filter({ id: candidateId });
        if (candidateResult && candidateResult.length > 0) {
          const c = candidateResult[0];
          if (c.phone_primary) candidatePhones.push(c.phone_primary);
          if (c.phone_secondary) candidatePhones.push(c.phone_secondary);
          setCandidatePhone(c.phone_primary || '');
          setCandidateData(c);
        }
      } catch (e) { console.error('Error loading candidate:', e); }

      // Load WhatsApp conversations - by candidate_id AND by phone
      let allConversations = [];
      const [convById, ...convsByPhone] = await Promise.all([
        base44.entities.WhatsappConversation.filter({ candidate_id: candidateId }),
        ...candidatePhones.map(phone => base44.entities.WhatsappConversation.filter({ candidate_phone: phone }))
      ]);
      if (convById) allConversations = allConversations.concat(convById);
      convsByPhone.forEach(convs => {
        if (convs) convs.forEach(c => {
          if (!allConversations.find(x => x.id === c.id)) allConversations.push(c);
        });
      });

      // Also search RotemTask conversations for tasks linked to this candidate
      const rotemTasks = await base44.entities.RotemTask.filter({ candidate_id: candidateId });
      if (rotemTasks) {
        for (const task of rotemTasks) {
          if (task.conversation_id) {
            const taskConv = await base44.entities.WhatsappConversation.filter({ id: task.conversation_id });
            if (taskConv) taskConv.forEach(c => {
              if (!allConversations.find(x => x.id === c.id)) allConversations.push(c);
            });
          }
        }
      }

      let allWhatsappMessages = [];
      if (allConversations.length > 0) {
        const msgArrays = await Promise.all(
          allConversations.map(c => base44.entities.WhatsappMessage.filter({ conversation_id: c.id }))
        );
        msgArrays.forEach(msgs => { if (msgs) allWhatsappMessages = allWhatsappMessages.concat(msgs); });
      }

      // Also try direct candidate_id field on messages (legacy)
      const directMessages = await base44.entities.WhatsappMessage.filter({ candidate_id: candidateId });
      if (directMessages) {
        directMessages.forEach(m => {
          if (!allWhatsappMessages.find(x => x.id === m.id)) allWhatsappMessages.push(m);
        });
      }

      // Load Email logs
      const emailLogs = await base44.entities.EmailLog.filter({
        related_entity_id: candidateId
      });

      // Combine and format all messages
      const allMessages = [];

      // Add WhatsApp messages
      if (allWhatsappMessages.length > 0) {
        allWhatsappMessages.forEach(msg => {
          // Find matching conversation for job info
          const conv = allConversations?.find(c => c.id === msg.conversation_id);
          allMessages.push({
            type: 'whatsapp',
            direction: msg.direction || 'outgoing',
            content: msg.content || msg.message_text || '',
            timestamp: msg.created_date,
            jobCode: conv?.job_title ? extractJobCode(conv.job_title) : (msg.job_id ? extractJobCode(msg.job_title) : 'לא שויך'),
            jobTitle: conv?.job_title || msg.job_title || 'לא מצוין',
            status: msg.status,
            senderName: msg.sender_name
          });
        });
      }

      // Add Email messages
      if (emailLogs && Array.isArray(emailLogs)) {
        emailLogs.forEach(email => {
          // Try to extract job info from related entity
          let jobInfo = { code: 'לא שויך', title: 'לא מצוין' };
          
          if (email.related_entity_type === 'Match') {
            // Try to get match details to extract job info
            const matchId = email.related_entity_id;
            // We can't easily fetch match here, so use what we have
            jobInfo.code = 'התאמה';
          }
          
          allMessages.push({
            type: 'email',
            direction: 'outgoing', // Emails are typically outgoing
            content: `נושא: ${email.subject || 'אין נושא'}\n\n${email.body || 'אין תוכן'}`,
            subject: email.subject || '',
            timestamp: email.created_date,
            jobCode: jobInfo.code,
            jobTitle: jobInfo.title,
            status: email.status,
            to: email.to
          });
        });
      }

      // Sort by timestamp (oldest first - newest at bottom)
      allMessages.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0);
        const dateB = new Date(b.timestamp || 0);
        return dateA - dateB;
      });

      setMessages(allMessages);

      // Auto-scroll to latest message
      if (messagesEndRef.current) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

    } catch (error) {
      console.error('Error loading communication history:', error);
    }
    setLoading(false);
  };

  const extractJobCode = (jobTitle) => {
    if (!jobTitle) return 'לא ידוע';
    const match = jobTitle.match(/pan-\d+/i);
    return match ? match[0].toUpperCase() : 'לא ידוע';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'לא ידוע';
    try {
      const date = new Date(timestamp);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: he });
    } catch {
      return 'תאריך לא תקין';
    }
  };

  const getChannelIcon = (type) => {
    return type === 'whatsapp' ? 
      <MessageCircle className="w-4 h-4 text-green-600" /> : 
      <Mail className="w-4 h-4 text-blue-600" />;
  };

  const getDirectionIcon = (direction) => {
    return direction === 'incoming' ? 
      <ArrowDown className="w-4 h-4 text-blue-600" /> : 
      <ArrowUp className="w-4 h-4 text-purple-600" />;
  };

  const getChannelBadge = (type) => {
    return type === 'whatsapp' ? 
      <Badge className="bg-green-100 text-green-700 text-xs">WhatsApp</Badge> : 
      <Badge className="bg-blue-100 text-blue-700 text-xs">מייל</Badge>;
  };

  const getDirectionBadge = (direction) => {
    return direction === 'incoming' ? 
      <Badge variant="outline" className="text-xs">נכנסת</Badge> : 
      <Badge variant="outline" className="text-xs">יוצאת</Badge>;
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      toast.error('יש להזין תוכן הודעה');
      return;
    }
    if (!candidatePhone) {
      toast.error('לא נמצא מספר טלפון של המועמד');
      return;
    }

    setSending(true);
    try {
      // Format phone
      let phone = candidatePhone.replace(/[+\-\s]/g, '');
      if (phone.startsWith('0')) phone = '972' + phone.substring(1);
      if (!phone.startsWith('972')) phone = '972' + phone;

      const sendResponse = await base44.functions.invoke('sendWhatsappViaGreenApi', {
        phone,
        message: replyText
      });

      if (!sendResponse?.data?.success) {
        throw new Error(sendResponse?.data?.error || 'שליחה נכשלה');
      }

      // Log the message
      await base44.entities.WhatsappMessage.create({
        candidate_id: candidateId,
        candidate_name: candidateName,
        phone_number: candidatePhone,
        content: replyText,
        direction: 'outgoing',
        status: 'sent',
        sender_name: 'טל',
        green_api_message_id: sendResponse?.data?.message_id || ''
      });

      toast.success('ההודעה נשלחה בהצלחה');
      setReplyText('');
      await loadCommunicationHistory(); // Refresh
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('שגיאה בשליחת ההודעה: ' + (error.message || ''));
    }
    setSending(false);
  };

  const { dragHandleProps, dialogStyle } = useDraggableDialog();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]" dir="rtl" style={dialogStyle}>
        <DialogHeader {...dragHandleProps} className="select-none">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageCircle className="w-6 h-6 text-purple-600" />
            היסטוריית תקשורת עם {candidateName}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 mr-auto text-gray-500 hover:text-gray-800"
              onClick={loadCommunicationHistory}
              disabled={loading}
              title="רענן"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>לא נמצאה תקשורת עם מועמד זה</p>
            <p className="text-xs mt-2 text-gray-400">מזהה: {candidateId}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={loadCommunicationHistory}
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              נסה שוב
            </Button>
          </div>
        ) : (
           <div className="h-[60vh] overflow-y-auto">
             <div className="space-y-4 pr-4">
               {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`border rounded-lg p-4 ${
                    msg.direction === 'incoming' 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-purple-50 border-purple-200'
                  }`}
                >
                  {/* Header with badges */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      {getDirectionIcon(msg.direction)}
                      {getDirectionBadge(msg.direction)}
                      {msg.senderName && msg.direction === 'outgoing' && (
                        <Badge variant="outline" className="text-xs text-gray-500">{msg.senderName}</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {getChannelIcon(msg.type)}
                      {getChannelBadge(msg.type)}
                    </div>

                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Briefcase className="w-3 h-3" />
                      {msg.jobCode}
                    </Badge>

                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Calendar className="w-3 h-3" />
                      {formatTimestamp(msg.timestamp)}
                    </Badge>

                    {msg.status && (
                      <Badge 
                        className={`text-xs ${
                          msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'read' 
                            ? 'bg-green-100 text-green-700' 
                            : msg.status === 'failed' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {msg.status}
                      </Badge>
                    )}
                  </div>

                  {/* Email subject (if exists) */}
                  {msg.subject && (
                    <div className="mb-2">
                      <span className="font-semibold text-sm text-gray-700">נושא: </span>
                      <span className="text-sm text-gray-600">{msg.subject}</span>
                    </div>
                  )}

                  {/* Job title */}
                  {msg.jobTitle && msg.jobTitle !== 'לא מצוין' && (
                    <div className="mb-2 text-xs text-gray-500">
                      משרה: {msg.jobTitle}
                    </div>
                  )}

                  {/* Message content */}
                  <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap bg-white/50 p-3 rounded border">
                    {msg.content || 'אין תוכן'}
                  </div>
                </div>
                ))}
                <div ref={messagesEndRef} />
                </div>
                </div>
                )}

        {/* Reply Box */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <MessageCircle className="w-4 h-4 text-green-600" />
            שלח הודעת WhatsApp (טל) → {candidateName}
            {candidatePhone && <span className="text-gray-400 text-xs font-normal">({candidatePhone})</span>}
          </div>

          {/* Template Picker Panel */}
          {showTemplatePicker && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-800">בחר תבנית הודעה</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTemplatePicker(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">סטטוס</Label>
                  <Select value={templateStyle} onValueChange={setTemplateStyle}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="בחר סטטוס" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map(status => (
                        <SelectItem key={status.status_number} value={status.status_number.toString()}>
                          {status.status_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">סגנון</Label>
                  <Select value={messageStyleVariant} onValueChange={setMessageStyleVariant}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp (חברותי)</SelectItem>
                      <SelectItem value="email">מייל (פורמלי)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {templateContent && (
                <Textarea
                  value={templateContent}
                  onChange={e => setTemplateContent(e.target.value)}
                  rows={4}
                  className="text-xs resize-none bg-white"
                />
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTemplatePicker(false)}>ביטול</Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!templateContent.trim()}
                  onClick={handleApplyTemplate}
                >
                  הדבק תבנית בשורת ההודעה
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-dashed border-blue-400 text-blue-600 hover:bg-blue-50"
              onClick={() => setShowTemplatePicker(v => !v)}
              title="בחר תבנית הודעה"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <div className="flex-1 relative">
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="כתוב הודעה למועמד..."
                rows={textareaRows}
                className="resize-none w-full"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) handleSendReply();
                }}
              />
              <div className="absolute left-1 bottom-1 flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 text-gray-400 hover:text-gray-700 p-0"
                  onClick={() => setTextareaRows(r => Math.max(1, r - 1))}
                  title="הקטן שדה"
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 text-gray-400 hover:text-gray-700 p-0"
                  onClick={() => setTextareaRows(r => Math.min(12, r + 1))}
                  title="הגדל שדה"
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <Button
              onClick={handleSendReply}
              disabled={sending || !replyText.trim()}
              className="bg-green-600 hover:bg-green-700 h-9 w-9 shrink-0 p-0"
              title="שלח הודעה"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-white" />}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline" size="sm">סגור</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}