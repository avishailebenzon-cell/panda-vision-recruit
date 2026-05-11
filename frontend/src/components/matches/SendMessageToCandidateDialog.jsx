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

export default function SendMessageToCandidateDialog({ isOpen, onClose, match, candidate, job }) {
  const [messageType, setMessageType] = useState('email');
  const [templateStyle, setTemplateStyle] = useState('');
  const [messageStyleVariant, setMessageStyleVariant] = useState('');
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
    if (!templateStyle || !messageStyleVariant) return null;
    
    return `candidate_status_${templateStyle}_${messageStyleVariant}_template`;
  };

  useEffect(() => {
    const key = getTemplateKey();
    
    if (key) {
      // Use custom template if exists, otherwise generate default based on status
      let content = templates[key] || '';
      
      if (!content && templateStyle) {
        const status = statuses.find(s => s.status_number === parseInt(templateStyle));
        if (status) {
          const statusName = status.status_name || '';
          let statusContent = '';
          
          // Generate content based on status and style
          if (messageStyleVariant === 'email') {
            if (statusName.includes('חדש') || statusName.includes('התקבל')) {
              statusContent = `תודה רבה על שליחת קורות החיים שלך למשרת {job_title} אצל {client_name}.

קורות החיים שלך התקבלו בהצלחה ונמצאים כעת בבדיקה ראשונית.

נחזור אליך בהקדם האפשרי עם עדכונים.`;
            } else if (statusName.includes('בבדיקה') || statusName.includes('בטיפול')) {
              statusContent = `קורות החיים שלך למשרת {job_title} אצל {client_name} נמצאים כעת בבדיקה מעמיקה.

אנחנו בוחנים את התאמתך לדרישות התפקיד ונעדכן אותך בהמשך התהליך.`;
            } else if (statusName.includes('ראיון') || statusName.includes('שיחה')) {
              statusContent = `שמחים לבשר לך שהלקוח {client_name} מעוניין לקדם אותך לשלב הבא בתהליך הגיוס למשרת {job_title}.

נחזור אליך בהקדם לתיאום ראיון/שיחת היכרות.`;
            } else if (statusName.includes('מועבר ללקוח') || statusName.includes('הועבר')) {
              statusContent = `שמחים לעדכן שקורות החיים שלך הועברו ללקוח {client_name} למשרת {job_title}.

נמתין לחזרה מהלקוח ונעדכן אותך בהמשך.`;
            } else if (statusName.includes('מאושר') || statusName.includes('מתאים')) {
              statusContent = `בשורות טובות! הלקוח {client_name} סימן אותך כמועמד מתאים למשרת {job_title}.

נחזור אליך בקרוב לגבי השלבים הבאים בתהליך.`;
            } else if (statusName.includes('לא מתאים') || statusName.includes('נדחה')) {
              statusContent = `לצערנו, לאחר בדיקה מעמיקה, הלקוח {client_name} החליט שלא להמשיך עם המועמדות שלך למשרת {job_title}.

אנחנו ממשיכים לחפש עבורך הזדמנויות מתאימות נוספות.`;
            } else if (statusName.includes('הצלחה') || statusName.includes('התקבל לעבודה')) {
              statusContent = `מזל טוב! 🎉

שמחים לבשר לך שהתקבלת למשרת {job_title} אצל {client_name}!

נשמח לשמוע איך מתנהל תהליך השילוב בארגון.`;
            } else {
              statusContent = `זהו עדכון בנוגע לתהליך הגיוס שלך למשרת {job_title} אצל {client_name}.

הסטטוס הנוכחי הוא: ${status.status_name}

נמשיך לעדכן אותך בהתפתחויות.`;
            }
            
            content = `שלום {candidate_name},

${statusContent}

בברכה,
צוות הגיוס
פנדה-טק`;
          } else {
            // WhatsApp style
            if (statusName.includes('חדש') || statusName.includes('התקבל')) {
              statusContent = `תודה שפנית אלינו! 🙏

קורות החיים שלך למשרת {job_title} התקבלו ונבדקים כרגע.

נחזור אליך בהקדם! ⏱️`;
            } else if (statusName.includes('בבדיקה') || statusName.includes('בטיפול')) {
              statusContent = `קורות החיים שלך למשרת {job_title} נמצאים בבדיקה מעמיקה 🔍

נעדכן אותך בהמשך התהליך!`;
            } else if (statusName.includes('ראיון') || statusName.includes('שיחה')) {
              statusContent = `בשורות טובות! 🎉

{client_name} רוצה לקדם אותך לשלב הבא - ראיון למשרת {job_title}!

נחזור אליך לתיאום 📞`;
            } else if (statusName.includes('מועבר ללקוח') || statusName.includes('הועבר')) {
              statusContent = `הקורות חיים שלך הועברו ללקוח {client_name} למשרת {job_title} ✅

נמתין לחזרה ונעדכן אותך!`;
            } else if (statusName.includes('מאושר') || statusName.includes('מתאים')) {
              statusContent = `מעולה! 🌟

{client_name} סימן אותך כמועמד מתאים למשרת {job_title}!

נחזור אליך לגבי השלבים הבאים 🚀`;
            } else if (statusName.includes('לא מתאים') || statusName.includes('נדחה')) {
              statusContent = `לצערנו, הפעם זה לא יצא 😔

{client_name} החליט שלא להמשיך עם המועמדות למשרת {job_title}.

אבל אל תדאג! אנחנו ממשיכים לחפש עבורך הזדמנויות מעולות! 💪`;
            } else if (statusName.includes('הצלחה') || statusName.includes('התקבל לעבודה')) {
              statusContent = `🎊 מזל טוב גדול! 🎊

התקבלת למשרת {job_title} אצל {client_name}! 🚀

מאחלים לך הצלחה רבה בתפקיד החדש! 🌟`;
            } else {
              statusContent = `עדכון מהיר: הסטטוס שלך למשרת {job_title} הוא כעת "${status.status_name}" 📊

נמשיך לעדכן אותך!`;
            }
            
            content = `היי {candidate_name} 👋

${statusContent}

פנדה-טק 🐼`;
          }
        }
      }
      
      if (content) {
        // Replace placeholders
        content = content.replace(/{candidate_name}/g, candidate?.full_name || match?.candidate_name || '');
        content = content.replace(/{candidate_email}/g, candidate?.email || '');
        content = content.replace(/{candidate_phone}/g, candidate?.phone_primary || '');
        content = content.replace(/{job_title}/g, job?.title || match?.job_title || '');
        content = content.replace(/{client_name}/g, job?.client_name || '');
        
        const status = statuses.find(s => s.status_number === parseInt(templateStyle));
        if (status) {
          content = content.replace(/{status_name}/g, status.status_name || '');
        }

        // Replace date placeholders
        const cvReceivedDate = candidate?.cv_received_date
          ? new Date(candidate.cv_received_date).toLocaleDateString('he-IL')
          : match?.created_date
            ? new Date(match.created_date).toLocaleDateString('he-IL')
            : '';
        content = content.replace(/{cv_received_date}/g, cvReceivedDate);
        content = content.replace(/{match_creation_date}/g, match?.created_date ? new Date(match.created_date).toLocaleDateString('he-IL') : '');
        
        setMessageContent(content);
      } else {
        setMessageContent('');
      }
    }
  }, [templateStyle, messageStyleVariant, templates, candidate, job, match, statuses]);

  const handleSend = async () => {
    if (!messageContent.trim()) {
      toast.error('יש להזין תוכן הודעה');
      return;
    }

    setSending(true);
    try {
      if (messageType === 'email') {
        // Send via email using Rotem outbox
        await base44.entities.WhatsappMessage.create({
          match_id: match?.id,
          candidate_id: match?.candidate_id || candidate?.id,
          candidate_name: candidate?.full_name || match?.candidate_name,
          job_id: match?.job_id || job?.id,
          job_title: job?.title || match?.job_title,
          phone_number: candidate?.phone_primary || '',
          content: messageContent,
          direction: 'outgoing',
          status: 'sent'
        });
      } else {
        // Send via WhatsApp using Rotem outbox
        await base44.entities.WhatsappMessage.create({
          match_id: match?.id,
          candidate_id: match?.candidate_id || candidate?.id,
          candidate_name: candidate?.full_name || match?.candidate_name,
          job_id: match?.job_id || job?.id,
          job_title: job?.title || match?.job_title,
          phone_number: candidate?.phone_primary || '',
          content: messageContent,
          direction: 'outgoing',
          status: 'sent'
        });
      }

      toast.success(`ההודעה נשלחה בהצלחה למועמד`);
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('שגיאה בשליחת ההודעה');
    }
    setSending(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">שלח הודעה למועמד</DialogTitle>
          <DialogDescription className="text-right">
            שליחת הודעה ל-{candidate?.full_name || match?.candidate_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Status Selection */}
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

          {/* Message Style Variant */}
          {templateStyle && (
            <div>
              <Label>סגנון ההודעה</Label>
              <Select value={messageStyleVariant} onValueChange={setMessageStyleVariant}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="בחר סגנון" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      מייל (פורמלי)
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp (חברותי)
                    </div>
                  </SelectItem>
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Send className="w-4 h-4 ml-2" />
              )}
              שלח הודעה
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}