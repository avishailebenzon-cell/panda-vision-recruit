import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  UserCheck,
  BrainCircuit,
  Search,
  LayoutList,
  Layers,
  Info,
  MessageSquare,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  X,
  HelpCircle,
  Lightbulb
} from 'lucide-react';

const TUTORIAL_STORAGE_KEY = 'matches-tutorial-completed';

const tutorialSteps = [
  {
    id: 'welcome-matches',
    title: 'ברוכים הבאים לרכזי הגיוס!',
    content: 'דף זה הוא מרכז השליטה שלך להתאמות מועמדים-משרות. כאן תוכלי לנהל את המלצות סוכני ה-AI נעמה ורועי, ולנהל תקשורת עם מועמדים דרך רותם.',
    icon: UserCheck,
    iconColor: 'text-blue-600',
    bgColor: 'from-blue-50 to-blue-100',
    highlightSelector: null,
    position: 'center',
    tip: 'לחצי "הבא" כדי להכיר את הרכזים.'
  },
  {
    id: 'agent-status-cards',
    title: 'נעמה ורועי - סוכני ההתאמה',
    content: 'נעמה (מועמדים למשרות) ורועי (משרות למועמדים) הם סוכני ה-AI שלנו שמאתרים התאמות. כאן תוכלי לראות את סטטוס הריצה שלהם ולהפעיל אותם ידנית.',
    icon: BrainCircuit,
    iconColor: 'text-purple-600',
    bgColor: 'from-purple-50 to-purple-100',
    highlightSelector: '[data-tutorial="agent-status-cards"]',
    position: 'bottom',
    tip: 'מומלץ להכיר את סטטוס הסוכנים ולעקוב אחרי הריצות שלהם.'
  },
  {
    id: 'search-filters',
    title: 'חיפוש וסינון התאמות',
    content: 'מצאו במהירות את ההתאמות הרצויות באמצעות כלי החיפוש והסינון. ניתן לסנן לפי סטטוס, ציון התאמה, משרה ועוד.',
    icon: Search,
    iconColor: 'text-green-600',
    bgColor: 'from-green-50 to-green-100',
    highlightSelector: '[data-tutorial="search-filters"]',
    position: 'bottom',
    tip: 'נסו שילובים שונים של פילטרים כדי למצוא התאמות מדויקות.'
  },
  {
    id: 'view-modes',
    title: 'תצוגה לפי משרה, מועמד או רותם',
    content: 'בחרו את מצב התצוגה הרצוי: "נעמה" (לפי משרה), "רועי" (לפי מועמד) או "רותם" (לניהול שיחות וואטסאפ).',
    icon: LayoutList,
    iconColor: 'text-orange-600',
    bgColor: 'from-orange-50 to-orange-100',
    highlightSelector: '[data-tutorial="view-modes"]',
    position: 'bottom',
    tip: 'כל מצב תצוגה מציע זווית שונה ושימושית לניהול ההתאמות.'
  },
  {
    id: 'bulk-actions',
    title: 'ניהול קבוצתי של התאמות',
    content: 'בחרו מספר התאמות וביצעו פעולות גורפות כגון שינוי סטטוס או מחיקה. לחצו על תיבת הסימון ליד כל התאמה כדי לבחור אותה.',
    icon: Layers,
    iconColor: 'text-indigo-600',
    bgColor: 'from-indigo-50 to-indigo-100',
    highlightSelector: '[data-tutorial="bulk-actions"]',
    position: 'bottom',
    tip: 'פעולות גורפות חוסכות זמן רב בניהול התאמות רבות.'
  },
  {
    id: 'match-details',
    title: 'בחינה וניהול התאמה',
    content: 'כל התאמה מציגה את פרטי המועמד/משרה, ציון ההתאמה, סטטוס ומקור. השתמשו בכפתורי הפעולה לניהול התאמה ספציפית.',
    icon: Info,
    iconColor: 'text-pink-600',
    bgColor: 'from-pink-50 to-pink-100',
    highlightSelector: '[data-tutorial="match-table"]',
    position: 'top',
    tip: 'הפעולות כוללות: צפייה בקו"ח, שיחה עם סוכן ה-AI, הערות, שליחת הודעה, סימון כלא רלוונטי ומחיקה.'
  },
  {
    id: 'rotem-whatsapp',
    title: 'רותם - תקשורת מועמדים בוואטסאפ',
    content: 'במצב "רותם" תוכלי לנהל שיחות וואטסאפ רציפות עם מועמדים ישירות מהמערכת.',
    icon: MessageSquare,
    iconColor: 'text-green-600',
    bgColor: 'from-green-50 to-green-100',
    highlightSelector: '[data-tutorial="rotem-tab"]',
    position: 'bottom',
    tip: 'רותם היא הכלי שלך לתקשורת אפקטיבית עם המועמדים.'
  },
  {
    id: 'tutorial-end',
    title: 'כל הכבוד! סיימת את המדריך!',
    content: 'כעת את שולטת בדף רכזי הגיוס. זכרי שאפשר תמיד לפתוח את המדריך מחדש דרך כפתור העזרה.',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    bgColor: 'from-green-50 to-green-100',
    highlightSelector: null,
    position: 'center',
    tip: null
  }
];

// Spotlight Overlay Component
function SpotlightOverlay({ targetRect, isVisible }) {
  if (!isVisible) return null;

  const padding = 8;
  const borderRadius = 12;

  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none z-[9998]"
      style={{ opacity: 0.75 }}
    >
      <defs>
        <mask id="spotlight-mask-matches">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {targetRect && (
            <rect
              x={targetRect.left - padding}
              y={targetRect.top - padding}
              width={targetRect.width + padding * 2}
              height={targetRect.height + padding * 2}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          )}
        </mask>
        {targetRect && (
          <filter id="glow-matches" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.85)"
        mask="url(#spotlight-mask-matches)"
      />
      {targetRect && (
        <rect
          x={targetRect.left - padding - 2}
          y={targetRect.top - padding - 2}
          width={targetRect.width + padding * 2 + 4}
          height={targetRect.height + padding * 2 + 4}
          rx={borderRadius + 2}
          ry={borderRadius + 2}
          fill="none"
          stroke="rgba(59, 130, 246, 0.6)"
          strokeWidth="3"
          filter="url(#glow-matches)"
        />
      )}
    </svg>
  );
}

// Tutorial Card Component
function TutorialCard({ step, currentStep, totalSteps, onNext, onPrev, onSkip, position, targetRect }) {
  const Icon = step.icon;

  const getCardPosition = () => {
    if (!targetRect || position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const cardWidth = 400;
    const cardHeight = 280;
    const gap = 20;

    let top, left, transform = '';

    switch (position) {
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2;
        transform = 'translateX(-50%)';
        if (top + cardHeight > window.innerHeight - 20) {
          top = targetRect.top - cardHeight - gap;
        }
        break;
      case 'top':
        top = targetRect.top - cardHeight - gap;
        left = targetRect.left + targetRect.width / 2;
        transform = 'translateX(-50%)';
        if (top < 20) {
          top = targetRect.bottom + gap;
        }
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - cardWidth - gap;
        transform = 'translateY(-50%)';
        if (left < 20) {
          left = targetRect.right + gap;
        }
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + gap;
        transform = 'translateY(-50%)';
        if (left + cardWidth > window.innerWidth - 20) {
          left = targetRect.left - cardWidth - gap;
        }
        break;
      default:
        top = '50%';
        left = '50%';
        transform = 'translate(-50%, -50%)';
    }

    if (typeof left === 'number') {
      left = Math.max(20, Math.min(left, window.innerWidth - cardWidth - 20));
    }
    if (typeof top === 'number') {
      top = Math.max(20, Math.min(top, window.innerHeight - cardHeight - 20));
    }

    return {
      top: typeof top === 'number' ? `${top}px` : top,
      left: typeof left === 'number' ? `${left}px` : left,
      transform
    };
  };

  const cardStyle = getCardPosition();

  return (
    <motion.div
      layoutId="tutorial-card-matches"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        type: 'spring',
        damping: 25,
        stiffness: 300
      }}
      className="fixed z-[9999] w-[90vw] max-w-[400px] bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={cardStyle}
    >
      {/* Header */}
      <div className={`bg-gradient-to-l ${step.bgColor} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center ${step.iconColor}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">{step.title}</h3>
              <p className="text-sm text-gray-600">שלב {currentStep + 1} מתוך {totalSteps}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSkip}
            className="text-gray-500 hover:text-gray-700 hover:bg-white/50"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pt-3">
        <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-2" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-gray-700 leading-relaxed">{step.content}</p>

        {step.tip && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{step.tip}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onPrev}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronRight className="w-4 h-4" />
          הקודם
        </Button>

        {/* Step Indicators */}
        <div className="flex gap-1.5">
          {tutorialSteps.map((_, index) => (
            <motion.div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStep
                  ? 'bg-blue-600'
                  : index < currentStep
                  ? 'bg-blue-300'
                  : 'bg-gray-300'
              }`}
              animate={{
                scale: index === currentStep ? 1.2 : 1
              }}
            />
          ))}
        </div>

        <Button
          onClick={onNext}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          {currentStep === totalSteps - 1 ? 'סיום' : 'הבא'}
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// Main Tutorial Component
export default function MatchesTutorial({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const step = tutorialSteps[currentStep];

  const updateTargetRect = useCallback(() => {
    if (step.highlightSelector) {
      const element = document.querySelector(step.highlightSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        });
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
      window.addEventListener('resize', updateTargetRect);
      window.addEventListener('scroll', updateTargetRect);
      
      return () => {
        window.removeEventListener('resize', updateTargetRect);
        window.removeEventListener('scroll', updateTargetRect);
      };
    }
  }, [isOpen, currentStep, updateTargetRect]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setCurrentStep(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9997]">
      <SpotlightOverlay targetRect={targetRect} isVisible={true} />
      <AnimatePresence mode="wait">
        <TutorialCard
          key={step.id}
          step={step}
          currentStep={currentStep}
          totalSteps={tutorialSteps.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          position={step.position}
          targetRect={targetRect}
        />
      </AnimatePresence>
    </div>
  );
}

// Hook to use the tutorial
export function useMatchesTutorial() {
  const [isOpen, setIsOpen] = useState(false);

  const startTutorial = () => setIsOpen(true);
  const closeTutorial = () => setIsOpen(false);

  const hasCompletedTutorial = () => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  };

  const resetTutorial = () => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  };

  return {
    isOpen,
    startTutorial,
    closeTutorial,
    hasCompletedTutorial,
    resetTutorial
  };
}

// Help Button Component for reopening tutorial
export function MatchesTutorialHelpButton({ onClick }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
    >
      <HelpCircle className="w-4 h-4" />
      מדריך הדף
    </Button>
  );
}