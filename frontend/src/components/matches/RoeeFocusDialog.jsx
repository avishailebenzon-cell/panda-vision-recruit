import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Loader2, Target, AlertCircle, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RoeeFocusDialog({ isOpen, onClose, candidates, onFocusSet, isLoading }) {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const relevantCandidates = useMemo(() => {
    return candidates.filter(c => c.status === 'מועמד' || c.status === 'עובד חברה');
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (!searchTerm) return relevantCandidates.slice(0, 30);
    const search = searchTerm.toLowerCase();
    
    // Separate candidates that start with search term vs those that contain it
    const startsWith = [];
    const contains = [];
    
    relevantCandidates.forEach(c => {
      const fullName = c.full_name?.toLowerCase() || '';
      const firstName = c.first_name?.toLowerCase() || '';
      const lastName = c.last_name?.toLowerCase() || '';
      const skills = c.skills_summary?.toLowerCase() || '';
      const experience = c.main_experience?.toLowerCase() || '';
      
      // Check if name starts with search term
      if (fullName.startsWith(search) || firstName.startsWith(search) || lastName.startsWith(search)) {
        startsWith.push(c);
      }
      // Otherwise check if it contains the search term anywhere
      else if (fullName.includes(search) || firstName.includes(search) || 
               lastName.includes(search) || skills.includes(search) || experience.includes(search)) {
        contains.push(c);
      }
    });
    
    // Return candidates that start with term first, then those that contain it
    return [...startsWith, ...contains].slice(0, 30);
  }, [relevantCandidates, searchTerm]);

  const handleConfirm = () => {
    if (selectedCandidate) {
      onFocusSet(selectedCandidate);
      setSelectedCandidate(null);
      setSearchTerm("");
    }
  };

  const handleClose = () => {
    setSelectedCandidate(null);
    setSearchTerm("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className="w-6 h-6 text-blue-600" />
            מיקוד רועי במועמד
          </DialogTitle>
          <DialogDescription>
            בחר מועמד שרועי יחפש עבורו משרות מתאימות (90%+ התאמה בלבד).
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            <strong>איך זה עובד:</strong>
            <ul className="list-disc mr-5 mt-1 space-y-0.5">
              <li>רועי יעבוד אך ורק על המועמד שתבחר</li>
              <li>יחפש משרות בהתאמה של 90% ומעלה בלבד</li>
              <li>לאחר סיום החיפוש, רועי יחזור לעבודה הרגילה שלו</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex-1 overflow-hidden">
          <Command className="h-full">
            <CommandInput 
              placeholder="חפש מועמד לפי שם, כישורים או ניסיון..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>לא נמצאו מועמדים</CommandEmpty>
              <CommandGroup>
                {filteredCandidates.map(candidate => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.full_name}
                    onSelect={() => setSelectedCandidate(candidate)}
                    className={selectedCandidate?.id === candidate.id ? "bg-blue-100" : ""}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          <span>{candidate.full_name}</span>
                          {candidate.resume_file_url && (
                            <FileText className="w-3 h-3 text-green-600" />
                          )}
                        </div>
                        {candidate.skills_summary && (
                          <div className="text-xs text-gray-500 truncate">
                            {candidate.skills_summary.substring(0, 80)}
                            {candidate.skills_summary.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      {selectedCandidate?.id === candidate.id && (
                        <Badge className="bg-blue-600 text-white">נבחר</Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            ביטול
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedCandidate || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מפעיל מיקוד...
              </>
            ) : (
              <>
                <Target className="w-4 h-4 ml-2" />
                התחל מיקוד
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}