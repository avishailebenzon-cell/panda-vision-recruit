import React, { useState, useEffect, useCallback } from 'react';
import { InvokeLLM } from "@/integrations/Core"; // Import InvokeLLM
import { CandidateInterview } from '@/entities/CandidateInterview';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, BrainCircuit, AlertTriangle, Save, Sparkles, Wand2, Copy } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function InterviewQuestionsDialog({ isOpen, onClose, candidate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [interviewData, setInterviewData] = useState(null);
  const [agentProgress, setAgentProgress] = useState('');

  const generateQuestions = useCallback(async () => {
    if (!candidate) {
        setError("לא נבחר מועמד");
        setIsLoading(false);
        return;
    }
      
    setIsLoading(true);
    setError('');
    setAgentProgress('מעבד את קורות החיים...');

    try {
      // Build candidate resume text from multiple fields
      const resumeText = [
        candidate.full_text,
        candidate.main_experience && `ניסיון עיקרי: ${candidate.main_experience}`,
        candidate.skills_summary && `סיכום כישורים: ${candidate.skills_summary}`,
        candidate.main_tech_tools && `כלים טכנולוגיים: ${candidate.main_tech_tools}`,
        candidate.main_programming_languages && `שפות תכנות: ${candidate.main_programming_languages}`,
        candidate.education && `השכלה: ${candidate.education}`
      ].filter(Boolean).join('\n\n');

      if (!resumeText || resumeText.trim().length === 0) {
        setError("לא נמצאו נתונים קורות חיים עבור מועמד זה. לא ניתן לייצר שאלות.");
        setIsLoading(false);
        return;
      }

      const prompt = `אתה מראיין HR מומחה ומנוסה. משימתך היא לקרוא את קורות החיים הבאים ולייצר בין 5 ל-10 שאלות ראיון מעמיקות ומותאמות אישית. התמקד בפערים בזמנים, מעברי עבודה תכופים, נקודות לא ברורות, והישגים בולטים. אל תשאל שאלות גנריות. קורות החיים:\n\n${resumeText.substring(0, 20000)}`;

      setAgentProgress('מכין שאלות מותאמות אישית...');
      
      const response = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: { "type": "string" },
              description: "רשימת שאלות הראיון שנוצרו"
            }
          },
          required: ["questions"]
        }
      });
      
      setAgentProgress('מעבד את תשובת המודל...');
      
      if (response.questions && Array.isArray(response.questions)) {
        setInterviewData({
          candidate_id: candidate.id,
          candidate_name: `${candidate.first_name} ${candidate.last_name}`,
          generated_questions: response.questions,
          answers: Array(response.questions.length).fill(''),
          interview_notes: ''
        });
      } else {
        throw new Error("Invalid response format from model.");
      }
    } catch (err) {
      console.error("Error generating questions:", err);
      setError(`שגיאה ביצירת השאלות: ${err.message}`);
    } finally {
      setIsLoading(false);
      setAgentProgress('');
    }
  }, [candidate]);

  const loadOrCreateInterview = useCallback(async () => {
    if (!candidate) return;
    
    setIsLoading(true);
    setError('');
    setAgentProgress('טוען נתוני ראיון קיימים או מכין שאלות חדשות...');

    try {
      // Check if an interview record already exists
      const existingInterviews = await CandidateInterview.filter({ candidate_id: candidate.id });
      if (existingInterviews.length > 0) {
        setInterviewData(existingInterviews[0]);
        setAgentProgress(''); // Clear progress if existing interview is loaded
      } else {
        // If not, generate new questions
        await generateQuestions();
      }
    } catch (err) {
      console.error("Error loading or creating interview:", err);
      setError(`שגיאה בטעינת או יצירת השאלון: ${err.message}`);
      setAgentProgress('');
    } finally {
      setIsLoading(false);
    }
  }, [candidate, generateQuestions]);

  useEffect(() => {
    if (isOpen) {
      loadOrCreateInterview();
    } else {
        // Reset state on close
        setInterviewData(null);
        setError('');
        setIsLoading(false);
        setIsSaving(false);
        setAgentProgress('');
    }
  }, [isOpen, loadOrCreateInterview]);

  const handleAnswerChange = (index, value) => {
    const newAnswers = [...interviewData.answers];
    newAnswers[index] = value;
    setInterviewData({ ...interviewData, answers: newAnswers });
  };

  const handleNotesChange = (value) => {
    setInterviewData({ ...interviewData, interview_notes: value });
  };
  
  const handleSave = async () => {
    if (!interviewData) return;

    setIsSaving(true);
    setError('');

    try {
      if (interviewData.id) {
        // Update existing record
        await CandidateInterview.update(interviewData.id, interviewData);
      } else {
        // Create new record
        await CandidateInterview.create(interviewData);
      }
      onClose();
    } catch (err) {
      console.error("Error saving interview:", err);
      setError(`שגיאה בשמירת הראיון: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyQuestions = () => {
    if (!interviewData?.generated_questions) return;
    
    const questionsText = `שאלות ראיון למועמד: ${interviewData.candidate_name}\n\n` +
      interviewData.generated_questions.map((question, index) => 
        `${index + 1}. ${question}`
      ).join('\n\n') +
      '\n\n--- נוצר על ידי PandaRecruitAI ---';
    
    navigator.clipboard.writeText(questionsText).then(() => {
      // Success feedback - could add a toast notification here
      console.log('השאלות הועתקו בהצלחה');
    }).catch(err => {
      console.error('שגיאה בהעתקת השאלות:', err);
    });
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" dir="rtl" style={{ direction: 'rtl' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-purple-600" />
            שאלון מותאם אישית למועמד
          </DialogTitle>
          {candidate && <DialogDescription>מועמד: {candidate.first_name} {candidate.last_name}</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="py-4 space-y-6">
            {isLoading && (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <Wand2 className="w-12 h-12 text-purple-400 animate-pulse mb-4" />
                <p className="text-lg font-semibold text-gray-700">מכין שאלות חכמות...</p>
                <p className="text-sm text-gray-500 mt-2">{agentProgress || 'ממתין לתגובה...'}</p>
              </div>
            )}

            {error && !isLoading && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {interviewData && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5 text-purple-600" />
                      שאלון לראיון
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyQuestions}
                      className="flex items-center gap-2 text-purple-600 border-purple-300 hover:bg-purple-50"
                    >
                      <Copy className="w-4 h-4" />
                      העתק שאלות
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">השאלות הבאות נוצרו על-ידי AI על בסיס קורות החיים של המועמד.</p>
                  <div className="space-y-4">
                    {interviewData.generated_questions.map((q, index) => (
                      <div key={index}>
                        <Label htmlFor={`question-${index}`} className="font-semibold text-gray-800 text-right block">{`שאלה ${index + 1}: ${q}`}</Label>
                        <Textarea
                          id={`question-${index}`}
                          placeholder="תשובת המועמד..."
                          value={interviewData.answers[index] || ''}
                          onChange={(e) => handleAnswerChange(index, e.target.value)}
                          className="mt-2 text-sm"
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <Label htmlFor="interview-notes" className="text-lg font-semibold mb-3">סיכום והערות הראיון</Label>
                  <Textarea
                    id="interview-notes"
                    placeholder="רשום כאן את סיכום הראיון, התרשמות כללית והערות נוספות..."
                    value={interviewData.interview_notes || ''}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    className="mt-2 text-sm"
                    rows={6}
                  />
                </div>
              </>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>ביטול</Button>
          <Button onClick={() => generateQuestions()} variant="ghost" disabled={isLoading || isSaving}>
            <Sparkles className="w-4 h-4 ml-2" />
            צור שאלות חדשות
          </Button>
          <Button onClick={handleSave} disabled={!interviewData || isLoading || isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="mr-2">שמור ראיון</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}