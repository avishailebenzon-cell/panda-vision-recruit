import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function MatchesLoadingToast({ isLoading, agentName = 'הסוכן' }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isLoading]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-8 left-8 z-50 animate-in fade-in">
      <div className="bg-black/50 backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-sm">
        <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium">ההתאמות של {agentName} בטעינה</p>
          <p className="text-white/70 text-xs mt-0.5">נא המתן...</p>
        </div>
      </div>
    </div>
  );
}