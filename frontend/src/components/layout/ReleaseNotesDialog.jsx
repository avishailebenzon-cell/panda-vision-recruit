import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, History, ChevronDown, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

export default function ReleaseNotesDialog({ isOpen, onClose, version, releaseNotes }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyVersions, setHistoryVersions] = useState([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const PAGE_SIZE = 5;

  const loadHistory = async (offset = 0) => {
    setLoadingHistory(true);
    try {
      const all = await base44.entities.SystemVersion.list('-last_updated', PAGE_SIZE + 1, offset);
      const items = all.slice(0, PAGE_SIZE);
      if (offset === 0) {
        setHistoryVersions(items);
      } else {
        setHistoryVersions(prev => [...prev, ...items]);
      }
      setHasMore(all.length > PAGE_SIZE);
      setHistoryOffset(offset + PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleShowHistory = () => {
    setShowHistory(true);
    loadHistory(0);
  };

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  // Format plain text: add paragraph breaks after sentences ending with a period
  const formatNotes = (notes) => {
    if (!notes) return 'אין הערות שחרור זמינות.';
    // If already has markdown formatting, return as-is
    if (notes.includes('\n\n') || notes.includes('##') || notes.includes('**')) return notes;
    // Add double newline after period followed by space/end
    return notes.replace(/\.\s+/g, '.\n\n').replace(/\.\s*$/g, '.\n\n');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-purple-600" />
            🎉 חידושים בגרסה {version}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="prose prose-sm max-w-none text-right" dir="rtl">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mb-3">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-800 mb-2 mt-4">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium text-gray-700 mb-2 mt-3">{children}</h3>,
                p: ({ children }) => <p className="text-gray-700 mb-2 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc mr-6 space-y-1 mb-3">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal mr-6 space-y-1 mb-3">{children}</ol>,
                li: ({ children }) => <li className="text-gray-700">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                code: ({ children }) => <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-purple-700">{children}</code>,
                blockquote: ({ children }) => (
                  <blockquote className="border-r-4 border-purple-400 pr-4 py-2 bg-purple-50 rounded-r-lg mb-3">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {formatNotes(releaseNotes)}
            </ReactMarkdown>
          </div>
        </div>

        {showHistory && (
          <div className="border-t pt-4 mt-2 space-y-3">
            <h3 className="font-semibold text-gray-700 text-sm">היסטוריית שינויים</h3>
            {historyVersions.map((v) => (
              <div key={v.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-purple-700 text-sm">v{v.version}</span>
                  <span className="text-xs text-gray-400">
                    {v.last_updated ? new Date(v.last_updated).toLocaleDateString('he-IL') : new Date(v.created_date).toLocaleDateString('he-IL')}
                  </span>
                </div>
                {v.release_notes && (
                  <div className="prose prose-sm max-w-none text-right" dir="rtl">
                    <ReactMarkdown
                      components={{
                        h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-800 mb-1 mt-2">{children}</h2>,
                        p: ({ children }) => <p className="text-gray-600 text-sm mb-1">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc mr-5 space-y-0.5 mb-2 text-sm">{children}</ul>,
                        li: ({ children }) => <li className="text-gray-600 text-sm">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
                      }}
                    >{formatNotes(v.release_notes)}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {hasMore && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => loadHistory(historyOffset)} disabled={loadingHistory}>
                {loadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                טען 5 גרסאות נוספות
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="dont-show" 
              checked={dontShowAgain} 
              onCheckedChange={setDontShowAgain}
            />
            <Label htmlFor="dont-show" className="cursor-pointer text-sm">
              קראתי ואל תציג שוב
            </Label>
          </div>
          <div className="flex gap-2">
            {!showHistory && (
              <Button variant="outline" onClick={handleShowHistory} className="gap-2 text-sm">
                <History className="w-4 h-4" />
                כל היסטוריית הגרסאות
              </Button>
            )}
            <Button onClick={handleClose} className="bg-purple-600 hover:bg-purple-700">
              סגור
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}