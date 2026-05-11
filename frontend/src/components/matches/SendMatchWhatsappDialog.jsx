import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, MessageCircle, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function SendMatchWhatsappDialog({ isOpen, onClose, match, job, candidate }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [candidateStatus, setCandidateStatus] = useState(null);
  const [loadedCandidate, setLoadedCandidate] = useState(null);

  // Load candidate data if not provided
  useEffect(() => {
    const loadCandidate = async () => {
      if (isOpen && match && !candidate) {
        console.log('Loading candidate data for:', match.candidate_id);
        try {
          const candidateData = await base44.entities.Candidate.filter({ id: match.candidate_id });
          if (candidateData && candidateData.length > 0) {
            setLoadedCandidate(candidateData[0]);
          }
        } catch (error) {
          console.error('Error loading candidate:', error);
        }
      } else if (isOpen && candidate) {
        setLoadedCandidate(candidate);
      }
    };
    
    loadCandidate();
  }, [isOpen, match, candidate]);

  useEffect(() => {
    const actualCandidate = loadedCandidate || candidate;
    
    if (isOpen && match) {
      console.log('SendMatchWhatsappDialog - Setting data:', { 
        phone: actualCandidate?.phone_primary, 
        candidateName: actualCandidate?.first_name || match.candidate_name,
        jobTitle: job?.title,
        hasJob: !!job,
        hasCandidate: !!actualCandidate 
      });
      
      // Set phone number - use candidate data or fallback to match data
      const phone = actualCandidate?.phone_primary || match.candidate_phone || '';
      setPhoneNumber(phone);

      // Build default message even if job is missing (use match data as fallback)
      const candidateName = actualCandidate?.first_name || match.candidate_name.split(' ')[0];
      const jobTitle = job?.title || match.job_title || 'לא צוין';
      const jobDescription = job?.description || 'אנא פנה למשרד לפרטים נוספים';
      const jobRequirements = job?.requirements || 'יפורט בשיחה';
      
      const defaultMessage = `שלום ${candidateName}
זו טל מחברת פנדה-טק (סוכנת בינה מלאכותית). 
יש לי משרה שנראית רלוונטית עבורך. 

*שם המשרה:*
${jobTitle}

*תיאור המשרה:*
${jobDescription}

*דרישות התפקיד:*
${jobRequirements}

*במידה ויש התאמה שלך למשרה לדעתך, ויש עניין מצידך להתקדם יש להקיש 1.* אחרת 0.`;

      setMessage(defaultMessage);
      
      // Load existing conversation if exists
      loadConversation();
    }
  }, [isOpen, match, job, loadedCandidate, candidate]);

  const loadConversation = async () => {
    if (!match?.id) return;
    
    try {
      // Load all WhatsApp messages for this match
      const messages = await base44.entities.WhatsappMessage.filter({
        match_id: match.id
      }, '-created_date');
      
      setConversation(messages);
      
      // Determine status based on latest candidate response
      const candidateMessages = messages.filter(m => m.direction === 'incoming');
      if (candidateMessages.length > 0) {
        const lastResponse = (candidateMessages[0].content || candidateMessages[0].message_text || '').trim();
        if (lastResponse === '1') {
          setCandidateStatus('interested');
        } else if (lastResponse === '0') {
          setCandidateStatus('not_interested');
        } else {
          setCandidateStatus('conversation');
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const handleSend = async () => {
    if (!phoneNumber || !message) {
      toast.error('נא למלא מספר טלפון והודעה');
      return;
    }

    setSending(true);
    try {
      // Format phone number for WhatsApp
      let formattedPhone = phoneNumber.replace(/[-\s]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '972' + formattedPhone.substring(1);
      }
      if (!formattedPhone.startsWith('972')) {
        formattedPhone = '972' + formattedPhone;
      }

      // Send via Green API (Tal's instance)
      const response = await base44.functions.invoke('sendWhatsappViaGreenApi', {
        phone: formattedPhone,
        message: message
      });

      if (response.data.success) {
        // Log to WhatsappMessage entity
        await base44.entities.WhatsappMessage.create({
          match_id: match.id,
          candidate_id: match.candidate_id,
          candidate_name: match.candidate_name,
          job_id: match.job_id,
          job_title: match.job_title,
          phone_number: formattedPhone,
          message_text: message,
          direction: 'outgoing',
          status: 'sent',
          green_api_message_id: response.data.message_id
        });

        toast.success('ההודעה נשלחה בהצלחה');
        
        // Reload conversation
        await loadConversation();
        
        // Clear message for next one
        setMessage('');
      } else {
        throw new Error(response.data.error || 'שליחה נכשלה');
      }
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('שגיאה בשליחת ההודעה: ' + error.message);
    } finally {
      setSending(false);
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  שליחת WhatsApp למועמד
                </DialogTitle>
                {match && (
                  <DialogDescription>
                    שליחת הודעה ל-{match.candidate_name} על משרה: {match.job_title}
                    <br />
                    <span className="text-amber-600 font-medium">שים לב: זוהי פעולה חד-צדדית של שליחת הודעה בלבד</span>
                  </DialogDescription>
                )}
              </div>
            </div>
            
            {/* Status Badge */}
            {candidateStatus === 'interested' && (
              <Badge className="bg-green-500 text-white text-sm py-2 px-4 w-fit">
                <CheckCircle className="w-4 h-4 ml-1" />
                מועמד מעוניין
              </Badge>
            )}
            {candidateStatus === 'not_interested' && (
              <Badge className="bg-red-500 text-white text-sm py-2 px-4 w-fit">
                <XCircle className="w-4 h-4 ml-1" />
                לא מעוניין
              </Badge>
            )}
            {candidateStatus === 'conversation' && (
              <Badge className="bg-orange-500 text-white text-sm py-2 px-4 w-fit">
                <AlertCircle className="w-4 h-4 ml-1" />
                שיחה עם מועמד
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phone Number */}
          <div>
            <Label htmlFor="phone">מספר טלפון</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="מספר טלפון המועמד"
              className="mt-1"
              dir="ltr"
            />
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">הודעה</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="mt-1"
              placeholder="תוכן ההודעה למועמד..."
            />
          </div>

          {/* Conversation History */}
          {conversation.length > 0 && (
            <div>
              <Label>חלונית דו-שיח</Label>
              <div className="mt-2 border rounded-lg p-3 max-h-64 overflow-y-auto bg-gray-50 space-y-2">
                {conversation.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`p-2 rounded-lg text-sm ${
                      msg.direction === 'outgoing'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-white border border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs flex items-center gap-1">
                        {msg.direction === 'outgoing' ? (
                          <>
                            <Send className="w-3 h-3" />
                            טל
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" />
                            {match.candidate_name}
                          </>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.created_date).toLocaleString('he-IL')}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content || msg.message_text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            ביטול
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !phoneNumber || !message}
            className="bg-green-600 hover:bg-green-700"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                שולח...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 ml-2" />
                שלח WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}