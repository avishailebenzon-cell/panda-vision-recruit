import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function MobileTabs({ value, onValueChange, children, className }) {
  const showButtons = !value || value === '';
  
  return (
    <div className={cn("space-y-4", className)}>
      {React.Children.map(children, child => {
        if (child?.type === MobileTabsButtons) {
          return showButtons ? React.cloneElement(child, { value, onValueChange }) : null;
        }
        if (child?.type === MobileTabsContent) {
          return React.cloneElement(child, { 
            parentValue: value, 
            onBack: () => onValueChange('')
          });
        }
        return child;
      })}
    </div>
  );
}

export function MobileTabsButtons({ value, onValueChange, children }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {React.Children.map(children, child => {
        if (child?.type === MobileTabButton) {
          return React.cloneElement(child, { 
            isActive: value === child.props.value,
            onClick: () => onValueChange?.(child.props.value)
          });
        }
        return child;
      })}
    </div>
  );
}

export function MobileTabButton({ value, isActive, onClick, icon: Icon, label, badge, color = "blue", children }) {
  const colors = {
    blue: {
      base: "bg-blue-50 border-blue-200 text-blue-700",
      active: "bg-blue-600 text-white border-blue-600 shadow-lg",
      hover: "hover:bg-blue-100"
    },
    purple: {
      base: "bg-purple-50 border-purple-200 text-purple-700",
      active: "bg-purple-600 text-white border-purple-600 shadow-lg",
      hover: "hover:bg-purple-100"
    },
    green: {
      base: "bg-green-50 border-green-200 text-green-700",
      active: "bg-green-600 text-white border-green-600 shadow-lg",
      hover: "hover:bg-green-100"
    },
    orange: {
      base: "bg-orange-50 border-orange-200 text-orange-700",
      active: "bg-orange-600 text-white border-orange-600 shadow-lg",
      hover: "hover:bg-orange-100"
    },
    pink: {
      base: "bg-pink-50 border-pink-200 text-pink-700",
      active: "bg-pink-600 text-white border-pink-600 shadow-lg",
      hover: "hover:bg-pink-100"
    },
    indigo: {
      base: "bg-indigo-50 border-indigo-200 text-indigo-700",
      active: "bg-indigo-600 text-white border-indigo-600 shadow-lg",
      hover: "hover:bg-indigo-100"
    },
    teal: {
      base: "bg-teal-50 border-teal-200 text-teal-700",
      active: "bg-teal-600 text-white border-teal-600 shadow-lg",
      hover: "hover:bg-teal-100"
    },
    gray: {
      base: "bg-gray-50 border-gray-200 text-gray-700",
      active: "bg-gray-700 text-white border-gray-700 shadow-lg",
      hover: "hover:bg-gray-100"
    }
  };

  const colorScheme = colors[color] || colors.blue;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full aspect-square rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-2 text-center",
        isActive 
          ? colorScheme.active
          : `${colorScheme.base} ${colorScheme.hover}`
      )}
    >
      {Icon && <Icon className="w-8 h-8 flex-shrink-0" />}
      <span className="font-semibold text-sm leading-tight line-clamp-2">{label || children}</span>
      {badge && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-full text-xs font-bold",
          isActive ? "bg-white/20" : "bg-white"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function MobileTabsContent({ parentValue, tabValue, children, onBack }) {
  if (parentValue !== tabValue) return null;
  
  return (
    <div className="space-y-4">
      {onBack && (
        <Button
          variant="outline"
          onClick={onBack}
          className="w-full gap-2 border-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          חזור לתפריט
        </Button>
      )}
      {children}
    </div>
  );
}

// Section component for nested tabs (like in Management page)
export function MobileSection({ title, icon: Icon, children, color = "purple" }) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const colors = {
    purple: "bg-purple-50 border-purple-200 text-purple-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800"
  };

  return (
    <div className={cn("rounded-lg border-2", colors[color] || colors.purple)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-right"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5" />}
          <span className="font-bold text-base">{title}</span>
        </div>
        <div className={cn("transition-transform", isOpen && "rotate-180")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}