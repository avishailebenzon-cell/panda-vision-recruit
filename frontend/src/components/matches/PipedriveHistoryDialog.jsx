import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, X, Loader2, Database, AlertCircle } from 'lucide-react';
import { fetchPipedriveNotesForCandidate } from "@/functions/fetchPipedriveNotesForCandidate";
import { toast } from "sonner";

export default function PipedriveHistoryDialog({ 
  candidate, 
  isOpen, 
  onClose, 
  onHistoryUpdated 
}) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(candidate?.pipedrive_history || '');
  const [fontSize, setFontSize] = useState(14);

  const handleLoadHistory = async () => {
    if (!candidate?.id) return;
    
    setLoading(true);
    try {
      const response = await fetchPipedriveNotesForCandidate({ candidate_id: candidate.id });
      if (response.data?.success) {
        setHistory(response.data.history);
        toast.success(response.data.message);
        if (onHistoryUpdated) {
          onHistoryUpdated();
        }
      } else {
        toast.error(response.data?.message || 'שגיאה בטעינת היסטוריה מ-Pipedrive');
      }
    } catch (error) {
      toast.error('שגיאה בטעינת היסטוריה מ-Pipedrive');
    }
    setLoading(false);
  };

  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 2, 24));
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 2, 10));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            הסטוריית {candidate?.full_name || candidate?.candidate_name} מ-Pipedrive
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50" style={{ fontSize: `${fontSize}px` }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
              <p className="text-gray-600">טוען היסטוריה מ-Pipedrive...</p>
            </div>
          ) : history ? (
            <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">{history}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <AlertCircle className="w-16 h-16 text-gray-400" />
              <p className="text-gray-600">אין היסטוריה שמורה עדיין</p>
              <Button onClick={handleLoadHistory} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                <Database className="w-4 h-4 ml-2" />
                טען היסטוריה מ-Pipedrive
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={fontSize <= 10}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={fontSize >= 24}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-500 self-center">{fontSize}px</span>
          </div>
          <div className="flex gap-2">
            {history && (
              <Button onClick={handleLoadHistory} disabled={loading} variant="outline">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <Database className="w-4 h-4 ml-2" />
                )}
                רענן מ-Pipedrive
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 ml-2" />
              סגור
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}