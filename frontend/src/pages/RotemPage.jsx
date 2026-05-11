import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Set page title
if (typeof document !== 'undefined') {
  document.title = 'HRAI | Pandatech';
}
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MessageCircle, Plus, Briefcase, User as UserIcon, Trash2, RefreshCw, Loader2, Eye, FileText, AlertTriangle, Info, Phone, TestTube, Inbox, SendHorizontal, Undo2, Clock, Building, HelpCircle, ArrowUpDown, ArrowUp, ArrowDown, Layers, ChevronDown, ChevronRight, ChevronUp, Send, MoreHorizontal, ClipboardList, Users, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StartRotemConversationDialog from "@/components/matches/StartRotemConversationDialog";
import WhatsappConversationDialog from "@/components/rotem/WhatsappConversationDialog";
import CandidateSummaryDialog from "@/components/rotem/CandidateSummaryDialog";
import JobDetailsDialog from "@/components/rotem/JobDetailsDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ConversationLogDialog from "@/components/rotem/ConversationLogDialog";
import MatchReasonsPopover from "@/components/matches/MatchReasonsPopover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import BlurredText from "@/components/ui/BlurredText";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileTabs, MobileTabsButtons, MobileTabButton, MobileTabsContent } from "@/components/ui/mobile-tabs";
import RotemThinkingLog from "@/components/rotem/RotemThinkingLog";
import { useNavigate } from "react-router-dom";
import DirectOutreachTab from "@/components/rotem/DirectOutreachTab";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import CandidateCommunicationHistory from "@/components/candidates/CandidateCommunicationHistory";
import ClientCommunicationHistory from "@/components/clients/ClientCommunicationHistory";
import ClarificationQuestionsDialog from "@/components/rotem/ClarificationQuestionsDialog";
import UnifiedSendDialog from "@/components/matches/UnifiedSendDialog";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import UserTasksCenterContent from "@/components/dashboard/UserTasksCenterContent";
import CandidateForm from "@/components/candidates/CandidateFormDialog";

// Inbox task row component (extracted for grouped/flat rendering)
function TaskInboxRow({ task, jobs, handlePriorityChange, setJobDetailsDialog, setCandidateSummaryDialog, setClarificationDialog, sourceLabels, statusColors, handleStatusChange, setCandidateCommunicationDialog, setClientCommunicationDialog, setConversationLogDialog, handleOpenRotemDialog, setConfirmDialog, setSendDialog, setUnifiedSendDialog, setEditingCandidate, setShowCandidateForm, hasNewMessage, betterMatch, onRefresh }) {
  const [generatingLetter, setGeneratingLetter] = React.useState(false);

  const handleGenerateLetter = async () => {
    setGeneratingLetter(true);
    try {
      const result = await base44.functions.invoke('generateClientLetter', { task_id: task.id });
      if (result?.data?.success) {
        toast.success(`מכתב ללקוח נוצר (${result.data.questions_count} שאלות הבהרה)`);
        if (onRefresh) onRefresh();
      } else {
        toast.error('שגיאה ביצירת המכתב');
      }
    } catch (e) {
      toast.error('שגיאה: ' + (e.message || ''));
    }
    setGeneratingLetter(false);
  };

  const job = jobs.find(j => j.id === task.job_id);
  const priorityColors = {
    "גבוהה": "bg-red-100 text-red-800 border-red-300",
    "בינונית": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "נמוכה": "bg-gray-100 text-gray-800 border-gray-300"
  };

  return (
    <TableRow 
      key={task.id} 
      className={`${hasNewMessage ? "bg-green-50 border-r-4 border-r-green-500" : ""} hover:bg-gray-50`}
    >
      <TableCell className="font-mono text-xs text-gray-600 whitespace-nowrap">{task.task_number || '—'}</TableCell>
      
      <TableCell>
        <Badge className={`${priorityColors[task.priority]} font-bold text-xs border`}>
          {task.priority || "בינונית"}
        </Badge>
      </TableCell>

      <TableCell className="font-medium">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <UserIcon className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <button 
              onClick={async (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                try { 
                  const d = await base44.entities.Candidate.filter({ id: task.candidate_id }); 
                  if (d?.length) setCandidateSummaryDialog({ isOpen: true, candidate: d[0] }); 
                } catch {} 
              }} 
              className="text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer"
            >
              <BlurredText>{task.candidate_name}</BlurredText>
            </button>
            {hasNewMessage && (
              <span className="inline-flex items-center gap-0.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse mr-1">
                💬 חדש
              </span>
            )}
            {task.candidate_phone && (
              <div className="text-xs text-gray-500 mt-0.5">{task.candidate_phone}</div>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div>
          {job ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="font-medium text-blue-700 hover:text-blue-900 underline decoration-dotted text-right">
                  {task.job_title}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 max-h-80 overflow-y-auto" align="start">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">{job.title}</h4>
                  {job.description && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">תיאור:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                  {job.requirements && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">דרישות:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.requirements}</p>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="font-medium text-gray-900">{task.job_title}</div>
          )}
          <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
            {job?.job_code && <span>#{job.job_code}</span>}
            {job?.client_name && <span>🏢 <BlurredText>{job.client_name}</BlurredText></span>}
            {job?.location && <span>📍 {job.location}</span>}
          </div>
        </div>
      </TableCell>

      <TableCell>
        {task.match_score || task.match_reasons || task.detailed_analysis
          ? <MatchReasonsPopover matchScore={task.match_score} matchReasons={task.match_reasons} detailedAnalysis={task.detailed_analysis} betterMatch={betterMatch} />
          : <span className="text-xs text-gray-400">-</span>}
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="text-xs w-fit">
            {sourceLabels[task.source] || task.source}
          </Badge>
          <Badge className={`${statusColors[task.status] || "bg-gray-100 text-gray-800"} text-xs w-fit`}>
            {task.status}
          </Badge>
        </div>
      </TableCell>

      <TableCell className="text-xs hidden lg:table-cell">
        <div className="space-y-1">
          <div className="text-gray-600">
            <span className="font-medium">נוצר: </span>
            {new Date(task.created_date).toLocaleDateString('he-IL')}
            <span className="text-gray-400 mr-2 ml-1">
              {new Date(task.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {task.client_summary_letter && (
            <div className="flex items-center gap-1 text-purple-600">
              <FileText className="w-3 h-3" />
              <span className="text-xs">יש מכתב</span>
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuItem onClick={() => setUnifiedSendDialog({ isOpen: true, task })}>
              <Send className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
              שלח הודעה
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCandidateCommunicationDialog({ isOpen: true, task })}>
              <MessageCircle className="w-4 h-4 text-purple-600 shrink-0 ml-2" />
              הסטוריית מועמד
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setClientCommunicationDialog({ isOpen: true, task })}>
              <Building className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
              הסטוריית לקוח
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConversationLogDialog({ isOpen: true, task })}>
              <FileText className="w-4 h-4 text-orange-600 shrink-0 ml-2" />
              לוג שיחה
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setClarificationDialog({ isOpen: true, task })}>
              <HelpCircle className="w-4 h-4 text-orange-600 shrink-0 ml-2" />
              שאלות הבהרה
            </DropdownMenuItem>
            {!task.client_summary_letter && (
              <DropdownMenuItem onClick={handleGenerateLetter} disabled={generatingLetter}>
                {generatingLetter ? <Loader2 className="w-4 h-4 shrink-0 ml-2 animate-spin" /> : <Wand2 className="w-4 h-4 shrink-0 ml-2 text-purple-600" />}
                צור מכתב ללקוח
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => {
              try {
                const candidateData = await base44.entities.Candidate.filter({ id: task.candidate_id });
                if (candidateData && candidateData.length > 0) {
                  setEditingCandidate(candidateData[0]);
                  setShowCandidateForm(true);
                }
              } catch (error) {
                console.error('Error loading candidate:', error);
              }
            }}>
              <UserIcon className="w-4 h-4 shrink-0 ml-2" />
              עריכת מועמד
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmDialog({ isOpen: true, taskId: task.id })}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="w-4 h-4 shrink-0 ml-2" />
              מחק משימה
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Live Call Button Component with countdown
function LiveCallButton({ task, onStop }) {
  const [countdown, setCountdown] = useState(3);
  const [isLive, setIsLive] = useState(false);

  // Check if task just transitioned to "בתהליך" (within last 5 seconds)
  useEffect(() => {
    const taskUpdated = task.updated_date ? new Date(task.updated_date) : new Date(task.created_date);
    const timeSinceUpdate = (Date.now() - taskUpdated.getTime()) / 1000;
    
    // If task was updated more than 5 seconds ago, skip countdown
    if (timeSinceUpdate > 5) {
      setIsLive(true);
      setCountdown(0);
      return;
    }

    // Otherwise, start countdown
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsLive(true);
    }
  }, [countdown, task]);

  if (!isLive) {
    return (
      <Button
        disabled
        className="bg-red-600 text-white h-8 px-3 text-sm font-bold animate-pulse"
        title="ספירה לאחור להתחלת שיחה"
      >
        {countdown}
      </Button>
    );
  }

  return (
    <Button
      onClick={onStop}
      className="bg-red-600 hover:bg-red-700 text-white animate-pulse h-8 px-3 text-sm font-bold"
      title="עצור שיחה"
    >
      🔴 Live Call
    </Button>
  );
}

export default function RotemPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("inbox");
  
  // Form state
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState("בינונית");
  const [manualPhone, setManualPhone] = useState("");
  const [jobSearchOpen, setJobSearchOpen] = useState(false);
  const [candidateSearchOpen, setCandidateSearchOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [loadingTestMode, setLoadingTestMode] = useState(false);
  
  // Dialog state
  const [rotemDialog, setRotemDialog] = useState({ isOpen: false, task: null });
  const [conversationDialog, setConversationDialog] = useState({ isOpen: false, task: null });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, taskId: null });
  const [candidateSummaryDialog, setCandidateSummaryDialog] = useState({ isOpen: false, candidate: null });
  const [jobDetailsDialog, setJobDetailsDialog] = useState({ isOpen: false, job: null });
  const [conversationLogDialog, setConversationLogDialog] = useState({ isOpen: false, task: null });
  const [selectedConversationTask, setSelectedConversationTask] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [candidateCommunicationDialog, setCandidateCommunicationDialog] = useState({ isOpen: false, task: null });
  const [clientCommunicationDialog, setClientCommunicationDialog] = useState({ isOpen: false, task: null });
  const [clarificationDialog, setClarificationDialog] = useState({ isOpen: false, task: null });
  const [unifiedSendDialog, setUnifiedSendDialog] = useState({ isOpen: false, task: null });
  const [sendDialog, setSendDialog] = useState({ isOpen: false, task: null });
  const [inboxSort, setInboxSort] = useState({ column: null, direction: 'asc' });
  const [groupBy, setGroupBy] = useState(null); // null | 'candidate_name' | 'job_title' | 'priority'
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [showTasksCenter, setShowTasksCenter] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // Fetch user
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch tasks with caching
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['rotemTasks'],
    queryFn: () => base44.entities.RotemTask.list('-created_date', 10000),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  // Fetch jobs with caching
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 10000),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch candidates with caching
  const { data: candidates = [] } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => base44.entities.Candidate.list('-created_date', 10000),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch recent incoming WhatsApp messages (last 24h) to mark tasks with new messages
  const { data: recentIncomingMessages = [] } = useQuery({
    queryKey: ['rotemIncomingMessages'],
    queryFn: async () => {
      const msgs = await base44.entities.WhatsappMessageRotem.filter(
        { direction: 'incoming' },
        '-created_date',
        500
      );
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return msgs.filter(m => new Date(m.created_date) > oneDayAgo);
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Fetch all matches to detect better matches for same candidates
  const { data: allMatches = [] } = useQuery({
    queryKey: ['allMatches'],
    queryFn: () => base44.entities.Match.list('-created_date', 5000),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Build set of task IDs that have new incoming messages
  const tasksWithNewMessages = useMemo(() => {
    const s = new Set();
    recentIncomingMessages.forEach(m => { if (m.conversation_id) s.add(m.conversation_id); });
    return s;
  }, [recentIncomingMessages]);

  // Build map of better matches for each task
  const betterMatchesMap = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      if (!task.candidate_id || !task.match_score) return;
      
      // Find all matches for this candidate with higher scores
      const betterMatches = allMatches.filter(m => 
        m.candidate_id === task.candidate_id &&
        m.match_score > task.match_score &&
        m.id !== task.match_id
      ).sort((a, b) => b.match_score - a.match_score);

      if (betterMatches.length > 0) {
        const best = betterMatches[0];
        const job = jobs.find(j => j.id === best.job_id);
        map[task.id] = {
          match_score: best.match_score,
          job_title: best.job_title,
          job_code: job?.job_code,
          job_id: best.job_id,
          agent_name: best.user_name || 'לא ידוע'
        };
      }
    });
    return map;
  }, [tasks, allMatches, jobs]);

  // Fetch test mode config
  const { data: testModeConfig } = useQuery({
    queryKey: ['agentConfig', 'rotem'],
    queryFn: async () => {
      const configs = await base44.entities.AgentConfig.filter({ agent_name: 'rotem' });
      return configs[0] || null;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  // Fetch Rotem settings (work mode)
  const { data: rotemSettings } = useQuery({
    queryKey: ['rotemSettings'],
    queryFn: async () => {
      const settings = await base44.entities.RotemSettings.list();
      return settings[0] || null;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const testMode = testModeConfig?.test_mode || false;
  const workMode = rotemSettings?.work_mode || 'advanced';

  const handleTestModeToggle = async () => {
    setLoadingTestMode(true);
    try {
      if (testModeConfig) {
        await base44.entities.AgentConfig.update(testModeConfig.id, {
          test_mode: !testMode
        });
        queryClient.invalidateQueries(['agentConfig', 'rotem']);
        toast.success(!testMode ? "מצב בדיקות הופעל - טל תפעל 24/7" : "מצב בדיקות כבוי - טל תפעל בשעות העבודה בלבד");
      } else {
        toast.error("לא נמצאו הגדרות טל");
      }
    } catch (error) {
      console.error("Error toggling test mode:", error);
      toast.error("שגיאה בעדכון מצב בדיקות");
    }
    setLoadingTestMode(false);
  };

  const loading = loadingTasks;

  const filteredJobs = useMemo(() => {
    if (!jobSearch) return jobs.slice(0, 20);
    const search = jobSearch.toLowerCase();
    return jobs.filter(j => 
      j.title?.toLowerCase().includes(search) ||
      j.client_name?.toLowerCase().includes(search) ||
      j.job_code?.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [jobs, jobSearch]);

  const filteredCandidates = useMemo(() => {
    if (!candidateSearch) return candidates.slice(0, 20);
    const search = candidateSearch.toLowerCase();
    return candidates.filter(c => 
      c.full_name?.toLowerCase().includes(search) ||
      c.first_name?.toLowerCase().includes(search) ||
      c.last_name?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.phone_primary?.includes(search)
    ).slice(0, 20);
  }, [candidates, candidateSearch]);

  const handleAddTask = async () => {
    if (!selectedJob || !selectedCandidate) {
      toast.error("יש לבחור משרה ומועמד");
      return;
    }

    setAdding(true);
    try {
      // Get next task number
      const nextNumber = await base44.functions.invoke('getNextTaskNumber', {});
      const taskNumber = `TD-${String(nextNumber.data.nextNumber).padStart(5, '0')}`;
      
      // Use manual phone if provided, otherwise use candidate's phone
      const phoneToUse = manualPhone.trim() || selectedCandidate.phone_primary;
      
      await base44.entities.RotemTask.create({
        task_number: taskNumber,
        job_id: selectedJob.id,
        job_title: selectedJob.title,
        candidate_id: selectedCandidate.id,
        candidate_name: selectedCandidate.full_name || `${selectedCandidate.first_name} ${selectedCandidate.last_name}`,
        candidate_phone: phoneToUse,
        status: "לא החל",
        source: "manual",
        priority: selectedPriority,
        notes: manualPhone.trim() ? `מספר טלפון ידני: ${manualPhone.trim()} (במקום ${selectedCandidate.phone_primary || 'לא ידוע'})` : ''
      });
      
      setSelectedJob(null);
      setSelectedCandidate(null);
      setSelectedPriority("בינונית");
      setManualPhone("");
      setJobSearch("");
      setCandidateSearch("");
      queryClient.invalidateQueries(['rotemTasks']);
      toast.success("המשימה נוספה בהצלחה");
    } catch (error) {
      console.error("Error adding task:", error);
      let errorMsg = "שגיאה בהוספת המשימה";
      if (error?.message) {
        errorMsg = error.message;
      } else if (error?.error) {
        errorMsg = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      }
      toast.error(errorMsg);
    }
    setAdding(false);
  };

  const handlePriorityChange = async (taskId, newPriority) => {
    try {
      await base44.entities.RotemTask.update(taskId, { priority: newPriority });
      queryClient.invalidateQueries(['rotemTasks']);
    } catch (error) {
      console.error("Error updating priority:", error);
      let errorMsg = "שגיאה בעדכון העדיפות";
      if (error?.message) {
        errorMsg = error.message;
      } else if (error?.error) {
        errorMsg = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      }
      toast.error(errorMsg);
    }
  };

  // Split tasks into inbox (active) and outbox (completed)
  const inboxTasks = tasks.filter(task => 
    task.status !== 'הסתיים' && 
    task.status !== 'הסתיים מוצלח' && 
    task.status !== 'לא ליצור קשר' && 
    task.status !== 'מועמד לא עונה'
  );

  const outboxTasks = tasks.filter(task => 
    task.status === 'הסתיים' || 
    task.status === 'הסתיים מוצלח' || 
    task.status === 'לא ליצור קשר' || 
    task.status === 'מועמד לא עונה'
  );

  const sortTasksByPriority = (tasks) => {
    return [...tasks].sort((a, b) => {
      const priorityOrder = { "גבוהה": 1, "בינונית": 2, "נמוכה": 3 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return new Date(b.created_date) - new Date(a.created_date);
    });
  };

  const handleInboxSort = (column) => {
    setInboxSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (column) => {
    if (inboxSort.column !== column) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return inboxSort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const applyInboxSort = (tasks) => {
    if (!inboxSort.column) return sortTasksByPriority(tasks);
    return [...tasks].sort((a, b) => {
      const dir = inboxSort.direction === 'asc' ? 1 : -1;
      const priorityOrder = { "גבוהה": 1, "בינונית": 2, "נמוכה": 3 };
      switch (inboxSort.column) {
        case 'task_number': return dir * (a.task_number || '').localeCompare(b.task_number || '');
        case 'priority': return dir * ((priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
        case 'job_title': return dir * (a.job_title || '').localeCompare(b.job_title || '');
        case 'candidate_name': return dir * (a.candidate_name || '').localeCompare(b.candidate_name || '');
        case 'source': return dir * (a.source || '').localeCompare(b.source || '');
        case 'status': return dir * (a.status || '').localeCompare(b.status || '');
        case 'created_date': return dir * (new Date(a.created_date) - new Date(b.created_date));
        default: return 0;
      }
    });
  };

  const sortedInboxTasks = applyInboxSort(inboxTasks);
  const sortedOutboxTasks = sortTasksByPriority(outboxTasks);

  const groupLabels = {
    candidate_name: 'שם מועמד',
    job_title: 'משרה',
    priority: 'רמת דחיפות',
  };

  const getGroupedInboxTasks = () => {
    if (!groupBy) return null;
    const groups = {};
    sortedInboxTasks.forEach(task => {
      const key = task[groupBy] || '—';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (groupBy === 'priority') {
        const order = { 'גבוהה': 1, 'בינונית': 2, 'נמוכה': 3, '—': 4 };
        return (order[a] || 4) - (order[b] || 4);
      }
      return a.localeCompare(b, 'he');
    });
  };

  const groupedInboxTasks = getGroupedInboxTasks();

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStatusChange = async (taskId, newStatus) => {
    // Block manual change to "בתהליך" - only automated process can do this
    if (newStatus === "בתהליך") {
      toast.error("לא ניתן להעביר ידנית לסטטוס 'בתהליך'. השתמש ב'מאושר לשיחה' והמערכת תעביר אוטומטית.");
      return;
    }

    // "תקשורת משתמש" - stop any active auto-conversations for this candidate
    if (newStatus === "תקשורת משתמש") {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const otherActiveTasks = tasks.filter(t =>
          t.id !== taskId &&
          t.candidate_phone === task.candidate_phone &&
          t.status === 'בתהליך'
        );
        for (const otherTask of otherActiveTasks) {
          try {
            await base44.entities.RotemTask.update(otherTask.id, {
              status: 'שיחה נעצרה',
              notes: (otherTask.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] שיחה נעצרה - הועבר למצב תקשורת משתמש`
            });
          } catch (err) { console.error('Error stopping active task:', err); }
        }
      }
    }

    // CRITICAL: When approving for call, stop any other active conversations with same candidate
    if (newStatus === "מאושר לשיחה") {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        // Find other tasks in progress with same candidate
        const otherActiveTasks = tasks.filter(t => 
          t.id !== taskId && 
          t.candidate_phone === task.candidate_phone && 
          t.status === 'בתהליך'
        );

        // Stop them before approving this one
        for (const otherTask of otherActiveTasks) {
          try {
            await base44.entities.RotemTask.update(otherTask.id, {
              status: 'שיחה נעצרה',
              notes: (otherTask.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] שיחה נעצרה אוטומטית - משימה אחרת אושרה לשיחה עם אותו מועמד`
            });
            console.log(`Stopped task ${otherTask.id} before approving ${taskId}`);
          } catch (err) {
            console.error('Error stopping other task:', err);
          }
        }
      }
    }

    // Special handling for "לא ליצור קשר" status
    if (newStatus === "לא ליצור קשר") {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      try {
        // 1. Update candidate status to "לא מתאים - נסגר"
        await base44.entities.Candidate.update(task.candidate_id, {
          status: "לא מתאים - נסגר"
        });

        // 2. Delete the task from Rotem
        await base44.entities.RotemTask.delete(taskId);
        queryClient.invalidateQueries(['rotemTasks']);

        // 3. Notify Carmit by creating a system activity log
        try {
          await base44.entities.SystemActivityLog.create({
            actor_type: 'agent',
            actor_name: 'rotem',
            actor_image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=40&h=40&fit=crop&crop=face',
            action_type: 'task_rejected',
            action_description: `טל סגרה משימה: ${task.candidate_name} ← ${task.job_title} (לא ליצור קשר)`,
            status: 'info',
            details: JSON.stringify({
              task_id: taskId,
              candidate_id: task.candidate_id,
              candidate_name: task.candidate_name,
              job_id: task.job_id,
              job_title: task.job_title,
              reason: 'לא ליצור קשר'
            })
          });
        } catch (logErr) {
          console.error("Error logging to SystemActivityLog:", logErr);
        }

        toast.success(`המשימה נסגרה והמועמד ${task.candidate_name} סומן כ"לא מתאים - נסגר"`);
      } catch (error) {
        console.error("Error handling 'no contact' status:", error);
        let errorMsg = "שגיאה בעדכון הסטטוס";
        if (error?.message) {
          errorMsg = error.message;
        } else if (error?.error) {
          errorMsg = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        }
        toast.error(errorMsg);
      }
      return;
    }

    // Special handling for "התערבות- לא להתקשר" status
    if (newStatus === "התערבות- לא להתקשר") {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      try {
        // 1. Delete the task from Rotem (cancel completely)
        await base44.entities.RotemTask.delete(taskId);
        queryClient.invalidateQueries(['rotemTasks']);

        // 2. Notify Carmit by creating a system activity log
        try {
          await base44.entities.SystemActivityLog.create({
            actor_type: 'user',
            actor_name: user?.full_name || 'מפעיל מערכת',
            actor_image: '',
            action_type: 'task_cancelled',
            action_description: `התערבות מפעיל: משימה בוטלה - ${task.candidate_name} ← ${task.job_title}`,
            status: 'warning',
            details: JSON.stringify({
              task_id: taskId,
              candidate_id: task.candidate_id,
              candidate_name: task.candidate_name,
              job_id: task.job_id,
              job_title: task.job_title,
              reason: 'התערבות מפעיל - לא להתקשר'
            })
          });
        } catch (logErr) {
          console.error("Error logging to SystemActivityLog:", logErr);
        }

        toast.success(`המשימה בוטלה בהצלחה (התערבות מפעיל)`);
      } catch (error) {
        console.error("Error handling intervention status:", error);
        let errorMsg = "שגיאה בביטול המשימה";
        if (error?.message) {
          errorMsg = error.message;
        } else if (error?.error) {
          errorMsg = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        }
        toast.error(errorMsg);
      }
      return;
    }

    // Regular status update
    try {
      await base44.entities.RotemTask.update(taskId, { status: newStatus });
      queryClient.invalidateQueries(['rotemTasks']);
      
      // If status changed to "הסתיים מוצלח", create EladTask
      if (newStatus === "הסתיים מוצלח") {
        try {
          const result = await base44.functions.invoke('createEladTaskFromRotem', { 
            rotem_task_id: taskId 
          });
          
          if (result.data.success) {
            toast.success(`המשימה עודכנה ונוצרה משימה לאלעד (${result.data.elad_task_number})`);
          } else {
            toast.info(`המשימה עודכנה. ${result.data.message || result.data.error}`);
          }
        } catch (eladError) {
          console.error("Error creating Elad task:", eladError);
          toast.warning(`המשימה עודכנה, אבל לא הצלחתי ליצור משימה לאלעד: ${eladError.message}`);
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      let errorMsg = "שגיאה בעדכון הסטטוס";
      if (error?.message) {
        errorMsg = error.message;
      } else if (error?.error) {
        errorMsg = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      }
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await base44.entities.RotemTask.delete(taskId);
      queryClient.invalidateQueries(['rotemTasks']);
      toast.success("המשימה נמחקה");
    } catch (error) {
      console.error("Error deleting task:", error);
      let errorMsg = "שגיאה במחיקת המשימה";
      if (error?.message) {
        errorMsg = error.message;
      } else if (error?.error) {
        errorMsg = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      }
      toast.error(errorMsg);
    }
    setConfirmDialog({ isOpen: false, taskId: null });
  };

  const handleReturnToInbox = async (taskId) => {
    try {
      await base44.entities.RotemTask.update(taskId, { status: 'לא החל' });
      queryClient.invalidateQueries(['rotemTasks']);
      toast.success("המשימה הוחזרה לדואר הנכנס");
    } catch (error) {
      console.error("Error returning to inbox:", error);
      toast.error("שגיאה בהחזרת המשימה");
    }
  };

  const handleOpenRotemDialog = (task) => {
    // Create a match-like object for the dialog
    const matchObj = {
      id: task.id,
      job_id: task.job_id,
      job_title: task.job_title,
      candidate_id: task.candidate_id,
      candidate_name: task.candidate_name
    };
    setRotemDialog({ isOpen: true, task: matchObj });
  };

  const handleViewConversationMessages = async (task) => {
    setSelectedConversationTask(task);
    setLoadingMessages(true);
    try {
      const messages = await base44.entities.WhatsappMessageRotem.filter(
        { conversation_id: task.conversation_id || task.id },
        'created_date'
      );
      setConversationMessages(messages || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("שגיאה בטעינת ההודעות");
      setConversationMessages([]);
    }
    setLoadingMessages(false);
  };



  const handleRotemSuccess = async () => {
    setRotemDialog({ isOpen: false, task: null });
    // Wait a bit for the backend to update the task status
    setTimeout(() => {
      queryClient.invalidateQueries(['rotemTasks']);
    }, 1000);
  };



  const statusColors = {
    "לא החל": "bg-gray-100 text-gray-800",
    "מאושר לשיחה": "bg-purple-100 text-purple-800",
    "בתהליך": "bg-blue-100 text-blue-800",
    "מועמד לא עונה": "bg-orange-100 text-orange-800",
    "הסתיים": "bg-green-100 text-green-800",
    "הסתיים מוצלח": "bg-emerald-100 text-emerald-800",
    "לא ליצור קשר": "bg-red-100 text-red-800",
    "התערבות- לא להתקשר": "bg-yellow-100 text-yellow-800",
    "שיחה נעצרה": "bg-gray-100 text-gray-800",
    "תקשורת משתמש": "bg-cyan-100 text-cyan-800"
  };

  const sourceLabels = {
    "manual": "ידני",
    "naama": "נעמה",
    "roee": "רועי",
    "carmit": "כרמית"
  };

  const priorityColors = {
    "גבוהה": "bg-red-100 text-red-800 border-red-300",
    "בינונית": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "נמוכה": "bg-gray-100 text-gray-800 border-gray-300"
  };

  if (loading) {
    return <LoadingSpinner message="טוען דף טל..." />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex items-center gap-4">

          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">טל - קשרי מועמדים</h1>
            <p className="text-sm md:text-base text-gray-600">סוכנת AI לתקשורת עם מועמדים בוואטסאפ - מספר טלפון: 058-6665109</p>
            <div className="text-sm text-purple-700 mt-2 bg-purple-50 px-3 py-2 rounded-md border border-purple-200 inline-block">
              💡 טל מקבלת משימות ישירות מכרמית לפי תעדוף התאמות מועמדים שיש לייצר איתם קשר. כרמית פועלת מול רכזי הגיוס לקבל התאמות
            </div>
          </div>
        </div>

      </div>

      {/* Thinking Log */}
      <RotemThinkingLog />

      {/* Tasks Tabs */}
      <MobileTabs value={activeTab} onValueChange={setActiveTab}>
        <MobileTabsButtons>
          <MobileTabButton value="inbox" icon={Inbox} label={`דואר נכנס (${sortedInboxTasks.length})`} color="green" />
          <MobileTabButton value="outbox" icon={SendHorizontal} label={`דואר יוצא (${sortedOutboxTasks.length})`} color="blue" />
          <MobileTabButton value="direct_outreach" icon={MessageCircle} label="דואר יוצא ישירות גייסות" color="purple" />
        </MobileTabsButtons>

        {/* Inbox Tab */}
        <MobileTabsContent tabValue="inbox">
          {/* Important Notice Alert */}
          {(()  => {
            return (
              <div className="mb-6">
                <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHelp(v => !v)}
                  className="flex items-center gap-2 text-purple-700 bg-purple-50 border border-purple-300 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-purple-100 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  עזרה
                  {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => navigate(createPageUrl('Management'))}
                  className="flex items-center gap-2 text-xs bg-green-50 border border-green-300 text-green-800 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors"
                  title="לחץ לשינוי הגדרות"
                >
                  <span className="font-medium">מודל עבודה:</span>
                  <span className="font-bold">{workMode === 'basic' ? '📋 בסיסי' : '🚀 מתקדם'}</span>
                </button>
                </div>
                {showHelp && (
                  <Alert className="bg-purple-50 border-purple-300 border-2 mt-2">
                    <AlertTriangle className="w-5 h-5 text-purple-700" />
                    <AlertDescription className="text-purple-900">
                    <strong className="text-lg">⚠️ שימו לב:</strong> 
                    <ul className="list-disc mr-6 mt-2 space-y-1">
                    <li>העברה לסטטוס <strong>"מאושר לשיחה"</strong> תגרום לטל ליצור קשר עם המועמד <strong>תוך דקה</strong> (התהליך האוטומטי רץ כל דקה).</li>
                    <li>בחירת סטטוס <strong className="text-red-700">"לא ליצור קשר"</strong> תמחק את המשימה מטל, תסגור את המועמד במערכת ("לא מתאים - נסגר"), ותעדכן את כרמית על הסגירה.</li>
                    <li>בחירת סטטוס <strong className="text-yellow-700">"התערבות- לא להתקשר"</strong> תבטל את המשימה חד-פעמית. <u>בחרו זאת כאשר אתם רוצים למנוע מטל ליצור קשר עם מועמד זה עבור משרה זו באופן חד פעמי</u>, בלי לסגור את המועמד בכלל המערכת.</li>
                    <li>בחירת סטטוס <strong className="text-cyan-700">"תקשורת משתמש"</strong> מפעיל מצב בו <strong>טל לא תיצור קשר אוטומטי עם המועמד</strong>. במצב זה המשתמש בלבד מנהל את התקשורת באמצעות כפתור <strong>"שלח הודעה"</strong> שמופיע בשורת המשימה. כל ההודעות שנשלחות ירוכזו בכרטיסיית "דואר יוצא ישירות גייסות".</li>
                    </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            );
          })()}

          {/* Add Task Form */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" />
                הוספת פנייה חדשה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Priority Select */}
                  <div className="w-full md:w-32">
                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="עדיפות" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="גבוהה">🔴 גבוהה</SelectItem>
                        <SelectItem value="בינונית">🟡 בינונית</SelectItem>
                        <SelectItem value="נמוכה">⚪ נמוכה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Job Search */}
                <div className="flex-1">
                  <Popover open={jobSearchOpen} onOpenChange={setJobSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Briefcase className="w-4 h-4 ml-2 text-gray-500" />
                        {selectedJob ? selectedJob.title : "בחר משרה..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="חפש משרה..." 
                          value={jobSearch}
                          onValueChange={setJobSearch}
                        />
                        <CommandList>
                          <CommandEmpty>לא נמצאו משרות</CommandEmpty>
                          <CommandGroup>
                            {filteredJobs.map(job => (
                              <CommandItem
                                key={job.id}
                                value={job.title}
                                onSelect={() => {
                                  setSelectedJob(job);
                                  setJobSearchOpen(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{job.title}</span>
                                  <span className="text-xs text-gray-500">
                                    <BlurredText>{job.client_name}</BlurredText> {job.job_code && `| ${job.job_code}`}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Candidate Search */}
                <div className="flex-1">
                  <Popover open={candidateSearchOpen} onOpenChange={setCandidateSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <UserIcon className="w-4 h-4 ml-2 text-gray-500" />
                        {selectedCandidate ? (selectedCandidate.full_name || `${selectedCandidate.first_name} ${selectedCandidate.last_name}`) : "בחר מועמד..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="חפש מועמד..." 
                          value={candidateSearch}
                          onValueChange={setCandidateSearch}
                        />
                        <CommandList>
                          <CommandEmpty>לא נמצאו מועמדים</CommandEmpty>
                          <CommandGroup>
                            {filteredCandidates.map(candidate => (
                              <CommandItem
                                key={candidate.id}
                                value={candidate.full_name || `${candidate.first_name} ${candidate.last_name}`}
                                onSelect={() => {
                                  setSelectedCandidate(candidate);
                                  setCandidateSearchOpen(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    <BlurredText>{candidate.full_name || `${candidate.first_name} ${candidate.last_name}`}</BlurredText>
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {candidate.phone_primary} {candidate.email && `| ${candidate.email}`}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <Button 
                  onClick={handleAddTask} 
                  disabled={!selectedJob || !selectedCandidate || adding}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-2" />}
                  הוסף
                </Button>
              </div>
              
              {/* Manual Phone Input */}
              {selectedCandidate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600" />
                    מספר טלפון לבדיקה (אופציונלי)
                  </label>
                  <Input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder={selectedCandidate.phone_primary || "הזן מספר טלפון ידנית"}
                    className="text-left"
                    dir="ltr"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    {manualPhone.trim() 
                      ? `✓ ישתמש ב: ${manualPhone.trim()}`
                      : `ברירת מחדל: ${selectedCandidate.phone_primary || 'לא ידוע'}`
                    }
                  </p>
                </div>
              )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  <span>משימות לביצוע</span>
                  <Badge className="bg-green-100 text-green-800 font-bold">{sortedInboxTasks.length} פניות</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-gray-50 border rounded-lg p-1">
                    <Layers className="w-4 h-4 text-gray-500 mr-1" />
                    <span className="text-xs text-gray-500 ml-1">קיבוץ:</span>
                    {[
                      { value: null, label: 'ללא' },
                      { value: 'candidate_name', label: 'מועמד' },
                      { value: 'job_title', label: 'משרה' },
                      { value: 'priority', label: 'דחיפות' },
                    ].map(opt => (
                      <button
                        key={String(opt.value)}
                        onClick={() => { setGroupBy(opt.value); setCollapsedGroups({}); }}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          groupBy === opt.value
                            ? 'bg-green-600 text-white'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24 cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleInboxSort('task_number')}>
                        <div className="flex items-center gap-1">מס׳ משימה {getSortIcon('task_number')}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleInboxSort('priority')}>
                        <div className="flex items-center gap-1">עדיפות {getSortIcon('priority')}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleInboxSort('job_title')}>
                        <div className="flex items-center gap-1">משרה {getSortIcon('job_title')}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleInboxSort('candidate_name')}>
                        <div className="flex items-center gap-1">מועמד {getSortIcon('candidate_name')}</div>
                      </TableHead>
                      <TableHead>התאמה</TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleInboxSort('source')}>
                        <div className="flex items-center gap-1">מקור {getSortIcon('source')}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleInboxSort('status')}>
                        <div className="flex items-center gap-1">סטטוס {getSortIcon('status')}</div>
                      </TableHead>
                      <TableHead>הערת ביצוע</TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleInboxSort('created_date')}>
                        <div className="flex items-center gap-1">תאריך {getSortIcon('created_date')}</div>
                      </TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedInboxTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין משימות בדואר הנכנס
                        </TableCell>
                      </TableRow>
                    ) : groupedInboxTasks ? (
                      groupedInboxTasks.map(([groupKey, groupTasks]) => (
                        <React.Fragment key={groupKey}>
                          <TableRow
                            className="bg-green-50 cursor-pointer hover:bg-green-100 select-none"
                            onClick={() => toggleGroup(groupKey)}
                          >
                            <TableCell colSpan={9}>
                              <div className="flex items-center gap-2 font-semibold text-green-800">
                                {collapsedGroups[groupKey] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                <Layers className="w-4 h-4" />
                                <span>{groupLabels[groupBy]}: {groupKey}</span>
                                <Badge className="bg-green-200 text-green-800 mr-2">{groupTasks.length}</Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          {!collapsedGroups[groupKey] && groupTasks.map((task) => (
                            <TaskInboxRow
                              key={task.id}
                              task={task}
                              jobs={jobs}
                              handlePriorityChange={handlePriorityChange}
                              setJobDetailsDialog={setJobDetailsDialog}
                              setCandidateSummaryDialog={setCandidateSummaryDialog}
                              setClarificationDialog={setClarificationDialog}
                              sourceLabels={sourceLabels}
                              statusColors={statusColors}
                              handleStatusChange={handleStatusChange}
                              setCandidateCommunicationDialog={setCandidateCommunicationDialog}
                              setClientCommunicationDialog={setClientCommunicationDialog}
                              setConversationLogDialog={setConversationLogDialog}
                              handleOpenRotemDialog={handleOpenRotemDialog}
                              setConfirmDialog={setConfirmDialog}
                              setSendDialog={setSendDialog}
                              setUnifiedSendDialog={setUnifiedSendDialog}
                              setEditingCandidate={setEditingCandidate}
                              setShowCandidateForm={setShowCandidateForm}
                              hasNewMessage={tasksWithNewMessages.has(task.id)}
                              betterMatch={betterMatchesMap[task.id]}
                              onRefresh={() => queryClient.invalidateQueries(['rotemTasks'])}
                            />
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      sortedInboxTasks.map((task) => (
                        <TaskInboxRow
                          key={task.id}
                          task={task}
                          jobs={jobs}
                          handlePriorityChange={handlePriorityChange}
                          setJobDetailsDialog={setJobDetailsDialog}
                          setCandidateSummaryDialog={setCandidateSummaryDialog}
                          setClarificationDialog={setClarificationDialog}
                          sourceLabels={sourceLabels}
                          statusColors={statusColors}
                          handleStatusChange={handleStatusChange}
                          setCandidateCommunicationDialog={setCandidateCommunicationDialog}
                          setClientCommunicationDialog={setClientCommunicationDialog}
                          setConversationLogDialog={setConversationLogDialog}
                          handleOpenRotemDialog={handleOpenRotemDialog}
                          setConfirmDialog={setConfirmDialog}
                          setSendDialog={setSendDialog}
                          setUnifiedSendDialog={setUnifiedSendDialog}
                          setEditingCandidate={setEditingCandidate}
                          setShowCandidateForm={setShowCandidateForm}
                          hasNewMessage={tasksWithNewMessages.has(task.id)}
                          betterMatch={betterMatchesMap[task.id]}
                          onRefresh={() => queryClient.invalidateQueries(['rotemTasks'])}
                        />
                      ))
                    )}
                   </TableBody>
                  </Table>
                    </div>
                    </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 mt-6">
                    <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => {
                    queryClient.invalidateQueries(['rotemTasks']);
                    queryClient.invalidateQueries(['jobs']);
                    queryClient.invalidateQueries(['candidates']);
                    }}>
                    <RefreshCw className="w-4 h-4 ml-2" />
                    רענן
                    </Button>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <TestTube className="w-5 h-5 text-yellow-700" />
                    <Label htmlFor="test-mode" className="text-sm font-medium text-yellow-900 cursor-pointer">
                    מצב בדיקות (24/7)
                    </Label>
                    </div>
                    <Switch
                    id="test-mode"
                    checked={testMode}
                    onCheckedChange={handleTestModeToggle}
                    disabled={loadingTestMode}
                    />
                    </div>

                    </div>
                    </MobileTabsContent>

                    {/* Outbox Tab */}
                    <MobileTabsContent tabValue="outbox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>משימות שהושלמו</span>
                <Badge variant="outline">{sortedOutboxTasks.length} פניות</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">מס׳ משימה</TableHead>
                      <TableHead>עדיפות</TableHead>
                      <TableHead>משרה</TableHead>
                      <TableHead>מועמד</TableHead>
                      <TableHead>התאמה</TableHead>
                      <TableHead>החלטת כרמית</TableHead>
                      <TableHead>מקור</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>הערת ביצוע</TableHead>
                      <TableHead>תאריך</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOutboxTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                          <SendHorizontal className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          אין משימות בדואר היוצא
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedOutboxTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-mono text-xs text-gray-600 whitespace-nowrap">
                            {task.task_number || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={priorityColors[task.priority] || "bg-gray-100 text-gray-800"}>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  const jobData = await base44.entities.Job.filter({ id: task.job_id });
                                  if (jobData && jobData.length > 0) {
                                    setJobDetailsDialog({ isOpen: true, job: jobData[0] });
                                  } else {
                                    toast.error('לא נמצאה משרה');
                                  }
                                } catch (error) {
                                  console.error('Error loading job:', error);
                                  toast.error('שגיאה בטעינת פרטי המשרה');
                                }
                              }}
                              className="text-blue-600 hover:underline flex items-center gap-1 text-right cursor-pointer"
                            >
                              <Briefcase className="w-3 h-3" />
                              {task.job_title}
                              {(() => {
                                const job = jobs.find(j => j.id === task.job_id);
                                return job?.job_code ? <span className="text-gray-500 text-xs"> | #{job.job_code}</span> : null;
                              })()}
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  const candidateData = await base44.entities.Candidate.filter({ id: task.candidate_id });
                                  if (candidateData && candidateData.length > 0) {
                                    setCandidateSummaryDialog({ isOpen: true, candidate: candidateData[0] });
                                  } else {
                                    toast.error('לא נמצא מועמד');
                                  }
                                } catch (error) {
                                  console.error('Error loading candidate:', error);
                                  toast.error('שגיאה בטעינת פרטי המועמד');
                                }
                              }}
                              className="text-blue-600 hover:underline flex items-center gap-1 text-right cursor-pointer"
                            >
                              <UserIcon className="w-3 h-3" />
                              <BlurredText>{task.candidate_name}</BlurredText>
                            </button>
                            {task.candidate_phone && (
                              <div className="text-xs text-gray-500">{task.candidate_phone}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {task.match_score || task.match_reasons || task.detailed_analysis ? (
                              <MatchReasonsPopover 
                                matchScore={task.match_score} 
                                matchReasons={task.match_reasons}
                                detailedAnalysis={task.detailed_analysis}
                              />
                            ) : (
                              <span className="text-xs text-gray-400">אין מידע</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {task.client_summary_letter ? (
                                <>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8 text-purple-700 hover:text-purple-900 hover:bg-purple-50" title="מכתב ללקוח">
                                        <FileText className="w-4 h-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[600px] max-h-[500px] overflow-y-auto" align="start">
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                          <FileText className="w-5 h-5 text-purple-600" />
                                          <h3 className="font-bold text-lg text-purple-900">מכתב סיכום ללקוח</h3>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                                          {task.client_summary_letter}
                                        </div>
                                        <div className="text-xs text-gray-500 border-t pt-2">
                                          נכתב על ידי כרמית • {new Date(task.created_date).toLocaleDateString('he-IL')}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-orange-700 hover:text-orange-900 hover:bg-orange-50"
                                    title="שאלות למועמד"
                                    onClick={() => setClarificationDialog({ isOpen: true, task })}
                                  >
                                    <HelpCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {sourceLabels[task.source] || task.source}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[task.status] || "bg-gray-100 text-gray-800"}>
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {task.rotem_execution_note ? (
                              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                                {task.rotem_execution_note}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(task.created_date).toLocaleDateString('he-IL')}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(task.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCandidateCommunicationDialog({ isOpen: true, task })}
                                className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                title="תקשורת עם מועמד (היסטוריה מלאה)"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setClientCommunicationDialog({ isOpen: true, task })}
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="היסטוריית שיחה עם לקוח"
                              >
                                <Building className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReturnToInbox(task.id)}
                                className="h-8 gap-1 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                title="החזר לדואר נכנס"
                              >
                                <Undo2 className="w-3 h-3" />
                                החזר
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </MobileTabsContent>

        {/* Direct Outreach Tab */}
        <MobileTabsContent tabValue="direct_outreach">
          <DirectOutreachTab />
        </MobileTabsContent>
      </MobileTabs>

      {/* Rotem Conversation Dialog */}
      <StartRotemConversationDialog
        isOpen={rotemDialog.isOpen}
        onClose={() => setRotemDialog({ isOpen: false, task: null })}
        match={rotemDialog.task}
        user={user}
        onSuccess={handleRotemSuccess}
      />

      {/* WhatsApp Conversation View Dialog */}
      <WhatsappConversationDialog
        isOpen={conversationDialog.isOpen}
        onClose={() => setConversationDialog({ isOpen: false, task: null })}
        task={conversationDialog.task}
        onMessageSent={() => queryClient.invalidateQueries(['rotemTasks'])}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, taskId: null })}
        onConfirm={() => handleDelete(confirmDialog.taskId)}
        title="מחיקת משימה"
        message="האם אתה בטוח שברצונך למחוק את המשימה?"
        confirmText="מחק"
        cancelText="ביטול"
        variant="destructive"
      />

      {/* Candidate Summary Dialog */}
      <CandidateSummaryDialog
        isOpen={candidateSummaryDialog.isOpen}
        onClose={() => setCandidateSummaryDialog({ isOpen: false, candidate: null })}
        candidate={candidateSummaryDialog.candidate}
      />

      <JobDetailsDialog
        isOpen={jobDetailsDialog.isOpen}
        onClose={() => setJobDetailsDialog({ isOpen: false, job: null })}
        job={jobDetailsDialog.job}
      />

      {/* Conversation Log Dialog */}
      <ConversationLogDialog
        isOpen={conversationLogDialog.isOpen}
        onClose={() => setConversationLogDialog({ isOpen: false, task: null })}
        task={conversationLogDialog.task}
      />

      {/* Conversation Messages Dialog */}
      <Dialog open={selectedConversationTask !== null} onOpenChange={() => setSelectedConversationTask(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              שיחה עם {selectedConversationTask?.candidate_name || 'מועמד'}
            </DialogTitle>
            <div className="text-sm text-gray-500 flex items-center gap-4">
              <span>📱 {selectedConversationTask?.candidate_phone}</span>
              <span>💼 {selectedConversationTask?.job_title}</span>
            </div>
          </DialogHeader>
          
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {conversationMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  אין הודעות בשיחה זו
                </div>
              ) : (
                conversationMessages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        msg.direction === 'outgoing'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${
                        msg.direction === 'outgoing' ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {new Date(msg.created_date).toLocaleTimeString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Candidate Communication History Dialog */}
      <CandidateCommunicationHistory
        candidateId={candidateCommunicationDialog.task?.candidate_id}
        candidateName={candidateCommunicationDialog.task?.candidate_name || ''}
        open={candidateCommunicationDialog.isOpen}
        onClose={() => setCandidateCommunicationDialog({ isOpen: false, task: null })}
      />

      {/* Client Communication History Dialog */}
      <ClientCommunicationHistory
        jobId={clientCommunicationDialog.task?.job_id}
        jobTitle={clientCommunicationDialog.task?.job_title || ''}
        open={clientCommunicationDialog.isOpen}
        onClose={() => setClientCommunicationDialog({ isOpen: false, task: null })}
      />

      {/* Clarification Questions Dialog */}
      <ClarificationQuestionsDialog
        isOpen={clarificationDialog.isOpen}
        onClose={() => setClarificationDialog({ isOpen: false, task: null })}
        task={clarificationDialog.task}
      />

      {/* Unified Send Dialog */}
      <UnifiedSendDialog
        isOpen={unifiedSendDialog.isOpen}
        onClose={() => setUnifiedSendDialog({ isOpen: false, task: null })}
        match={unifiedSendDialog.task ? {
          ...unifiedSendDialog.task,
          candidate_phone: unifiedSendDialog.task.candidate_phone
        } : null}
        agentName="טל"
      />
      {/* Unified Send Dialog (for "תקשורת משתמש" tasks) */}
      {sendDialog.task && (
        <UnifiedSendDialog
          isOpen={sendDialog.isOpen}
          onClose={() => setSendDialog({ isOpen: false, task: null })}
          match={{
            id: sendDialog.task.id,
            job_id: sendDialog.task.job_id,
            job_title: sendDialog.task.job_title,
            candidate_id: sendDialog.task.candidate_id,
            candidate_name: sendDialog.task.candidate_name,
            candidate_phone: sendDialog.task.candidate_phone
          }}
          candidate={null}
          job={null}
          agentName="טל"
          onMatchRemoved={() => {}}
          clientSummaryLetter={sendDialog.task.client_summary_letter || ''}
        />
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        candidate={{ id: '', full_name: '' }}
        match={null}
        onTaskCreated={() => {
          setCreateTaskOpen(false);
          queryClient.invalidateQueries(['rotemTasks']);
        }}
        agentName="טל"
      />

      {/* Tasks Center Dialog */}
      <Dialog open={showTasksCenter} onOpenChange={setShowTasksCenter}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>ריכוז משימות</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto">
            <UserTasksCenterContent />
          </div>
        </DialogContent>
      </Dialog>

      {/* Candidate Form Dialog */}
      <Dialog open={showCandidateForm} onOpenChange={setShowCandidateForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCandidate ? "עריכת מועמד" : "הוספת מועמד"}</DialogTitle>
          </DialogHeader>
          <CandidateForm
            candidate={editingCandidate}
            onSubmit={async (formData) => {
              try {
                if (editingCandidate) {
                  await base44.entities.Candidate.update(editingCandidate.id, formData);
                  toast.success("המועמד עודכן בהצלחה");
                  queryClient.invalidateQueries(['candidates']);
                  queryClient.invalidateQueries(['rotemTasks']);
                } else {
                  await base44.entities.Candidate.create(formData);
                  toast.success("המועמד נוצר בהצלחה");
                  queryClient.invalidateQueries(['candidates']);
                }
                setShowCandidateForm(false);
                setEditingCandidate(null);
              } catch (error) {
                console.error("Error saving candidate:", error);
                toast.error("שגיאה בשמירת המועמד");
              }
            }}
            onCancel={() => {
              setShowCandidateForm(false);
              setEditingCandidate(null);
            }}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}