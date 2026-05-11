import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Mail,
  Send,
  Settings as SettingsIcon,
  Award,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { syncPipedriveEmployees } from '@/functions/syncPipedriveEmployees';
import EitanSettingsManagement from './EitanSettingsManagement';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const dayLabels = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת'
};

export default function EitanManagement() {
  const [settings, setSettings] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedules, logs] = await Promise.all([
        base44.entities.EitanSchedule.list('-updated_date', 1),
        base44.entities.PipedriveSyncStatus.filter({ sync_type: 'employees' }, '-last_run_time', 10)
      ]);

      if (schedules && schedules.length > 0) {
        setSettings(schedules[0]);
      } else {
        const newSettings = await base44.entities.EitanSchedule.create({
          is_enabled: false,
          sync_frequency: 'weekly',
          day_of_week: 'sunday',
          time: '08:00',
          weekly_report_enabled: false,
          weekly_report_day: 'sunday',
          weekly_report_time: '09:00',
          recipient_email: ''
        });
        setSettings(newSettings);
      }

      setSyncLogs(logs || []);
    } catch (e) {
      console.error('Error loading data:', e);
      toast.error('שגיאה בטעינת הנתונים');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await base44.entities.EitanSchedule.update(settings.id, settings);
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const runSyncNow = async () => {
    setSyncing(true);
    try {
      toast.info('מתחיל סנכרון עובדים מ-Pipedrive...');
      const result = await syncPipedriveEmployees();
      if (result.data?.success) {
        toast.success(`סנכרון הושלם: ${result.data.employeesCreated} עובדים נוצרו, ${result.data.employeesUpdated} עודכנו, ${result.data.employeesDeleted} נמחקו`);
        await loadData();
      } else if (result.data?.error) {
        toast.error(result.data.error);
      }
    } catch (e) {
      console.error('Error syncing:', e);
      toast.error('שגיאה בסנכרון');
    }
    setSyncing(false);
  };

  const sendWeeklyReportNow = async () => {
    setSendingReport(true);
    try {
      toast.info('שולח דוח נתונים חסרים...');
      const result = await base44.functions.invoke('sendEitanWeeklyReport', {});
      if (result.data?.success) {
        const { employeesWithoutManager, managersWithMissingData } = result.data;
        toast.success(`הדוח נשלח בהצלחה! ${employeesWithoutManager} עובדים ללא מנהל, ${managersWithMissingData} מנהלים עם נתונים חסרים`);
      } else {
        toast.error(result.data?.error || 'שגיאה בשליחת הדוח');
      }
    } catch (e) {
      console.error('Error sending report:', e);
      toast.error('שגיאה בשליחת הדוח');
    }
    setSendingReport(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img 
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" 
          alt="איתן" 
          className="w-12 h-12 rounded-full object-cover border-2 border-blue-200 shadow"
        />
        <div>
          <h2 className="text-xl font-bold text-gray-900">איתן - בדיקות איכות</h2>
          <p className="text-sm text-gray-600">הגדרות סנכרון נתוני עובדים לבדיקות איכות</p>
        </div>
      </div>

      <Tabs defaultValue="sync" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            הגדרות סנכרון
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Award className="w-4 h-4" />
            היסטוריית סנכרונים
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2">
            <Send className="w-4 h-4" />
            דוח שבועי
          </TabsTrigger>
          <TabsTrigger value="check_settings" className="gap-2">
            <SettingsIcon className="w-4 h-4" />
            הגדרות המבדק
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sync">
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            סנכרון אוטומטי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm mb-4">
            <div className="font-medium text-blue-800 mb-2">איתן אחראי על 2 תהליכי סנכרון אוטומטיים:</div>
            <ul className="list-disc mr-5 space-y-1 text-blue-700">
              <li><strong>סנכרון עובדים מ-Pipedrive</strong> - מעדכן את מאגר העובדים ממנהלי Pipedrive</li>
              <li><strong>סנכרון טופס מועמדים חדשים</strong> - מייבא מועמדים חדשים מ-Google Sheet, ומעדכן אותם ב-Pipedrive</li>
            </ul>
            <p className="text-xs text-blue-600 mt-2">שני התהליכים רצים באותו תזמון שמוגדר למטה</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={settings?.is_enabled || false}
                onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
              />
              <div>
                <Label>סנכרון אוטומטי</Label>
                <p className="text-sm text-gray-500">הפעלת סנכרון תזמון</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={runSyncNow}
              disabled={syncing}
              className="gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              סנכרון עכשיו
            </Button>
          </div>

          {settings?.is_enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>תדירות</Label>
                  <Select
                    value={settings.sync_frequency}
                    onValueChange={(value) => setSettings({ ...settings, sync_frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">שבועי</SelectItem>
                      <SelectItem value="daily">יומי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.sync_frequency === 'weekly' && (
                  <div>
                    <Label>יום בשבוע</Label>
                    <Select
                      value={settings.day_of_week}
                      onValueChange={(value) => setSettings({ ...settings, day_of_week: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(dayLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>שעה</Label>
                  <Input
                    type="time"
                    value={settings.time}
                    onChange={(e) => setSettings({ ...settings, time: e.target.value })}
                  />
                </div>
              </div>

              {settings.last_run_time && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">ריצה אחרונה:</span>
                    <span className="font-medium text-blue-800">
                      {new Date(settings.last_run_time).toLocaleString('he-IL', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  {settings.last_run_status && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-blue-700">סטטוס:</span>
                      <Badge className={settings.last_run_status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {settings.last_run_status === 'success' ? <CheckCircle className="w-3 h-3 ml-1" /> : <AlertCircle className="w-3 h-3 ml-1" />}
                        {settings.last_run_status === 'success' ? 'הצליח' : 'נכשל'}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-4 border-t mt-4">
            <Button
              onClick={saveSettings}
              disabled={saving}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              שמור הגדרות סנכרון
            </Button>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            היסטוריית סנכרונים ({syncLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>תאריך ושעה</TableHead>
                  <TableHead className="text-center">סטטוס</TableHead>
                  <TableHead className="text-center">נוצרו</TableHead>
                  <TableHead className="text-center">עודכנו</TableHead>
                  <TableHead className="text-center">נמחקו</TableHead>
                  <TableHead>הודעת שגיאה</TableHead>
                  <TableHead className="text-center">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      אין היסטוריית סנכרונים
                    </TableCell>
                  </TableRow>
                ) : (
                  syncLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        {new Date(log.last_run_time).toLocaleString('he-IL', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={log.status === 'success' ? 'bg-green-100 text-green-800' : log.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                          {log.status === 'success' && <CheckCircle className="w-3 h-3 ml-1" />}
                          {log.status === 'failed' && <AlertCircle className="w-3 h-3 ml-1" />}
                          {log.status === 'in_progress' && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
                          {log.status === 'success' ? 'הצליח' : log.status === 'failed' ? 'נכשל' : 'בתהליך'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{log.items_created || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{log.items_updated || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{log.items_deleted || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-red-600">
                        {log.error_message || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          פירוט
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-600" />
            דוח שבועי - נתונים חסרים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={settings?.weekly_report_enabled || false}
                onCheckedChange={(checked) => setSettings({ ...settings, weekly_report_enabled: checked })}
              />
              <div>
                <Label>דוח שבועי אוטומטי</Label>
                <p className="text-sm text-gray-500">שליחת דוח על עובדים ומנהלים עם נתונים חסרים</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={sendWeeklyReportNow}
              disabled={sendingReport || !settings?.recipient_email}
              className="gap-2"
            >
              {sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              שלח דוח עכשיו
            </Button>
          </div>

          {settings?.weekly_report_enabled && (
            <div className="space-y-4">
              <div>
                <Label>מייל יעד לדוח</Label>
                <Input
                  type="email"
                  value={settings.recipient_email || ''}
                  onChange={(e) => setSettings({ ...settings, recipient_email: e.target.value })}
                  placeholder="your@email.com"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">כתובת המייל אליה יישלח הדוח השבועי</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>יום בשבוע</Label>
                  <Select
                    value={settings.weekly_report_day}
                    onValueChange={(value) => setSettings({ ...settings, weekly_report_day: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(dayLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>שעת שליחה</Label>
                  <Input
                    type="time"
                    value={settings.weekly_report_time}
                    onChange={(e) => setSettings({ ...settings, weekly_report_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-sm">
                <div className="font-medium text-purple-800 mb-2">הדוח יכלול:</div>
                <ul className="list-disc mr-5 space-y-1 text-purple-700">
                  <li>עובדים שאין להם מנהל ישיר בפייפדרייב</li>
                  <li>מנהלים ישירים ללא מייל או טלפון</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={saveSettings}
              disabled={saving}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              שמור הגדרות סנכרון
            </Button>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="check_settings">
          <EitanSettingsManagement />
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              פירוט מלא לסנכרון
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">תאריך ושעה:</span>
                  <span className="font-medium">{new Date(selectedLog.last_run_time).toLocaleString('he-IL', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">סטטוס:</span>
                  <Badge className={selectedLog.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {selectedLog.status === 'success' ? 'הצליח' : 'נכשל'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedLog.items_created || 0}</div>
                    <div className="text-xs text-gray-500">נוצרו</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedLog.items_updated || 0}</div>
                    <div className="text-xs text-gray-500">עודכנו</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{selectedLog.items_deleted || 0}</div>
                    <div className="text-xs text-gray-500">נמחקו</div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedLog.error_message && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <div className="font-medium text-red-800 mb-1">הודעת שגיאה:</div>
                  <div className="text-sm text-red-700">{selectedLog.error_message}</div>
                </div>
              )}

              {/* Details JSON */}
              {selectedLog.details && (
                <div>
                  <div className="font-medium text-gray-700 mb-2">פירוט מלא:</div>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto" dir="ltr">
                    {JSON.stringify(JSON.parse(selectedLog.details), null, 2)}
                  </pre>
                </div>
              )}

              {!selectedLog.details && !selectedLog.error_message && (
                <div className="text-center py-4 text-gray-500">
                  אין פירוט נוסף זמין לסנכרון זה
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}