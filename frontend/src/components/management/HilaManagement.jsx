import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MobileTabs, MobileTabsButtons, MobileTabButton, MobileTabsContent } from '@/components/ui/mobile-tabs';
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
  Calendar, 
  Clock, 
  Save, 
  Play, 
  Loader2, 
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Users,
  FileText,
  Send,
  Eye,
  MessageCircle,
  Inbox,
  Phone,
  ExternalLink,
  Check,
  Settings,
  RefreshCw,
  History,
  XCircle,
  Download,
  Megaphone
} from 'lucide-react';
import { toast } from 'sonner';
import { runHilaAgent } from '@/functions/runHilaAgent';
import { createHilaDraft } from '@/functions/createHilaDraft';
import { scheduledHilaProcess } from '@/functions/scheduledHilaProcess';
import { generateJobPublicationReport } from '@/functions/generateJobPublicationReport';
import { base44 } from '@/api/base44Client';
import { Checkbox } from '@/components/ui/checkbox';
import CandidatesEmailTab from './CandidatesEmailTab';
import EmployeeEmailsTable from '../hila/EmployeeEmailsTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  '00:00', '00:30', '01:00', '01:30', '02:00', '02:30',
  '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', 
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', 
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
];

export default function HilaManagement() {
  const [activeTab, setActiveTab] = useState("");
  const [settings, setSettings] = useState({
    is_enabled: true,
    days: ['sunday'],
    day_of_week: 'sunday',
    time: '09:00',
    draft_days: ['thursday'],
    draft_send_day: 'thursday',
    draft_send_time: '10:00',
    publication_report_enabled: true,
    publication_report_day: 'tuesday',
    publication_report_time: '12:00',
    publication_report_email: 'Office@pandatech.co.il',
    distribution_list_email: '',
    test_email: '',
    cv_target_email: 'jobs@pandatech.co.il',
    bonus_description: 'בונוס של 2,000 ₪'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [runningFullProcess, setRunningFullProcess] = useState(false);
  const [settingsId, setSettingsId] = useState(null);
  const [pendingDrafts, setPendingDrafts] = useState([]);
  const [approvedDrafts, setApprovedDrafts] = useState([]);
  const [overrideDuplicatePrevention, setOverrideDuplicatePrevention] = useState(false);
  const [viewDraftDialog, setViewDraftDialog] = useState({ isOpen: false, draft: null });
  const [generatingPublicationPreview, setGeneratingPublicationPreview] = useState(false);
  const [publicationPreviewDialog, setPublicationPreviewDialog] = useState({ isOpen: false, html: null, jobsCount: 0 });
  const [sendingPublicationReport, setSendingPublicationReport] = useState(false);
  const [sendingTestReport, setSendingTestReport] = useState(false);

  useEffect(() => {
    loadSettings(false);  // Don't force reload - only load once
    loadPendingDrafts();
    loadApprovedDrafts();
  }, []);

  const loadSettings = async (force = false) => {
    // Don't reload if we already have settings and it's not forced
    if (settingsId && !force) {
      setLoading(false);
      return;
    }
    
    try {
      const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
      if (schedules && schedules.length > 0) {
        const s = schedules[0];
        setSettings({
          ...s,
          days: s.days || (s.day_of_week ? [s.day_of_week] : ['sunday']),
          draft_days: s.draft_days || (s.draft_send_day ? [s.draft_send_day] : ['thursday']),
          publication_report_days: s.publication_report_days || (s.publication_report_day ? [s.publication_report_day] : ['tuesday'])
        });
        setSettingsId(s.id);
      }
    } catch (e) {
      console.log('Could not load Hila settings');
    }
    setLoading(false);
  };

  const loadPendingDrafts = async () => {
    // No longer needed - simplified flow
    setPendingDrafts([]);
  };

  const loadApprovedDrafts = async () => {
    try {
      const { HilaDraft } = await import('@/entities/HilaDraft');
      // Load ready drafts (new status) or approved (backwards compatibility)
      let drafts = await HilaDraft.filter({ status: 'ready' }, '-created_date', 5);
      if (!drafts || drafts.length === 0) {
        drafts = await HilaDraft.filter({ status: 'approved' }, '-created_date', 5);
      }
      setApprovedDrafts(drafts);
    } catch (e) {
      console.log('Could not load drafts');
    }
  };


  const saveSettings = async () => {
    setSaving(true);
    try {
      const dataToSave = {
        is_enabled: settings.is_enabled,
        days: settings.days,
        day_of_week: settings.days[0] || 'sunday',
        time: settings.time,
        draft_days: settings.draft_days,
        draft_send_day: settings.draft_days[0] || 'thursday',
        draft_send_time: settings.draft_send_time,
        publication_report_enabled: settings.publication_report_enabled,
        publication_report_days: settings.publication_report_days,
        publication_report_day: settings.publication_report_days?.[0] || settings.publication_report_day || 'tuesday',
        publication_report_time: settings.publication_report_time,
        publication_report_email: settings.publication_report_email,
        distribution_list_email: settings.distribution_list_email,
        test_email: settings.test_email,
        cv_target_email: settings.cv_target_email,
        bonus_description: settings.bonus_description
      };

      if (settingsId) {
        await base44.entities.HilaSchedule.update(settingsId, dataToSave);
      } else {
        const created = await base44.entities.HilaSchedule.create(dataToSave);
        setSettingsId(created.id);
      }
      toast.success('ההגדרות נשמרו בהצלחה');
      // Don't reload - keep current settings state
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const createDraftForApproval = async () => {
    setCreatingDraft(true);
    try {
      const response = await createHilaDraft({});
      if (response.data?.success) {
        toast.success('הטיוטה נוצרה בהצלחה');
        // Reload drafts to show the new one
        const drafts = await base44.entities.HilaDraft.filter({ status: 'ready' }, '-created_date', 5);
        setApprovedDrafts(drafts);
      } else {
        toast.error(response.data?.error || 'שגיאה ביצירת הטיוטה');
      }
    } catch (e) {
      console.error('Error creating draft:', e);
      toast.error('שגיאה ביצירת הטיוטה');
    }
    setCreatingDraft(false);
  };

  const runManually = async (isTest = false) => {
    const targetEmail = isTest ? settings.test_email : settings.distribution_list_email;
    
    if (!targetEmail) {
      toast.error(isTest ? 'יש להגדיר מייל לבדיקות' : 'יש להגדיר רשימת תפוצה לפני הפעלה');
      return;
    }

    if (isTest) {
      setRunningTest(true);
      try {
        const response = await runHilaAgent({ targetEmail, isTest });
        if (response.data?.success) {
          toast.success(`המייל נשלח בהצלחה לבדיקה! ${response.data.jobsSent} משרות נשלחו`);
        } else {
          toast.error(response.data?.error || 'שגיאה בשליחת המייל');
        }
      } catch (e) {
        console.error('Error running Hila:', e);
        toast.error('שגיאה בהפעלת הילה');
      }
      setRunningTest(false);
    } else {
      // Start countdown for sending to all employees
      setCountdown(5);
      setSendSuccess(false);
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Actually send the email
            sendToAllEmployees(targetEmail);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const sendToAllEmployees = async (targetEmail) => {
    setRunning(true);
    setCountdown(null);
    
    // Show immediate visual feedback
    toast.loading('שולח מיילים לעובדים...', { id: 'hila-send' });
    
    try {
      const response = await runHilaAgent({ 
        targetEmail, 
        isTest: false,
        overrideDuplicatePrevention 
      });
      if (response.data?.success) {
        setSendSuccess(true);
        toast.success(`המייל נשלח בהצלחה לכל העובדים! ${response.data.jobsSent} משרות נשלחו`, { id: 'hila-send' });
        // Reload logs to show the new entry
        setTimeout(() => {
          setSendSuccess(false);
          loadApprovedDrafts(); // Refresh drafts in case status changed
        }, 3000);
      } else {
        toast.error(response.data?.error || 'שגיאה בשליחת המייל', { id: 'hila-send' });
      }
    } catch (e) {
      console.error('Error running Hila:', e);
      toast.error('שגיאה בהפעלת הילה', { id: 'hila-send' });
    }
    
    setRunning(false);
  };

  const runFullAutomatedProcess = async () => {
    setRunningFullProcess(true);
    try {
      const response = await scheduledHilaProcess({});
      if (response.data?.actions?.length > 0) {
        toast.success(`התהליך הושלם: ${response.data.actions.join(', ')}`);
      } else {
        toast.info('אין פעולות נדרשות כרגע (לא הגיע הזמן המתוזמן)');
      }
      // Reload only drafts, not settings (to avoid overwriting user changes)
      await Promise.all([loadPendingDrafts(), loadApprovedDrafts()]);
    } catch (e) {
      console.error('Error running full process:', e);
      toast.error('שגיאה בהפעלת התהליך');
    }
    setRunningFullProcess(false);
  };

  const generatePublicationPreview = async () => {
    setGeneratingPublicationPreview(true);
    try {
      const response = await generateJobPublicationReport({ preview_mode: true });
      const data = response.data;
      if (data?.success && data.preview) {
        setPublicationPreviewDialog({
          isOpen: true,
          html: data.html,
          jobsCount: data.jobs_count
        });
      } else {
        toast.info(data?.message || 'לא נמצאו משרות הזקוקות לפרסום');
      }
    } catch (e) {
      console.error('Error generating publication preview:', e);
      toast.error('שגיאה ביצירת טיוטת דוח הפרסום');
    }
    setGeneratingPublicationPreview(false);
  };

  const sendPublicationReport = async () => {
    setSendingPublicationReport(true);
    try {
      toast.loading('שולח דוח פרסום (עשוי לקחת עד 30 שניות)...', { id: 'publication-send' });
      const response = await generateJobPublicationReport({ 
        preview_mode: false,
        target_email: settings.publication_report_email 
      });
      if (response.data?.success) {
        toast.success(`דוח הפרסום נשלח בהצלחה ל-${settings.publication_report_email}`, { id: 'publication-send' });
        setPublicationPreviewDialog({ isOpen: false, html: null, jobsCount: 0 });
        if (settingsId) {
          setSettings(prev => ({ ...prev, last_publication_report_time: new Date().toISOString() }));
        }
      } else {
        toast.error(response.data?.error || 'שגיאה בשליחת הדוח', { id: 'publication-send' });
      }
    } catch (e) {
      console.error('Error sending publication report:', e);
      toast.error('שגיאה בשליחת דוח הפרסום', { id: 'publication-send' });
    }
    setSendingPublicationReport(false);
  };

  const sendTestPublicationReport = async () => {
    setSendingTestReport(true);
    try {
      toast.loading('שולח דוח בדיקה (עשוי לקחת עד 30 שניות)...', { id: 'publication-test' });
      const response = await generateJobPublicationReport({ 
        preview_mode: false,
        target_email: settings.publication_report_email,
        is_test: true
      });
      if (response.data?.success) {
        toast.success(`דוח בדיקה נשלח בהצלחה ל-${settings.publication_report_email}`, { id: 'publication-test' });
      } else {
        toast.error(response.data?.error || 'שגיאה בשליחת דוח הבדיקה', { id: 'publication-test' });
      }
    } catch (e) {
      console.error('Error sending test publication report:', e);
      toast.error('שגיאה בשליחת דוח הבדיקה', { id: 'publication-test' });
    }
    setSendingTestReport(false);
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
      <MobileTabs value={activeTab} onValueChange={setActiveTab}>
        <MobileTabsButtons>
          <MobileTabButton value="employees" icon={Users} label="עובדי החברה" color="pink" />
          <MobileTabButton value="candidates" icon={Users} label="מועמדי החברה" color="blue" />
          <MobileTabButton value="publication" icon={Megaphone} label="דוח פרסום" color="purple" />
        </MobileTabsButtons>

        <MobileTabsContent tabValue="employees">
      {/* Ready Draft - Waiting to be sent */}
      {approvedDrafts.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              טיוטה מוכנה - ממתינה לשליחה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvedDrafts.slice(0, 1).map(draft => (
              <div key={draft.id} className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{draft.subject}</h4>
                    <p className="text-sm text-gray-500">
                      {draft.jobs_count} משרות
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800 animate-pulse">
                      <Clock className="w-3 h-3 mr-1" />
                      ממתין לשליחה
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewDraftDialog({ isOpen: true, draft })}
                      className="h-7 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      צפה במלואו
                    </Button>
                  </div>
                </div>

                <div 
                  className="bg-gray-50 p-3 rounded text-sm max-h-32 overflow-y-auto border line-clamp-4"
                  dangerouslySetInnerHTML={{ __html: draft.body }}
                />

                <p className="text-xs text-gray-400 mt-2">
                  נוצר ב - {new Date(draft.created_date).toLocaleString('he-IL', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face" 
              alt="הילה" 
              className="w-14 h-14 rounded-full object-cover border-4 border-pink-200 shadow-lg"
            />
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-pink-600" />
                הילה - הפצת משרות לעובדים
              </CardTitle>
              <p className="text-sm text-gray-600">
                קופירייטרית ואחראית על הפצת משרות שבועית לעובדי החברה
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">


          {/* New Mechanism Alert */}
          <Alert className="bg-amber-50 border-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-900">
              <strong>⚠️ שינוי מנגנון שליחה — ממתין לאישור</strong>
              <br />
              המנגנון עבר משליחה דרך Resend לשליחה דרך <strong>jobs@pandatech.co.il</strong> (Outlook).
              <br />
              לפני שליחה לעובדים — בצעו <strong>שלח לבדיקה</strong> לכתובת שלכם ווודאו שהמייל מגיע תקין.
            </AlertDescription>
          </Alert>

          {/* Info Alert */}
          <Alert className="bg-pink-50 border-pink-200">
            <Users className="w-4 h-4 text-pink-600" />
            <AlertDescription>
              <strong>תהליך העבודה האוטומטי:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li><strong>ימים {settings.draft_days?.map(d => DAYS_OPTIONS.find(opt => opt.value === d)?.label).join(', ') || 'חמישי'} בשעה {settings.draft_send_time || '10:00'}:</strong> הילה מכינה טיוטת מייל</li>
                <li><strong>ימים {settings.days?.map(d => DAYS_OPTIONS.find(opt => opt.value === d)?.label).join(', ') || 'ראשון'} בשעה {settings.time || '11:00'}:</strong> המייל נשלח אוטומטית לעובדים — רק אם קיימת טיוטה תקינה</li>
              </ol>
              <p className="mt-2 text-xs text-pink-700">
                💡 ניתן לצפות בטיוטה לפני השליחה ולבטל אותה אם יש צורך. ניתן גם ליצור טיוטה או לשלוח מייל ידנית.
              </p>
            </AlertDescription>
          </Alert>

          {/* Send Schedule Settings */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
            <h3 className="font-medium flex items-center gap-2 text-green-900">
              <Send className="w-4 h-4 text-green-600" />
              תזמון שליחת מייל לעובדים
            </h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  ימי שליחה
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OPTIONS.map(day => (
                    <div
                      key={day.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        settings.days?.includes(day.value)
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        const newDays = settings.days?.includes(day.value)
                          ? settings.days.filter(d => d !== day.value)
                          : [...(settings.days || []), day.value];
                        setSettings({ ...settings, days: newDays });
                      }}
                    >
                      <Checkbox
                        checked={settings.days?.includes(day.value)}
                        onCheckedChange={() => {
                          const newDays = settings.days?.includes(day.value)
                            ? settings.days.filter(d => d !== day.value)
                            : [...(settings.days || []), day.value];
                          setSettings({ ...settings, days: newDays });
                        }}
                      />
                      <span className="text-sm">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  שעת שליחה
                </Label>
                <Select
                  value={settings.time || '11:00'}
                  onValueChange={(value) => setSettings({ ...settings, time: value })}
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
              <p className="text-xs text-green-700">⚠️ המייל יישלח רק אם קיימת טיוטה מוכנה ותקינה בשעת השליחה</p>
            </div>
          </div>

          {/* Draft Schedule */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              תזמון יצירת טיוטה לאישור
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  ימים ליצירת טיוטה
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OPTIONS.map(day => (
                    <div
                      key={day.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        settings.draft_days?.includes(day.value)
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        const newDraftDays = settings.draft_days?.includes(day.value)
                          ? settings.draft_days.filter(d => d !== day.value)
                          : [...(settings.draft_days || []), day.value];
                        setSettings({ ...settings, draft_days: newDraftDays });
                      }}
                    >
                      <Checkbox
                        checked={settings.draft_days?.includes(day.value)}
                        onCheckedChange={() => {
                          const newDraftDays = settings.draft_days?.includes(day.value)
                            ? settings.draft_days.filter(d => d !== day.value)
                            : [...(settings.draft_days || []), day.value];
                          setSettings({ ...settings, draft_days: newDraftDays });
                        }}
                      />
                      <span className="text-sm">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  שעת יצירת טיוטה
                </Label>
                <Select
                  value={settings.draft_send_time || '10:00'}
                  onValueChange={(value) => setSettings({ ...settings, draft_send_time: value })}
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
            </div>
          </div>

          {/* Email Settings */}
          <div className="space-y-4">


            <EmployeeEmailsTable 
              onEmailsLoaded={(emails) => setSettings({ ...settings, distribution_list_email: emails })}
              currentEmails={settings.distribution_list_email || ''}
            />

            <div className="space-y-2">
              <Label>כתובת מייל לבדיקות</Label>
              <Input
                type="email"
                value={settings.test_email || ''}
                onChange={(e) => setSettings({ ...settings, test_email: e.target.value })}
                placeholder="test@company.co.il"
                dir="ltr"
              />
              <p className="text-xs text-gray-500">לשליחת מייל בדיקה לפני השליחה לכל העובדים</p>
            </div>

            <div className="space-y-2">
              <Label>כתובת מייל לקבלת קורות חיים</Label>
              <Input
                type="email"
                value={settings.cv_target_email || ''}
                onChange={(e) => setSettings({ ...settings, cv_target_email: e.target.value })}
                placeholder="jobs@pandatech.co.il"
                dir="ltr"
              />
            </div>



            <div className="space-y-2">
              <Label>תיאור הבונוס לתוכנית "חבר מביא חבר"</Label>
              <Textarea
                value={settings.bonus_description || ''}
                onChange={(e) => setSettings({ ...settings, bonus_description: e.target.value })}
                placeholder="בונוס של 2,000 ₪ לעובד שמביא חבר שמתקבל לעבודה"
                rows={2}
              />
            </div>
          </div>

          {/* Last Run Status */}
          {settings.last_run_time && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-red-600 font-medium">
                נכשל בשעה 14:48 היום
              </div>
              <div className="flex items-center gap-2 mb-2">
                {settings.last_run_status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-medium">ריצה אחרונה</span>
                <Badge className={settings.last_run_status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {settings.last_run_status === 'success' ? 'הצלחה' : 'נכשל'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(settings.last_run_time).toLocaleString('he-IL', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          )}

          {/* Override Duplicate Prevention */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Checkbox
              id="override-duplicate"
              checked={overrideDuplicatePrevention}
              onCheckedChange={setOverrideDuplicatePrevention}
            />
            <Label htmlFor="override-duplicate" className="text-sm cursor-pointer">
              אפשר שליחה חוזרת באותו שבוע (עקוף מניעת כפילויות)
            </Label>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button onClick={saveSettings} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              שמור הגדרות
            </Button>
            <Button 
              onClick={runFullAutomatedProcess} 
              disabled={runningFullProcess}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {runningFullProcess ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              הפעל תהליך אוטומטי מלא
            </Button>
            <Button 
              onClick={createDraftForApproval} 
              disabled={creatingDraft}
              variant="outline"
              className="gap-2 border-pink-300 text-pink-700 hover:bg-pink-50"
            >
              {creatingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              צור טיוטה
            </Button>
            <Button 
              onClick={() => runManually(true)} 
              disabled={runningTest || !settings.test_email}
              variant="outline"
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {runningTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              שלח לבדיקה
            </Button>
            <Button 
              onClick={() => runManually(false)} 
              disabled={running || countdown !== null || !settings.distribution_list_email}
              variant="outline"
              className={`gap-2 ${
                sendSuccess 
                  ? 'bg-green-500 text-white border-green-500 hover:bg-green-600' 
                  : countdown !== null 
                    ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 animate-pulse'
                    : 'border-red-300 text-red-700 hover:bg-red-50 animate-pulse'
              }`}
            >
              {running ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> שולח...</>
              ) : sendSuccess ? (
                <><CheckCircle className="w-4 h-4" /> נשלח בהצלחה!</>
              ) : countdown !== null ? (
                <><Clock className="w-4 h-4" /> שולח בעוד {countdown}...</>
              ) : (
                <><Send className="w-4 h-4" /> שלח לעובדים המסומנים</>
              )}
            </Button>
          </div>

          {/* Run Logs */}
          <HilaRunLogs />
        </CardContent>
      </Card>
        </MobileTabsContent>

        {/* Candidates Tab */}
        <MobileTabsContent tabValue="candidates">
          <CandidatesEmailTab />
        </MobileTabsContent>

        {/* Publication Report Tab */}
        <MobileTabsContent tabValue="publication">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                דוח פרסום שבועי
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-blue-100 border-blue-300">
                <Megaphone className="w-4 h-4 text-blue-700" />
                <AlertDescription className="text-blue-900">
                  <strong>דוח פרסום אוטומטי:</strong> הילה שולחת דוח של משרות המומלצות לפרסום באתרים
                  <br />
                  הדוח כולל עד 10 משרות שזקוקות לפרסום (מעט מועמדים או מעט התאמות איכותיות מעל 70%)
                </AlertDescription>
              </Alert>

              {/* Fixed Schedule Info */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">דוח פרסום שבועי</p>
                  <p className="text-sm text-blue-700">📅 <strong>כל יום חמישי בשעה 10:00</strong> — נשלח אוטומטית לפי הגדרת אוטומציה קבועה במערכת</p>
                </div>
              </div>

              {/* Email Setting */}
              <div className="p-4 bg-white border rounded-lg space-y-2">
                <Label className="font-medium">כתובת מייל לשליחת הדוח</Label>
                <Input
                  type="email"
                  value={settings.publication_report_email || 'Office@pandatech.co.il'}
                  onChange={(e) => setSettings({ ...settings, publication_report_email: e.target.value })}
                  placeholder="Office@pandatech.co.il"
                  dir="ltr"
                />
              </div>

              {/* Preview and Send */}
              <div className="space-y-3 pt-4 border-t">
                <p className="text-sm text-gray-700 font-medium">
                  צפה בטיוטה של הדוח ושלח בדיקה:
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={generatePublicationPreview}
                    disabled={generatingPublicationPreview}
                    variant="outline"
                    className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    {generatingPublicationPreview ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> יוצר טיוטה...</>
                    ) : (
                      <><Eye className="w-4 h-4" /> הצג טיוטת דוח</>
                    )}
                  </Button>
                  <Button
                    onClick={() => sendTestPublicationReport()}
                    disabled={generatingPublicationPreview || sendingTestReport}
                    variant="outline"
                    className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-100"
                  >
                    {sendingTestReport ? <><Loader2 className="w-4 h-4 animate-spin" /> שולח בדיקה...</> : <><Send className="w-4 h-4" /> שלח בדיקה למייל שהוגדר</>}
                  </Button>
                  <Button onClick={saveSettings} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    שמור הגדרות
                  </Button>
                </div>
              </div>

              {settings.last_publication_report_time && (
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-sm">דוח אחרון נשלח:</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(settings.last_publication_report_time).toLocaleString('he-IL', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Publication Report Run Logs */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-5 h-5 text-blue-600" />
                  היסטוריית דוחות פרסום שנשלחו
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <PublicationReportLogsTable />
            </CardContent>
          </Card>
        </MobileTabsContent>
      </MobileTabs>

      {/* Draft Preview Dialog */}

      {/* Draft Preview Dialog */}
      <Dialog open={viewDraftDialog.isOpen} onOpenChange={(open) => !open && setViewDraftDialog({ isOpen: false, draft: null })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-pink-600" />
              {viewDraftDialog.draft?.subject}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge className="bg-green-100 text-green-800">
                {viewDraftDialog.draft?.jobs_count} משרות
              </Badge>
              <Badge variant="outline">
                {viewDraftDialog.draft?.created_date && new Date(viewDraftDialog.draft.created_date).toLocaleDateString('he-IL')}
              </Badge>
            </div>
            <div 
              className="bg-gray-50 p-6 rounded-lg border prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: viewDraftDialog.draft?.body }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Publication Preview Dialog */}
      <Dialog open={publicationPreviewDialog.isOpen} onOpenChange={(open) => !open && setPublicationPreviewDialog({ isOpen: false, html: null, jobsCount: 0 })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                דוח משרות לפרסום - טיוטה
              </div>
              <Button
                onClick={sendPublicationReport}
                size="sm"
                disabled={sendingPublicationReport}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {sendingPublicationReport ? <><Loader2 className="w-4 h-4 animate-spin" /> שולח...</> : <><Send className="w-4 h-4" /> שלח עכשיו</>}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge className="bg-blue-100 text-blue-800">
                {publicationPreviewDialog.jobsCount} משרות מומלצות
              </Badge>
              <Badge variant="outline">
                {new Date().toLocaleDateString('he-IL')}
              </Badge>
            </div>
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-sm text-blue-800">
                דוח זה ישלח ל-{settings.publication_report_email || 'Office@pandatech.co.il'} בימים {settings.publication_report_days?.map(d => DAYS_OPTIONS.find(opt => opt.value === d)?.label).join(', ') || 'שלישי'} בשעה {settings.publication_report_time || '12:00'} באופן אוטומטי
              </AlertDescription>
            </Alert>
            <div 
              className="bg-white p-6 rounded-lg border prose prose-sm max-w-none"
              style={{ direction: 'rtl' }}
              dangerouslySetInnerHTML={{ __html: publicationPreviewDialog.html }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Publication Report Logs Table Component
function PublicationReportLogsTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLogs = async () => {
    try {
      const emailLogs = await base44.entities.EmailLog.filter(
        { related_entity_type: 'JobPublicationReport' },
        '-created_date',
        20
      );
      setLogs(Array.isArray(emailLogs) ? emailLogs : []);
    } catch (e) {
      console.error('Could not load publication report logs:', e);
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
        <p>טרם נשלחו דוחות פרסום</p>
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

// Hila Run Logs Component
function HilaRunLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await base44.entities.HilaRunLog.list('-created_date', 20);
      setLogs(Array.isArray(allLogs) ? allLogs : []);
    } catch (e) {
      console.error('Could not load Hila run logs:', e);
      setLogs([]);
    }
    setLoading(false);
  };

  const getRuntypeLabel = (type) => {
    switch(type) {
      case 'draft_creation': return 'יצירת טיוטה';
      case 'carmit_approval': return 'אישור כרמית';
      case 'email_send': return 'שליחת מייל';
      case 'full_process': return 'תהליך מלא';
      default: return type;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />הצלחה</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />נכשל</Badge>;
      case 'skipped':
        return <Badge className="bg-gray-100 text-gray-800">דילוג</Badge>;
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

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5 text-pink-600" />
            היסטוריית ריצות הילה
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>אין לוגים של ריצות עדיין</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-40">תאריך</TableHead>
                  <TableHead className="w-32">סוג</TableHead>
                  <TableHead className="w-24">סטטוס</TableHead>
                  <TableHead>פרטים</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className={log.status === 'failed' ? 'bg-red-50' : ''}>
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
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getRuntypeLabel(log.run_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm">
                      {log.status === 'failed' && log.error_message && (
                        <div className="flex items-start gap-2 text-red-600">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{log.error_message}</span>
                        </div>
                      )}
                      {log.status === 'success' && (
                        <span className="text-gray-600">
                          {log.jobs_count && `${log.jobs_count} משרות`}
                          {log.emails_sent_to && ` • נשלח ל: ${log.emails_sent_to.substring(0, 40)}${log.emails_sent_to.length > 40 ? '...' : ''}`}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Publication Report Logs Component
function PublicationReportLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      // Filter EmailLog for publication reports
      const emailLogs = await base44.entities.EmailLog.filter(
        { related_entity_type: 'JobPublicationReport' },
        '-created_date',
        20
      );
      setLogs(Array.isArray(emailLogs) ? emailLogs : []);
    } catch (e) {
      console.error('Could not load publication report logs:', e);
      setLogs([]);
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />נשלח</Badge>;
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

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-5 h-5 text-blue-600" />
            היסטוריית דוחות פרסום
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>טרם נשלחו דוחות פרסום</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-40">תאריך</TableHead>
                  <TableHead className="w-24">סטטוס</TableHead>
                  <TableHead className="w-48">נשלח אל</TableHead>
                  <TableHead>נושא</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className={log.status === 'failed' ? 'bg-red-50' : ''}>
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
                    <TableCell className="text-sm text-gray-600">{log.to}</TableCell>
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
        )}
      </CardContent>
    </Card>
  );
}