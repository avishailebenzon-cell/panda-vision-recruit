import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function SendTaskEmailDialog({ isOpen, onClose, match, job, onMatchRemoved, agentName = 'נעמה' }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [markAsContacted, setMarkAsContacted] = useState(false);

  const jobCode = job?.job_code || '';
  const defaultSubject = `הודעה לגבי המועמד ${match?.candidate_name || ''} למשרה ${match?.job_title || ''}`;
  const defaultBody = `היי,

רציתי לעדכן שהמועמד ${match?.candidate_name || ''} מתאים למשרה ${match?.job_title || ''} ${jobCode ? `#${jobCode}` : ''} לאחר בדיקה ידנית.`;
  
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  React.useEffect(() => {
    if (isOpen) {
      setSubject(defaultSubject);
      setBody(defaultBody);
      setMarkAsContacted(false);
    }
  }, [isOpen, defaultSubject, defaultBody]);

  const handleSend = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      toast.error('נא להזין כתובת מייל תקינה');
      return;
    }

    setSending(true);
    try {
      await base44.functions.invoke('sendEmailViaResend', {
        to: recipientEmail,
        subject: subject,
        body: body,
        from_name: `${agentName} - פנדה-טק`
      });
      
      // Log to EmailLog (always)
      await base44.entities.EmailLog.create({
        to: recipientEmail,
        subject: subject,
        status: 'sent',
        sent_by_user_id: (await base44.auth.me()).id,
        sent_by_user_name: (await base44.auth.me()).full_name,
        source: 'manual',
        related_entity_type: 'Match',
        related_entity_id: match?.id
      });
      
      // Always remove match after sending
      if (onMatchRemoved) {
        onMatchRemoved(match.id);
      }
      
      // If marked as contacted, also update candidate status
      if (markAsContacted && match?.candidate_id) {
        await base44.entities.Candidate.update(match.candidate_id, {
          status: 'ביצירת קשר'
        });
      }
      
      toast.success(`המייל נשלח בהצלחה ל-${recipientEmail}`);
      onClose();
      setRecipientEmail('');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('שגיאה בשליחת המייל');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            שליחת משימה במייל
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div>
            <Label>כתובת מייל ליעד</Label>
            <Input
              type="email"
              placeholder="example@email.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>נושא המייל</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>תוכן המייל</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Checkbox
              id="mark-contacted"
              checked={markAsContacted}
              onCheckedChange={setMarkAsContacted}
            />
            <Label 
              htmlFor="mark-contacted" 
              className="text-sm font-medium cursor-pointer"
            >
              סמן גם מועמד כ"ביצירת קשר"
            </Label>
          </div>
          <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-200">
            ⚠️ לאחר שליחת המייל, ההתאמה תוסר אוטומטית מהרשימה
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={sending}>
              ביטול
            </Button>
            <Button onClick={handleSend} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 ml-2" />
                  שלח מייל
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}