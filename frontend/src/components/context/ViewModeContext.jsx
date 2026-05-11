import React, { createContext, useContext, useState, useEffect } from 'react';

const ViewModeContext = createContext();

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
};

export function ViewModeProvider({ children }) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [forcedMode, setForcedMode] = useState(() => {
    // Check localStorage for forced mode on initial load
    const saved = localStorage.getItem('forcedViewMode');
    if (saved === 'mobile' || saved === 'desktop') {
      return saved;
    }
    return null;
  });

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobileDevice(isMobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save forced mode to localStorage when it changes
  useEffect(() => {
    if (forcedMode) {
      localStorage.setItem('forcedViewMode', forcedMode);
    } else {
      localStorage.removeItem('forcedViewMode');
    }
  }, [forcedMode]);

  // Actual view mode based on device or forced mode
  const viewMode = forcedMode || (isMobileDevice ? 'mobile' : 'desktop');

  const toggleViewMode = () => {
    if (forcedMode === null) {
      // First toggle - force opposite of auto-detected
      const newMode = isMobileDevice ? 'desktop' : 'mobile';
      setForcedMode(newMode);
      localStorage.setItem('forcedViewMode', newMode);
    } else if (forcedMode === 'mobile') {
      setForcedMode('desktop');
    } else {
      setForcedMode('mobile');
    }
  };

  const resetViewMode = () => {
    setForcedMode(null);
  };

  return (
    <ViewModeContext.Provider value={{ 
      viewMode, 
      isMobileDevice, 
      forcedMode,
      toggleViewMode,
      resetViewMode,
      isMobileView: viewMode === 'mobile'
    }}>
      {children}
    </ViewModeContext.Provider>
  );
}