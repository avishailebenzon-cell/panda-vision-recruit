import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, HelpCircle, Copy, CheckCircle } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function ClarificationQuestionsDialog({ isOpen, onClose, task }) {
  const [questions, setQuestions] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !task) {
      setQuestions([]);
      return;
    }

    // Use pre-generated questions if available
    if (task.clarification_questions) {
      try {
        const parsed = typeof task.clarification_questions === 'string' 
          ? JSON.parse(task.clarification_questions) 
          : task.clarification_questions;
        if (Array.isArray(parsed)) {
          setQuestions(parsed);
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          setQuestions(parsed.questions);
        }
      } catch (error) {
        console.error('Error parsing questions:', error);
      }
    }
  }, [isOpen, task]);

  const handleCopyAll = () => {
    const text = questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('השאלות הועתקו ללוח');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] text-right" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <span className="text-xl">שאלות הבהרה</span>
                <p className="text-sm text-gray-500 font-normal mt-1">
                  {task.candidate_name} ← {task.job_title}
                </p>
              </div>
            </DialogTitle>
            {questions.length > 0 && (
              <Button
                variant="outline"
                onClick={handleCopyAll}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    הועתק!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    העתק הכל
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="text-center py-12">
                <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">לא נמצאו שאלות הבהרה</p>
                <p className="text-xs text-gray-400 mt-2">
                  {!task.client_summary_letter ? 'אין מכתב ללקוח עבור משימה זו' : 'לא הצלחנו ליצור שאלות מהמכתב'}
                </p>
              </div>
            ) : (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    מטרת השאלות
                  </h3>
                  <p className="text-sm text-orange-800">
                    השאלות הבאות נועדו לברר אם למועמד יש כישורים או ניסיון נוסף שלא הוזכר בקורות החיים, במיוחד בנושאים שזוהו כפערים או חסרונות במכתב ללקוח.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 font-mono text-sm text-gray-800 leading-loose whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">
                  {questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}
                </div>

                <div className="space-y-3">
                   {questions.map((question, index) => (
                     <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                       <div className="flex items-start gap-3">
                         <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                           <span className="text-orange-700 font-bold text-sm">{index + 1}</span>
                         </div>
                         <p className="text-sm text-gray-800 leading-relaxed pt-1">
                           {question}
                         </p>
                       </div>
                     </div>
                   ))}
                 </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <p className="text-xs text-blue-800">
                    💡 <strong>טיפ:</strong> השתמש בשאלות אלה בשיחת הטלפון עם המועמד כדי למקסם את הסיכוי להתאמה מוצלחת
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}