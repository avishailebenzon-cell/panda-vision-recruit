import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  MessageCircle, 
  Loader2, 
  AlertTriangle,
  Settings,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function RotemSettingsManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [workMode, setWorkMode] = useState('advanced');
  const [activeConversationsCount, setActiveConversationsCount] = useState(0);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settingsList = await base44.entities.RotemSettings.list();
      if (settingsList.length > 0) {
        const s = settingsList[0];
        setSettings(s);
        setSettingsId(s.id);
        setWorkMode(s.work_mode || 'advanced');
      } else {
        // Create default settings
        const newSettings = await base44.entities.RotemSettings.create({
          work_mode: 'advanced',
          active_conversations_count: 0
        });
        setSettings(newSettings);
        setSettingsId(newSettings.id);
        setWorkMode('advanced');
      }
      
      // Count active conversations
      const activeTasks = await base44.entities.RotemTask.filter({
        status: { $in: ['בתהליך', 'מאושר לשיחה'] }
      });
      setActiveConversationsCount(activeTasks.length);
      
    } catch (e) {
      console.error('Error loading Rotem settings:', e);
      toast.error('שגיאה בטעינת הגדרות נועה');
    }
    setLoading(false);
  };

  const handleModeChange = async (newMode) => {
    // Check if there are active conversations
    if (activeConversationsCount > 0) {
      toast.error(`לא ניתן להחליף מודל כרגע - יש ${activeConversationsCount} שיחות פעילות. יש לסגור את כל השיחות לפני החלפת המודל.`);
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        work_mode: newMode,
        last_mode_change_date: new Date().toISOString(),
        active_conversations_count: 0
      };

      // Get current user name
      try {
        const user = await base44.auth.me();
        updateData.last_mode_change_by = user.full_name;
      } catch (userErr) {
        console.warn('Could not get user name:', userErr);
      }

      if (settingsId) {
        await base44.entities.RotemSettings.update(settingsId, updateData);
      } else {
        const created = await base44.entities.RotemSettings.create(updateData);
        setSettingsId(created.id);
      }
      
      setWorkMode(newMode);
      setSettings({ ...settings, ...updateData });
      toast.success(`מודל עבודה עודכן ל-${newMode === 'basic' ? 'בסיסי' : 'מתקדם'}`);
      
    } catch (e) {
      console.error('Error updating work mode:', e);
      toast.error('שגיאה בעדכון מודל העבודה');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face" 
                alt="נועה" 
                className="w-14 h-14 rounded-full object-cover border-4 border-green-200 shadow-lg"
              />
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-green-600" />
                  הגדרות נועה
                </CardTitle>
                <p className="text-sm text-gray-600">
                  ניהול מודל עבודה ותצורת שיחות
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={loadSettings}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Conversations Warning */}
          {activeConversationsCount > 0 && (
            <Alert className="bg-orange-50 border-orange-300">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>שיחות פעילות: {activeConversationsCount}</strong>
                <br />
                לא ניתן להחליף מודל עבודה כאשר יש שיחות פעילות. יש לסגור את כל השיחות לפני ביצוע השינוי.
              </AlertDescription>
            </Alert>
          )}

          {/* Work Mode Selection */}
          <Card className={`border-2 ${workMode === 'basic' ? 'bg-blue-50 border-blue-400' : 'bg-purple-50 border-purple-400'}`}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-lg font-bold">מודל עבודה</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    בחר בין מודל בסיסי (הודעה אחת פשוטה) למודל מתקדם (שיחה מלאה)
                  </p>
                </div>
                <Badge className={workMode === 'basic' ? 'bg-blue-600' : 'bg-purple-600'}>
                  {workMode === 'basic' ? '📋 בסיסי' : '🚀 מתקדם'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Mode Option */}
                <Card 
                  className={`cursor-pointer transition-all ${
                    workMode === 'basic' 
                      ? 'border-2 border-blue-500 bg-blue-50' 
                      : 'border hover:border-gray-300'
                  } ${activeConversationsCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => activeConversationsCount === 0 && handleModeChange('basic')}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">📋 מודל בסיסי</h3>
                      {workMode === 'basic' && <Badge className="bg-blue-600">פעיל</Badge>}
                    </div>
                    <p className="text-sm text-gray-600">
                      הודעה אחת פשוטה: הצגת המשרה ובקשה לתגובה כן/לא
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1 mr-4">
                      <li>• שליחה מהירה ופשוטה</li>
                      <li>• ללא בדיקת התאמה מקדימה</li>
                      <li>• מתאים לכמויות גדולות</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Advanced Mode Option */}
                <Card 
                  className={`cursor-pointer transition-all ${
                    workMode === 'advanced' 
                      ? 'border-2 border-purple-500 bg-purple-50' 
                      : 'border hover:border-gray-300'
                  } ${activeConversationsCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => activeConversationsCount === 0 && handleModeChange('advanced')}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">🚀 מודל מתקדם</h3>
                      {workMode === 'advanced' && <Badge className="bg-purple-600">פעיל</Badge>}
                    </div>
                    <p className="text-sm text-gray-600">
                      שיחה מלאה עם בדיקת התאמה מקצועית ושליחת טופס
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1 mr-4">
                      <li>• שיחה מעמיקה עם המועמד</li>
                      <li>• בדיקת התאמה מקצועית</li>
                      <li>• שליחת טופס מועמד</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {settings?.last_mode_change_date && (
                <div className="text-xs text-gray-500 border-t pt-3">
                  שינוי אחרון: {new Date(settings.last_mode_change_date).toLocaleString('he-IL')}
                  {settings.last_mode_change_by && ` על ידי ${settings.last_mode_change_by}`}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work Mode Descriptions */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-base">תיאור מודלים</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-bold text-sm mb-2">📋 מודל בסיסי:</h4>
                <div className="bg-white border rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                  נועה שולחת למועמד הודעה אחת עם פרטי המשרה ושואלת האם יש עניין (כן/לא).
                  <br />
                  <strong>אם התשובה "כן":</strong> נועה מעבירה לגורם אנושי לטיפול.
                  <br />
                  <strong>אם התשובה "לא":</strong> נועה סוגרת את השיחה בנימוס.
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm mb-2">🚀 מודל מתקדם:</h4>
                <div className="bg-white border rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                  נועה מנהלת שיחה מלאה: מציגה את עצמה, שואלת שאלות מקצועיות לבדיקת התאמה, 
                  ואם יש התאמה - שולחת קישור לטופס מועמד. השיחה יכולה לכלול מספר הודעות הלוך ושוב.
                </div>
              </div>
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
}