import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  LayoutDashboard,
  Layers,
  BrainCircuit,
  RefreshCw,
  ScrollText,
  Mail,
  Save,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  X,
  HelpCircle,
  Lightbulb
} from 'lucide-react';

const TUTORIAL_STORAGE_KEY = 'management-tutorial-completed';

const tutorialSteps = [
  {
    id: 'welcome-system-management',
    title: 'ברוכים הבאים לניהול המערכת',
    content: 'זהו מרכז השליטה שלך! כאן תוכלי להגדיר ולנטר את כלל פעולות המערכת, תזמונים, סנכרונים, סוכני AI ועוד.',
    icon: LayoutDashboard,
    iconColor: 'text-blue-600',
    bgColor: 'from-blue-50 to-blue-100',
    highlightSelector: null,
    position: 'center',
    tip: 'לחצי על "הבא" כדי להתחיל את הסיור'
  },
  {
    id: 'management-navigation',
    title: 'ניווט בין לשוניות הניהול',
    content: 'הכירי את הלשוניות השונות, שכל אחת מהן מיועדת לניהול היבטים ספציפיים במערכת (כמו משתמשים, סוכנים, סנכרונים). בחרי את הלשונית הרצויה לגישה מהירה.',
    icon: Layers,
    iconColor: 'text-purple-600',
    bgColor: 'from-purple-50 to-purple-100',
    highlightSelector: '[data-tutorial="management-tabs"]',
    position: 'bottom',
    tip: 'הלשוניות מאורגנות לפי קטגוריות: סוכנים, ממשקים חיצוניים, קונפיגורציה ולוגים'
  },
  {
    id: 'ai-agent-settings',
    title: 'הפעלת ותזמון סוכני AI',
    content: 'כאן תוכלי להפעיל, להשבית ולתזמן את סוכני ה-AI שלנו – נעמה ורועי – שאחראים על התאמת מועמדים למשרות. הקפידי לבדוק את סטטוס הריצה שלהם.',
    icon: BrainCircuit,
    iconColor: 'text-pink-600',
    bgColor: 'from-pink-50 to-pink-100',
    highlightSelector: '[data-tutorial="agent-settings"]',
    position: 'bottom',
    tip: 'הסוכנים רצים אוטומטית לפי התזמון שהגדרת'
  },
  {
    id: 'pipedrive-sync-management',
    title: 'הגדרת סנכרון Pipedrive',
    content: 'קבעי תזמונים לסנכרון אוטומטי של אנשי קשר ומשרות עם Pipedrive, או הפעילי סנכרון ידני בלחיצת כפתור לפי הצורך.',
    icon: RefreshCw,
    iconColor: 'text-green-600',
    bgColor: 'from-green-50 to-green-100',
    highlightSelector: '[data-tutorial="pipedrive-sync"]',
    position: 'bottom',
    tip: 'סנכרון ידני שימושי כשאת רוצה לעדכן מיד את הנתונים'
  },
  {
    id: 'system-activity-log',
    title: 'מעקב אחר פעילות המערכת',
    content: 'עקבי אחר כל הפעולות שמתרחשות במערכת – סנכרונים, הפעלת סוכנים, העלאות קבצים ועוד. זהו יומן המערכת המלא.',
    icon: ScrollText,
    iconColor: 'text-orange-600',
    bgColor: 'from-orange-50 to-orange-100',
    highlightSelector: '[data-tutorial="activity-log"]',
    position: 'bottom',
    tip: 'הלוג מתעדכן בזמן אמת ומאפשר לזהות בעיות במהירות'
  },
  {
    id: 'email-service-settings',
    title: 'הגדרת שירותי המייל',
    content: 'כאן תוכלי לקבוע את הגדרות שירות המייל של המערכת, כולל שמות שולח ברירת מחדל וכתובות מייל, ולבצע בדיקת שליחה.',
    icon: Mail,
    iconColor: 'text-indigo-600',
    bgColor: 'from-indigo-50 to-indigo-100',
    highlightSelector: '[data-tutorial="email-service"]',
    position: 'bottom',
    tip: 'מומלץ לבדוק את שליחת המייל לפני שימוש בפרודקשן'
  },
  {
    id: 'save-changes',
    title: 'זכרי לשמור שינויים',
    content: 'לאחר כל שינוי שאת מבצעת בהגדרות, חשוב ללחוץ על כפתור השמירה כדי לוודא שהם נכנסים לתוקף.',
    icon: Save,
    iconColor: 'text-red-600',
    bgColor: 'from-red-50 to-red-100',
    highlightSelector: '[data-tutorial="save-button"]',
    position: 'top',
    tip: 'שינויים שלא נשמרו יאבדו בעת עזיבת הדף'
  },
  {
    id: 'tutorial-end',
    title: 'כל הכבוד! סיימת את המדריך!',
    content: 'כעת את שולטת בכלי ניהול המערכת. זכרי שאפשר תמיד לפתוח את המדריך מחדש דרך כפתור העזרה.',
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
        <mask id="spotlight-mask">
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
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
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
        mask="url(#spotlight-mask)"
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
          filter="url(#glow)"
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
        // Check if card goes off screen
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

    // Ensure card stays within viewport
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
      layoutId="tutorial-card"
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
export default function ManagementTutorial({ isOpen, onClose }) {
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
        // Scroll element into view if needed
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
export function useManagementTutorial() {
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
    resetTutorial,
    TutorialComponent: () => <ManagementTutorial isOpen={isOpen} onClose={closeTutorial} />
  };
}

// Help Button Component for reopening tutorial
export function TutorialHelpButton({ onClick }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
    >
      <HelpCircle className="w-4 h-4" />
      מדריך המערכת
    </Button>
  );
}