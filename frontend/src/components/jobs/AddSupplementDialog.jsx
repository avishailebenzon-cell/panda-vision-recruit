import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AddSupplementDialog({ isOpen, onClose, job, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('Starting file upload:', file.name);
    setUploading(true);
    setExtractedText("");

    try {
      toast.loading('מעלה קובץ...', { id: 'file-upload' });
      
      // Upload file
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      console.log('Upload result:', uploadResult);
      
      if (!uploadResult?.file_url) {
        throw new Error('העלאת הקובץ נכשלה');
      }

      toast.loading('מעבד את הקובץ עם דנה...', { id: 'file-upload' });

      // Extract text using Dana (InvokeLLM with file)
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `
אתה דנה, סוכנת AI המתמחה בניהול משרות.
קיבלת קובץ עם תוספת הגדרות למשרה קיימת.
אנא חלצי את כל המידע הרלוונטי מהקובץ ותארי אותו בצורה ברורה ומסודרת.

המידע הזה יתווסף להגדרת המשרה הקיימת.

החזירי את המידע בפורמט ברור וקריא, כולל:
- דרישות טכניות נוספות
- פרטים על הסביבה
- כלים וטכנולוגיות ספציפיות
- כל מידע רלוונטי אחר שמופיע בקובץ

אם הקובץ ריק או לא רלוונטי, ציין זאת.
        `,
        file_urls: [uploadResult.file_url]
      });

      console.log('Extraction response:', response);
      toast.dismiss('file-upload');

      if (response && response.trim()) {
        setExtractedText(response);
        toast.success('המידע חולץ בהצלחה מהקובץ! ✅');
      } else {
        toast.error('לא נמצא מידע רלוונטי בקובץ');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.dismiss('file-upload');
      toast.error(`שגיאה: ${error.message || 'שגיאה בעיבוד הקובץ'}`);
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!extractedText.trim()) {
      toast.error('אין מידע לשמירה');
      return;
    }

    setProcessing(true);
    try {
      // Update job with supplement
      await base44.entities.Job.update(job.id, {
        dana_supplement: extractedText
      });

      // Sync to Pipedrive - ALWAYS try to sync after adding supplement
      try {
        await base44.functions.invoke('syncSupplementToPipedrive', {
          job_id: job.id,
          deal_id: job.pipedrive_deal_id,
          supplement_text: extractedText
        });
        toast.success('התוספת נשמרה ועודכנה ב-Pipedrive');
      } catch (syncError) {
        console.error('Error syncing to Pipedrive:', syncError);
        toast.warning('התוספת נשמרה אך לא עודכנה ב-Pipedrive');
      }

      setExtractedText("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving supplement:', error);
      toast.error('שגיאה בשמירת התוספת');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            הוספת תוספת הגדרות למשרה - {job?.title}
          </DialogTitle>
          <p className="text-sm text-gray-600">
            דנה תעזור לך לחלץ ולשמור מידע נוסף למשרה מקובץ
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="supplement-file" className="text-sm font-medium">
              העלאת קובץ הגדרות נוספות
            </Label>
            <div className="flex flex-col gap-2">
              <input
                id="supplement-file"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <Button
                onClick={() => document.getElementById('supplement-file').click()}
                disabled={uploading}
                variant="outline"
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    מעלה ומעבד...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 ml-2" />
                    העלה קובץ
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              ניתן להעלות קבצי PDF, Word או טקסט עם מידע נוסף על המשרה
            </p>
          </div>

          {/* Extracted Content Display */}
          {extractedText && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription>
                <div className="font-medium text-green-800 mb-2">
                  דנה חילצה את המידע הבא מהקובץ:
                </div>
                <div className="bg-white p-3 rounded border text-sm max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {extractedText}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Current Supplement Display */}
          {job?.dana_supplement && !extractedText && (
            <Alert className="bg-blue-50 border-blue-200">
              <FileText className="w-4 h-4 text-blue-600" />
              <AlertDescription>
                <div className="font-medium text-blue-800 mb-2">
                  תוספת הגדרות קיימת:
                </div>
                <div className="bg-white p-3 rounded border text-sm max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {job.dana_supplement}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploading || processing}
          >
            ביטול
          </Button>
          <Button
            onClick={handleSave}
            disabled={!extractedText.trim() || processing || uploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                שומר...
              </>
            ) : (
              'שמור תוספת'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}