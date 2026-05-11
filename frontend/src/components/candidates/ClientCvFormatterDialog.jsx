import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Download, Wand2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ClientCvFormatterDialog({ isOpen, onClose, candidate }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [processedHtml, setProcessedHtml] = useState('');
    const [agentProgress, setAgentProgress] = useState('');

    const generateClientCv = async () => {
        if (!candidate?.full_text && !candidate?.skills_summary) {
            setError("לא נמצא טקסט קורות חיים עבור מועמד זה.");
            return;
        }

        setIsProcessing(true);
        setError('');
        setProcessedHtml('');
        setAgentProgress('יוצר שיחה עם הסוכן...');

        try {
            setAgentProgress('מעבד קורות חיים...');

            // Simple approach: Just clean personal info from full_text
            const cvText = candidate.full_text || candidate.skills_summary || '';
            
            const prompt = `אתה צריך להסיר פרטים מזהים מקורות חיים ולהחזיר את התוכן בפורמט HTML פשוט.

קורות החיים המקוריים:
${cvText}

משימתך:
1. **העתק את כל התוכן המקורי מילה במילה** (לא תקציר!)
2. הסר רק את הפרטים המזהים הבאים:
   - מספרי טלפון
   - כתובות אימייל
   - כתובות מגורים מלאות
   - תעודת זהות
   - תאריך לידה מדויק
3. **שמור הכל אחרת**: שם המועמד, כל הכותרות, כל התוכן, הניסוח המקורי, המבנה
4. החזר HTML מעוצב פשוט עם כותרות h2 לסעיפים

דוגמה לפורמט:
<div style="text-align: center; margin-bottom: 20px;">
<h1 style="color: #1e40af;">${candidate.first_name} ${candidate.last_name}</h1>
</div>

<h2 style="color: #1e40af; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 20px;">ניסיון תעסוקתי</h2>
<p>[העתק כאן את כל תוכן הניסיון מהמקור]</p>

<h2 style="color: #1e40af; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 20px;">השכלה</h2>
<p>[העתק כאן את כל תוכן ההשכלה]</p>

[המשך עם כל הכותרות והתכנים]`;

            const response = await base44.integrations.Core.InvokeLLM({
                prompt: prompt,
                response_json_schema: null // We want plain text/HTML, not JSON
            });

            // The response should be HTML content
            let htmlContent = response;
            
            // Clean up the response if needed
            if (typeof htmlContent === 'string') {
                // Remove markdown code blocks if present
                htmlContent = htmlContent.replace(/```html\n?/g, '').replace(/```\n?/g, '');
                htmlContent = htmlContent.trim();
            }

            setProcessedHtml(htmlContent);
            setAgentProgress('');
            
        } catch (e) {
            console.error('Error processing CV:', e);
            if (e.message.includes('תם הזמן')) {
                setError(`${e.message}\n\nטיפים לפתרון:\n• ודא שהטקסט לא ארוך מדי (מעל 10,000 מילים)\n• נסה שוב מאוחר יותר כשהשרת פחות עמוס\n• בדוק חיבור לאינטרנט`);
            } else if (e.message.includes('agent not found') || e.message.includes('Agent not found')) {
                setError('סוכן עיבוד קורות החיים אינו זמין כרגע. אנא פנה למנהל המערכת.');
            } else {
                setError(`שגיאה בעיבוד קורות החיים: ${e.message}`);
            }
        } finally {
            setIsProcessing(false);
            setAgentProgress('');
        }
    };

    const downloadAsPdf = async () => {
        if (!processedHtml) return;

        try {
            setAgentProgress('מייצר PDF...');
            setIsProcessing(true);

            // Create a complete HTML document with styles and company logo
            const fullHtmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="he">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>קורות חיים - ${candidate?.first_name} ${candidate?.last_name}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&display=swap');
                    
                    * {
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Assistant', 'Segoe UI', Arial, sans-serif;
                        line-height: 1.6;
                        margin: 0;
                        padding: 0;
                        background: white;
                        color: #374151;
                        direction: rtl;
                    }
                    
                    .page-container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #1e40af;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .logo-container {
                        margin-bottom: 15px;
                    }
                    
                    .logo-container img {
                        height: 70px;
                        width: auto;
                    }
                    
                    .company-info {
                        font-size: 11px;
                        color: #6b7280;
                        margin-top: 10px;
                    }
                    
                    .cv-content {
                        padding: 15px 0;
                    }
                    
                    h1 {
                        color: #1e40af;
                        font-size: 24px;
                        margin: 20px 0;
                        text-align: center;
                    }
                    
                    h2 {
                        color: #1e40af;
                        font-size: 18px;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                        margin: 20px 0 10px 0;
                    }
                    
                    h3 {
                        color: #374151;
                        font-size: 16px;
                        margin: 15px 0 8px 0;
                        font-weight: 600;
                    }
                    
                    p {
                        margin: 8px 0;
                        line-height: 1.6;
                    }
                    
                    li {
                        margin: 5px 0;
                        line-height: 1.5;
                    }
                    
                    ul {
                        padding-right: 20px;
                        margin: 8px 0;
                    }
                    
                    .footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 2px solid #e5e7eb;
                        text-align: center;
                        font-size: 10px;
                        color: #9ca3af;
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <div class="header">
                        <div class="logo-container">
                            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6847eb494b4ff1b4288c7bb5/9aa178c6c_.png" alt="Panda Tech Logo" />
                        </div>
                        <div class="company-info">jobs@pandatech.co.il | www.pandatech.co.il</div>
                    </div>
                    
                    <div class="cv-content">
                        ${processedHtml}
                    </div>
                    
                    <div class="footer">
                        מסמך זה הופק על ידי פנדה-טק | המידע במסמך חסוי ומיועד לנמען בלבד
                    </div>
                </div>
            </body>
            </html>
            `;

            // Convert HTML to PDF using ConvertAPI
            const convertApiSecret = 'ZB1qZ7mwVbN8pjNa'; // From your secrets
            const response = await fetch('https://v2.convertapi.com/convert/html/to/pdf?Secret=' + convertApiSecret, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Parameters: [
                        {
                            Name: 'File',
                            Value: btoa(unescape(encodeURIComponent(fullHtmlContent)))
                        },
                        {
                            Name: 'FileName',
                            Value: `cv_${candidate?.first_name}_${candidate?.last_name}.html`
                        },
                        {
                            Name: 'PageSize',
                            Value: 'a4'
                        },
                        {
                            Name: 'MarginTop',
                            Value: '10'
                        },
                        {
                            Name: 'MarginBottom',
                            Value: '10'
                        },
                        {
                            Name: 'MarginLeft',
                            Value: '10'
                        },
                        {
                            Name: 'MarginRight',
                            Value: '10'
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error('שגיאה בהמרת HTML ל-PDF');
            }

            const result = await response.json();
            const pdfUrl = result.Files[0].Url;

            // Download the PDF
            const pdfResponse = await fetch(pdfUrl);
            const pdfBlob = await pdfResponse.blob();
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `קורות_חיים_${candidate?.first_name}_${candidate?.last_name}_פנדה-טק.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setAgentProgress('');
            setIsProcessing(false);
        } catch (error) {
            console.error('Error creating PDF:', error);
            setError('שגיאה ביצירת PDF: ' + error.message);
            setAgentProgress('');
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setProcessedHtml('');
        setError('');
        setAgentProgress('');
        setIsProcessing(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                        הכנת קורות חיים ללקוח
                    </DialogTitle>
                    {candidate && (
                        <p className="text-sm text-gray-600">
                            מועמד: {candidate.first_name} {candidate.last_name}
                        </p>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {!processedHtml && !isProcessing && (
                        <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                            <Wand2 className="w-16 h-16 text-blue-400 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                מוכן להכין קורות חיים ללקוח?
                            </h3>
                            <p className="text-gray-500 mb-6 max-w-md">
                                המערכת תעתיק את קורות החיים המקוריים מילה במילה, תסיר רק פרטי קשר אישיים, ותפיק PDF עם לוגו פנדה-טק
                            </p>
                            <Button onClick={generateClientCv} className="bg-blue-600 hover:bg-blue-700">
                                <Wand2 className="w-4 h-4 ml-2" />
                                הכן קורות חיים ללקוח
                            </Button>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                            <Wand2 className="w-12 h-12 text-blue-400 animate-pulse mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                מעבד קורות חיים...
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                {agentProgress || 'הסוכן עובד על הכנת הגרסה ללקוח...'}
                            </p>
                            <div className="flex items-center gap-2 text-blue-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">אנא המתן...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {processedHtml && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-medium">קורות החיים מוכנים!</span>
                                </div>
                                <Button onClick={downloadAsPdf} className="bg-green-600 hover:bg-green-700" disabled={isProcessing}>
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                            מייצר PDF...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4 ml-2" />
                                            הורד PDF
                                        </>
                                    )}
                                </Button>
                            </div>

                            <div className="border rounded-lg p-4 bg-gray-50">
                                <h4 className="font-semibold text-gray-700 mb-3">תצוגה מקדימה:</h4>
                                <ScrollArea className="h-96 border bg-white rounded">
                                    <div 
                                        className="p-4 text-sm"
                                        dangerouslySetInnerHTML={{ __html: processedHtml }}
                                    />
                                </ScrollArea>
                            </div>

                            <Alert>
                                <AlertDescription>
                                    <strong>שים לב:</strong> לחץ על "הורד PDF" כדי לייצר ולהוריד קובץ PDF מקצועי עם לוגו פנדה-טק.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        סגור
                    </Button>
                    {processedHtml && (
                        <Button onClick={downloadAsPdf} className="bg-blue-600 hover:bg-blue-700" disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                    מייצר PDF...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4 ml-2" />
                                    הורד PDF
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}