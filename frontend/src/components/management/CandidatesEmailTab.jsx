import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Save, 
  Play, 
  Loader2, 
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Users,
  Send,
  Eye,
  RefreshCw,
  History,
  XCircle,
  Clock,
  Calendar,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

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

export default function CandidatesEmailTab() {
  const [settings, setSettings] = useState({
    is_enabled: true,
    days: ['sunday'],
    time: '09:00',
    draft_days: ['thursday'],
    draft_send_time: '10:00',
    test_email: '',
    candidate_distribution_email: '',
    candidates_cv_email: 'jobs@pandatech.co.il'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [settingsId, setSettingsId] = useState(null);
  const [approvedDrafts, setApprovedDrafts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingCandidateEmails, setLoadingCandidateEmails] = useState(false);
  const [candidatesList, setCandidatesList] = useState([]);
  const [mailLogData, setMailLogData] = useState({});
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (e) {
      console.log('Could not load user');
    }
  };

  useEffect(() => {
    loadSettings();
    loadApprovedDrafts();
    loadLogs();
    loadCandidatesForTable();
  }, []);

  const loadSettings = async () => {
    try {
      const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
      if (schedules && schedules.length > 0) {
        const s = schedules[0];
        setSettings({
          is_enabled: s.candidates_is_enabled !== undefined ? s.candidates_is_enabled : true,
          days: s.candidates_days || ['sunday'],
          time: s.candidates_time || '09:00',
          draft_days: s.candidates_draft_days || ['thursday'],
          draft_send_time: s.candidates_draft_send_time || '10:00',
          test_email: s.test_email || '',
          candidate_distribution_email: s.candidate_distribution_email || '',
          candidates_cv_email: s.candidates_cv_email || 'jobs@pandatech.co.il'
        });
        setSettingsId(s.id);
      }
    } catch (e) {
      console.log('Could not load Hila settings');
    }
    setLoading(false);
  };

  const loadApprovedDrafts = async () => {
    try {
      // Load ALL candidate drafts for review (pending_approval and ready)
      let allDrafts = await base44.entities.HilaDraft.filter({ 
        audience_type: 'candidates'
      }, '-created_date', 10);
      
      // Filter to show pending_approval and ready drafts
      const relevantDrafts = allDrafts.filter(d => 
        d.status === 'pending_approval' || d.status === 'ready'
      );
      
      setApprovedDrafts(relevantDrafts);
    } catch (e) {
      console.log('Could not load candidate drafts');
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const allLogs = await base44.entities.HilaRunLog.filter({ 
        audience_type: 'candidates'
      }, '-created_date', 20);
      setLogs(Array.isArray(allLogs) ? allLogs : []);
    } catch (e) {
      console.log('Could not load candidate run logs:', e);
      setLogs([]);
    }
    setLoadingLogs(false);
  };

  const loadCandidatesForTable = async () => {
    setLoadingCandidateEmails(true);
    try {
      // Excluded statuses
      const excludedStatuses = [
        'לא מתאים – נסגר',
        'אושר – בהמתנה להצעת שכר',
        'חוזה חתום',
        'סיווג אושר – בהמתנה לתחילת עבודה',
        'מועסק – פעיל',
        'סגור'
      ];
      
      const allCandidates = await base44.entities.Candidate.list();

      // Filter out excluded statuses
      const filteredCandidates = allCandidates.filter(cand => 
        cand.email && 
        cand.email.trim() && 
        !excludedStatuses.includes(cand.status)
      );

      // Remove duplicates by email - keep only the most recent candidate
      const uniqueCandidatesMap = new Map();
      filteredCandidates.forEach(cand => {
        const email = cand.email.trim().toLowerCase();
        const existing = uniqueCandidatesMap.get(email);

        if (!existing || new Date(cand.created_date) > new Date(existing.created_date)) {
          uniqueCandidatesMap.set(email, cand);
        }
      });

      const uniqueCandidates = Array.from(uniqueCandidatesMap.values());
      setCandidatesList(uniqueCandidates);
      
      // Load mail log data for click tracking
      const mailLogs = await base44.entities.HilaMailLog.list();
      const logMap = {};
      mailLogs.forEach(log => {
        if (log.candidate_id && !logMap[log.candidate_id]) {
          logMap[log.candidate_id] = {
            cv_link_clicked: log.cv_link_clicked,
            website_clicked: log.website_clicked,
            cv_link_click_date: log.cv_link_click_date,
            website_click_date: log.website_click_date
          };
        }
      });
      setMailLogData(logMap);
      
    } catch (e) {
      console.error('Error loading candidates for table:', e);
      toast.error('שגיאה בטעינת המועמדים');
    }
    setLoadingCandidateEmails(false);
  };

  const loadCandidateEmails = async () => {
    setLoadingCandidateEmails(true);
    try {
      const candidates = await base44.entities.Candidate.list();
      
      // Extract all emails and join them with semicolons
      const emailsList = candidates
        .map(cand => cand.email)
        .filter(email => email && email.trim())
        .join('; ');
      
      if (emailsList) {
        setSettings({ ...settings, candidate_distribution_email: emailsList });
        toast.success(`נטענו ${candidates.length} כתובות מייל של מועמדים`);
      } else {
        toast.error('לא נמצאו מועמדים עם כתובות מייל');
      }
    } catch (e) {
      console.error('Error loading candidate emails:', e);
      toast.error('שגיאה בטעינת כתובות המייל');
    }
    setLoadingCandidateEmails(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const dataToSave = {
        candidates_is_enabled: settings.is_enabled,
        candidates_days: settings.days,
        candidates_time: settings.time,
        candidates_draft_days: settings.draft_days,
        candidates_draft_send_time: settings.draft_send_time,
        test_email: settings.test_email,
        candidate_distribution_email: settings.candidate_distribution_email,
        candidates_cv_email: settings.candidates_cv_email
      };

      if (settingsId) {
        await base44.entities.HilaSchedule.update(settingsId, dataToSave);
      } else {
        const created = await base44.entities.HilaSchedule.create(dataToSave);
        setSettingsId(created.id);
      }
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const runManually = async (isTest = false) => {
    const targetEmail = isTest ? settings.test_email : settings.candidate_distribution_email;
    
    if (!targetEmail) {
      toast.error(isTest ? 'יש להגדיר מייל לבדיקות' : 'יש להגדיר כתובת מייל לפני הפעלה');
      return;
    }

    if (isTest) {
      setRunningTest(true);
      try {
        // Call function to send test email to candidates
        const response = await base44.functions.invoke('sendHilaCandidateEmail', { 
          targetEmail, 
          isTest: true 
        });
        if (response.data?.success) {
          toast.success(`המייל נשלח בהצלחה לבדיקה!`);
          loadLogs();
        } else {
          toast.error(response.data?.error || 'שגיאה בשליחת המייל');
        }
      } catch (e) {
        console.error('Error running Hila candidate test:', e);
        toast.error('שגיאה בהפעלת הילה');
      }
      setRunningTest(false);
    } else {
      // Start countdown for sending to all candidates
      setCountdown(5);
      setSendSuccess(false);
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            sendToAllCandidates(targetEmail);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const createDraftForCandidates = async () => {
    setCreatingDraft(true);
    try {
      const response = await base44.functions.invoke('createHilaCandidateDraft', {});
      if (response.data?.success) {
        toast.success('הטיוטה למועמדים נוצרה בהצלחה');
        // Wait a moment for DB to update, then refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        await Promise.all([
          loadApprovedDrafts(),
          loadLogs(),
          loadCandidatesForTable()
        ]);
      } else {
        toast.error(response.data?.error || 'שגיאה ביצירת הטיוטה');
      }
    } catch (e) {
      console.error('Error creating candidate draft:', e);
      toast.error('שגיאה ביצירת הטיוטה');
    }
    setCreatingDraft(false);
  };

  const approveDraft = async (draftId) => {
    try {
      await base44.entities.HilaDraft.update(draftId, {
        status: 'ready',
        approved_by: user?.full_name || 'Admin',
        approved_date: new Date().toISOString()
      });
      toast.success('הטיוטה אושרה ומוכנה לשליחה');
      await loadApprovedDrafts();
    } catch (e) {
      console.error('Error approving draft:', e);
      toast.error('שגיאה באישור הטיוטה');
    }
  };

  const rejectDraft = async (draftId) => {
    try {
      await base44.entities.HilaDraft.update(draftId, {
        status: 'rejected'
      });
      toast.success('הטיוטה נדחתה');
      await loadApprovedDrafts();
    } catch (e) {
      console.error('Error rejecting draft:', e);
      toast.error('שגיאה בדחיית הטיוטה');
    }
  };

  const sendToAllCandidates = async (targetEmail) => {
    setRunning(true);
    setCountdown(null);
    
    try {
      const response = await base44.functions.invoke('sendHilaCandidateEmail', { 
        targetEmail, 
        isTest: false 
      });
      if (response.data?.success) {
        setSendSuccess(true);
        toast.success(`המייל נשלח בהצלחה למועמדים!`);
        loadLogs();
        setTimeout(() => setSendSuccess(false), 3000);
      } else {
        toast.error(response.data?.error || 'שגיאה בשליחת המייל');
      }
    } catch (e) {
      console.error('Error running Hila candidates:', e);
      toast.error('שגיאה בהפעלת הילה');
    }
    
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const pendingDrafts = approvedDrafts.filter(d => d.status === 'pending_approval');
  const readyDrafts = approvedDrafts.filter(d => d.status === 'ready');

  return (
    <div className="space-y-6">
      {/* Pending Drafts for Approval */}
      {pendingDrafts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              טיוטה חדשה ממתינה לאישור
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingDrafts.map(draft => (
              <div key={draft.id} className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-lg">{draft.subject}</h4>
                    <p className="text-sm text-gray-500">
                      {draft.jobs_count} משרות • נוצר ב-{new Date(draft.created_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800">
                    <Clock className="w-3 h-3 mr-1" />
                    ממתין לאישור
                  </Badge>
                </div>

                <div 
                  className="bg-gray-50 p-4 rounded text-sm max-h-96 overflow-y-auto border"
                  dangerouslySetInnerHTML={{ __html: draft.body }}
                />

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button 
                    onClick={() => approveDraft(draft.id)}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    אשר ושלח
                  </Button>
                  <Button 
                    onClick={() => rejectDraft(draft.id)}
                    variant="outline"
                    className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4" />
                    דחה טיוטה
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ready Drafts */}
      {readyDrafts.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              טיוטה מאושרת - ממתינה לשליחה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {readyDrafts.slice(0, 1).map(draft => (
              <div key={draft.id} className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{draft.subject}</h4>
                    <p className="text-sm text-gray-500">
                      {draft.jobs_count} משרות
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 animate-pulse">
                    <Clock className="w-3 h-3 mr-1" />
                    ממתין לשליחה למועמדים
                  </Badge>
                </div>

                <div 
                  className="bg-gray-50 p-3 rounded text-sm max-h-48 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: draft.body }}
                />

                <p className="text-xs text-gray-400 mt-2">
                  נוצר ב - {new Date(draft.created_date).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })} | {new Date(draft.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}
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
                הילה - הפצת משרות למועמדים
              </CardTitle>
              <p className="text-sm text-gray-600">
                שליחת משרות יזומה למועמדים חיצוניים
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert className="bg-pink-50 border-pink-200">
            <Users className="w-4 h-4 text-pink-600" />
            <AlertDescription>
              <strong>תהליך העבודה האוטומטי:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li><strong>ימים {settings.draft_days?.map(d => DAYS_OPTIONS.find(opt => opt.value === d)?.label).join(', ') || 'חמישי'} בשעה {settings.draft_send_time || '10:00'}:</strong> הילה מכינה טיוטת מייל למועמדים</li>
                <li><strong>ימים {settings.days?.map(d => DAYS_OPTIONS.find(opt => opt.value === d)?.label).join(', ') || 'ראשון'} בשעה {settings.time || '11:00'}:</strong> המייל נשלח אוטומטית למועמדים</li>
              </ol>
              <p className="mt-2 text-xs text-pink-700">
                💡 המערכת תשלח רק למועמדים שלא ביטלו מנוי ושאינם בסטטוסים מוחרגים. כל מייל כולל קישורי Unsubscribe, קישור לשליחת קו״ח, וקישור לאתר.
              </p>
            </AlertDescription>
          </Alert>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">הפעלת שליחה אוטומטית</Label>
              <p className="text-sm text-gray-500">הילה תשלח מייל אוטומטי ביום ובשעה שנקבעו</p>
            </div>
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
            />
          </div>

          {/* Draft Schedule */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              תזמון יצירת טיוטה
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
                        onCheckedChange={() => {}}
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

          {/* Final Send Schedule */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-green-600" />
              תזמון שליחת המייל
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  ימים לשליחה
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
                        onCheckedChange={() => {}}
                      />
                      <span className="text-sm">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  שעה
                </Label>
                <Select
                  value={settings.time}
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
            </div>
          </div>

          {/* Email Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>כתובת מייל לבדיקות</Label>
              <Input
                type="email"
                value={settings.test_email || ''}
                onChange={(e) => setSettings({ ...settings, test_email: e.target.value })}
                placeholder="test@company.co.il"
                dir="ltr"
              />
              <p className="text-xs text-gray-500">לשליחת מייל בדיקה לפני השליחה לכל המועמדים</p>
            </div>

            <div className="space-y-2">
              <Label>כתובת מייל לקבלת קורות חיים</Label>
              <Input
                type="email"
                value={settings.candidates_cv_email || ''}
                onChange={(e) => setSettings({ ...settings, candidates_cv_email: e.target.value })}
                placeholder="jobs@pandatech.co.il"
                dir="ltr"
              />
              <p className="text-xs text-gray-500">כתובת זו תשמש ליצירת קישור mailto בתחתית כל משרה במייל</p>
            </div>

            {/* Candidates Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">רשימת מועמדים לשליחה</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{candidatesList.length} מועמדים</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadCandidatesForTable}
                    disabled={loadingCandidateEmails}
                    className="gap-2 text-xs h-8"
                  >
                    {loadingCandidateEmails ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    רענן רשימה
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-gray-500">
                💡 מוצגים רק מועמדים שאינם בסטטוסים: לא מתאים – נסגר, אושר – בהמתנה להצעת שכר, חוזה חתום, סיווג אושר – בהמתנה לתחילת עבודה, מועסק – פעיל, סגור
              </p>

              {loadingCandidateEmails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : candidatesList.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>אין מועמדים זמינים לשליחה</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-50 z-10">
                      <TableRow>
                        <TableHead className="w-48">שם ומשפחה</TableHead>
                        <TableHead className="w-56">מייל</TableHead>
                        <TableHead className="w-32">טלפון</TableHead>
                        <TableHead className="w-32">קישור נלחץ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidatesList.map((candidate) => {
                        const logData = mailLogData[candidate.id];
                        const hasClicked = logData?.cv_link_clicked || logData?.website_clicked;
                        
                        return (
                          <TableRow key={candidate.id}>
                            <TableCell className="font-medium text-sm">
                              {candidate.full_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`}
                            </TableCell>
                            <TableCell className="text-sm" dir="ltr">
                              {candidate.email}
                            </TableCell>
                            <TableCell className="text-sm" dir="ltr">
                              {candidate.phone_primary || '-'}
                            </TableCell>
                            <TableCell>
                              {hasClicked ? (
                                <div className="flex flex-col gap-1">
                                  {logData.cv_link_clicked && (
                                    <Badge className="bg-green-100 text-green-800 text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      קו״ח - {logData.cv_link_click_date ? new Date(logData.cv_link_click_date).toLocaleDateString('he-IL') : ''}
                                    </Badge>
                                  )}
                                  {logData.website_clicked && (
                                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      אתר - {logData.website_click_date ? new Date(logData.website_click_date).toLocaleDateString('he-IL') : ''}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs text-gray-400">
                                  לא נלחץ
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button onClick={saveSettings} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              שמור הגדרות
            </Button>
            <Button 
              onClick={createDraftForCandidates} 
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
              disabled={running || countdown !== null || !settings.candidate_distribution_email}
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
                <><Send className="w-4 h-4" /> שלח לכל המועמדים</>
              )}
            </Button>
          </div>

          {/* Run Logs */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-5 h-5 text-pink-600" />
                  היסטוריית ריצות למועמדים
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loadingLogs}>
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
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
                              {log.run_type === 'draft_creation' ? 'יצירת טיוטה' :
                               log.run_type === 'email_send' ? 'שליחת מייל' :
                               log.run_type === 'test_send' ? 'שליחת בדיקה' : log.run_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.status === 'success' ? (
                              <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />הצלחה</Badge>
                            ) : log.status === 'failed' ? (
                              <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />נכשל</Badge>
                            ) : (
                              <Badge variant="outline">{log.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.status === 'failed' && log.error_message && (
                              <div className="flex items-start gap-2 text-red-600">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{log.error_message}</span>
                              </div>
                            )}
                            {log.status === 'success' && (
                              <span className="text-gray-600">
                                {log.candidates_sent && `${log.candidates_sent} מועמדים`}
                                {log.candidates_skipped && ` • ${log.candidates_skipped} דולגו`}
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
        </CardContent>
      </Card>
    </div>
  );
}