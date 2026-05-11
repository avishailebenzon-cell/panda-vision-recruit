import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Mail, 
  Clock, 
  Save, 
  Send, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  History,
  Users,
  Briefcase,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TIME_OPTIONS = [
  '00:00', '00:30', '01:00', '01:30', '02:00', '02:30',
  '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', 
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', 
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
];

export default function CarmitManagement() {
  const [settings, setSettings] = useState({
    is_enabled: true,
    daily_summary_enabled: true,
    daily_summary_time: '16:00',
    daily_summary_email: 'avishai@pandatech.co.il'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [settingsId, setSettingsId] = useState(null);
  const [previewDialog, setPreviewDialog] = useState({ isOpen: false, html: null });
  const [generatingPreview, setGeneratingPreview] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const schedules = await base44.entities.CarmitSchedule.list('-updated_date', 1);
      if (schedules && schedules.length > 0) {
        setSettings(schedules[0]);
        setSettingsId(schedules[0].id);
      }
    } catch (e) {
      console.log('Could not load Carmit settings');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      if (settingsId) {
        await base44.entities.CarmitSchedule.update(settingsId, settings);
      } else {
        const created = await base44.entities.CarmitSchedule.create(settings);
        setSettingsId(created.id);
      }
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const generatePreview = async () => {
    setGeneratingPreview(true);
    try {
      const response = await base44.functions.invoke('sendCarmitDailySummary', { preview_mode: true });
      
      if (response.data?.success && response.data.preview) {
        setPreviewDialog({
          isOpen: true,
          html: response.data.html
        });
      } else {
        toast.info(response.data?.message || 'לא ניתן ליצור טיוטה');
      }
    } catch (e) {
      console.error('Error generating preview:', e);
      toast.error('שגיאה ביצירת טיוטה');
    }
    setGeneratingPreview(false);
  };

  const sendNow = async () => {
    setSending(true);
    try {
      toast.loading('שולח סיכום יומי...', { id: 'carmit-send' });
      const response = await base44.functions.invoke('sendCarmitDailySummary', { 
        preview_mode: false,
        target_email: settings.daily_summary_email 
      });
      
      if (response.data?.success) {
        toast.success(`הסיכום היומי נשלח בהצלחה ל-${settings.daily_summary_email}`, { id: 'carmit-send' });
        setPreviewDialog({ isOpen: false, html: null });
        await loadSettings();
      } else {
        toast.error(response.data?.error || 'שגיאה בשליחת הסיכום', { id: 'carmit-send' });
      }
    } catch (e) {
      console.error('Error sending summary:', e);
      toast.error('שגיאה בשליחת הסיכום', { id: 'carmit-send' });
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <img 
              src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=60&h=60&fit=crop&crop=face" 
              alt="כרמית" 
              className="w-14 h-14 rounded-full object-cover border-4 border-purple-200 shadow-lg"
            />
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-600" />
                כרמית - סיכום יומי
              </CardTitle>
              <p className="text-sm text-gray-600">
                מנהלת הגיוס - שולחת סיכום יומי של פעילות כל הסוכנים
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert className="bg-purple-50 border-purple-200">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <AlertDescription>
              <strong>סיכום יומי אוטומטי:</strong> כרמית תשלח מדי יום סיכום מקיף של פעילות הגיוס:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>התאמות שכל סוכן יצר ב-24 שעות האחרונות (כמות ושמות)</li>
                <li>משרות שטופלו</li>
                <li>התאמות שהועברו לטל לטיפול (כמות ושמות)</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">הפעלת סיכום יומי אוטומטי</Label>
              <p className="text-sm text-gray-500">כרמית תשלח מייל סיכום אוטומטי מדי יום בשעה שנקבעה</p>
            </div>
            <Switch
              checked={settings.daily_summary_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, daily_summary_enabled: checked })}
            />
          </div>

          {/* Schedule Settings */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              תזמון שליחת הסיכום
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  שעת שליחה (מדי יום)
                </Label>
                <Select
                  value={settings.daily_summary_time || '16:00'}
                  onValueChange={(value) => setSettings({ ...settings, daily_summary_time: value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>כתובת מייל לשליחת הסיכום</Label>
                <Input
                  type="email"
                  value={settings.daily_summary_email || 'avishai@pandatech.co.il'}
                  onChange={(e) => setSettings({ ...settings, daily_summary_email: e.target.value })}
                  placeholder="avishai@pandatech.co.il"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500">ברירת מחדל: avishai@pandatech.co.il</p>
              </div>
            </div>
          </div>

          {/* Last Run Status */}
          {settings.last_summary_sent && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {settings.last_summary_status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-medium">סיכום אחרון נשלח:</span>
                <Badge className={settings.last_summary_status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {settings.last_summary_status === 'success' ? 'הצלחה' : 'נכשל'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(settings.last_summary_sent).toLocaleString('he-IL', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
              {settings.last_summary_error && (
                <p className="text-sm text-red-600 mt-1">{settings.last_summary_error}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button onClick={saveSettings} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              שמור הגדרות
            </Button>
            <Button
              onClick={generatePreview}
              disabled={generatingPreview}
              variant="outline"
              className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              {generatingPreview ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> יוצר טיוטה...</>
              ) : (
                <><Mail className="w-4 h-4" /> הצג טיוטת סיכום</>
              )}
            </Button>
            <Button
              onClick={sendNow}
              disabled={sending || !settings.daily_summary_email}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> שולח...</>
              ) : (
                <><Send className="w-4 h-4" /> שלח סיכום עכשיו</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5 text-purple-600" />
            היסטוריית סיכומים שנשלחו
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DailySummaryLogsTable />
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewDialog.isOpen} onOpenChange={(open) => !open && setPreviewDialog({ isOpen: false, html: null })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-600" />
                סיכום יומי - טיוטה
              </div>
              <Button
                onClick={sendNow}
                size="sm"
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
                שלח עכשיו
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline">
                {new Date().toLocaleDateString('he-IL')}
              </Badge>
            </div>
            <div 
              className="bg-white p-6 rounded-lg border prose prose-sm max-w-none"
              style={{ direction: 'rtl' }}
              dangerouslySetInnerHTML={{ __html: previewDialog.html }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Daily Summary Logs Table Component
function DailySummaryLogsTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLogs = async () => {
    try {
      const emailLogs = await base44.entities.EmailLog.filter(
        { related_entity_type: 'CarmitDailySummary' },
        '-created_date',
        30
      );
      setLogs(Array.isArray(emailLogs) ? emailLogs : []);
    } catch (e) {
      console.error('Could not load summary logs:', e);
      setLogs([]);
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />נשלח בהצלחה</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />נכשל</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>טרם נשלחו סיכומים</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-40">תאריך</TableHead>
            <TableHead className="w-32">סטטוס</TableHead>
            <TableHead className="w-48">נשלח אל</TableHead>
            <TableHead>נושא</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className={log.status === 'sent' ? 'bg-green-50' : log.status === 'failed' ? 'bg-red-50' : ''}>
              <TableCell className="text-sm">
                {new Date(log.created_date).toLocaleString('he-IL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Jerusalem'
                })}
              </TableCell>
              <TableCell>{getStatusBadge(log.status)}</TableCell>
              <TableCell className="text-sm font-medium text-gray-700">{log.to}</TableCell>
              <TableCell className="text-sm">
                {log.status === 'failed' && log.error_message && (
                  <div className="flex items-start gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{log.error_message}</span>
                  </div>
                )}
                {log.status === 'sent' && (
                  <span className="text-gray-600 line-clamp-1">
                    {log.subject}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}