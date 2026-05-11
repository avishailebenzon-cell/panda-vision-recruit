import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';
import { Play, Square, Loader2, Mail, CheckCircle, AlertCircle, Clock, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function EmailScannerControl() {
  const [scanStatus, setScanStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);

  const fetchStatus = async () => {
    try {
      const statuses = await base44.entities.MailScanStatus.list();
      if (statuses.length > 0) {
        setScanStatus(statuses[0]);
      }
      
      const logs = await base44.entities.EmailScanLog.list('-created_date', 5);
      setRecentLogs(logs);
    } catch (error) {
      console.error('Error fetching status:', error);
      toast.error('שגיאה בטעינת סטטוס הסורק');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const statuses = await base44.entities.MailScanStatus.list();
      if (statuses.length > 0) {
        await base44.entities.MailScanStatus.update(statuses[0].id, {
          self_scheduled_enabled: true
        });
        toast.success('סורק המיילים הופעל בהצלחה');
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error starting scanner:', error);
      toast.error('שגיאה בהפעלת הסורק');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const statuses = await base44.entities.MailScanStatus.list();
      if (statuses.length > 0) {
        await base44.entities.MailScanStatus.update(statuses[0].id, {
          self_scheduled_enabled: false,
          is_running: false
        });
        toast.success('סורק המיילים הופסק');
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
      toast.error('שגיאה בעצירת הסורק');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            בקרת סריקת מיילים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isRunning = scanStatus?.self_scheduled_enabled === true;
  const isScanningNow = scanStatus?.is_running === true;
  const nextRun = scanStatus?.self_scheduled_next_run;
  const lastRun = scanStatus?.self_scheduled_last_run;
  const runCount = scanStatus?.self_scheduled_run_count || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          בקרת סריקת מיילים (Self-Scheduled)
        </CardTitle>
        <CardDescription>
          מנגנון עצמאי שמריץ סריקת מיילים כל 5 דקות באופן אוטומטי
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">סטטוס</span>
            </div>
            <Badge className={isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {isRunning ? '✓ פעיל' : '⊗ מושהה'}
            </Badge>
            {isScanningNow && (
              <Badge className="bg-blue-100 text-blue-800 mr-2">
                <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                סורק כעת
              </Badge>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">ריצה הבאה</span>
            </div>
            <div className="text-sm font-medium">
              {isRunning && nextRun ? (
                <>
                  {new Date(nextRun).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  <span className="text-xs text-gray-500 mr-2">
                    ({Math.round((new Date(nextRun) - new Date()) / 60000)} דק')
                  </span>
                </>
              ) : (
                <span className="text-gray-400">לא מתוזמן</span>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">מספר ריצות</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{runCount}</div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-3">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 ml-2" />
              )}
              הפעל סריקה אוטומטית
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              disabled={actionLoading}
              variant="destructive"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Square className="w-4 h-4 ml-2" />
              )}
              עצור סריקה אוטומטית
            </Button>
          )}
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertDescription className="text-sm">
            <strong>מנגנון עצמאי חדש:</strong> הסורק מנהל את עצמו באופן עצמאי ללא תלות באוטומציות חיצוניות.
            הוא ירוץ כל 5 דקות ויתזמן את עצמו מחדש אוטומטית. אם יש מיילים נוספים לעיבוד, הוא ירוץ שוב תוך דקה.
          </AlertDescription>
        </Alert>

        {/* Statistics */}
        {scanStatus && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold mb-3 text-sm">סטטיסטיקה כללית</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-600">מיילים שעובדו:</span>
                <div className="font-bold">{scanStatus.total_emails_processed || 0}</div>
              </div>
              <div>
                <span className="text-gray-600">מועמדים חדשים:</span>
                <div className="font-bold text-green-600">{scanStatus.total_candidates_created || 0}</div>
              </div>
              <div>
                <span className="text-gray-600">מועמדים עודכנו:</span>
                <div className="font-bold text-blue-600">{scanStatus.total_candidates_updated || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Logs */}
        {recentLogs.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold mb-3 text-sm">ריצות אחרונות</h4>
            <div className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                  <div className="flex items-center gap-2">
                    {log.status === 'Completed' ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : log.status === 'Failed' ? (
                      <AlertCircle className="w-3 h-3 text-red-600" />
                    ) : (
                      <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                    )}
                    <span className="text-gray-600">
                      {new Date(log.start_time).toLocaleDateString('he-IL')} {new Date(log.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex gap-3 text-gray-700">
                    <span>📧 {log.emails_scanned}</span>
                    <span className="text-green-600">➕ {log.candidates_created}</span>
                    {log.errors_count > 0 && (
                      <span className="text-red-600">⚠ {log.errors_count}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Error */}
        {scanStatus?.last_error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>שגיאה אחרונה:</strong> {scanStatus.last_error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}