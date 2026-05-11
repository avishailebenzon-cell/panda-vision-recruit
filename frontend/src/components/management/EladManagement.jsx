import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Play,
  Loader2,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Building,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { runEladAgent } from '@/functions/runEladAgent';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EladSettingsManagement from '@/components/elad/EladSettingsManagement';
import { base44 } from '@/api/base44Client';

const DAYS_OPTIONS = [
  { value: 'sunday', label: 'ראשון' },
  { value: 'monday', label: 'שני' },
  { value: 'tuesday', label: 'שלישי' },
  { value: 'wednesday', label: 'רביעי' },
  { value: 'thursday', label: 'חמישי' },
  { value: 'friday', label: 'שישי' },
  { value: 'saturday', label: 'שבת' }
];

const TIME_OPTIONS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export default function EladManagement() {
  const [settings, setSettings] = useState({
    is_enabled: true,
    days: ['sunday', 'tuesday', 'thursday'],
    time: '09:00',
    recipient_name: '',
    recipient_email: ''
  });
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const schedules = await base44.entities.EladSchedule.list('-updated_date', 1);
      
      if (schedules.length > 0) {
        const s = schedules[0];
        setSettings({
          is_enabled: s.is_enabled ?? true,
          days: s.days || ['sunday', 'tuesday', 'thursday'],
          time: s.time || '09:00',
          recipient_name: s.recipient_name || '',
          recipient_email: s.recipient_email || ''
        });
        setSettingsId(s.id);
        setLastRun({
          time: s.last_run_time,
          status: s.last_run_status,
          missingCount: s.last_missing_count
        });
      }
    } catch (e) {
      console.log('Could not load Elad settings');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!settings.recipient_email) {
      toast.error('יש להזין כתובת מייל לנמען');
      return;
    }

    setSaving(true);
    try {
      if (settingsId) {
        await base44.entities.EladSchedule.update(settingsId, settings);
      } else {
        const created = await base44.entities.EladSchedule.create(settings);
        setSettingsId(created.id);
      }
      
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const runManually = async () => {
    if (!settings.recipient_email) {
      toast.error('יש להגדיר מייל נמען לפני הרצה');
      return;
    }

    setRunning(true);
    try {
      const response = await runEladAgent({});
      
      if (response.data?.success) {
        if (response.data.emailSent) {
          toast.success(`נמצאו ${response.data.missingCount} רשומות עם פרטים חסרים. נשלח מייל ל-${response.data.recipient}`);
        } else {
          toast.success('כל הנתונים תקינים - לא נמצאו פרטים חסרים');
        }
        loadSettings(); // Refresh to get updated last run info
      } else {
        toast.error(response.data?.error || 'שגיאה בהרצת אלעד');
      }
    } catch (e) {
      console.error('Error running Elad:', e);
      toast.error('שגיאה בהרצת אלעד');
    }
    setRunning(false);
  };

  const toggleDay = (day) => {
    setSettings(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="schedule" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 max-w-md">
        <TabsTrigger value="schedule">תזמון בדיקות</TabsTrigger>
        <TabsTrigger value="email-settings">הגדרות שליחה</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule">
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face" 
                alt="אלעד" 
                className="w-14 h-14 rounded-full object-cover border-4 border-blue-200 shadow-lg"
              />
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  אלעד - ניהול לקוחות
                </CardTitle>
                <p className="text-sm text-gray-600">
                  סוכן AI לבדיקת שלמות נתוני לקוחות ואנשי קשר
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_enabled: checked }))}
              />
              <span className={settings.is_enabled ? 'text-green-600 font-medium' : 'text-gray-500'}>
                {settings.is_enabled ? 'פעיל' : 'מושבת'}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Last Run Status */}
          {lastRun?.time && (
            <Alert className={lastRun.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              {lastRun.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    ריצה אחרונה: {new Date(lastRun.time).toLocaleString('he-IL', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  {lastRun.missingCount !== undefined && (
                    <Badge variant={lastRun.missingCount > 0 ? 'destructive' : 'default'}>
                      {lastRun.missingCount} פרטים חסרים
                    </Badge>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Recipient Settings */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <Label className="font-medium">נמען לדוחות</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recipient_name" className="text-sm">שם העובד</Label>
                  <Input
                    id="recipient_name"
                    value={settings.recipient_name}
                    onChange={(e) => setSettings(prev => ({ ...prev, recipient_name: e.target.value }))}
                    placeholder="שם העובד שיקבל את הדוח"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="recipient_email" className="text-sm">כתובת מייל *</Label>
                  <Input
                    id="recipient_email"
                    type="email"
                    value={settings.recipient_email}
                    onChange={(e) => setSettings(prev => ({ ...prev, recipient_email: e.target.value }))}
                    placeholder="email@company.com"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Settings */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <Label className="font-medium">תזמון בדיקות</Label>
              </div>

              <div>
                <Label className="text-sm mb-2 block">ימים בשבוע</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OPTIONS.map(day => (
                    <div
                      key={day.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        settings.days.includes(day.value)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleDay(day.value)}
                    >
                      <Checkbox
                        checked={settings.days.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <span className="text-sm">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm mb-2 block">שעת הריצה</Label>
                <Select
                  value={settings.time}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, time: value }))}
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
            </CardContent>
          </Card>

          {/* What Elad Checks */}
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription>
              <div className="font-medium mb-1">אלעד בודק:</div>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>שלכל איש קשר יש שיוך ארגוני (לקוח)</li>
                <li>שלכל איש קשר יש כתובת מייל</li>
                <li>שלכל איש קשר יש מספר טלפון</li>
                <li>שלכל לקוח יש פרטי התקשרות מלאים</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              variant="outline"
              onClick={runManually}
              disabled={running || !settings.recipient_email}
              className="gap-2"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              הרץ בדיקה עכשיו
            </Button>
            <Button
              onClick={saveSettings}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              שמור הגדרות
            </Button>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="email-settings">
        <EladSettingsManagement />
      </TabsContent>
    </Tabs>
  );
}