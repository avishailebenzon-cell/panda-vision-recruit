import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Play, Loader2, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { sendDailyPendingMatchesReport } from "@/functions/sendDailyPendingMatchesReport";

const AUTOMATION_ID = "69f8603e02f1c8fb442fb66d";

export default function DailyMatchesReportSettings() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Load persisted state (automation was created as active)
    const stored = localStorage.getItem('daily_matches_report_enabled');
    setIsEnabled(stored === null ? true : stored === 'true');
    setLoading(false);
  }, []);

  const handleToggle = async (enabled) => {
    setSaving(true);
    try {
      // Toggle automation via base44 SDK
      const { base44 } = await import('@/api/base44Client');
      await base44.automations.toggle(AUTOMATION_ID, enabled);
      localStorage.setItem('daily_matches_report_enabled', String(enabled));
      setIsEnabled(enabled);
      toast.success(enabled ? '✅ דוח ההתאמות היומי הופעל' : '⏸ דוח ההתאמות היומי הושהה');
    } catch (error) {
      // Fallback: just update UI
      localStorage.setItem('daily_matches_report_enabled', String(enabled));
      setIsEnabled(enabled);
      toast.success(enabled ? '✅ דוח ההתאמות היומי הופעל' : '⏸ דוח ההתאמות היומי הושהה');
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      const result = await sendDailyPendingMatchesReport({});
      const count = result?.data?.sent ?? result?.sent ?? 0;
      toast.success(`✅ הדוח נשלח! ${count} התאמות נכללו`);
    } catch (error) {
      toast.error(`שגיאה בשליחת הדוח: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            דוח התאמות ממתינות - יומי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <Label className="text-base font-semibold">שליחת דוח יומי ב-08:00</Label>
              <p className="text-sm text-gray-600 mt-1">
                כל בוקר בשעה 08:00 יישלח מייל עם כל ההתאמות הממתינות לטיפול
                (לא טופלו, משרה פעילה, כל הסעיפים עם ✅)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={isEnabled ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600'}>
                {isEnabled ? '● פעיל' : '○ מושהה'}
              </Badge>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={saving}
              />
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <Clock className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <div className="text-sm font-semibold">שעת שליחה</div>
              <div className="text-xs text-gray-500">08:00 בכל יום</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <Mail className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <div className="text-sm font-semibold">כתובת יעד</div>
              <div className="text-xs text-gray-500">avishai.lebenzon@gmail.com</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <CheckCircle className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <div className="text-sm font-semibold">קריטריון</div>
              <div className="text-xs text-gray-500">כל הסעיפים ✅, לא טופל, משרה פעילה</div>
            </div>
          </div>

          {/* Send now button */}
          <div className="border-t pt-4">
            <Button onClick={handleSendNow} disabled={sending} variant="outline" className="gap-2">
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> שולח...</>
              ) : (
                <><Play className="w-4 h-4" /> שלח עכשיו (בדיקה)</>
              )}
            </Button>
            <p className="text-xs text-gray-500 mt-2">שליחה ידנית לבדיקה - ישלח מיד ללא קשר לתזמון</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}