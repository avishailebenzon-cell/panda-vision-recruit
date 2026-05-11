import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Loader2, Save, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function OnboardingImportDialog({ isOpen, onClose, onImportSuccess }) {
  const [step, setStep] = useState(1); // 1=URL input, 2=preview/edit, 3=results
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [detailsDialog, setDetailsDialog] = useState({ isOpen: false, index: null, data: null });
  const [saving, setSaving] = useState(false);
  const [saveResults, setSaveResults] = useState(null);

  const handleParse = async () => {
    if (!spreadsheetUrl.trim()) {
      toast.error('נא להזין קישור לגיליון');
      return;
    }
    
    setLoading(true);
    try {
      const response = await base44.functions.invoke('parseOnboardingData', { 
        spreadsheetUrl 
      });
      
      setParsedData(response.data.candidates || []);
      setSkippedRows(response.data.skipped || []);
      setStep(2);
      toast.success(`נטענו ${response.data.candidates?.length || 0} מועמדים לתצוגה מקדימה`);
      
    } catch (error) {
      console.error('Error parsing:', error);
      toast.error('שגיאה בטעינת הנתונים: ' + error.message);
    }
    setLoading(false);
  };

  const handleOpenDetails = (index) => {
    setDetailsDialog({ 
      isOpen: true, 
      index, 
      data: { ...parsedData[index] } 
    });
  };

  const handleSaveDetails = () => {
    setParsedData(prev => prev.map((item, idx) => 
      idx === detailsDialog.index ? detailsDialog.data : item
    ));
    setDetailsDialog({ isOpen: false, index: null, data: null });
    toast.success('השורה עודכנה');
  };

  const handleDeleteRow = (index) => {
    setParsedData(prev => prev.filter((_, idx) => idx !== index));
    toast.success('השורה נמחקה');
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const response = await base44.functions.invoke('saveParsedOnboardingData', {
        candidates: parsedData
      });
      
      setSaveResults(response.data);
      setStep(3);
      toast.success(`נשמרו בהצלחה! ${response.data.created} נוצרו, ${response.data.updated} עודכנו`);
      
      if (onImportSuccess) {
        onImportSuccess();
      }
      
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('שגיאה בשמירת הנתונים: ' + error.message);
    }
    setSaving(false);
  };

  const handleClose = () => {
    setStep(1);
    setSpreadsheetUrl('');
    setParsedData([]);
    setSkippedRows([]);
    setDetailsDialog({ isOpen: false, index: null, data: null });
    setSaveResults(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ייבוא טפסי קליטה</DialogTitle>
        </DialogHeader>

        {/* Step 1: URL Input */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>קישור לגיליון גוגל</Label>
              <Input
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-2"
              />
            </div>
            
            <Alert>
              <AlertDescription>
                <p className="font-semibold mb-2">תהליך הייבוא:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>המערכת תקרא את הנתונים מהאקסל ותציג אותם לתצוגה מקדימה</li>
                  <li>תוכל לערוך כל שורה לפני השמירה</li>
                  <li>רק לאחר אישור הנתונים יישמרו במאגר</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <Button
              onClick={handleParse}
              disabled={loading || !spreadsheetUrl.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  טוען נתונים...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  טען לתצוגה מקדימה
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Preview and Edit */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">תצוגה מקדימה</h3>
                <p className="text-sm text-gray-600">{parsedData.length} מועמדים מוכנים לשמירה</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  חזור
                </Button>
                <Button 
                  onClick={handleSaveAll} 
                  disabled={saving || parsedData.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      שומר...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 ml-2" />
                      אשר ושמור הכל ({parsedData.length})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {skippedRows.length > 0 && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertDescription>
                  <p className="font-semibold text-orange-800">{skippedRows.length} שורות דולגו:</p>
                  <ul className="text-xs mt-2 space-y-1">
                    {skippedRows.slice(0, 5).map((item, idx) => (
                      <li key={idx}>שורה {item.rowNumber}: {item.reason}</li>
                    ))}
                    {skippedRows.length > 5 && <li>ועוד {skippedRows.length - 5}...</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg overflow-x-auto max-h-96">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-20">שורה</TableHead>
                    <TableHead>שם מלא</TableHead>
                    <TableHead>אימייל</TableHead>
                    <TableHead>טלפון</TableHead>
                    <TableHead>ת.ז</TableHead>
                    <TableHead className="w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((candidate, index) => (
                    <TableRow 
                      key={index}
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => handleOpenDetails(index)}
                    >
                      <TableCell className="font-mono text-xs">{candidate.rowNumber}</TableCell>
                      <TableCell>
                        <span className="font-medium">{candidate.full_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{candidate.email || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{candidate.phone_primary || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{candidate.id_number || '-'}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRow(index)}
                          className="h-7 w-7 text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && saveResults && (
          <div className="space-y-4">
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  הייבוא הושלם בהצלחה!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-green-600">{saveResults.created}</div>
                    <div className="text-sm text-gray-600">מועמדים נוצרו</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-yellow-600">{saveResults.updated}</div>
                    <div className="text-sm text-gray-600">מועמדים עודכנו</div>
                  </div>
                </div>
                
                {saveResults.errors?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-red-600">שגיאות ({saveResults.errors.length}):</h4>
                    <div className="bg-white rounded-lg border max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>שורה</TableHead>
                            <TableHead>שם</TableHead>
                            <TableHead>שגיאה</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saveResults.errors.map((err, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-sm">{err.rowNumber}</TableCell>
                              <TableCell className="text-sm">{err.name}</TableCell>
                              <TableCell className="text-xs text-red-600">{err.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                
                <Button onClick={handleClose} className="w-full">
                  סגור
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>

      {/* Full Details Edit Dialog */}
      <Dialog open={detailsDialog.isOpen} onOpenChange={(open) => !open && setDetailsDialog({ isOpen: false, index: null, data: null })}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת פרטי מועמד - שורה {detailsDialog.data?.rowNumber}</DialogTitle>
          </DialogHeader>
          
          {detailsDialog.data && (
            <div className="space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">פרטים אישיים</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">שם פרטי</Label>
                    <Input
                      value={detailsDialog.data.first_name || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ 
                        ...prev, 
                        data: { ...prev.data, first_name: e.target.value, full_name: `${e.target.value} ${prev.data.last_name}` }
                      }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">שם משפחה</Label>
                    <Input
                      value={detailsDialog.data.last_name || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ 
                        ...prev, 
                        data: { ...prev.data, last_name: e.target.value, full_name: `${prev.data.first_name} ${e.target.value}` }
                      }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">שם פרטי באנגלית</Label>
                    <Input
                      value={detailsDialog.data.first_name_english || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, first_name_english: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">שם משפחה באנגלית</Label>
                    <Input
                      value={detailsDialog.data.last_name_english || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, last_name_english: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">מספר ת.ז</Label>
                    <Input
                      value={detailsDialog.data.id_number || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, id_number: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">מין</Label>
                    <Input
                      value={detailsDialog.data.gender || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, gender: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">תאריך לידה</Label>
                    <Input
                      value={detailsDialog.data.date_of_birth || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, date_of_birth: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">תאריך עלייה</Label>
                    <Input
                      value={detailsDialog.data.immigration_date || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, immigration_date: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">ארץ עלייה</Label>
                    <Input
                      value={detailsDialog.data.immigration_country || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, immigration_country: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">סטטוס משפחתי</Label>
                    <Input
                      value={detailsDialog.data.marital_status || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, marital_status: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">יצירת קשר</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">אימייל</Label>
                    <Input
                      value={detailsDialog.data.email || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, email: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">טלפון נייד</Label>
                    <Input
                      value={detailsDialog.data.phone_primary || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, phone_primary: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">טלפון בבית</Label>
                    <Input
                      value={detailsDialog.data.phone_secondary || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, phone_secondary: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">כתובת</Label>
                    <Input
                      value={detailsDialog.data.address || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, address: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">עיר מגורים</Label>
                    <Input
                      value={detailsDialog.data.city || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, city: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">מיקוד</Label>
                    <Input
                      value={detailsDialog.data.postal_code || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, postal_code: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Professional Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">פרטים מקצועיים</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">תחום עיסוק מבוקש</Label>
                    <Input
                      value={detailsDialog.data.desired_field || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, desired_field: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">תפקיד מרכזי בעבר</Label>
                    <Input
                      value={detailsDialog.data.main_role_experience || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, main_role_experience: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">ציפיות שכר</Label>
                    <Input
                      value={detailsDialog.data.salary_expectation || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, salary_expectation: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">מועד תחילת עבודה</Label>
                    <Input
                      value={detailsDialog.data.expected_start_date || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, expected_start_date: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">ידע בשפות</Label>
                    <Input
                      value={detailsDialog.data.languages || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, languages: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">רישיון נהיגה</Label>
                    <Input
                      value={detailsDialog.data.has_drivers_license || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, has_drivers_license: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">רכב ליסינג</Label>
                    <Input
                      value={detailsDialog.data.needs_leasing_car || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, needs_leasing_car: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">ארוחות באתר</Label>
                    <Input
                      value={detailsDialog.data.needs_lunch_at_client || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, needs_lunch_at_client: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">תחביבים</Label>
                    <Input
                      value={detailsDialog.data.hobbies || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, hobbies: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Security Clearance */}
              <div>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">סיווג בטחוני</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">סיווג בטחוני</Label>
                    <Input
                      value={detailsDialog.data.security_clearance || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, security_clearance: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">גורם מסווג</Label>
                    <Input
                      value={detailsDialog.data.security_clearance_authority || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, security_clearance_authority: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">שנת סיווג</Label>
                    <Input
                      value={detailsDialog.data.security_clearance_year || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, security_clearance_year: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Work History */}
              <div>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">היסטוריית עבודה</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-sm">מקום עבודה 1</Label>
                      <Input
                        value={detailsDialog.data.job_1_company || ''}
                        onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, job_1_company: e.target.value }}))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">תאריך סיום</Label>
                      <Input
                        value={detailsDialog.data.job_1_end_date || ''}
                        onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, job_1_end_date: e.target.value }}))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">סיבת סיום</Label>
                      <Input
                        value={detailsDialog.data.job_1_end_reason || ''}
                        onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, job_1_end_reason: e.target.value }}))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-sm">מקום עבודה 2</Label>
                      <Input
                        value={detailsDialog.data.job_2_company || ''}
                        onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, job_2_company: e.target.value }}))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">תאריך סיום</Label>
                      <Input
                        value={detailsDialog.data.job_2_end_date || ''}
                        onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, job_2_end_date: e.target.value }}))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">סיבת סיום</Label>
                      <Input
                        value={detailsDialog.data.job_2_end_reason || ''}
                        onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, job_2_end_reason: e.target.value }}))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Military Service */}
              <div>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">שירות צבאי</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">דרגה</Label>
                    <Input
                      value={detailsDialog.data.military_rank || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, military_rank: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">מקצוע צבאי</Label>
                    <Input
                      value={detailsDialog.data.military_service || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, military_service: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">שנת גיוס</Label>
                    <Input
                      value={detailsDialog.data.military_recruitment_year || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, military_recruitment_year: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">שנת שחרור</Label>
                    <Input
                      value={detailsDialog.data.military_discharge_year || ''}
                      onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, military_discharge_year: e.target.value }}))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <h3 className="font-semibold text-lg mb-3 border-b pb-2">הערות נוספות</h3>
                <div>
                  <Label className="text-sm">הערות</Label>
                  <Input
                    value={detailsDialog.data.additional_notes || ''}
                    onChange={(e) => setDetailsDialog(prev => ({ ...prev, data: { ...prev.data, additional_notes: e.target.value }}))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setDetailsDialog({ isOpen: false, index: null, data: null })}
                >
                  ביטול
                </Button>
                <Button 
                  onClick={handleSaveDetails}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 ml-2" />
                  שמור שינויים
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}