import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, Loader2, Send, Eye, Mail, MessageCircle, Briefcase, User as UserIcon } from 'lucide-react';
import BlurredText from '@/components/ui/BlurredText';
import { toast } from 'sonner';

export default function DirectOutreachTabElad() {
  const [outreachData, setOutreachData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessages, setSelectedMessages] = useState(new Set());

  const loadOutreachData = async () => {
    setLoading(true);
    try {
      // Get all email messages sent from UnifiedSendDialog to clients
      const allEmailLogs = await base44.entities.EmailLog.list('-created_date', 5000);
      
      // Get all WhatsApp messages sent to clients
      const allWhatsappLogs = await base44.entities.WhatsappOutbox.list('-created_date', 5000);
      
      console.log(`Loaded ${allEmailLogs.length} email logs and ${allWhatsappLogs.length} WhatsApp logs`);
      
      // Filter messages that were sent to clients (have client_id)
      const clientEmails = allEmailLogs.filter(log => 
        log.client_id && log.candidate_id
      ).map(log => ({
        ...log,
        type: 'email',
        sent_date: log.sent_at || log.created_date,
        recipient: log.client_email,
        subject: log.subject
      }));
      
      const clientWhatsapp = allWhatsappLogs.filter(log => 
        log.client_id && log.candidate_id
      ).map(log => ({
        ...log,
        type: 'whatsapp',
        sent_date: log.created_date,
        recipient: log.client_phone || log.recipient_phone,
        subject: 'הודעת WhatsApp'
      }));
      
      // Combine and sort by date
      const allMessages = [...clientEmails, ...clientWhatsapp]
        .sort((a, b) => new Date(b.sent_date) - new Date(a.sent_date));
      
      setOutreachData(allMessages);
    } catch (error) {
      console.error('Error loading outreach data:', error);
      toast.error('שגיאה בטעינת נתוני דואר יוצא');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOutreachData();
    
    // Subscribe to EmailLog updates for real-time display
    const unsubscribeEmails = base44.entities.EmailLog.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        loadOutreachData();
      }
    });
    
    // Subscribe to WhatsappOutbox updates for real-time display
    const unsubscribeWhatsapp = base44.entities.WhatsappOutbox.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        loadOutreachData();
      }
    });
    
    return () => {
      unsubscribeEmails();
      unsubscribeWhatsapp();
    };
  }, []);

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = outreachData.map(msg => msg.id);
      setSelectedMessages(new Set(allIds));
    } else {
      setSelectedMessages(new Set());
    }
  };

  const getMessageBadge = (message) => {
    if (message.type === 'email') {
      return (
        <Badge className="bg-blue-500 text-white">
          <Mail className="w-3 h-3 ml-1" />
          מייל
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-green-500 text-white">
          <MessageCircle className="w-3 h-3 ml-1" />
          WhatsApp
        </Badge>
      );
    }
  };

  const getStatusBadge = (message) => {
    const status = message.status || 'sent';
    
    if (status === 'sent') {
      return <Badge className="bg-green-100 text-green-800">נשלח</Badge>;
    } else if (status === 'failed') {
      return <Badge className="bg-red-100 text-red-800">נכשל</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800">ממתין</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-600" />
            הודעות יוצאות ללקוחות דרך סוכני הגיוס
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadOutreachData}>
            <RefreshCw className="w-4 h-4 ml-2" />
            רענן
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          מיילים והודעות WhatsApp שנשלחו ישירות ללקוחות על ידי הגייסות (נעמה, רמי, אליק, איתי, ליאור, אופיר, GC)
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedMessages.size > 0 && selectedMessages.size === outreachData.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>מועמד</TableHead>
                <TableHead>משרה</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>נמען</TableHead>
                <TableHead>נושא</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך שליחה</TableHead>
                <TableHead>נשלח ע״י</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outreachData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    <Send className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    טרם נשלחו הודעות ישירות ללקוחות
                  </TableCell>
                </TableRow>
              ) : (
                outreachData.map((message) => (
                  <TableRow key={`${message.type}-${message.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMessages.has(message.id)}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedMessages);
                          if (checked) {
                            newSelected.add(message.id);
                          } else {
                            newSelected.delete(message.id);
                          }
                          setSelectedMessages(newSelected);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {getMessageBadge(message)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3 h-3 text-blue-600" />
                        <BlurredText>{message.candidate_name || message.candidate_full_name}</BlurredText>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3 h-3 text-orange-600" />
                        <span className="text-sm">{message.job_title || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BlurredText>{message.client_company_name || message.client_name || '-'}</BlurredText>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-mono text-gray-600" dir="ltr">
                        <BlurredText>{message.recipient}</BlurredText>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-xs truncate">{message.subject}</div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(message)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(message.sent_date).toLocaleDateString('he-IL')}
                      <div className="text-xs text-gray-400">
                        {new Date(message.sent_date).toLocaleTimeString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-600">
                        <BlurredText>{message.sent_by_user_name}</BlurredText>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}