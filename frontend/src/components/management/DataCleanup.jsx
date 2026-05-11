import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DatabaseZap, Loader2, CheckCircle, AlertTriangle, Users, Clock, Calendar } from 'lucide-react';
import { cleanDuplicateClientChosenStatus } from '@/functions/cleanDuplicateClientChosenStatus';
import { cleanDuplicateCandidates } from '@/functions/cleanDuplicateCandidates';
import { backfillCvReceivedDates } from '@/functions/backfillCvReceivedDates';
import PendingDuplicatesManager from './PendingDuplicatesManager';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function DataCleanup({ currentUser }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Duplicate candidates cleanup
  const [isDuplicatesLoading, setIsDuplicatesLoading] = useState(false);
  const [duplicatesResult, setDuplicatesResult] = useState(null);
  const [duplicatesError, setDuplicatesError] = useState('');
  const [showDuplicatesConfirm, setShowDuplicatesConfirm] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [liveProgress, setLiveProgress] = useState(null);

  // CV dates backfill
  const [isCvDatesLoading, setIsCvDatesLoading] = useState(false);
  const [cvDatesResult, setCvDatesResult] = useState(null);
  const [cvDatesError, setCvDatesError] = useState('');

  // Auto cleanup scheduler
  const [autoCleanupEnabled, setAutoCleanupEnabled] = useState(false);
  const [autoCleanupIntervalDays, setAutoCleanupIntervalDays] = useState(7);
  const [lastAutoCleanup, setLastAutoCleanup] = useState(null);
  const [nextAutoCleanup, setNextAutoCleanup] = useState(null);
  const [isSavingScheduler, setIsSavingScheduler] = useState(false);

  // Load scheduler settings from user data
  useEffect(() => {
    const loadSchedulerSettings = async () => {
      try {
        const user = await base44.auth.me();
        if (user.duplicate_cleanup_scheduler) {
          const settings = user.duplicate_cleanup_scheduler;
          setAutoCleanupEnabled(settings.enabled || false);
          setAutoCleanupIntervalDays(settings.interval_days || 7);
          setLastAutoCleanup(settings.last_run || null);
          
          if (settings.enabled && settings.last_run) {
            const nextRun = new Date(settings.last_run);
            nextRun.setDate(nextRun.getDate() + (settings.interval_days || 7));
            setNextAutoCleanup(nextRun.toISOString());
          }
        }
      } catch (err) {
        console.error('Error loading scheduler settings:', err);
      }
    };
    loadSchedulerSettings();
  }, []);

  // Check if auto cleanup should run
  useEffect(() => {
    const checkAndRunAutoCleanup = async () => {
      if (!autoCleanupEnabled || !lastAutoCleanup) return;
      
      const now = new Date();
      const lastRun = new Date(lastAutoCleanup);
      const daysSinceLastRun = Math.floor((now - lastRun) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastRun >= autoCleanupIntervalDays) {
        // Run auto cleanup
        toast.info('מפעיל ניקוי אוטומטי של מועמדים כפולים...');
        await handleCleanDuplicateCandidates(true);
      }
    };
    
    if (autoCleanupEnabled) {
      checkAndRunAutoCleanup();
    }
  }, [autoCleanupEnabled, lastAutoCleanup, autoCleanupIntervalDays]);

  // Check if we should show reminder (every 30 days)
  useEffect(() => {
    const lastCleanupReminder = localStorage.getItem('lastDuplicateCleanupReminder');
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    if (!lastCleanupReminder || (now - parseInt(lastCleanupReminder)) > thirtyDays) {
      // Show reminder after a short delay
      const timer = setTimeout(() => {
        setShowReminderDialog(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissReminder = () => {
    localStorage.setItem('lastDuplicateCleanupReminder', Date.now().toString());
    setShowReminderDialog(false);
  };

  const handleCleanDuplicateCandidates = async (isAutoRun = false) => {
    if (!isAutoRun) {
      setShowDuplicatesConfirm(false);
    }
    setIsDuplicatesLoading(true);
    setDuplicatesResult(null);
    setDuplicatesError('');
    setLiveProgress({ iteration: 0, scanned: 0, found: 0, saved: 0, remaining: '?' });

    let totalPendingSaved = 0;
    let totalScanned = 0;
    let iterationCount = 0;
    const maxIterations = 50; // Safety limit

    try {
      let hasMore = true;
      
      while (hasMore && iterationCount < maxIterations) {
        iterationCount++;
        console.log(`Starting iteration ${iterationCount}...`);
        
        // Update live progress immediately
        setLiveProgress(prev => ({
          ...prev,
          iteration: iterationCount,
          status: 'running'
        }));
        
        const response = await cleanDuplicateCandidates();
        
        if (response.data.success) {
          const summary = response.data.summary;
          totalScanned = summary.totalCandidatesScanned;
          totalPendingSaved += summary.pendingReviewGroups || 0;
          
          // Update live progress with detailed info
          setLiveProgress({
            iteration: iterationCount,
            scanned: totalScanned,
            found: summary.duplicateGroupsFound,
            saved: totalPendingSaved,
            remaining: summary.remainingGroups || 0,
            status: summary.remainingGroups > 0 ? 'continuing' : 'done'
          });
          
          // Update UI with current progress
          setDuplicatesResult({
            ...response.data,
            summary: {
              ...summary,
              totalCandidates: totalScanned,
              pendingReviewGroups: totalPendingSaved,
              currentIteration: iterationCount
            }
          });
          
          // Check if there are more duplicates to process
          const remaining = summary.remainingGroups || 0;
          hasMore = remaining > 0;
          
          console.log(`Iteration ${iterationCount} completed. Pending saved: ${summary.pendingReviewGroups}, Remaining: ${remaining}, hasMore: ${hasMore}`);
          
          if (hasMore) {
            // Small delay between iterations
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          console.error('Function returned error:', response.data.error);
          setDuplicatesError(response.data.error || 'שגיאה לא ידועה בניקוי הכפילויות');
          hasMore = false;
        }
      }
      
      if (iterationCount >= maxIterations) {
        console.warn('Reached max iterations limit');
        toast.warning('הגעת למגבלת ריצות מקסימלית. הפעל שוב להמשך.');
      }
      
      // Final update
      localStorage.setItem('lastDuplicateCleanupReminder', Date.now().toString());
      
      const now = new Date().toISOString();
      setLastAutoCleanup(now);
      
      const nextRun = new Date();
      nextRun.setDate(nextRun.getDate() + autoCleanupIntervalDays);
      setNextAutoCleanup(nextRun.toISOString());
      
      if (autoCleanupEnabled) {
        await base44.auth.updateMe({
          duplicate_cleanup_scheduler: {
            enabled: autoCleanupEnabled,
            interval_days: autoCleanupIntervalDays,
            last_run: now
          }
        });
      }
      
      toast.success(`הושלם! ${totalPendingSaved} כפילויות נשלחו לאישור ב-${iterationCount} ריצות${isAutoRun ? ' (סריקה אוטומטית)' : ''}`);
      
    } catch (err) {
      console.error('Error cleaning duplicates:', err);
      setDuplicatesError('שגיאה בניקוי מועמדים כפולים: ' + err.message);
    } finally {
      setIsDuplicatesLoading(false);
      setLiveProgress(null);
    }
  };

  const handleSaveSchedulerSettings = async () => {
    setIsSavingScheduler(true);
    try {
      const now = autoCleanupEnabled && !lastAutoCleanup ? new Date().toISOString() : lastAutoCleanup;
      
      await base44.auth.updateMe({
        duplicate_cleanup_scheduler: {
          enabled: autoCleanupEnabled,
          interval_days: autoCleanupIntervalDays,
          last_run: now
        }
      });
      
      if (autoCleanupEnabled && now) {
        const nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + autoCleanupIntervalDays);
        setNextAutoCleanup(nextRun.toISOString());
        setLastAutoCleanup(now);
      } else {
        setNextAutoCleanup(null);
      }
      
      toast.success('הגדרות הניקוי האוטומטי נשמרו');
    } catch (err) {
      console.error('Error saving scheduler settings:', err);
      toast.error('שגיאה בשמירת הגדרות הניקוי האוטומטי');
    } finally {
      setIsSavingScheduler(false);
    }
  };

  const handleBackfillCvDates = async () => {
    setIsCvDatesLoading(true);
    setCvDatesResult(null);
    setCvDatesError('');

    try {
      const response = await backfillCvReceivedDates();
      
      if (response.data.success) {
        setCvDatesResult(response.data);
        
        if (response.data.has_more) {
          toast.success(
            `עודכנו ${response.data.updated} מועמדים. יש עוד מועמדים - לחץ שוב להמשך`,
            { duration: 5000 }
          );
        } else {
          toast.success(`הושלם! עודכנו ${response.data.updated} מועמדים`);
        }
      } else {
        setCvDatesError('התהליך נכשל');
      }
      
    } catch (err) {
      console.error('Error backfilling CV dates:', err);
      setCvDatesError('שגיאה בעדכון מועדי קו"ח: ' + err.message);
      toast.error('שגיאה בעדכון מועדי קו"ח');
    } finally {
      setIsCvDatesLoading(false);
    }
  };

  const handleCleanDuplicateStatus = async () => {
    setIsLoading(true);
    setResult(null);
    setError('');

    try {
      const response = await cleanDuplicateClientChosenStatus();
      
      if (response.data.success) {
        setResult(response.data);
      } else {
        setError(response.data.error || 'שגיאה לא ידועה בניקוי הנתונים');
      }
    } catch (err) {
      console.error('Error running cleanup:', err);
      setError('שגיאה בהרצת ניקוי הנתונים: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (currentUser?.app_role !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ניקוי וארגון נתונים</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              פונקציונליות זו זמינה רק למנהלי מערכת.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="w-6 h-6 text-orange-600" />
          ניקוי וארגון נתונים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">ניקוי מצבים כפולים - "לקוח בחר"</h3>
          <p className="text-sm text-gray-600 mb-4">
            מסיר את המצב הכפול "לקוח בחר (עותק)" ומעדכן את כל ההפניות אליו להצביע למצב המקורי "לקוח בחר".
          </p>
          
          <Button 
            onClick={handleCleanDuplicateStatus}
            disabled={isLoading}
            className="mb-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                מנקה...
              </>
            ) : (
              <>
                <DatabaseZap className="w-4 h-4 ml-2" />
                נקה מצבים כפולים
              </>
            )}
          </Button>

          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">הניקוי הושלם בהצלחה!</div>
                  <div className="text-sm">
                    {result.summary?.removedStatus && (
                      <>
                        <p>• הוסר המצב: "{result.summary.removedStatus.name}" (מספר {result.summary.removedStatus.number})</p>
                        <p>• נשמר המצב: "{result.summary.originalStatus.name}" (מספר {result.summary.originalStatus.number})</p>
                      </>
                    )}
                    {result.summary?.updatedMatches !== undefined && <p>• עודכנו {result.summary.updatedMatches} התאמות</p>}
                    {result.summary?.updatedCandidates !== undefined && <p>• עודכנו {result.summary.updatedCandidates} מועמדים</p>}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Duplicate Candidates Cleanup */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            מיזוג מועמדים כפולים
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            מזהה מועמדים כפולים לפי:
            <br />
            • <strong>שם זהה</strong> - שולח לאישור ידני
            <br />
            • <strong>אימייל זהה</strong> - שולח לאישור ידני
            <br />
            <br />
            הסריקה רצה אוטומטית עד שנמצאות כל הכפילויות.
          </p>
          
          <Button 
            onClick={() => setShowDuplicatesConfirm(true)}
            disabled={isDuplicatesLoading}
            variant="default"
            className="mb-4 bg-purple-600 hover:bg-purple-700"
          >
            {isDuplicatesLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                {duplicatesResult?.summary?.currentIteration 
                  ? `סורק... ריצה ${duplicatesResult.summary.currentIteration}`
                  : 'סורק כפילויות...'}
              </>
            ) : (
              <>
                <Users className="w-4 h-4 ml-2" />
                סרוק כפילויות
              </>
            )}
          </Button>

          {/* Live Progress Indicator */}
          {isDuplicatesLoading && liveProgress && (
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-100 to-purple-50 border-2 border-purple-400 rounded-lg shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <div className="absolute inset-0 w-6 h-6 bg-purple-400 rounded-full animate-ping opacity-20" />
                </div>
                <span className="font-bold text-purple-900 text-lg">
                  🔍 סריקה פעילה - ריצה {liveProgress.iteration}
                </span>
              </div>
              <div className="text-sm text-purple-800 space-y-1.5 bg-white/60 p-3 rounded-lg">
                <p className="flex items-center gap-2">
                  <span className="font-semibold">סרוקים:</span>
                  <Badge className="bg-blue-600">{liveProgress.scanned}</Badge>
                  <span className="text-gray-600">מועמדים</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-semibold">נמצאו:</span>
                  <Badge className="bg-orange-600">{liveProgress.found}</Badge>
                  <span className="text-gray-600">כפילויות</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-semibold">נשלחו לאישור:</span>
                  <Badge className="bg-green-600">{liveProgress.saved}</Badge>
                </p>
                {liveProgress.remaining > 0 && (
                  <div className="pt-2 mt-2 border-t border-purple-200">
                    <p className="font-bold text-purple-900 flex items-center gap-2 animate-pulse">
                      <Clock className="w-4 h-4" />
                      נותרו {liveProgress.remaining} כפילויות - ממשיך תוך 2 שניות...
                    </p>
                  </div>
                )}
                {liveProgress.status === 'done' && (
                  <div className="pt-2 mt-2 border-t border-green-200">
                    <p className="font-bold text-green-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      הסריקה הושלמה!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {duplicatesResult && (
            <Alert className={duplicatesResult.summary.duplicateGroupsFound > 0 ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold text-green-800">
                    {duplicatesResult.summary.duplicateGroupsFound > 0 ? 'סריקת הכפילויות הושלמה בהצלחה!' : 'לא נמצאו כפילויות במערכת'}
                  </div>
                  <div className="text-sm text-green-700">
                    <p>• סה"כ מועמדים במערכת: {duplicatesResult.summary.totalCandidates || duplicatesResult.summary.totalCandidatesScanned}</p>
                    {duplicatesResult.summary.currentIteration && (
                      <p>• מספר ריצות שבוצעו: <Badge className="bg-blue-600">{duplicatesResult.summary.currentIteration}</Badge></p>
                    )}
                    <p>• קבוצות כפילויות שנמצאו: <Badge className={duplicatesResult.summary.duplicateGroupsFound > 0 ? "bg-orange-600" : "bg-green-600"}>{duplicatesResult.summary.duplicateGroupsFound}</Badge></p>
                    {duplicatesResult.summary.duplicateGroupsFound > 0 && (
                      <p>• נשלחו לאישור ידני: <Badge className="bg-purple-600">{duplicatesResult.summary.pendingReviewGroups}</Badge></p>
                    )}
                  </div>
                  
                  {duplicatesResult.duplicatePreview && duplicatesResult.duplicatePreview.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-blue-700">
                        👀 תצוגה מקדימה של כפילויות שנמצאו ({duplicatesResult.duplicatePreview.length})
                      </summary>
                      <div className="mt-2 max-h-60 overflow-y-auto text-xs space-y-2 bg-white p-2 rounded border">
                        {duplicatesResult.duplicatePreview.map((group, i) => (
                          <div key={i} className="p-2 border-r-4 border-orange-400 bg-orange-50">
                            <div className="font-semibold text-orange-800">
                              {group.type === 'email' && `📧 אימייל זהה: ${group.key}`}
                              {group.type === 'phone' && `📱 טלפון זהה: ${group.key}`}
                              {group.type === 'name' && `👤 שם זהה: ${group.key}`}
                              {' '}<Badge variant="outline">{group.count} מועמדים</Badge>
                            </div>
                            <div className="mr-2 mt-1 space-y-1">
                              {group.candidates.map(c => (
                                <div key={c.id} className="text-gray-700">
                                  • {c.name} {c.email && `(${c.email})`} - נוצר ב-{new Date(c.created_date).toLocaleDateString('he-IL')}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  
                  {duplicatesResult.details && duplicatesResult.details.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">פרטי המיזוגים ({duplicatesResult.details.length})</summary>
                      <div className="mt-2 max-h-60 overflow-y-auto text-xs space-y-2">
                        {duplicatesResult.details.map((d, i) => (
                          <div key={i} className="bg-white p-2 rounded border border-purple-200">
                            <div className="flex items-center gap-2 text-red-600 mb-1">
                              <span className="font-medium">נמחק:</span>
                              <span>{d.deleted}</span>
                            </div>
                            <div className="flex items-center gap-2 text-green-700">
                              <span className="font-medium">שולב אל:</span>
                              <span>{d.kept}</span>
                            </div>
                            <div className="text-gray-500 text-[10px] mt-1">
                              סיבה: {d.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {duplicatesError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{duplicatesError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Pending Duplicates Manager */}
        <PendingDuplicatesManager />

        {/* CV Received Dates Backfill */}
        <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            השלמת מועדי הגעת קורות חיים
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            מעדכן מועד הגעת קו"ח עבור מועמדים ללא תאריך. משערך לפי השנה המאוחרת ביותר בהיסטוריית העבודה (1.1 בשנה שאחריה).
          </p>
          
          <Button 
            onClick={handleBackfillCvDates}
            disabled={isCvDatesLoading}
            className="mb-4 bg-green-600 hover:bg-green-700"
          >
            {isCvDatesLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                מעדכן...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 ml-2" />
                עדכן מועדי קו"ח
              </>
            )}
          </Button>

          {cvDatesResult && (
            <Alert className={cvDatesResult.has_more ? "bg-yellow-50 border-yellow-200" : ""}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">
                    {cvDatesResult.has_more ? 'עודכן Batch' : 'העדכון הושלם בהצלחה!'}
                  </div>
                  <div className="text-sm">
                    <p>• Batch זה: {cvDatesResult.batch_processed} מועמדים</p>
                    <p>• עודכנו: {cvDatesResult.updated} מועמדים</p>
                    <p>• דולגו: {cvDatesResult.skipped} מועמדים</p>
                    {cvDatesResult.has_more && (
                      <p className="font-semibold text-yellow-700 mt-2">
                        ⚠️ יש עוד מועמדים לעדכון - לחץ שוב על הכפתור
                      </p>
                    )}
                    {cvDatesResult.details && cvDatesResult.details.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium">דוגמאות ({cvDatesResult.details.length})</summary>
                        <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1">
                          {cvDatesResult.details.map((d, i) => (
                            <div key={i} className="bg-white p-2 rounded border">
                              <div className="font-medium">{d.name}</div>
                              <div className="text-gray-600">
                                {d.method === 'estimated' && `שנה אחרונה: ${d.latest_job_year} → קו"ח: ${d.estimated_cv_date.substring(0, 10)}`}
                                {d.method === 'created_date' && `נקבע לפי תאריך יצירה: ${d.date.substring(0, 10)}`}
                                {d.method === 'skipped' && `דולג: ${d.reason}`}
                                {d.method === 'error' && `שגיאה: ${d.error}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {cvDatesError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{cvDatesError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Auto Cleanup Scheduler */}
        <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            ניקוי אוטומטי מתוזמן
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-cleanup"
                  checked={autoCleanupEnabled}
                  onCheckedChange={setAutoCleanupEnabled}
                />
                <Label htmlFor="auto-cleanup" className="font-medium">
                  הפעל ניקוי אוטומטי
                </Label>
              </div>
            </div>

            {autoCleanupEnabled && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <Label htmlFor="interval-days" className="whitespace-nowrap">
                    בצע ניקוי כל:
                  </Label>
                  <Input
                    id="interval-days"
                    type="number"
                    min="1"
                    max="90"
                    value={autoCleanupIntervalDays}
                    onChange={(e) => setAutoCleanupIntervalDays(parseInt(e.target.value) || 7)}
                    className="w-20"
                  />
                  <span className="text-gray-600">ימים</span>
                </div>

                {lastAutoCleanup && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>ניקוי אחרון: {new Date(lastAutoCleanup).toLocaleDateString('he-IL')} בשעה {new Date(lastAutoCleanup).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}

                {nextAutoCleanup && autoCleanupEnabled && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Clock className="w-4 h-4" />
                    <span>ניקוי הבא: {new Date(nextAutoCleanup).toLocaleDateString('he-IL')}</span>
                  </div>
                )}

                <Button 
                  onClick={handleSaveSchedulerSettings}
                  disabled={isSavingScheduler}
                  className="mt-2"
                >
                  {isSavingScheduler ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      שומר...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 ml-2" />
                      שמור הגדרות
                    </>
                  )}
                </Button>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              הניקוי האוטומטי יופעל בכל כניסה למערכת לאחר שעבר פרק הזמן שהוגדר.
            </p>
          </div>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={showDuplicatesConfirm} onOpenChange={setShowDuplicatesConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600">
              <Users className="w-5 h-5" />
              אישור מיזוג מועמדים כפולים
            </DialogTitle>
            <DialogDescription className="text-right space-y-2 pt-2">
              <p>
                פעולה זו תסרוק את המערכת ותשלח כפילויות לאישור ידני.
              </p>
              <p className="font-semibold">
                הסריקה תימשך אוטומטית עד שתמצא את כל הכפילויות.
              </p>
              <p className="text-purple-600">
                תוכל לאשר/לדחות כל כפילות בנפרד במסך "כפילויות ממתינות לאישור".
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDuplicatesConfirm(false)}>
              ביטול
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => handleCleanDuplicateCandidates(false)}>
              כן, סרוק כפילויות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 30-day Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              הגיע הזמן לנקות כפילויות!
            </DialogTitle>
            <DialogDescription className="text-right space-y-2 pt-2">
              <p>
                עברו 30 יום מאז הניקוי האחרון של מועמדים כפולים במערכת.
              </p>
              <p>
                מומלץ לבצע ניקוי תקופתי כדי לשמור על בסיס נתונים נקי ומסודר.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={dismissReminder}>
              הזכר לי אחר כך
            </Button>
            <Button onClick={() => {
              setShowReminderDialog(false);
              setShowDuplicatesConfirm(true);
            }}>
              נקה כפילויות עכשיו
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}