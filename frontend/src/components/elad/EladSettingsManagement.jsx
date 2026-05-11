import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Mail, FileText, Settings as SettingsIcon, Shield } from "lucide-react";
import { toast } from "sonner";

export default function EladSettingsManagement() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settingsList = await base44.entities.EladSettings.list();
      
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      } else {
        // Create default settings
        const defaultSettings = await base44.entities.EladSettings.create({
          sender_name: "פנדה-טק",
          sender_email: "jobs@pandatech.co.il",
          signature_text: "בברכה,\nצוות פנדה-טק\nחברת כוח אדם והשמה\nטל: 03-1234567",
          subject_template: "{JobTitle} | {CandidateFullName} | פנדה-טק",
          body_template: "שלום רב,\n\nמצורפים קורות החיים של {CandidateFullName} להגשה למשרת \"{JobTitle}\" בחברת {ClientCompanyName}.\nנשמח לקבל עדכון על התקדמות המועמד בתהליך.\n\nבברכה,\n{SignatureText}",
          language_mode: "עברית",
          enable_branded_pdf: true,
          pdf_branding_mode: "לוגו בעמוד ראשון",
          auto_execute_on_approved: true,
          execute_window_seconds: 60,
          max_emails_per_minute: 10,
          max_retries: 2,
          retry_delay_seconds: 120,
          retry_on_transient_only: true,
          do_not_send_if_missing_client_email: true,
          do_not_send_if_missing_cv: true,
          do_not_send_if_deadline_passed: true,
          default_priority_if_missing: "בינונית",
          is_active: true
        });
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("שגיאה בטעינת ההגדרות");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.EladSettings.update(settings.id, settings);
      toast.success("ההגדרות נשמרו בהצלחה");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("שגיאה בשמירת ההגדרות");
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      
      setSettings({ ...settings, logo_asset_url: result.file_url });
      toast.success("הלוגו הועלה בהצלחה");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("שגיאה בהעלאת הלוגו");
    }
    setUploadingLogo(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            מיילים
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            PDF
          </TabsTrigger>
          <TabsTrigger value="execution" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            ביצוע
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            חוקים
          </TabsTrigger>
        </TabsList>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>פרטי שולח</CardTitle>
              <CardDescription>הגדרות שולח המיילים ותבניות</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שם השולח</Label>
                  <Input
                    value={settings.sender_name || ""}
                    onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                    placeholder="פנדה-טק"
                  />
                </div>
                <div className="space-y-2">
                  <Label>מייל שולח (מאומת ב-Resend)</Label>
                  <Input
                    type="email"
                    value={settings.sender_email || ""}
                    onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                    placeholder="jobs@pandatech.co.il"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>מייל לתשובות (אופציונלי)</Label>
                <Input
                  type="email"
                  value={settings.reply_to_email || ""}
                  onChange={(e) => setSettings({ ...settings, reply_to_email: e.target.value })}
                  placeholder="reply@pandatech.co.il"
                />
              </div>

              <div className="space-y-2">
                <Label>שפת המיילים</Label>
                <Select
                  value={settings.language_mode || "עברית"}
                  onValueChange={(value) => setSettings({ ...settings, language_mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="עברית">עברית</SelectItem>
                    <SelectItem value="אנגלית">אנגלית</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>תבנית נושא המייל</Label>
                <Input
                  value={settings.subject_template || ""}
                  onChange={(e) => setSettings({ ...settings, subject_template: e.target.value })}
                  placeholder="{JobTitle} | {CandidateFullName} | פנדה-טק"
                />
                <p className="text-xs text-gray-500">משתנים זמינים: {"{JobTitle}"}, {"{CandidateFullName}"}, {"{ClientCompanyName}"}</p>
              </div>

              <div className="space-y-2">
                <Label>תבנית גוף המייל</Label>
                <Textarea
                  value={settings.body_template || ""}
                  onChange={(e) => setSettings({ ...settings, body_template: e.target.value })}
                  rows={6}
                  placeholder="שלום רב,..."
                />
                <p className="text-xs text-gray-500">משתנים זמינים: {"{JobTitle}"}, {"{CandidateFullName}"}, {"{ClientCompanyName}"}, {"{SignatureText}"}</p>
              </div>

              <div className="space-y-2">
                <Label>חתימה</Label>
                <Textarea
                  value={settings.signature_text || ""}
                  onChange={(e) => setSettings({ ...settings, signature_text: e.target.value })}
                  rows={4}
                  placeholder="בברכה,..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PDF Branding */}
        <TabsContent value="pdf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>הפקת PDF ממותג</CardTitle>
              <CardDescription>הגדרות ליצירת קורות חיים ממותגים עם לוגו החברה</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>הפעל PDF ממותג</Label>
                  <p className="text-xs text-gray-500">ליצירת קורות חיים עם לוגו פנדה-טק</p>
                </div>
                <Switch
                  checked={settings.enable_branded_pdf || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, enable_branded_pdf: checked })}
                />
              </div>

              {settings.enable_branded_pdf && (
                <>
                  <div className="space-y-2">
                    <Label>מיקום הלוגו</Label>
                    <Select
                      value={settings.pdf_branding_mode || "לוגו בעמוד ראשון"}
                      onValueChange={(value) => setSettings({ ...settings, pdf_branding_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="לוגו על כל עמוד">לוגו על כל עמוד</SelectItem>
                        <SelectItem value="לוגו בעמוד ראשון">לוגו בעמוד ראשון</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>קובץ לוגו</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                      {uploadingLogo && <Loader2 className="w-4 h-4 animate-spin" />}
                    </div>
                    {settings.logo_asset_url && (
                      <img src={settings.logo_asset_url} alt="Logo" className="h-16 mt-2 border rounded" />
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execution Settings */}
        <TabsContent value="execution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מדיניות ביצוע ותזמון</CardTitle>
              <CardDescription>הגדרות לשליחה אוטומטית ו-rate limiting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>שליחה אוטומטית באישור</Label>
                  <p className="text-xs text-gray-500">האם לשלוח אוטומטית כשמשימה מאושרת</p>
                </div>
                <Switch
                  checked={settings.auto_execute_on_approved || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_execute_on_approved: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>חלון זמן לביצוע (שניות)</Label>
                <Input
                  type="number"
                  value={settings.execute_window_seconds || 60}
                  onChange={(e) => setSettings({ ...settings, execute_window_seconds: parseInt(e.target.value) })}
                  min={10}
                  max={300}
                />
                <p className="text-xs text-gray-500">זמן מקסימלי מאישור ועד שליחה בפועל</p>
              </div>

              <div className="space-y-2">
                <Label>מגבלת מיילים לדקה</Label>
                <Input
                  type="number"
                  value={settings.max_emails_per_minute || 10}
                  onChange={(e) => setSettings({ ...settings, max_emails_per_minute: parseInt(e.target.value) })}
                  min={1}
                  max={50}
                />
                <p className="text-xs text-gray-500">למניעת הצפה ושמירה על reputation</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>ניסיונות חוזרים מקסימליים</Label>
                  <Input
                    type="number"
                    value={settings.max_retries || 2}
                    onChange={(e) => setSettings({ ...settings, max_retries: parseInt(e.target.value) })}
                    min={0}
                    max={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>המתנה בין ניסיונות (שניות)</Label>
                  <Input
                    type="number"
                    value={settings.retry_delay_seconds || 120}
                    onChange={(e) => setSettings({ ...settings, retry_delay_seconds: parseInt(e.target.value) })}
                    min={30}
                    max={600}
                  />
                </div>
                <div className="flex items-center justify-between pt-7">
                  <Label className="text-xs">רק שגיאות זמניות</Label>
                  <Switch
                    checked={settings.retry_on_transient_only || false}
                    onCheckedChange={(checked) => setSettings({ ...settings, retry_on_transient_only: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operational Rules */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>חוקים תפעוליים</CardTitle>
              <CardDescription>כללי חסימה ומדיניות ברירת מחדל</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription className="text-sm">
                  💡 כללים אלו מונעים שליחת מיילים במקרים בעייתיים
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between py-2 border-b">
                <div className="space-y-1">
                  <Label>חסום אם חסר מייל לקוח</Label>
                  <p className="text-xs text-gray-500">לא לשלוח אם אין כתובת מייל ללקוח</p>
                </div>
                <Switch
                  checked={settings.do_not_send_if_missing_client_email || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, do_not_send_if_missing_client_email: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div className="space-y-1">
                  <Label>חסום אם חסר קו"ח</Label>
                  <p className="text-xs text-gray-500">לא לשלוח אם אין קורות חיים למועמד</p>
                </div>
                <Switch
                  checked={settings.do_not_send_if_missing_cv || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, do_not_send_if_missing_cv: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div className="space-y-1">
                  <Label>חסום אם דד-ליין עבר</Label>
                  <p className="text-xs text-gray-500">לא לשלוח אם תאריך המשרה חלף</p>
                </div>
                <Switch
                  checked={settings.do_not_send_if_deadline_passed || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, do_not_send_if_deadline_passed: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>עדיפות ברירת מחדל</Label>
                <Select
                  value={settings.default_priority_if_missing || "בינונית"}
                  onValueChange={(value) => setSettings({ ...settings, default_priority_if_missing: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="גבוהה">גבוהה</SelectItem>
                    <SelectItem value="בינונית">בינונית</SelectItem>
                    <SelectItem value="נמוכה">נמוכה</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">עדיפות שתוגדר אם לא צוינה</p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-1">
                  <Label>סוכן אלעד פעיל</Label>
                  <p className="text-xs text-gray-500">האם לאפשר לאלעד לעבוד</p>
                </div>
                <Switch
                  checked={settings.is_active || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
          שמור הגדרות
        </Button>
      </div>
    </div>
  );
}