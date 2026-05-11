import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ThumbsUp, 
  ThumbsDown, 
  Send, 
  Loader2,
  Bot,
  Briefcase,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { MatchNote } from "@/entities/MatchNote";
import { Match } from "@/entities/Match";
import { InvokeLLM } from "@/integrations/Core";

export default function AgentFeedbackDialog({ 
  isOpen, 
  onClose, 
  match, 
  agentType, // "naama" or "roee"
  user,
  onMatchRejected // callback when match is marked as rejected
}) {
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState(null); // "positive" or "negative"
  const [sending, setSending] = useState(false);
  const [agentResponse, setAgentResponse] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFeedback("");
      setFeedbackType(null);
      setAgentResponse("");
    }
  }, [isOpen, match?.id]);

  if (!match) return null;

  const agentInfo = {
    naama: {
      name: "נעמה",
      role: "מחפשת מועמדים למשרות תוכנה",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
      color: "orange"
    },
    roee: {
      name: "רועי", 
      role: "מחפש משרות למועמדים",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
      color: "blue"
    },
    rami: {
      name: "רמי",
      role: "מומחה להתאמות רמה 1",
      image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop&crop=face",
      color: "red"
    },
    alik: {
      name: "אליק",
      role: "מומחה התאמות אלקטרוניקה",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
      color: "teal"
    },
    itay: {
      name: "איתי",
      role: "מומחה התאמות IT",
      image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&crop=face",
      color: "indigo"
    },
    lior: {
      name: "ליאור",
      role: "מומחה התאמות הנדסת מערכת",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
      color: "amber"
    },
    ofir: {
      name: "אופיר",
      role: "מומחה התאמות הנדסת מכונות",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
      color: "emerald"
    },
    gc: {
      name: "GC",
      role: "סוכן כללי - Garbage Collector",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
      color: "gray"
    }
  };

  const agent = agentInfo[agentType] || agentInfo.naama;

  const handleSendFeedback = async () => {
    if (!feedback.trim() && !feedbackType) {
      toast.error("נא לבחור סוג משוב או לכתוב הערה");
      return;
    }

    setSending(true);
    try {
      // Build context for the agent
      const feedbackContext = `
סוג משוב: ${feedbackType === 'positive' ? 'חיובי - התאמה טובה' : feedbackType === 'negative' ? 'שלילי - התאמה לא מתאימה' : 'הערה כללית'}
מועמד: ${match.candidate_name}
משרה: ${match.job_title || 'חיפוש חופשי'}
ציון התאמה: ${match.match_score || 'לא צוין'}
סיבות להתאמה מקוריות: ${match.match_reasons || 'לא צוינו'}

הערת המשתמש: ${feedback || 'ללא הערה נוספת'}
      `.trim();

      // Get agent response
      const response = await InvokeLLM({
        prompt: `אתה ${agent.name}, סוכן AI ש${agent.role} במערכת גיוס.
        
קיבלת משוב מ${user?.full_name || 'משתמש'} לגבי התאמה שביצעת:

${feedbackContext}

${feedbackType === 'positive' ? 
  'המשתמש מרוצה מההתאמה. הודה לו והסבר מה עשית נכון ומה תמשיך לעשות.' : 
  feedbackType === 'negative' ? 
  'המשתמש לא מרוצה מההתאמה. התנצל, הבן מה טעית, והסבר מה תשפר בהתאמות עתידיות.' :
  'המשתמש שלח הערה כללית. הגב בצורה מקצועית ורלוונטית.'
}

הגב בעברית, בצורה קצרה וידידותית (2-4 משפטים).`,
        response_json_schema: {
          type: "object",
          properties: {
            response: { type: "string", description: "תגובת הסוכן" },
            learning_points: { type: "array", items: { type: "string" }, description: "נקודות ללמידה עתידית" }
          }
        }
      });

      setAgentResponse(response.response);

      // Save the feedback as a note on the match
      const noteText = `💬 משוב לסוכן ${agent.name}:
סוג: ${feedbackType === 'positive' ? '👍 חיובי' : feedbackType === 'negative' ? '👎 שלילי' : '💭 הערה'}
${feedback ? `הערה: ${feedback}` : ''}
תגובת ${agent.name}: ${response.response}
${response.learning_points?.length > 0 ? `נקודות ללמידה: ${response.learning_points.join(', ')}` : ''}`;

      await MatchNote.create({
        match_id: match.id,
        user_id: user?.id,
        user_name: user?.full_name || user?.email || 'משתמש',
        note_text: noteText,
        is_system_note: false
      });

      // Save to AgentMatchFeedback for learning
      try {
        const { saveMatchFeedback } = await import('@/functions/saveMatchFeedback');
        await saveMatchFeedback({
          match_id: match.id,
          feedback_type: feedbackType === 'positive' ? 'approved' : 'rejected',
          rejection_reason: feedbackType === 'negative' ? feedback : null,
          notes: feedback || response.response
        });
      } catch (learningError) {
        console.error('Error saving feedback for learning:', learningError);
      }

      // If negative feedback, mark the match as rejected and hide it from view
      if (feedbackType === 'negative') {
        await Match.update(match.id, {
          is_rejected_feedback: true,
          rejection_reason: feedback || response.response
        });
        
        // For Naama specifically, also mark the candidate as irrelevant to prevent future matches
        if (agentType === 'naama' && match.candidate_id) {
          try {
            const { Candidate } = await import('@/entities/Candidate');
            await Candidate.update(match.candidate_id, {
              status: "לא רלוונטי יותר"
            });
            toast.success(`המשוב נשלח לנעמה, ההתאמה הוסרה והמועמד סומן כלא רלוונטי`);
          } catch (candidateUpdateError) {
            console.error("Error marking candidate as irrelevant:", candidateUpdateError);
            toast.success(`המשוב נשלח ל${agent.name} וההתאמה הוסרה מהתצוגה`);
          }
        } else {
          toast.success(`המשוב נשלח ל${agent.name} וההתאמה הוסרה מהתצוגה`);
        }
        
        // Call the callback to notify parent component
        if (onMatchRejected) {
          onMatchRejected(match.id);
        }
      } else {
        toast.success(`המשוב נשלח ל${agent.name}`);
      }

    } catch (error) {
      console.error("Error sending feedback:", error);
      toast.error("שגיאה בשליחת המשוב");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setFeedback("");
    setFeedbackType(null);
    setAgentResponse("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img 
              src={agent.image}
              alt={agent.name}
              className={`w-12 h-12 rounded-full object-cover border-3 border-${agent.color}-200`}
            />
            <div>
              <span>שיחה עם {agent.name}</span>
              <p className="text-sm font-normal text-gray-500">{agent.role}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match Context */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span className="font-medium">{match.candidate_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-green-600" />
              <span>{match.job_title || 'חיפוש חופשי'}</span>
            </div>
            {match.match_score && (
              <Badge className="mt-2 bg-purple-100 text-purple-800">
                ציון התאמה: {match.match_score}%
              </Badge>
            )}
          </div>

          {/* Feedback Type Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              איך היתה ההתאמה?
            </label>
            <div className="flex gap-2">
              <Button
                variant={feedbackType === 'positive' ? 'default' : 'outline'}
                onClick={() => setFeedbackType('positive')}
                className={feedbackType === 'positive' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <ThumbsUp className="w-4 h-4 ml-2" />
                התאמה מצוינת
              </Button>
              <Button
                variant={feedbackType === 'negative' ? 'default' : 'outline'}
                onClick={() => setFeedbackType('negative')}
                className={feedbackType === 'negative' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                <ThumbsDown className="w-4 h-4 ml-2" />
                התאמה לא מתאימה
              </Button>
            </div>
          </div>

          {/* Feedback Text */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              הערות נוספות ל{agent.name} (אופציונלי)
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={`למשל: "המועמד לא מתאים כי חסר לו ניסיון ב..." או "התאמה מצוינת, בדיוק מה שחיפשתי!"`}
              rows={3}
            />
          </div>

          {/* Agent Response */}
          {agentResponse && (
            <div className={`bg-${agent.color}-50 border border-${agent.color}-200 rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Bot className={`w-4 h-4 text-${agent.color}-600`} />
                <span className="font-medium text-sm">{agent.name} אומרת:</span>
              </div>
              <p className="text-sm text-gray-700">{agentResponse}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {agentResponse ? 'סגור' : 'ביטול'}
            </Button>
            {!agentResponse && (
              <Button 
                onClick={handleSendFeedback} 
                disabled={sending || (!feedback.trim() && !feedbackType)}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 ml-2" />
                )}
                שלח ל{agent.name}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}