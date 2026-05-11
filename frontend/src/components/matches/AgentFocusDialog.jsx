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
import { Briefcase, Loader2, Target, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AgentFocusDialog({ isOpen, onClose, jobs, onFocusSet, isLoading, agentName, agentColor = "orange" }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Jobs are already pre-filtered by the parent component (e.g., carmitAssignedJobs)
  // No need to filter again by status
  const filteredJobs = useMemo(() => {
    if (!searchTerm) return jobs; // Show ALL jobs passed from parent
    const search = searchTerm.toLowerCase();
    return jobs.filter(j => 
      j.title?.toLowerCase().includes(search) ||
      j.client_name?.toLowerCase().includes(search) ||
      j.job_code?.toLowerCase().includes(search)
    );
  }, [jobs, searchTerm]);

  const handleConfirm = () => {
    if (selectedJob) {
      onFocusSet(selectedJob);
      setSelectedJob(null);
      setSearchTerm("");
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedJob(null);
    setSearchTerm("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className={`w-6 h-6 text-${agentColor}-600`} />
            מיקוד {agentName} במשרה
          </DialogTitle>
          <DialogDescription>
            בחר משרה ש{agentName} יתמקד בה. {agentName} יעבור על כל המועמדים הרלוונטיים וימצא את המתאימים ביותר.
          </DialogDescription>
        </DialogHeader>

        <Alert className={`bg-${agentColor}-50 border-${agentColor}-200`}>
          <AlertCircle className={`w-4 h-4 text-${agentColor}-600`} />
          <AlertDescription className={`text-sm text-${agentColor}-900`}>
            <strong>איך זה עובד:</strong>
            <ul className="list-disc mr-5 mt-1 space-y-0.5">
              <li>{agentName} יעבוד אך ורק על המשרה שתבחר</li>
              <li>יעבור על כל המועמדים הרלוונטיים (לפי טכנולוגיות, כלים, כישורים)</li>
              <li>אחרי סיום החיפוש בכל המועמדים, {agentName} יחזור לעבודה הרגילה</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex-1 overflow-hidden">
          <Command className="h-full">
            <CommandInput 
              placeholder="חפש משרה לפי שם, לקוח או קוד..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>לא נמצאו משרות פעילות</CommandEmpty>
              <CommandGroup>
                {filteredJobs.map(job => (
                  <CommandItem
                    key={job.id}
                    value={job.title}
                    onSelect={() => setSelectedJob(job)}
                    className={selectedJob?.id === job.id ? `bg-${agentColor}-100` : ""}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Briefcase className={`w-4 h-4 text-${agentColor}-600 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{job.title}</div>
                        <div className="text-xs text-gray-500 flex gap-2">
                          {job.job_code && <span>#{job.job_code}</span>}
                          {job.client_name && <span>🏢 {job.client_name}</span>}
                          {job.location && <span>📍 {job.location}</span>}
                        </div>
                      </div>
                      {selectedJob?.id === job.id && (
                        <Badge className={`bg-${agentColor}-600 text-white`}>נבחר</Badge>
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
            disabled={!selectedJob || isLoading}
            className={`bg-${agentColor}-600 hover:bg-${agentColor}-700`}
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