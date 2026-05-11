import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, MessageCircle, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function SendMessageToClientDialog({ isOpen, onClose, match, candidate, job }) {
  const [messageType, setMessageType] = useState('email');
  const [templateCategory, setTemplateCategory] = useState('');
  const [templateStyle, setTemplateStyle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState({});
  const [statuses, setStatuses] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const user = await base44.auth.me();
      setTemplates(user);
      const statusList = await base44.entities.CandidateStatus.list('status_number');
      setStatuses(statusList);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const getTemplateKey = () => {
    if (!templateCategory || !templateStyle) return null;
    
    if (templateCategory === 'status') {
      return `client_status_${templateStyle}_${messageType}_template`;
    } else if (templateCategory === 'send_cv') {
      // Fixed: Correct template key format is send_cv_{type}_template_{number}
      return `send_cv_${messageType}_template_${templateStyle}`;
    }
    return null;
  };

  useEffect(() => {
    const key = getTemplateKey();
    
    // Default templates if user hasn't saved custom ones
    const defaultTemplates = {
      'send_cv_email_template_1': `לכבוד {client_name},

הנדון: הצגת מועמד - {candidate_name}

אני מתכבד להציג בפניכם מועמד איכותי לתפקיד הפתוח אצלכם.

פרטי המועמד:
━━━━━━━━━━━━━━━━━━━━━
שם מלא: {candidate_name}
דואר אלקטרוני: {candidate_email}
טלפון: {candidate_phone}
סיווג ביטחוני: {security_clearance}

רקע מקצועי:
{skills_summary}

קורות החיים המלאים מצורפים למייל זה.

אשמח לתאם שיחת היכרות בהקדם.

בברכה,
צוות פנדה-טק`,
      'send_cv_email_template_2': `היי {client_name},

איך הולך? רציתי להציג לך מועמד שנראה לי מתאים מאוד למה שאתם מחפשים.

הכירו את {candidate_name}!

פרטים ליצירת קשר:
📧 {candidate_email}
📱 {candidate_phone}
🔒 סיווג: {security_clearance}

קצת על הרקע המקצועי:
{skills_summary}

מצרף את קורות החיים המלאים - אשמח לשמוע מה דעתך!

תודה,
פנדה-טק`,
      'send_cv_email_template_3': `שלום {client_name},

מועמד חדש: {candidate_name}
טלפון: {candidate_phone} | מייל: {candidate_email}
סיווג: {security_clearance}

התמחות: {skills_summary}

קו"ח מצורפים.

פנדה-טק`,
      'send_cv_whatsapp_template_1': `היי {client_name}! 👋

יש לי מועמד מעולה בשבילך! 🌟

👤 {candidate_name}
📧 {candidate_email}
📱 {candidate_phone}
🔒 סיווג: {security_clearance}

💪 הכישורים שלו:
{skills_summary}

מצרף את קורות החיים 📎

מה דעתך? 🤔

פנדה-טק 🐼`,
      'send_cv_whatsapp_template_2': `שלום {client_name},

שולח לך קורות חיים של מועמד רלוונטי.

שם: {candidate_name}
טלפון: {candidate_phone}
מייל: {candidate_email}
סיווג: {security_clearance}

רקע מקצועי:
{skills_summary}

קורות החיים מצורפים.

פנדה-טק`,
      'send_cv_whatsapp_template_3': `{client_name}, יש לי בשורות טובות! 🎉

מצאתי מועמד שנראה לי מושלם למה שאתם מחפשים!

🌟 הכירו את {candidate_name}!

📞 {candidate_phone}
✉️ {candidate_email}
🔐 {security_clearance}

ההתמחות שלו:
{skills_summary}

אני ממש מתרגש מההתאמה הזו! 🚀
קורות החיים מצורפים - תעיף מבט ותגיד לי מה אתה חושב!

פנדה-טק 🐼`,
    };
    
    if (key) {
      // Use custom template if exists, otherwise use default
      let content = templates[key] || defaultTemplates[key] || '';
      
      if (content) {
        // Replace placeholders
        content = content.replace(/{candidate_name}/g, candidate?.full_name || match?.candidate_name || '');
        content = content.replace(/{candidate_email}/g, candidate?.email || '');
        content = content.replace(/{candidate_phone}/g, candidate?.phone_primary || '');
        content = content.replace(/{job_title}/g, job?.title || match?.job_title || '');
        content = content.replace(/{client_name}/g, job?.client_name || '');
        content = content.replace(/{security_clearance}/g, candidate?.security_clearance || job?.security_clearance || '');
        content = content.replace(/{skills_summary}/g, candidate?.skills_summary || '');
        
        const status = statuses.find(s => s.status_number === parseInt(templateStyle));
        if (status) {
          content = content.replace(/{status_name}/g, status.status_name || '');
        }
        
        setMessageContent(content);
      } else {
        setMessageContent('');
      }
    }
  }, [templateCategory, templateStyle, messageType, templates, candidate, job, match, statuses]);

  const handleSend = async () => {
    if (!messageContent.trim()) {
      toast.error('יש להזין תוכן הודעה');
      return;
    }

    setSending(true);
    try {
      // Create Elad task for sending to client
      await base44.entities.EladTask.create({
        job_id: match?.job_id || job?.id,
        job_title: job?.title || match?.job_title,
        candidate_id: match?.candidate_id || candidate?.id,
        candidate_name: candidate?.full_name || match?.candidate_name,
        message_type: messageType,
        message_content: messageContent,
        status: 'ממתין לשליחה',
        source: 'agent_recommendation'
      });

      toast.success(`ההודעה הועברה לאלעד לשליחה ללקוח באמצעות ${messageType === 'email' ? 'מייל' : 'WhatsApp'}`);
      onClose();
    } catch (error) {
      console.error('Error creating Elad task:', error);
      toast.error('שגיאה ביצירת משימה לאלעד');
    }
    setSending(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">שלח הודעה ללקוח</DialogTitle>
          <DialogDescription className="text-right">
            שליחת הודעה ללקוח על המועמד {candidate?.full_name || match?.candidate_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Message Type */}
          <div>
            <Label>אופן השליחה</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={messageType === 'email' ? 'default' : 'outline'}
                onClick={() => setMessageType('email')}
                className="flex-1"
              >
                <Mail className="w-4 h-4 ml-2" />
                מייל
              </Button>
              <Button
                variant={messageType === 'whatsapp' ? 'default' : 'outline'}
                onClick={() => setMessageType('whatsapp')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="w-4 h-4 ml-2" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Template Category */}
          <div>
            <Label>סוג ההודעה</Label>
            <Select value={templateCategory} onValueChange={setTemplateCategory}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="בחר סוג הודעה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="send_cv">שליחת קורות חיים</SelectItem>
                <SelectItem value="status">עדכון סטטוס</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Template Style */}
          {templateCategory === 'send_cv' && (
            <div>
              <Label>סגנון ההודעה</Label>
              <Select value={templateStyle} onValueChange={setTemplateStyle}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="בחר סגנון" />
                </SelectTrigger>
                <SelectContent>
                  {messageType === 'email' ? (
                    <>
                      <SelectItem value="1">פורמלי ומקצועי</SelectItem>
                      <SelectItem value="2">חברותי ואישי</SelectItem>
                      <SelectItem value="3">קצר ולעניין</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="1">חברותי עם אמוג'יס</SelectItem>
                      <SelectItem value="2">פשוט וישיר</SelectItem>
                      <SelectItem value="3">נלהב ומעודד</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {templateCategory === 'status' && (
            <div>
              <Label>בחר סטטוס</Label>
              <Select value={templateStyle} onValueChange={setTemplateStyle}>
                <SelectTrigger className="mt-2">
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
          )}

          {/* Message Content */}
          <div>
            <Label>תוכן ההודעה</Label>
            <Textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={12}
              className="mt-2"
              placeholder="בחר סוג הודעה וסגנון כדי לטעון תבנית..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={sending || !messageContent.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Send className="w-4 h-4 ml-2" />
              )}
              העבר לאלעד לשליחה
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}