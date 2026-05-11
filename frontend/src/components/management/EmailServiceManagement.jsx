import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Mail, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Send,
  Search,
  Paperclip
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function EmailServiceManagement() {
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load config
      const configs = await base44.entities.EmailServiceConfig.list();
      if (configs.length > 0) {
        setConfig(configs[0]);
      } else {
        // Create default config
        const newConfig = await base44.entities.EmailServiceConfig.create({
          service_name: 'resend',
          default_from_name: 'PandaHRAI',
          default_from_email: 'noreply@pandatech.co.il',
          is_active: true,
          daily_limit: 1000,
          emails_sent_today: 0
        });
        setConfig(newConfig);
      }

      // Load ALL emails from both sources
      const [emailLogData, emailOutboxData] = await Promise.all([
        base44.entities.EmailLog.list('-created_date', 200),
        base44.entities.EmailOutbox.list('-created_date', 200)
      ]);

      // Merge and mark source
      const allEmails = [
        ...emailLogData.map(m => ({ ...m, source_table: 'resend' })),
        ...emailOutboxData.map(m => ({ ...m, source_table: 'outlook' }))
      ];

      // Sort by created_date
      allEmails.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      setLogs(allEmails);
    } catch (error) {
      console.error('Error loading email service data:', error);
      toast.error('שגיאה בטעינת נתוני שירות המיילים');
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await base44.entities.EmailServiceConfig.update(config.id, {
        default_from_name: config.default_from_name,
        default_from_email: config.default_from_email,
        is_active: config.is_active,
        daily_limit: config.daily_limit,
        notes: config.notes
      });
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast.error('אנא הזן כתובת מייל לבדיקה');
      return;
    }
    setTestSending(true);
    try {
      const { sendEmailViaResend } = await import('@/functions/sendEmailViaResend');
      const result = await sendEmailViaResend({
        to: testEmail,
        subject: 'בדיקת שירות מיילים - PandaHRAI',
        body: `שלום,\n\nזוהי הודעת בדיקה משירות המיילים של PandaHRAI.\n\nאם קיבלת הודעה זו, שירות המיילים פועל כראוי.\n\nבברכה,\nמערכת PandaHRAI`
      });
      
      if (result.data?.success) {
        toast.success('מייל בדיקה נשלח בהצלחה!');
        loadData(); // Refresh logs
      } else {
        toast.error('שגיאה בשליחת מייל בדיקה: ' + (result.data?.error || 'שגיאה לא ידועה'));
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('שגיאה בשליחת מייל בדיקה');
    }
    setTestSending(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 ml-1" />נשלח</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 ml-1" />נכשל</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Loader2 className="w-3 h-3 ml-1 animate-spin" />ממתין</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceLabel = (source) => {
    const labels = {
      manual: 'ידני',
      agent: 'סוכן',
      system: 'מערכת',
      candidate_send: 'שליחת מועמד',
      job_send: 'שליחת משרה',
      notification: 'התראה'
    };
    return labels[source] || source;
  };

  const filteredLogs = logs.filter(msg => {
    const matchesSearch = !searchTerm ||
      msg.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.message_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.message_content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.from_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            שירות מיילים - Resend
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status indicator */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${config?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="font-medium">{config?.is_active ? 'השירות פעיל' : 'השירות מושבת'}</span>
            <Badge variant="outline" className="mr-auto">
              {config?.emails_sent_today || 0} / {config?.daily_limit || 1000} מיילים היום
            </Badge>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>שם השולח ברירת מחדל</Label>
              <Input
                value={config?.default_from_name || ''}
                onChange={(e) => setConfig({ ...config, default_from_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>כתובת השולח ברירת מחדל</Label>
              <Input
                value={config?.default_from_email || ''}
                onChange={(e) => setConfig({ ...config, default_from_email: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>מגבלת מיילים יומית</Label>
              <Input
                type="number"
                value={config?.daily_limit || 1000}
                onChange={(e) => setConfig({ ...config, daily_limit: parseInt(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={config?.is_active || false}
                onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
              />
              <Label>שירות פעיל</Label>
            </div>
          </div>

          <Button onClick={saveConfig} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Settings className="w-4 h-4 ml-2" />}
            שמור הגדרות
          </Button>
        </CardContent>
      </Card>

      {/* Test Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-green-600" />
            בדיקת שירות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="כתובת מייל לבדיקה"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={sendTestEmail} disabled={testSending} variant="outline">
              {testSending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
              שלח מייל בדיקה
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All Emails History */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              כל המיילים במערכת
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="חיפוש לפי מס׳ הודעה, שם, נושא, נמען..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="sent">נשלח</SelectItem>
                <SelectItem value="failed">נכשל</SelectItem>
                <SelectItem value="pending">ממתין</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{logs.length}</div>
              <div className="text-sm text-blue-600">סה״כ מיילים</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">
                {logs.filter(m => m.status === 'sent').length}
              </div>
              <div className="text-sm text-green-600">נשלחו</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-700">
                {logs.filter(m => m.status === 'failed').length}
              </div>
              <div className="text-sm text-red-600">נכשלו</div>
            </div>
          </div>

          {logs.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead>מס׳</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>נושא</TableHead>
                    <TableHead>נמען</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>שולח</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono font-semibold text-blue-700">
                        {log.message_number || log.resend_message_id?.substring(0, 8) || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.created_date).toLocaleString('he-IL')}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={log.subject}>
                          {log.subject || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="max-w-[180px] truncate" title={log.to || log.client_email}>
                          {log.to || log.client_email || '-'}
                        </div>
                        {log.candidate_name && (
                          <div className="text-xs text-gray-500 mt-1">
                            מועמד: {log.candidate_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                        {log.error_message && (
                          <div className="text-xs text-red-600 mt-1 max-w-[150px] truncate" title={log.error_message}>
                            {log.error_message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.source_table === 'resend' ? 'Resend' : 'Outlook'}
                        </Badge>
                        {log.source && log.source !== 'manual' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {getSourceLabel(log.source)}
                          </div>
                        )}
                        {log.attachment_filename && (
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {log.attachment_filename}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.sent_by_user_name || log.from_name || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>אין מיילים להצגה</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}