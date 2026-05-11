import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Award, Save, Loader2, Info, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function EitanSettingsManagement() {
  const [settings, setSettings] = useState(null);
  const [questionsTemplate, setQuestionsTemplate] = useState('');
  const [scoringCriteria, setScoringCriteria] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const allSettings = await base44.entities.EitanSettings.list();
      
      if (allSettings.length > 0) {
        const latestSettings = allSettings[0];
        setSettings(latestSettings);
        setQuestionsTemplate(latestSettings.questions_template || '');
        setScoringCriteria(latestSettings.scoring_criteria || '');
      } else {
        // Set default values
        setQuestionsTemplate(getDefaultQuestionsTemplate());
        setScoringCriteria(getDefaultScoringCriteria());
      }
    } catch (e) {
      console.error('Error loading settings:', e);
      toast.error('שגיאה בטעינת ההגדרות');
    }
    setLoading(false);
  };

  const getDefaultQuestionsTemplate = () => {
    return `שלום,

אני איתן ממחלקת בקרת האיכות של פנדה-טק.

אני מבצע מבדק איכות שירות מספר {{check_number}} עבור העובד {{employee_name}} שעובד אצלכם.

ברצוני לשאול מספר שאלות קצרות:

1. באופן כללי, איך הייתם מדרגים את השירות של {{employee_name}} בסולם 1-10?

2. האם {{employee_name}} מגיע בזמן ומקיים את זמני העבודה?

3. האם יש לכם משוב ספציפי או נקודות לשיפור?

תודה רבה על שיתוף הפעולה!
תאריך המבדק: {{check_date}}`;
  };

  const getDefaultScoringCriteria = () => {
    return `קריטריונים לציון המבדק (1-10):

**ציון 9-10 (מצוין):**
- הלקוח מביע שביעות רצון מלאה
- אין תלונות או בעיות
- העובד מקבל שבחים על איכות העבודה
- הלקוח מעוניין להמשיך עם העובד

**ציון 7-8 (טוב מאוד):**
- הלקוח מרוצה באופן כללי
- יש נקודות קטנות לשיפור
- השירות עומד בציפיות

**ציון 5-6 (בינוני):**
- הלקוח מרוצה חלקית
- יש מספר נקודות לשיפור
- דורש מעקב

**ציון 3-4 (חלש):**
- הלקוח מביע אי שביעות רצון
- יש בעיות משמעותיות
- נדרש טיפול מיידי

**ציון 1-2 (גרוע):**
- הלקוח מאוד לא מרוצה
- בעיות חמורות בשירות
- סיכון לסיום העסקה

**הנחיות לאיתן:**
- שקול את כל התשובות ביחד
- תן משקל רב לשאלה הראשונה (דירוג כללי)
- התייחס לנקודות ספציפיות שהלקוח מעלה
- אם הלקוח לא עונה על חלק מהשאלות - הערך בהתאם`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave = {
        questions_template: questionsTemplate,
        scoring_criteria: scoringCriteria,
        is_active: true,
        last_updated_by: user?.full_name || user?.email,
        last_updated_date: new Date().toISOString()
      };

      if (settings) {
        await base44.entities.EitanSettings.update(settings.id, dataToSave);
        toast.success('ההגדרות עודכנו בהצלחה');
      } else {
        const created = await base44.entities.EitanSettings.create(dataToSave);
        setSettings(created);
        toast.success('ההגדרות נשמרו בהצלחה');
      }

      await loadData();
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Award className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">הגדרות מבדק איכות שירות</h2>
          <p className="text-gray-600">הגדרת השאלות והקריטריונים לציון מבדקי האיכות של איתן</p>
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>משתנים זמינים:</strong>
          <div className="mt-2 space-y-1 text-sm">
            <div>• <code className="bg-blue-100 px-2 py-0.5 rounded">{'{{employee_name}}'}</code> - שם העובד</div>
            <div>• <code className="bg-blue-100 px-2 py-0.5 rounded">{'{{check_number}}'}</code> - מספר המבדק (TST-XXXXX)</div>
            <div>• <code className="bg-blue-100 px-2 py-0.5 rounded">{'{{check_date}}'}</code> - תאריך ביצוע המבדק</div>
            <div>• <code className="bg-blue-100 px-2 py-0.5 rounded">{'{{manager_name}}'}</code> - שם המנהל</div>
            <div>• <code className="bg-blue-100 px-2 py-0.5 rounded">{'{{client_name}}'}</code> - שם הלקוח</div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Questions Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            תבנית השאלות למבדק
          </CardTitle>
          <p className="text-sm text-gray-600">
            השאלות שאיתן ישאל את המנהל מטעם הלקוח. השתמש במשתנים להתאמה אישית.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={questionsTemplate}
            onChange={(e) => setQuestionsTemplate(e.target.value)}
            placeholder="הזן את תבנית השאלות..."
            className="min-h-[300px] font-mono text-sm"
            dir="rtl"
          />
        </CardContent>
      </Card>

      {/* Scoring Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            קריטריונים לציון (1-10)
          </CardTitle>
          <p className="text-sm text-gray-600">
            הנחיות לאיתן כיצד לדרג את תשובות הלקוח ולתת ציון סופי למבדק.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={scoringCriteria}
            onChange={(e) => setScoringCriteria(e.target.value)}
            placeholder="הזן את קריטריוני הציון..."
            className="min-h-[400px] font-mono text-sm"
            dir="rtl"
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          שמור הגדרות
        </Button>
      </div>

      {settings && (
        <div className="text-sm text-gray-500 text-left">
          עדכון אחרון: {settings.last_updated_by || 'לא ידוע'} ב-{new Date(settings.last_updated_date || settings.updated_date).toLocaleString('he-IL')}
        </div>
      )}
    </div>
  );
}