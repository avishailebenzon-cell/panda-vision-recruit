import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const agentConfigs = {
  naama: {
    name: 'נעמה',
    color: 'orange',
    role: 'מומחית תוכנה',
    expertise: 'תוכנה, embedded, firmware, C++, Python, Java'
  },
  alik: {
    name: 'אליק',
    color: 'teal',
    role: 'מומחה אלקטרוניקה',
    expertise: 'אלקטרוניקה, PCB, FPGA, אנלוגי/דיגיטלי'
  },
  itay: {
    name: 'איתי',
    color: 'indigo',
    role: 'מומחה IT',
    expertise: 'DevOps, Cloud, AWS, Azure, רשתות, אבטחת מידע'
  },
  lior: {
    name: 'ליאור',
    color: 'amber',
    role: 'מומחה הנדסת מערכת',
    expertise: 'הנדסת מערכת, SRS, MBSE, DOORS'
  },
  ofir: {
    name: 'אופיר',
    color: 'emerald',
    role: 'מומחה הנדסת מכונות',
    expertise: 'הנדסת מכונות, SolidWorks, CATIA, תכנון מכני'
  },
  gc: {
    name: 'GC',
    color: 'gray',
    role: 'סוכן כללי',
    expertise: 'משרות כלליות שלא סווגו לתחום ספציפי'
  }
};

export default function MatchJustificationDialog({ isOpen, onClose, match, candidate, job, agentType }) {
  const [justification, setJustification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isNotSuitable, setIsNotSuitable] = useState(false);

  const agentConfig = agentConfigs[agentType] || agentConfigs.gc;

  React.useEffect(() => {
    if (isOpen && match && candidate && job) {
      generateJustification();
    }
  }, [isOpen, match, candidate, job]);

  const generateJustification = async () => {
    setLoading(true);
    setJustification(null);
    setIsNotSuitable(false);

    try {
      const response = await base44.functions.invoke('generateMatchJustification', {
        match_id: match.id,
        candidate_id: candidate.id,
        job_id: job.id,
        agent_type: agentType
      });

      setJustification(response.data.justification);
      setIsNotSuitable(response.data.isNotSuitable);
    } catch (error) {
      console.error('Error generating justification:', error);
      toast.error('שגיאה ביצירת הנימוק');
      setJustification('שגיאה ביצירת הנימוק. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setJustification(null);
    setIsNotSuitable(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 bg-${agentConfig.color}-100 rounded-full flex items-center justify-center`}>
              <Lightbulb className={`w-5 h-5 text-${agentConfig.color}-600`} />
            </div>
            נימוק התאמה מ{agentConfig.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match Info */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">מועמד:</span>
                <span className="font-semibold mr-2">{match?.candidate_name}</span>
              </div>
              <div>
                <span className="text-gray-600">משרה:</span>
                <span className="font-semibold mr-2">{match?.job_title}</span>
              </div>
              <div>
                <span className="text-gray-600">ציון התאמה מקורי:</span>
                <span className="font-semibold mr-2">{match?.match_score}%</span>
              </div>
              <div>
                <span className="text-gray-600">סוכן:</span>
                <span className="font-semibold mr-2">{agentConfig.name}</span>
              </div>
            </div>
          </div>

          {/* Justification Content */}
          <div className="min-h-[200px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className={`w-12 h-12 animate-spin text-${agentConfig.color}-600 mb-4`} />
                <p className="text-gray-600">
                  {agentConfig.name} בודק{agentConfig.name === 'נעמה' ? 'ת' : ''} את ההתאמה ומנסח{agentConfig.name === 'נעמה' ? 'ת' : ''} נימוק מפורט...
                </p>
              </div>
            ) : justification ? (
              <div>
                {isNotSuitable && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 p-3 rounded-lg mb-4 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <strong>שים לב:</strong> הסוכן זיהה שהמועמד עשוי לא להתאים למשרה
                    </div>
                  </div>
                )}
                
                <div className={`prose prose-sm max-w-none p-4 rounded-lg border-2 ${
                  isNotSuitable 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-green-50 border-green-200'
                }`}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="mr-5 mb-3 list-disc">{children}</ul>,
                      ol: ({ children }) => <ol className="mr-5 mb-3 list-decimal">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                      h3: ({ children }) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
                    }}
                  >
                    {justification}
                  </ReactMarkdown>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            סגור
          </Button>
          {!loading && justification && (
            <Button onClick={generateJustification} variant="outline">
              <Lightbulb className="w-4 h-4 ml-2" />
              בדוק שוב
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}