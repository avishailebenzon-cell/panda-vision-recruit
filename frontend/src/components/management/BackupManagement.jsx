import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, Database, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function BackupManagement() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backups, setBackups] = useState([]);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState(null);

  const daysOfWeek = [
    { value: 0, label: 'ראשון' },
    { value: 1, label: 'שני' },
    { value: 2, label: 'שלישי' },
    { value: 3, label: 'רביעי' },
    { value: 4, label: 'חמישי' },
    { value: 5, label: 'שישי' },
    { value: 6, label: 'שבת' }
  ];

  useEffect(() => {
    loadConfig();
    loadBackups();
  }, []);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.BackupConfig.list();
      if (configs.length > 0) {
        setConfig(configs[0]);
      } else {
        const newConfig = await base44.entities.BackupConfig.create({
          is_enabled: false,
          backup_day: 0,
          backup_time: "02:00",
          last_backup_status: "never_run"
        });
        setConfig(newConfig);
      }
    } catch (error) {
      toast.error('שגיאה בטעינת הגדרות גיבוי');
      console.error(error);
    }
    setLoading(false);
  };

  const loadBackups = async () => {
    try {
      const response = await base44.functions.invoke('listGoogleDriveBackups', {});
      if (response.data?.backups) {
        setBackups(response.data.backups);
      }
    } catch (error) {
      console.log('לא ניתן לטעון רשימת גיבויים:', error.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.BackupConfig.update(config.id, {
        is_enabled: config.is_enabled,
        backup_day: config.backup_day,
        backup_time: config.backup_time,
        google_drive_folder_id: config.google_drive_folder_id
      });
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      toast.error('שגיאה בשמירת ההגדרות');
      console.error(error);
    }
    setSaving(false);
  };

  const handleRunBackupNow = async () => {
    setBackingUp(true);
    toast.info('מתחיל גיבוי...');
    
    try {
      console.log('Starting backup...');
      const response = await base44.functions.invoke('backupToGoogleDrive', { forceRun: true });
      console.log('Backup response:', response);
      
      if (response?.data?.success) {
        toast.success('הגיבוי החל ברקע - בדוק את הסטטוס בעוד כמה דקות');
        
        // Refresh immediately to show updated status
        await loadConfig();
        await loadBackups();
        
        // Refresh again after 30 seconds
        setTimeout(async () => {
          await loadConfig();
          await loadBackups();
        }, 30000);
      } else {
        const errorMsg = response?.data?.error || response?.data?.message || 'הגיבוי נכשל - בדוק את החיבור ל-Google Drive';
        console.error('Backup failed:', errorMsg);
        toast.error(errorMsg);
        
        // Refresh config to show error
        await loadConfig();
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error(`שגיאה בהפעלת הגיבוי: ${error.message}`);
      
      // Refresh config to show error
      await loadConfig();
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackupId) return;
    
    setRestoring(true);
    try {
      const response = await base44.functions.invoke('restoreFromGoogleDrive', {
        fileId: selectedBackupId,
        confirmRestore: true
      });
      
      if (response.data?.success) {
        toast.success(`שחזור הושלם: ${response.data.restored_records} רשומות`);
        setShowRestoreConfirm(false);
        setSelectedBackupId(null);
        
        // Reload page after restore
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error('השחזור נכשל');
      }
    } catch (error) {
      toast.error('שגיאה בשחזור הנתונים');
      console.error(error);
    }
    setRestoring(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
  }

  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', text: 'הצליח' },
    failed: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', text: 'נכשל' },
    in_progress: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', text: 'מתבצע' },
    never_run: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50', text: 'מעולם לא רץ' }
  };

  const status = statusConfig[config?.last_backup_status || 'never_run'];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Backup Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            הגדרות גיבוי אוטומטי
          </CardTitle>
          <CardDescription>
            הגדר גיבוי שבועי אוטומטי של כל נתוני האפליקציה ל-Google Drive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <Label htmlFor="backup-enabled">הפעל גיבוי אוטומטי</Label>
            <Switch
              id="backup-enabled"
              checked={config?.is_enabled || false}
              onCheckedChange={(checked) => setConfig({ ...config, is_enabled: checked })}
            />
          </div>

          {/* Day of week */}
          <div className="space-y-2">
            <Label>יום בשבוע</Label>
            <Select
              value={String(config?.backup_day || 0)}
              onValueChange={(value) => setConfig({ ...config, backup_day: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {daysOfWeek.map(day => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="backup-time">שעה ביום</Label>
            <Input
              id="backup-time"
              type="time"
              value={config?.backup_time || "02:00"}
              onChange={(e) => setConfig({ ...config, backup_time: e.target.value })}
            />
          </div>

          {/* Google Drive Folder ID */}
          <div className="space-y-2">
            <Label htmlFor="folder-id">מזהה תיקיית Google Drive</Label>
            <Input
              id="folder-id"
              placeholder="הדבק את מזהה התיקייה מה-URL של Google Drive"
              value={config?.google_drive_folder_id || ''}
              onChange={(e) => setConfig({ ...config, google_drive_folder_id: e.target.value })}
            />
            <p className="text-xs text-gray-500">
              פתח תיקייה ב-Google Drive והעתק את המזהה מה-URL (החלק אחרי folders/)
            </p>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'שומר...' : 'שמור הגדרות'}
          </Button>
        </CardContent>
      </Card>

      {/* Backup Status */}
      <Card>
        <CardHeader>
          <CardTitle>סטטוס גיבוי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-center gap-3 p-4 rounded-lg ${status.bg}`}>
            <StatusIcon className={`w-5 h-5 ${status.color} ${config?.last_backup_status === 'in_progress' ? 'animate-spin' : ''}`} />
            <div className="flex-1">
              <div className="font-medium">{status.text}</div>
              {config?.last_backup_date && (
                <div className="text-sm text-gray-600">
                  גיבוי אחרון: {new Date(config.last_backup_date).toLocaleString('he-IL')}
                </div>
              )}
              {config?.last_backup_total_records > 0 && (
                <div className="text-sm text-gray-600">
                  {config.last_backup_total_records} רשומות מ-{config.last_backup_file_count} ישויות
                </div>
              )}
            </div>
          </div>

          {config?.last_backup_error && (
            <Alert variant="destructive">
              <AlertDescription>{config.last_backup_error}</AlertDescription>
            </Alert>
          )}

          {/* Manual Backup Button */}
          <Button 
            onClick={handleRunBackupNow} 
            disabled={backingUp}
            variant="outline"
            className="w-full"
          >
            <Download className="w-4 h-4 ml-2" />
            {backingUp ? 'מבצע גיבוי...' : 'בצע גיבוי עכשיו'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore from Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            שחזור מגיבוי
          </CardTitle>
          <CardDescription className="text-red-600">
            ⚠️ פעולה זו תמחק את כל הנתונים הקיימים ותחליף אותם בגיבוי!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {backups.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label>בחר גיבוי לשחזור</Label>
                {backups.map(backup => (
                  <div
                    key={backup.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedBackupId === backup.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedBackupId(backup.id)}
                  >
                    <div className="font-medium">{backup.name}</div>
                    <div className="text-sm text-gray-600">
                      תאריך: {new Date(backup.modified).toLocaleString('he-IL')}
                    </div>
                    <div className="text-xs text-gray-500">
                      גודל: {(backup.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setShowRestoreConfirm(true)}
                disabled={!selectedBackupId || restoring}
                variant="destructive"
                className="w-full"
              >
                <Upload className="w-4 h-4 ml-2" />
                {restoring ? 'משחזר נתונים...' : 'שחזר מגיבוי זה'}
              </Button>
            </>
          ) : (
            <Alert>
              <AlertDescription>
                לא נמצאו קבצי גיבוי. בצע גיבוי ראשון כדי להתחיל.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={handleRestoreBackup}
        title="⚠️ אזהרה: שחזור נתונים"
        message="פעולה זו תמחק את כל הנתונים הקיימים באפליקציה ותחליף אותם בנתונים מהגיבוי. האם אתה בטוח שברצונך להמשיך?"
        confirmText="כן, שחזר נתונים"
        confirmVariant="destructive"
        isLoading={restoring}
      />
    </div>
  );
}