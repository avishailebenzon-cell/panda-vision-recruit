import React from 'react';
import { usePresentationMode } from '../context/PresentationModeContext';

export default function BlurredText({ children, type = "name", className = "" }) {
  const { isPresentationMode } = usePresentationMode();

  if (!isPresentationMode || !children) {
    return <>{children}</>;
  }

  return (
    <span 
      className={`${className} relative select-none`}
      style={{
        filter: 'blur(6px)',
        userSelect: 'none',
        pointerEvents: 'none'
      }}
      title={type === "name" ? "מטושטש במצב הדרכה" : "מטושטש במצב הדרכה"}
    >
      {children}
    </span>
  );
}