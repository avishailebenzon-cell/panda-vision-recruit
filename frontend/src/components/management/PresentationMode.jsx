import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Presentation, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

export default function PresentationMode() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AgentConfig.filter({ 
        config_key: 'presentation_mode' 
      });

      if (configs && configs.length > 0) {
        setPresentationMode(configs[0].config_value?.enabled || false);
      }
    } catch (error) {
      console.error("Error loading presentation mode:", error);
      toast.error("שגיאה בטעינת הגדרות הצגה");
    }
    setLoading(false);
  };

  const handleToggle = async () => {
    setSaving(true);
    try {
      const configs = await base44.entities.AgentConfig.filter({ 
        config_key: 'presentation_mode' 
      });

      if (configs && configs.length > 0) {
        await base44.entities.AgentConfig.update(configs[0].id, {
          config_value: { enabled: !presentationMode }
        });
      } else {
        await base44.entities.AgentConfig.create({
          config_key: 'presentation_mode',
          agent_name: 'system',
          display_name: 'מצב הצגת מערכת',
          config_value: { enabled: !presentationMode }
        });
      }

      setPresentationMode(!presentationMode);
      toast.success(
        !presentationMode 
          ? "מצב הדרכה הופעל - שמות מועמדים ולקוחות מטושטשים" 
          : "מצב הדרכה כובה - המערכת חזרה לתצוגה רגילה"
      );
      
      // Reload page to apply changes across all components
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error toggling presentation mode:", error);
      toast.error("שגיאה בעדכון מצב הצגה");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Presentation className="w-6 h-6 text-purple-600" />
            מצב הצגת מערכת
          </CardTitle>
          <CardDescription>
            הפעלת מצב הדרכה עם טשטוש שמות מועמדים ולקוחות להדגמות ותצוגה
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Toggle */}
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Label 
                  htmlFor="presentation-mode" 
                  className="text-lg font-semibold text-purple-900 cursor-pointer"
                >
                  מצב הדרכה והצגה
                </Label>
                <p className="text-sm text-purple-700">
                  {presentationMode 
                    ? "🔒 שמות מועמדים ולקוחות מטושטשים" 
                    : "👁️ המערכת מציגה שמות אמיתיים"}
                </p>
              </div>
              <Switch
                id="presentation-mode"
                checked={presentationMode}
                onCheckedChange={handleToggle}
                disabled={saving}
                className="scale-125"
              />
            </div>
          </div>

          {/* Info Alert */}
          <Alert className={presentationMode ? "bg-purple-100 border-purple-300" : "bg-gray-50"}>
            <Info className={presentationMode ? "w-5 h-5 text-purple-700" : "w-5 h-5 text-gray-500"} />
            <AlertDescription className={presentationMode ? "text-purple-900" : "text-gray-700"}>
              {presentationMode ? (
                <div className="space-y-2">
                  <p className="font-semibold">✅ מצב הדרכה פעיל</p>
                  <ul className="mr-4 space-y-1 text-sm">
                    <li>• שמות מועמדים ושמות לקוחות מטושטשים בכל המערכת</li>
                    <li>• מתאים להצגות, הדגמות והדרכות</li>
                    <li>• כל הפעולות האחרות פועלות כרגיל</li>
                    <li>• המידע לא נמחק - רק מטושטש מהתצוגה</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold">ℹ️ מצב עבודה רגיל</p>
                  <p className="text-sm">
                    המערכת מציגה שמות אמיתיים של מועמדים ולקוחות. הפעל מצב הדרכה כדי לטשטש שמות לצורך הדגמות.
                  </p>
                </div>
              )}
            </AlertDescription>
          </Alert>

          {/* Status Badge */}
          <div className="flex items-center justify-center p-8">
            <div className={`px-8 py-4 rounded-full border-4 ${
              presentationMode 
                ? "bg-purple-100 border-purple-400 text-purple-900" 
                : "bg-gray-100 border-gray-300 text-gray-700"
            }`}>
              <div className="flex items-center gap-3">
                <Presentation className={`w-8 h-8 ${presentationMode ? "text-purple-600" : "text-gray-500"}`} />
                <span className="text-2xl font-bold">
                  {presentationMode ? "🔒 מצב הדרכה" : "👁️ מצב רגיל"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}