import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, MessageCircle, Building, Loader2, Calendar, User, FileText } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export default function ClientCommunicationHistory({ jobId, jobTitle, open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (open && jobId) {
      loadCommunicationHistory();
    }
  }, [open, jobId]);

  const loadCommunicationHistory = async () => {
    setLoading(true);
    try {
      // Load EmailOutbox - messages sent to clients about this job's candidates
      const emailOutbox = await base44.entities.EmailOutbox.filter({
        candidate_id: { $exists: true }
      });

      // Filter for messages related to this job
      const jobRelatedMessages = emailOutbox.filter(msg => {
        // Check if message content mentions the job or if we have a way to link it
        return msg.message_content?.includes(jobTitle) || 
               msg.subject?.includes(jobTitle);
      });

      // Combine all messages
      const allMessages = [];

      // Add Email Outbox messages to clients
      jobRelatedMessages.forEach(email => {
        allMessages.push({
          type: 'email_to_client',
          direction: 'outgoing',
          content: email.message_content || '',
          subject: email.subject || '',
          timestamp: email.created_date,
          clientName: email.client_name,
          clientEmail: email.client_email,
          candidateName: email.candidate_name,
          status: email.status,
          sentBy: email.sent_by_user_name
        });
      });

      // Sort by timestamp (newest first)
      allMessages.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0);
        const dateB = new Date(b.timestamp || 0);
        return dateB - dateA;
      });

      setMessages(allMessages);
    } catch (error) {
      console.error('Error loading client communication history:', error);
    }
    setLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building className="w-6 h-6 text-blue-600" />
            היסטוריית תקשורת עם לקוחות - {jobTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>לא נמצאה תקשורת עם לקוחות עבור משרה זו</p>
          </div>
        ) : (
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className="border rounded-lg p-4 bg-blue-50 border-blue-200"
                >
                  {/* Header with badges */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <Badge className="bg-blue-100 text-blue-700 text-xs">מייל ללקוח</Badge>
                    </div>

                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Building className="w-3 h-3" />
                      {msg.clientName}
                    </Badge>

                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <User className="w-3 h-3" />
                      {msg.candidateName}
                    </Badge>

                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Calendar className="w-3 h-3" />
                      {formatTimestamp(msg.timestamp)}
                    </Badge>

                    {msg.status && (
                      <Badge 
                        className={`text-xs ${
                          msg.status === 'sent' 
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

                  {/* Email details */}
                  <div className="space-y-2">
                    {msg.clientEmail && (
                      <div className="text-xs text-gray-600">
                        <span className="font-semibold">אל: </span>
                        {msg.clientEmail}
                      </div>
                    )}

                    {msg.subject && (
                      <div className="mb-2">
                        <span className="font-semibold text-sm text-gray-700">נושא: </span>
                        <span className="text-sm text-gray-600">{msg.subject}</span>
                      </div>
                    )}

                    {msg.sentBy && (
                      <div className="text-xs text-gray-500">
                        <span className="font-semibold">נשלח על ידי: </span>
                        {msg.sentBy}
                      </div>
                    )}

                    {/* Message content */}
                    <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap bg-white/70 p-3 rounded border border-blue-200">
                      {msg.content || 'אין תוכן'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            סגור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}