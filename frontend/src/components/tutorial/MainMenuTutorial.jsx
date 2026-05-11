import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Home, 
  Search, 
  Briefcase,
  Star,
  CheckCircle,
  Sparkles
} from 'lucide-react';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'ברוכים הבאים למערכת!',
    content: 'זוהי מערכת ניהול הגיוס החכמה של פנדה-טק. בואו נעבור יחד על התכונות העיקריות.',
    icon: Home,
    iconColor: 'text-blue-600',
    bgColor: 'from-blue-50 to-blue-100',
    highlightSelector: null,
    position: 'center',
    tip: '💡 המדריך יארך כ-2 דקות',
    details: [
      'ניווט קל ומהיר בין מסכים',
      'חיפוש מתקדם של מועמדים',
      'ניהול משרות והתאמות',
      'סטטיסטיקות בזמן אמת'
    ]
  },
  {
    id: 'quick-search',
    title: 'חיפוש מהיר',
    content: 'כאן תוכלו לחפש מועמדים על פי שם, כישורים, סיווג, או כל מידע רלוונטי אחר.',
    icon: Search,
    iconColor: 'text-purple-600',
    bgColor: 'from-purple-50 to-purple-100',
    highlightSelector: '[data-tutorial="quick-search"]',
    position: 'bottom',
    tip: '🔍 החיפוש מתבצע בזמן אמת',
    details: [
      'חפשו לפי שם מלא או חלקי',
      'הקלידו סיווג בטחוני',
      'חפשו לפי עיר או אזור',
      'תוצאות מיידיות תוך שניות'
    ]
  },
  {
    id: 'nav-buttons',
    title: 'כפתורי ניווט מרכזיים',
    content: 'אלו הכפתורים המרכזיים למסכי המערכת - משרות, מועמדים, התאמות ולקוחות.',
    icon: Briefcase,
    iconColor: 'text-blue-600',
    bgColor: 'from-blue-50 to-blue-100',
    highlightSelector: '[data-tutorial="main-navigation"]',
    position: 'bottom',
    tip: '🚀 כל מסך מותאם לתפקיד שלכם',
    details: [
      '📋 נעמה ודנה - ניהול משרות',
      '👥 יעל - ניהול מועמדים',
      '⭐ נעמה ורועי - התאמות',
      '🏢 אלעד - ניהול לקוחות'
    ]
  },
  {
    id: 'activity-feed',
    title: 'פיד פעילות',
    content: 'עדכונים בזמן אמת על כל מה שקורה במערכת - מועמדים חדשים, התאמות, ועוד.',
    icon: Sparkles,
    iconColor: 'text-green-600',
    bgColor: 'from-green-50 to-green-100',
    highlightSelector: '[data-tutorial="activity-section"]',
    position: 'right',
    tip: '⚡ עדכונים אוטומטיים כל כמה שניות',
    details: [
      'סוכני AI עובדים ברקע',
      'התראות על מועמדים חדשים',
      'עדכוני משרות ולקוחות',
      'התאמות אוטומטיות'
    ]
  },
  {
    id: 'stats',
    title: 'סטטיסטיקות מהירות',
    content: 'תצוגת מבט מהיר על מצב המערכת - משרות פעילות, מועמדים, התאמות ולקוחות.',
    icon: Star,
    iconColor: 'text-orange-600',
    bgColor: 'from-orange-50 to-orange-100',
    highlightSelector: '[data-tutorial="quick-stats"]',
    position: 'top',
    tip: '📊 הנתונים מתעדכנים בזמן אמת',
    details: [
      'משרות פעילות בזמן נתון',
      'סה"כ מועמדים במערכת',
      'התאמות שנוצרו',
      'לקוחות פעילים'
    ]
  },
  {
    id: 'complete',
    title: 'מוכנים להתחיל!',
    content: 'סיימתם את המדריך בהצלחה. עכשיו אתם מוכנים להשתמש במערכת בצורה מיטבית.',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    bgColor: 'from-green-50 to-green-100',
    highlightSelector: null,
    position: 'center',
    tip: '✨ ניתן לפתוח את המדריך שוב בכל עת',
    details: [
      'השתמשו בכפתור העזרה (F1)',
      'כל סוכן AI זמין לעזרה',
      'צוות התמיכה כאן בשבילכם',
      'בהצלחה! 🎉'
    ]
  }
];

function SpotlightMask({ targetRect, glow = true }) {
  if (!targetRect) return null;

  const padding = 8;
  const x = targetRect.x - padding;
  const y = targetRect.y - padding;
  const width = targetRect.width + padding * 2;
  const height = targetRect.height + padding * 2;
  const borderRadius = 12;

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998 }}
    >
      <defs>
        {glow && (
          <filter id="spotlight-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={borderRadius}
            fill="black"
          />
        </mask>
      </defs>
      
      {/* Dark overlay with cutout */}
      <rect
        width="100%"
        height="100%"
        fill="black"
        opacity="0.75"
        mask="url(#spotlight-mask)"
      />
      
      {/* Glowing border */}
      {glow && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={borderRadius}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          filter="url(#spotlight-glow)"
          className="animate-pulse"
        />
      )}
    </svg>
  );
}

function TutorialCard({ step, currentIndex, totalSteps, onNext, onPrev, onSkip, onComplete, position, targetRect }) {
  const [cardPosition, setCardPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  useEffect(() => {
    if (!targetRect || position === 'center') {
      setCardPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const cardWidth = 420;
    const cardHeight = 450;
    const gap = 20;
    const padding = 20;

    let newPosition = {};

    switch (position) {
      case 'bottom':
        // Check if card would overflow bottom
        let topPos = targetRect.bottom + gap;
        if (topPos + cardHeight > viewportHeight - padding) {
          // Try placing it above instead
          topPos = Math.max(targetRect.top - cardHeight - gap, padding);
        }
        newPosition = {
          top: `${topPos}px`,
          left: `${Math.min(Math.max(targetRect.left + targetRect.width / 2, cardWidth / 2 + padding), viewportWidth - cardWidth / 2 - padding)}px`,
          transform: 'translateX(-50%)'
        };
        break;
      case 'top':
        let topPosTop = targetRect.top - cardHeight - gap;
        // If would overflow top, place below instead
        if (topPosTop < padding) {
          topPosTop = Math.min(targetRect.bottom + gap, viewportHeight - cardHeight - padding);
        }
        newPosition = {
          top: `${Math.max(topPosTop, padding)}px`,
          left: `${Math.min(Math.max(targetRect.left + targetRect.width / 2, cardWidth / 2 + padding), viewportWidth - cardWidth / 2 - padding)}px`,
          transform: 'translateX(-50%)'
        };
        break;
      case 'right':
        // Check if card would overflow right
        let leftPos = targetRect.right + gap;
        if (leftPos + cardWidth > viewportWidth - padding) {
          // Place on left instead
          leftPos = Math.max(targetRect.left - cardWidth - gap, padding);
        }
        newPosition = {
          top: `${Math.min(Math.max(targetRect.top + targetRect.height / 2, cardHeight / 2 + padding), viewportHeight - cardHeight / 2 - padding)}px`,
          left: `${leftPos}px`,
          transform: 'translateY(-50%)'
        };
        break;
      case 'left':
        let leftPosLeft = targetRect.left - cardWidth - gap;
        // If would overflow left, place on right instead
        if (leftPosLeft < padding) {
          leftPosLeft = Math.min(targetRect.right + gap, viewportWidth - cardWidth - padding);
        }
        newPosition = {
          top: `${Math.min(Math.max(targetRect.top + targetRect.height / 2, cardHeight / 2 + padding), viewportHeight - cardHeight / 2 - padding)}px`,
          left: `${Math.max(leftPosLeft, padding)}px`,
          transform: 'translateY(-50%)'
        };
        break;
      default:
        newPosition = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    setCardPosition(newPosition);
  }, [targetRect, position]);

  const Icon = step.icon;
  const progress = ((currentIndex + 1) / totalSteps) * 100;

  return (
    <motion.div
      layoutId="tutorial-card"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, ...cardPosition }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed z-[9999] w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={{ ...cardPosition }}
    >
      {/* Header with gradient */}
      <div className={`bg-gradient-to-br ${step.bgColor} p-6 pb-4`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 ${step.bgColor} rounded-xl shadow-sm`}>
            <Icon className={`w-8 h-8 ${step.iconColor}`} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSkip}
            className="text-gray-600 hover:text-gray-900 -mt-2 -mr-2"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{step.title}</h3>
        
        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-gray-600">
              שלב {currentIndex + 1} מתוך {totalSteps}
            </span>
            <span className="text-xs font-medium text-gray-600">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-gray-700 text-base leading-relaxed mb-4">
          {step.content}
        </p>

        {step.tip && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">{step.tip}</p>
          </div>
        )}

        {step.details && step.details.length > 0 && (
          <ul className="space-y-2 mb-6">
            {step.details.map((detail, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="text-blue-500 mt-0.5">•</span>
                {detail}
              </motion.li>
            ))}
          </ul>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentIndex > 0 && (
            <Button
              variant="outline"
              onClick={onPrev}
              className="flex-1"
            >
              <ChevronRight className="w-4 h-4 ml-2" />
              הקודם
            </Button>
          )}
          
          {currentIndex < totalSteps - 1 ? (
            <Button
              onClick={onNext}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              הבא
              <ChevronLeft className="w-4 h-4 mr-2" />
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 ml-2" />
              סיום
            </Button>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <motion.div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? 'w-8 bg-blue-600'
                  : idx < currentIndex
                  ? 'w-2 bg-green-500'
                  : 'w-2 bg-gray-300'
              }`}
              layoutId={`indicator-${idx}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function MainMenuTutorial({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const step = TUTORIAL_STEPS[currentStep];

  useEffect(() => {
    if (!isOpen) return;

    const updateTargetRect = () => {
      if (step.highlightSelector) {
        const element = document.querySelector(step.highlightSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect);

    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect);
    };
  }, [isOpen, step]);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('mainmenu_tutorial_completed', 'true');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('mainmenu_tutorial_completed', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Spotlight mask */}
      {targetRect && <SpotlightMask targetRect={targetRect} />}
      
      {/* Tutorial card */}
      <AnimatePresence mode="wait">
        <TutorialCard
          key={step.id}
          step={step}
          currentIndex={currentStep}
          totalSteps={TUTORIAL_STEPS.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          onComplete={handleComplete}
          position={step.position}
          targetRect={targetRect}
        />
      </AnimatePresence>
    </>
  );
}

// Custom hook for easy usage
export function useMainMenuTutorial() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('mainmenu_tutorial_completed');
    if (!completed) {
      // Auto-open on first visit after a short delay
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const reset = () => {
    localStorage.removeItem('mainmenu_tutorial_completed');
    setIsOpen(true);
  };

  return { isOpen, open, close, reset };
}