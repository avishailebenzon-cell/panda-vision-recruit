import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  FileText,
  BrainCircuit,
  Share2,
  Calculator,
  Edit,
  MessageCircle,
  Trash2,
  Briefcase,
  Send,
  Smartphone,
  Eye,
  Clock,
  ClipboardList,
  PlusSquare,
} from "lucide-react";
import CandidateTimelineDialog from "./CandidateTimelineDialog";
import CreateTaskDialog from "../tasks/CreateTaskDialog";
import CandidateTasksDialog from "../tasks/CandidateTasksDialog";

/**
 * Dropdown actions menu for a candidate row in the Database tab.
 */
export function CandidateActionsDropdown({
  candidate,
  matchCount = 0,
  user,
  onShowJobs,
  onOpenResume,
  onOpenInterview,
  onOpenClientCv,
  onOpenSendCv,
  onOpenOfferSystem,
  onEdit,
  onCommunicationHistory,
  onDelete,
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onShowJobs(candidate)}>
            <Briefcase className={`w-4 h-4 ml-2 ${matchCount > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
            משרות שהותאם {matchCount > 0 ? `(${matchCount})` : ''}
          </DropdownMenuItem>
          {candidate.resume_file_url && (
            <DropdownMenuItem onClick={() => onOpenResume(candidate.resume_file_url)}>
              <FileText className="w-4 h-4 ml-2 text-green-600" />
              צפה בקו״ח
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onOpenInterview(candidate)}>
            <BrainCircuit className="w-4 h-4 ml-2 text-purple-600" />
            שאלות לראיון
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenClientCv(candidate)}>
            <FileText className="w-4 h-4 ml-2 text-orange-600" />
            הכן קו״ח ללקוח
          </DropdownMenuItem>
          {(user?.can_send_candidate_email_to_client || user?.can_send_candidate_whatsapp_to_client) && (
            <DropdownMenuItem onClick={() => onOpenSendCv(candidate)}>
              <Share2 className="w-4 h-4 ml-2 text-blue-600" />
              שלח קו״ח ללקוח
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onOpenOfferSystem}>
            <Calculator className="w-4 h-4 ml-2 text-amber-600" />
            מחשבון הצעת שכר
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateTaskOpen(true)}>
            <PlusSquare className="w-4 h-4 ml-2 text-blue-600" />
            יצירת משימה
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTasksOpen(true)}>
            <ClipboardList className="w-4 h-4 ml-2 text-blue-500" />
            משימות
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTimelineOpen(true)}>
            <Clock className="w-4 h-4 ml-2 text-blue-500" />
            ציר זמן
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(candidate)}>
            <Edit className="w-4 h-4 ml-2" />
            עריכה
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCommunicationHistory(candidate)}>
            <MessageCircle className="w-4 h-4 ml-2 text-purple-600" />
            היסטוריית תקשורת
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(candidate.id)} className="text-red-600 focus:text-red-600">
            <Trash2 className="w-4 h-4 ml-2" />
            מחיקה
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CandidateTimelineDialog
       candidate={candidate}
       open={timelineOpen}
       onClose={() => setTimelineOpen(false)}
      />
      <CreateTaskDialog
       open={createTaskOpen}
       onClose={() => setCreateTaskOpen(false)}
       candidate={candidate}
       agentName="יעל"
      />
      <CandidateTasksDialog
       open={tasksOpen}
       onClose={() => setTasksOpen(false)}
       candidate={candidate}
      />
      </>
      );
      }

      /**
      * Dropdown actions menu for a candidate row in the Inbox tab.
      */
export function InboxCandidateActionsDropdown({
  candidate,
  user,
  onOpenResume,
  onOpenInterview,
  onOpenClientCv,
  onOpenOfferSystem,
  onSendToClients,
  onSendWhatsapp,
  onMarkAsRead,
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onOpenResume(candidate.resume_file_url)}>
            <FileText className="w-4 h-4 ml-2 text-green-600" />
            צפה בקו״ח
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenInterview(candidate)}>
            <BrainCircuit className="w-4 h-4 ml-2 text-purple-600" />
            שאלות לראיון
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenClientCv(candidate)}>
            <FileText className="w-4 h-4 ml-2 text-orange-600" />
            הכן קו״ח ללקוח
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenOfferSystem}>
            <Calculator className="w-4 h-4 ml-2 text-amber-600" />
            מחשבון הצעת שכר
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateTaskOpen(true)}>
            <PlusSquare className="w-4 h-4 ml-2 text-blue-600" />
            יצירת משימה
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTasksOpen(true)}>
            <ClipboardList className="w-4 h-4 ml-2 text-blue-500" />
            משימות
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTimelineOpen(true)}>
            <Clock className="w-4 h-4 ml-2 text-blue-500" />
            ציר זמן
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onSendToClients(candidate)}
            disabled={!user?.can_send_email_to_clients}
          >
            <Send className="w-4 h-4 ml-2 text-blue-600" />
            שלח ללקוחות (מייל)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSendWhatsapp(candidate)}
            disabled={!candidate.phone_primary}
          >
            <Smartphone className="w-4 h-4 ml-2 text-green-600" />
            {candidate.phone_primary ? 'WhatsApp למועמד' : 'אין מספר טלפון'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onMarkAsRead(candidate.id)}
            disabled={candidate.is_read}
          >
            <Eye className="w-4 h-4 ml-2 text-blue-600" />
            {candidate.is_read ? 'נקרא' : 'סמן כנקרא'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CandidateTimelineDialog
        candidate={candidate}
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />
      <CreateTaskDialog
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        candidate={candidate}
        agentName="יעל - דואר נכנס"
      />
      <CandidateTasksDialog
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
        candidate={candidate}
      />
    </>
  );
}