import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Loader2, CheckCircle, AlertCircle, Building, Users, Briefcase, Clock, Save, History, Info, ExternalLink, Key } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { syncPipedriveOrganizations } from "@/functions/syncPipedriveOrganizations";
import { syncPipedriveJobs } from "@/functions/syncPipedriveJobs";
import { syncPipedriveEmployees } from "@/functions/syncPipedriveEmployees";
import { toast } from "sonner";
import moment from "moment";
import { base44 } from "@/api/base44Client";

const DAYS_OPTIONS = [
  { value: 'sunday', label: 'ראשון' },
  { value: 'monday', label: 'שני' },
  { value: 'tuesday', label: 'שלישי' },
  { value: 'wednesday', label: 'רביעי' },
  { value: 'thursday', label: 'חמישי' },
  { value: 'friday', label: 'שישי' },
  { value: 'saturday', label: 'שבת' },
];

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

export default function PipedriveSync() {
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [syncingJobs, setSyncingJobs] = useState(false);
  const [syncingEmployees, setSyncingEmployees] = useState(false);
  const [contactsResult, setContactsResult] = useState(null);
  const [jobsResult, setJobsResult] = useState(null);
  const [employeesResult, setEmployeesResult] = useState(null);
  const [contactsError, setContactsError] = useState(null);
  const [jobsError, setJobsError] = useState(null);
  const [employeesError, setEmployeesError] = useState(null);

  // Schedule states
  const [orgsSchedule, setOrgsSchedule] = useState({ is_enabled: false, days: [], time: '07:00' });
  const [jobsSchedule, setJobsSchedule] = useState({ is_enabled: false, days: [], time: '07:00' });
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  // Sync history
  const [syncHistory, setSyncHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await loadSchedules();
      await new Promise(resolve => setTimeout(resolve, 800));
      await loadSyncHistory();
    };
    loadData();
  }, []);

  const loadSyncHistory = async () => {
    setLoadingHistory(true);
    try {
      const logs = await base44.entities.SystemActivityLog.filter(
        { action_type: 'pipedrive_sync' },
        '-created_date',
        50
      );
      setSyncHistory(logs);
    } catch (e) {
      console.error('Error loading sync history:', e);
    }
    setLoadingHistory(false);
  };

  const loadSchedules = async () => {
    try {
      const schedules = await base44.entities.PipedriveSyncSchedule.list();
      const orgs = schedules.find(s => s.sync_type === 'organizations');
      const jobs = schedules.find(s => s.sync_type === 'jobs');
      if (orgs) setOrgsSchedule({ ...orgs });
      if (jobs) setJobsSchedule({ ...jobs });
    } catch (e) {
      console.error('Error loading schedules:', e);
    }
  };

  const saveSchedule = async (type, schedule) => {
    setSavingSchedule(true);
    try {
      const existing = await base44.entities.PipedriveSyncSchedule.filter({ sync_type: type });
      const data = {
        sync_type: type,
        is_enabled: schedule.is_enabled,
        days: schedule.days,
        time: schedule.time
      };
      if (existing.length > 0) {
        await base44.entities.PipedriveSyncSchedule.update(existing[0].id, data);
      } else {
        await base44.entities.PipedriveSyncSchedule.create(data);
      }
      toast.success('הגדרות התזמון נשמרו');
    } catch (e) {
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSavingSchedule(false);
  };

  const toggleDay = (schedule, setSchedule, day) => {
    const days = schedule.days || [];
    if (days.includes(day)) {
      setSchedule({ ...schedule, days: days.filter(d => d !== day) });
    } else {
      setSchedule({ ...schedule, days: [...days, day] });
    }
  };

  const handleSyncContacts = async () => {
    setSyncingContacts(true);
    setContactsError(null);
    setContactsResult(null);

    try {
      const response = await syncPipedriveOrganizations({});
      
      if (response.data?.success) {
        setContactsResult(response.data);
        // Refresh sync history after a short delay to ensure the log entry is saved
        setTimeout(() => loadSyncHistory(), 1000);
      } else {
        setContactsError(response.data?.error || 'שגיאה לא ידועה');
      }
    } catch (err) {
      setContactsError(err.message || 'שגיאה בסנכרון');
    } finally {
      setSyncingContacts(false);
    }
  };

  const handleSyncJobs = async () => {
    setSyncingJobs(true);
    setJobsError(null);
    setJobsResult(null);

    try {
      const response = await syncPipedriveJobs({});
      
      if (response.data?.success) {
        setJobsResult(response.data);
        // Refresh sync history after a short delay to ensure the log entry is saved
        setTimeout(() => loadSyncHistory(), 1000);
      } else {
        setJobsError(response.data?.error || 'שגיאה לא ידועה');
      }
    } catch (err) {
      setJobsError(err.message || 'שגיאה בסנכרון');
    } finally {
      setSyncingJobs(false);
    }
  };

  const handleSyncEmployees = async () => {
    setSyncingEmployees(true);
    setEmployeesError(null);
    setEmployeesResult(null);

    try {
      const response = await syncPipedriveEmployees({});
      
      if (response.data?.success) {
        setEmployeesResult(response.data);
        // Refresh sync history after a short delay to ensure the log entry is saved
        setTimeout(() => loadSyncHistory(), 1000);
      } else {
        setEmployeesError(response.data?.error || 'שגיאה לא ידועה');
      }
    } catch (err) {
      setEmployeesError(err.message || 'שגיאה בסנכרון');
    } finally {
      setSyncingEmployees(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5 text-green-600" />
          סנכרון מ-Pipedrive
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="contacts" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              לקוחות ואנשי קשר
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              משרות
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              עובדים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            <p className="text-sm text-gray-600">
              סנכרון אנשי קשר עם סטטוס <strong>"לקוח"</strong> או <strong>"לקוח פוטנציאלי"</strong> מ-Pipedrive למערכת.
              <br />
              הסנכרון יוסיף ויעדכן נתונים (לא ימחק קיימים).
            </p>

            <Button
              onClick={handleSyncContacts}
              disabled={syncingContacts}
              className="w-full sm:w-auto"
            >
              {syncingContacts ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  מסנכרן לקוחות...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  סנכרן לקוחות עכשיו
                </>
              )}
            </Button>

            {/* Organizations Schedule */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  תזמון סנכרון אוטומטי
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="orgs-enabled"
                    checked={orgsSchedule.is_enabled}
                    onCheckedChange={(checked) => setOrgsSchedule({ ...orgsSchedule, is_enabled: checked })}
                  />
                  <label htmlFor="orgs-enabled" className="text-sm font-medium">
                    הפעל סנכרון אוטומטי
                  </label>
                </div>

                {orgsSchedule.is_enabled && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">ימים:</label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OPTIONS.map(day => (
                          <Button
                            key={day.value}
                            type="button"
                            variant={orgsSchedule.days?.includes(day.value) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleDay(orgsSchedule, setOrgsSchedule, day.value)}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">שעה:</label>
                      <Select
                        value={orgsSchedule.time || '07:00'}
                        onValueChange={(value) => setOrgsSchedule({ ...orgsSchedule, time: value })}
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
                  </>
                )}

                <Button
                  onClick={() => saveSchedule('organizations', orgsSchedule)}
                  disabled={savingSchedule}
                  size="sm"
                  className="mt-2"
                >
                  {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  שמור הגדרות
                </Button>
              </CardContent>
            </Card>

            {contactsError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{contactsError}</AlertDescription>
              </Alert>
            )}

            {contactsResult && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-green-800">סנכרון לקוחות הושלם בהצלחה!</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-white">
                        <Users className="w-3 h-3 mr-1" />
                        {contactsResult.validPersons}/{contactsResult.totalPersonsInPipedrive} אנשי קשר מתאימים
                      </Badge>
                      <Badge variant="outline" className="bg-white">
                        <Building className="w-3 h-3 mr-1" />
                        {contactsResult.organizationsWithValidPersons} ארגונים
                      </Badge>
                      <Badge className="bg-green-600">
                        {contactsResult.clientsCreated} לקוחות חדשים
                      </Badge>
                      <Badge className="bg-blue-600">
                        {contactsResult.clientsUpdated} לקוחות עודכנו
                      </Badge>
                      <Badge className="bg-purple-600">
                        {contactsResult.contactsCreated} אנשי קשר נוספו
                      </Badge>
                      <Badge className="bg-indigo-600">
                        {contactsResult.contactsUpdated} אנשי קשר עודכנו
                      </Badge>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <p className="text-sm text-gray-600">
              סנכרון משרות מדילים פתוחים ב-Pipedrive שיש להם שדה <strong>"Job Title"</strong>.
              <br />
              מסנכרן: כותרת, תיאור, דרישות, מיקום, סיווג בטחוני, ולקוח.
            </p>

            <Button
              onClick={handleSyncJobs}
              disabled={syncingJobs}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              {syncingJobs ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  מסנכרן משרות...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  סנכרן משרות עכשיו
                </>
              )}
            </Button>

            {/* Jobs Schedule */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  תזמון סנכרון אוטומטי
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="jobs-enabled"
                    checked={jobsSchedule.is_enabled}
                    onCheckedChange={(checked) => setJobsSchedule({ ...jobsSchedule, is_enabled: checked })}
                  />
                  <label htmlFor="jobs-enabled" className="text-sm font-medium">
                    הפעל סנכרון אוטומטי
                  </label>
                </div>

                {jobsSchedule.is_enabled && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">ימים:</label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OPTIONS.map(day => (
                          <Button
                            key={day.value}
                            type="button"
                            variant={jobsSchedule.days?.includes(day.value) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleDay(jobsSchedule, setJobsSchedule, day.value)}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">שעה:</label>
                      <Select
                        value={jobsSchedule.time || '07:00'}
                        onValueChange={(value) => setJobsSchedule({ ...jobsSchedule, time: value })}
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
                  </>
                )}

                <Button
                  onClick={() => saveSchedule('jobs', jobsSchedule)}
                  disabled={savingSchedule}
                  size="sm"
                  className="mt-2"
                >
                  {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  שמור הגדרות
                </Button>
              </CardContent>
            </Card>

            {jobsError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{jobsError}</AlertDescription>
              </Alert>
            )}

            {jobsResult && (
              <Alert className="border-blue-200 bg-blue-50">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-blue-800">סנכרון משרות הושלם בהצלחה!</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-white">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {jobsResult.dealsWithJobTitle}/{jobsResult.totalOpenDeals} דילים עם Job Title
                      </Badge>
                      <Badge className="bg-green-600">
                        {jobsResult.jobsCreated} משרות חדשות
                      </Badge>
                      <Badge className="bg-blue-600">
                        {jobsResult.jobsUpdated} משרות עודכנו
                      </Badge>
                      <Badge variant="outline" className="bg-white">
                        {jobsResult.jobsSkipped} דולגו
                      </Badge>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            </TabsContent>

            <TabsContent value="employees" className="space-y-4">
             <p className="text-sm text-gray-600">
               סנכרון עובדי החברה מ-Pipedrive למערכת.
               <br />
               הסנכרון יוסיף ויעדכן נתונים (לא ימחק קיימים).
             </p>

             <Button
               onClick={handleSyncEmployees}
               disabled={syncingEmployees}
               className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
             >
               {syncingEmployees ? (
                 <>
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                   מסנכרן עובדים...
                 </>
               ) : (
                 <>
                   <RefreshCw className="w-4 h-4 mr-2" />
                   סנכרן עובדים עכשיו
                 </>
               )}
             </Button>

             {employeesError && (
               <Alert variant="destructive">
                 <AlertCircle className="w-4 h-4" />
                 <AlertDescription>{employeesError}</AlertDescription>
               </Alert>
             )}

             {employeesResult && (
               <Alert className="border-purple-200 bg-purple-50">
                 <CheckCircle className="w-4 h-4 text-purple-600" />
                 <AlertDescription>
                   <div className="space-y-2">
                     <p className="font-medium text-purple-800">סנכרון עובדים הושלם בהצלחה!</p>
                     <div className="flex flex-wrap gap-2">
                       <Badge className="bg-purple-600">
                         {employeesResult.employeesCreated || 0} עובדים חדשים
                       </Badge>
                       <Badge className="bg-blue-600">
                         {employeesResult.employeesUpdated || 0} עובדים עודכנו
                       </Badge>
                     </div>
                   </div>
                 </AlertDescription>
               </Alert>
             )}
            </TabsContent>
            </Tabs>

            {/* Sync History Log */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <History className="w-4 h-4" />
              היסטוריית סנכרונים
            </h3>
            <Button variant="ghost" size="sm" onClick={loadSyncHistory} disabled={loadingHistory}>
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <Info className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              <strong>שים לב:</strong> התזמון האוטומטי דורש הגדרת cron job חיצוני.
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="link" className="text-amber-700 underline p-0 h-auto mr-1">
                    לחץ כאן להוראות הגדרה
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      הוראות הגדרת Cron Job להילה
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 text-sm">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">שלב 1: העתק את ה-URL של הפונקציה</h4>
                      <p className="text-blue-700 mb-2">לך לדשבורד Base44 → Code → Functions → <strong>scheduledMasterProcess</strong></p>
                      <p className="text-blue-700">העתק את ה-Function URL</p>
                      <p className="text-blue-600 text-xs mt-2">💡 פונקציה זו מטפלת בכל התזמונים: הילה + פייפדרייב</p>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-2">שלב 2: קבל את ה-Authorization Token</h4>
                      <p className="text-green-700 mb-2">באותו מסך, לחץ על כפתור <strong>"Copy cURL"</strong></p>
                      <p className="text-green-700 mb-2">תקבל משהו כזה:</p>
                      <code className="block bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
                        curl -X POST "https://..." -H "Authorization: Bearer eyJ..."
                      </code>
                      <p className="text-green-700 mt-2">העתק את כל מה שאחרי <strong>Bearer </strong> (הטוקן הארוך)</p>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-800 mb-2">שלב 3: הגדר ב-cron-job.org</h4>
                      <ol className="list-decimal list-inside space-y-2 text-purple-700">
                        <li>צור חשבון ב-<a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="underline">cron-job.org</a></li>
                        <li>צור Cron Job חדש</li>
                        <li><strong>URL:</strong> הכנס את ה-Function URL</li>
                        <li><strong>Schedule:</strong> בחר יום ושעה (למשל: כל ראשון ב-09:00)</li>
                        <li><strong>Request Method:</strong> POST</li>
                        <li><strong>Headers:</strong> הוסף header חדש:
                          <ul className="list-disc list-inside mr-4 mt-1">
                            <li><strong>Name:</strong> Authorization</li>
                            <li><strong>Value:</strong> Bearer [הטוקן שהעתקת]</li>
                          </ul>
                        </li>
                      </ol>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-800 mb-2">שלב 4: בדוק</h4>
                      <p className="text-orange-700">לחץ "Test Run" ב-cron-job.org לוודא שזה עובד.</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://cron-job.org', '_blank')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        פתח cron-job.org
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </AlertDescription>
          </Alert>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : syncHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>אין היסטוריית סנכרונים</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {syncHistory.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border ${
                    log.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium">{log.action_description}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(log.created_date).toLocaleString('he-IL', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  {log.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        פרטים נוספים
                      </summary>
                      <pre className="text-xs mt-1 p-2 bg-white rounded border overflow-x-auto">
                        {JSON.stringify(JSON.parse(log.details), null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}