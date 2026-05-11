import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation } from 'react-router-dom';

const PresentationModeContext = createContext({
  isPresentationMode: false,
  loading: true,
  refreshMode: () => {}
});

export const usePresentationMode = () => useContext(PresentationModeContext);

export const PresentationModeProvider = ({ children }) => {
  const [isPresentationMode, setIsPresentationMode] = useState(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem('presentation_mode');
    return stored === 'true';
  });
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const loadPresentationMode = async () => {
    try {
      const configs = await base44.entities.AgentConfig.filter({ 
        config_key: 'presentation_mode' 
      });

      if (configs && configs.length > 0) {
        const enabled = configs[0].config_value?.enabled || false;
        setIsPresentationMode(enabled);
        localStorage.setItem('presentation_mode', enabled.toString());
      } else {
        setIsPresentationMode(false);
        localStorage.setItem('presentation_mode', 'false');
      }
    } catch (error) {
      console.error("Error loading presentation mode:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPresentationMode();
  }, []);

  // Reload on navigation to catch any changes
  useEffect(() => {
    loadPresentationMode();
  }, [location.pathname]);

  const refreshMode = () => {
    loadPresentationMode();
  };

  return (
    <PresentationModeContext.Provider value={{ isPresentationMode, loading, refreshMode }}>
      {children}
    </PresentationModeContext.Provider>
  );
};