import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { runGcAgent } from '@/functions/runGcAgent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  UserCheck,
  Search,
  Trash2,
  MessageSquare,
  MessageCircle,
  Building,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Bot,
  Info,
  Play,
  Loader2,
  RefreshCw,
  Activity,
  Database,
  Target,
  TrendingUp,
  Calendar,
  FileText,
  Code,
  Cpu,
  Inbox,
  Send,
  Lightbulb,
  Mail,
  BrainCircuit,
  MoreHorizontal,
  ClipboardList,
  PlusSquare,
  User as UserIcon,
  BadgeCheck,
  LayoutList,
  Rows3,
} from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { UserMinus } from 'lucide-react';
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import BlurredText from "../components/ui/BlurredText";
import MatchNotesDialog from "../components/matches/MatchNotesDialog";
import MatchReasonsPopover from "../components/matches/MatchReasonsPopover";
import AgentFeedbackDialog from "../components/matches/AgentFeedbackDialog";
import PipedriveHistoryDialog from "../components/matches/PipedriveHistoryDialog";
import AgentThinkingLog from "../components/matches/AgentThinkingLog";
import AgentFocusDialog from "../components/matches/AgentFocusDialog";
import CandidateResumeDialog from "../components/matches/CandidateResumeDialog";
import MatchesLoadingToast from "../components/matches/MatchesLoadingToast";
import MatchJustificationDialog from "../components/matches/MatchJustificationDialog";
import SendTaskEmailDialog from "../components/matches/SendTaskEmailDialog";
import SendMatchWhatsappDialog from "../components/matches/SendMatchWhatsappDialog";
import CandidateCommunicationHistory from "../components/candidates/CandidateCommunicationHistory";
import ClientCommunicationHistory from "../components/clients/ClientCommunicationHistory";
import UnifiedSendDialog from "../components/matches/UnifiedSendDialog";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import InterviewQuestionsDialog from "../components/candidates/InterviewQuestionsDialog";
import CreateTaskDialog from "../components/tasks/CreateTaskDialog";
import CandidateTasksDialog from "../components/tasks/CandidateTasksDialog";
import CandidateForm from "../components/candidates/CandidateFormDialog";
import UnifiedTableView from "../components/matches/UnifiedTableView";
import CandidateTimelineDialog from "../components/candidates/CandidateTimelineDialog";
import HandledFilterButtons from "../components/matches/HandledFilterButtons";
import AgentFiltersBar from "../components/matches/AgentFiltersBar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function GcPage() {
  const queryClient = useQueryClient();
  const [matches, setMatches] = useState([]);

  const candidateMatchCountMap = useMemo(() => {
    const map = {};
    matches.forEach(m => {
      if (m.candidate_id) {
        map[m.candidate_id] = (map[m.candidate_id] || 0) + 1;
      }
    });
    return map;
  }, [matches]);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedJobs, setExpandedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('gc_expanded_jobs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  const [notesDialog, setNotesDialog] = useState({ isOpen: false, match: null });
  const [agentFeedbackDialog, setAgentFeedbackDialog] = useState({ isOpen: false, match: null });
  const [addingToRotem, setAddingToRotem] = useState(null);
  const [pipedriveHistoryDialog, setPipedriveHistoryDialog] = useState({ isOpen: false, candidate: null });
  const [settingFocus, setSettingFocus] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [agentStatus, setAgentStatus] = useState(null);
  const [runningAgent, setRunningAgent] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [focusDialog, setFocusDialog] = useState(false);
  const [resumeDialog, setResumeDialog] = useState({ isOpen: false, candidate: null });
  const [revalidating, setRevalidating] = useState(false);
  const [revalidatingSingle, setRevalidatingSingle] = useState(null);
  const [matchScoreFilter, setMatchScoreFilter] = useState(() => localStorage.getItem('gc_matchScoreFilter') || "80+");
  const [priorityFilter, setPriorityFilter] = useState(() => localStorage.getItem('gc_priorityFilter') || "all");
  const [showAllMatches, setShowAllMatches] = useState(() => localStorage.getItem('gc_showAllMatches') === 'true');
  const [showFullMatchOnly, setShowFullMatchOnly] = useState(() => localStorage.getItem('gc_showFullMatchOnly') === 'true');
  const [showBestFitOnly, setShowBestFitOnly] = useState(() => localStorage.getItem('gc_showBestFitOnly') === 'true');
  const [showRecentCvsOnly, setShowRecentCvsOnly] = useState(() => localStorage.getItem('gc_showRecentCvsOnly') === 'true');
  const [handledFilter, setHandledFilter] = useState(() => localStorage.getItem('gc_handledFilter') || "all");
  const [showWithTasksOnly, setShowWithTasksOnly] = useState(false);

  useEffect(() => { localStorage.setItem('gc_matchScoreFilter', matchScoreFilter); }, [matchScoreFilter]);
  useEffect(() => { localStorage.setItem('gc_priorityFilter', priorityFilter); }, [priorityFilter]);
  useEffect(() => { localStorage.setItem('gc_handledFilter', handledFilter); }, [handledFilter]);
  useEffect(() => { localStorage.setItem('gc_showFullMatchOnly', showFullMatchOnly); }, [showFullMatchOnly]);
  useEffect(() => { localStorage.setItem('gc_showBestFitOnly', showBestFitOnly); }, [showBestFitOnly]);
  useEffect(() => { localStorage.setItem('gc_showRecentCvsOnly', showRecentCvsOnly); }, [showRecentCvsOnly]);
  useEffect(() => { localStorage.setItem('gc_showAllMatches', showAllMatches); }, [showAllMatches]);

  const [justificationDialog, setJustificationDialog] = useState({ isOpen: false, match: null });
  const [communicationHistoryDialog, setCommunicationHistoryDialog] = useState({ isOpen: false, match: null });
  const [clientCommunicationDialog, setClientCommunicationDialog] = useState({ isOpen: false, match: null });
  const [candidateJobsDialog, setCandidateJobsDialog] = useState({ isOpen: false, candidate: null, matches: [], loading: false });
  const [unifiedSendDialog, setUnifiedSendDialog] = useState({ isOpen: false, match: null });
  const [activeTab, setActiveTab] = useState("outbox");
  const [notes, setNotes] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [clientCommunications, setClientCommunications] = useState([]);
  const [rotemTasks, setRotemTasks] = useState([]);
  const [totalMatchesCount, setTotalMatchesCount] = useState(0);
  const [interviewDialogState, setInterviewDialogState] = useState({ isOpen: false, candidate: null });
  const [createTaskDialog, setCreateTaskDialog] = useState({ isOpen: false, candidate: null, match: null });
  const [candidateTasksDialog, setCandidateTasksDialog] = useState({ isOpen: false, candidate: null });
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('gc_viewMode') || "table");

  useEffect(() => { localStorage.setItem('gc_viewMode', viewMode); }, [viewMode]);
  const [timelineDialog, setTimelineDialog] = useState({ open: false, candidate: null });

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (!currentUser.can_view_matches) {
        setLoading(false);
        return;
      }

      const [matchList, jobList, candidateList] = await Promise.all([
        base44.entities.Match.filter({ user_name: 'GC (סוכן AI)' }, '-created_date'),
        base44.entities.Job.list(),
        base44.entities.Candidate.list('-created_date', 500)
      ]);

      setTotalMatchesCount(matchList.length);

      // Load secondary data in background
      Promise.all([
        base44.entities.MatchNote.list(),
        base44.entities.WhatsappMessage.list(),
        base44.entities.EmailLog.list(),
        base44.entities.EmailOutbox.list(),
        base44.entities.RotemTask.list('-created_date', 500)
      ]).then(([notesList, whatsappList, emailList, emailOutboxList, tasksList]) => {
        setNotes(notesList);
        setCommunications([...whatsappList, ...emailList]);
        setClientCommunications(emailOutboxList);
        setRotemTasks(tasksList);
      }).catch(e => console.warn('Secondary data load error:', e));

      if (showAllMatches) {
        setMatches(matchList);
      } else {
        const candidateStatusMap = new Map(candidateList.map(c => [c.id, c.status]));
        const gcJobIds = new Set(
          jobList
            .filter(job => job.assigned_agent === 'gc')
            .map(job => job.id)
        );
        
        const filteredMatchList = matchList.filter(m => {
          const candidateStatus = candidateStatusMap.get(m.candidate_id);
          if (candidateStatus === "לא רלוונטי יותר" || candidateStatus === "לא מתאים - נסגר") {
            return false;
          }
          if (!gcJobIds.has(m.job_id)) {
            return false;
          }
          return true;
        });
        
        setMatches(filteredMatchList);
      }
      setJobs(jobList);
      setCandidates(candidateList);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const loadAgentStatus = async () => {
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'gc' });
      if (statuses.length > 0) {
        const status = statuses[0];
        if (status.focused_job_id && status.focus_end_time && !status.is_running) {
          await base44.entities.AgentRunStatus.update(status.id, {
            focused_job_id: null,
            focused_job_title: null,
            focus_start_time: null,
            focus_end_time: null,
            focus_matches_found: 0
          });
          const updatedStatuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'gc' });
          if (updatedStatuses.length > 0) {
            setAgentStatus(updatedStatuses[0]);
          }
        } else {
          setAgentStatus(status);
        }
      }
    } catch (error) {
      console.error("Error loading agent status:", error);
    }
  };

  const carmitAssignedJobs = useMemo(() => {
    return jobs.filter(j => j.status === 'פעילה' && j.assigned_agent === 'gc');
  }, [jobs]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      await runGcAgent({});
      toast.success('GC התחיל לרוץ');
      setTimeout(() => {
        loadAgentStatus();
      }, 2000);
    } catch (error) {
      console.error('Error running gc agent:', error);
      toast.error(`שגיאה בהפעלת הסוכן: ${error.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleSetFocus = async (job) => {
    setSettingFocus(true);
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'gc' });
      const focusData = {
        focused_job_id: job.id,
        focused_job_title: job.title,
        focus_start_time: new Date().toISOString(),
        focus_matches_found: 0
      };
      
      if (statuses.length > 0) {
        await base44.entities.AgentRunStatus.update(statuses[0].id, focusData);
      } else {
        await base44.entities.AgentRunStatus.create({
          agent_name: 'gc',
          ...focusData
        });
      }
      
      toast.success(`GC ממוקד על: ${job.title}`);
      setFocusDialog(false);
      loadAgentStatus();
    } catch (error) {
      console.error('Error setting focus:', error);
      toast.error('שגיאה בהגדרת מיקוד');
    }
    setSettingFocus(false);
  };

  const handleCancelFocus = async () => {
    setSettingFocus(true);
    try {
      if (agentStatus) {
        await base44.entities.AgentRunStatus.update(agentStatus.id, {
          focused_job_id: null,
          focused_job_title: null,
          focus_start_time: null,
          focus_matches_found: 0
        });
        toast.success("המיקוד של GC בוטל");
        loadAgentStatus();
      }
    } catch (error) {
      console.error("Error canceling focus:", error);
      toast.error("שגיאה בביטול המיקוד");
    }
    setSettingFocus(false);
  };

  const handleRevalidateMatches = async () => {
    if (!confirm('לבדוק מחדש את ההתאמות הקיימות של GC? התהליך יעדכן תיאורים וימחק התאמות שכבר לא מתאימות (10 התאמות בכל לחיצה)')) {
      return;
    }

    setRevalidating(true);
    try {
      const response = await base44.functions.invoke('revalidateAgentMatches', { 
        agent_name: 'gc',
        limit: 10
      });
      
      toast.success(`${response.message}\nעודכנו: ${response.updated}, נמחקו: ${response.deleted}`);
      loadData();
    } catch (error) {
      console.error('Error revalidating matches:', error);
      toast.error('שגיאה בבדיקה מחדש של ההתאמות');
    } finally {
      setRevalidating(false);
    }
  };

  const handleRevalidateSingle = async (match) => {
    setRevalidatingSingle(match.id);
    try {
      const response = await base44.functions.invoke('revalidateSingleMatch', { 
        match_id: match.id
      });
      
      if (response.data.action === 'deleted') {
        setMatches(prev => prev.filter(m => m.id !== match.id));
        toast.success(`ההתאמה נמחקה - ${response.data.message}`);
      } else if (response.data.action === 'updated') {
        await loadData();
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error('Error revalidating single match:', error);
      toast.error('שגיאה בבדיקה מחדש');
    } finally {
      setRevalidatingSingle(null);
    }
  };

  useEffect(() => {
    loadData();
    loadAgentStatus();
  }, []);

  useEffect(() => {
    if (!user?.can_view_matches) return;
    
    const unsubscribeJob = base44.entities.Job.subscribe((event) => {
      setJobs(prev => {
        if (event.type === 'update') {
          return prev.map(j => j.id === event.id ? event.data : j);
        } else if (event.type === 'create') {
          return [event.data, ...prev];
        } else if (event.type === 'delete') {
          return prev.filter(j => j.id !== event.id);
        }
        return prev;
      });
    });
    
    const unsubscribeCandidate = base44.entities.Candidate.subscribe((event) => {
      if (event.type === 'update') {
        setCandidates(prev => prev.map(c => 
          c.id === event.id ? event.data : c
        ));
        if (event.data.status === 'לא רלוונטי יותר' || event.data.status === 'לא מתאים - נסגר') {
          setMatches(prev => prev.filter(m => m.candidate_id !== event.id));
        }
      }
    });
    
    return () => {
      unsubscribeJob();
      unsubscribeCandidate();
    };
  }, [user?.can_view_matches]);

  const handleDelete = async (matchId) => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך למחוק את ההתאמה? לא ניתן לשחזר פעולה זו.",
      onConfirm: async () => {
        try {
          setMatches(prev => prev.filter(m => m.id !== matchId));
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
          await base44.entities.Match.delete(matchId);
        } catch (error) {
          console.error("Error deleting match:", error);
          toast.error("שגיאה במחיקת ההתאמה");
          loadData();
        }
      }
    });
  };

  const handleAddToRotem = async (match) => {
    setAddingToRotem(match.id);
    try {
      const candidate = candidates.find(c => c.id === match.candidate_id);
      
      await base44.entities.RotemTask.create({
        job_id: match.job_id,
        job_title: match.job_title,
        candidate_id: match.candidate_id,
        candidate_name: match.candidate_name,
        candidate_phone: candidate?.phone_primary || '',
        status: "לא החל",
        source: "gc"
      });
      
      toast.success(`נוספה משימה לרותם: ${match.candidate_name} ← ${match.job_title}`);
    } catch (error) {
      console.error("Error adding to Rotem:", error);
      toast.error("שגיאה בהוספת המשימה לרותם");
    }
    setAddingToRotem(null);
  };

  const handleOpenPipedriveHistory = (candidateId) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      setPipedriveHistoryDialog({ isOpen: true, candidate });
    }
  };

  const handleShowCandidateJobs = async (match) => {
    const candidate = getCandidateDetails(match.candidate_id);
    if (!candidate) return;
    
    setCandidateJobsDialog({ 
      isOpen: true, 
      candidate, 
      matches: null,
      loading: true
    });

    try {
      const allMatches = await base44.entities.Match.filter({ 
        candidate_id: candidate.id,
        match_score: { $gte: 80 }
      }, '-match_score', 50);
      
      const jobsMap = new Map(jobs.map(j => [j.id, j]));
      
      const matchesWithJobDetails = allMatches
        .map(m => ({
          ...m,
          job_code: jobsMap.get(m.job_id)?.job_code,
          job_title: m.job_title || jobsMap.get(m.job_id)?.title,
          client_name: jobsMap.get(m.job_id)?.client_name
        }))
        .filter(m => m.job_code || m.job_title)
        .sort((a, b) => b.match_score - a.match_score);
      
      setCandidateJobsDialog(prev => ({ 
        ...prev, 
        matches: matchesWithJobDetails,
        loading: false
      }));
    } catch (error) {
      console.error('Error loading candidate jobs:', error);
      setCandidateJobsDialog(prev => ({ 
        ...prev, 
        matches: [],
        loading: false
      }));
    }
  };

  const handleMarkCandidateIrrelevant = async (match) => {
    setConfirmDialog({
      isOpen: true,
      title: "סימון מועמד כלא מתאים",
      message: `האם לסמן את ${match.candidate_name} כ"לא מתאים - נסגר"? המועמד יוסר לחלוטין מכל ההתאמות העתידיות במערכת - לא רק אצל GC אלא אצל כל הסוכנים (נעמה, רמי, אליק, איתי, ליאור, אופיר, דגנית).`,
      confirmText: "סמן כלא מתאים",
      variant: "destructive",
      onConfirm: async () => {
        try {
          localStorage.setItem('gc_viewMode', viewMode);
          localStorage.setItem('gc_expanded_jobs', JSON.stringify(expandedJobs));
          
          await base44.entities.Candidate.update(match.candidate_id, {
            status: "לא מתאים - נסגר"
          });
          
          setCandidates(prev => prev.map(c => 
            c.id === match.candidate_id ? {...c, status: "לא מתאים - נסגר"} : c
          ));
          
          setMatches(prev => prev.filter(m => m.candidate_id !== match.candidate_id));
          
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" });
          
          toast.success(`${match.candidate_name} סומן כלא מתאים והוסר לחלוטין מכל ההתאמות במערכת`);
          
          base44.entities.MatchNote.create({
            match_id: match.id,
            user_id: user.id,
            user_name: user.full_name || user.email,
            note_text: `המועמד סומן כ"לא מתאים - נסגר" על ידי GC ולא יופיע בהתאמות עתידיות של כל הסוכנים`,
            is_system_note: true
          }).catch(e => console.error("Error creating note:", e));
        } catch (error) {
          console.error("Error marking candidate as irrelevant:", error);
          toast.error("שגיאה בסימון המועמד");
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" });
        }
      }
    });
  };

  const candidatesMap = useMemo(() => {
    const map = new Map();
    candidates.forEach(c => map.set(c.id, c));
    return map;
  }, [candidates]);

  const jobsMap = useMemo(() => {
    const map = new Map();
    jobs.forEach(j => map.set(j.id, j));
    return map;
  }, [jobs]);

  const betterMatchByMatchId = useMemo(() => {
    const result = new Map();
    const agentNames = {
      'naama': 'נעמה', 'alik': 'אליק', 'itay': 'איתי', 'lior': 'ליאור',
      'ofir': 'אופיר', 'gc': 'GC', 'rami': 'רמי', 'dganit': 'דגנית'
    };
    matches.forEach(match => {
      const betterMatches = matches.filter(m =>
        m.candidate_id === match.candidate_id &&
        m.id !== match.id &&
        m.job_id !== match.job_id &&
        (m.match_score || 0) > (match.match_score || 0)
      );
      if (betterMatches.length > 0) {
        const best = betterMatches.reduce((a, b) => (a.match_score || 0) > (b.match_score || 0) ? a : b);
        const job = jobsMap.get(best.job_id);
        result.set(match.id, {
          job_title: best.job_title || job?.title || '',
          job_code: job?.job_code || best.job_id,
          agent_name: agentNames[best.user_name?.split(' ')[0]?.toLowerCase()] || best.user_name || '',
          match_score: best.match_score
        });
      }
    });
    return result;
  }, [matches, jobsMap]);

  const notesCountByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => {
      map.set(note.match_id, (map.get(note.match_id) || 0) + 1);
    });
    return map;
  }, [notes]);

  const tasksCountByMatch = useMemo(() => {
    const map = new Map();
    rotemTasks.forEach(task => {
      if (task.match_id) {
        map.set(task.match_id, (map.get(task.match_id) || 0) + 1);
      }
    });
    return map;
  }, [rotemTasks]);

  const userNotesCountByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => {
      if (!note.is_system_note) {
        map.set(note.match_id, (map.get(note.match_id) || 0) + 1);
      }
    });
    return map;
  }, [notes]);

  const agentConversationByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => {
      if (!note.is_system_note && note.note_text?.includes('💬 משוב לסוכן')) {
        map.set(note.match_id, true);
      }
    });
    return map;
  }, [notes]);

  const communicationsCountByCandidate = useMemo(() => {
    const map = new Map();
    communications.forEach(comm => {
      const candidateId = comm.candidate_id;
      if (candidateId) {
        map.set(candidateId, (map.get(candidateId) || 0) + 1);
      }
    });
    return map;
  }, [communications]);

  const clientCommunicationsCountByJob = useMemo(() => {
    const map = new Map();
    if (clientCommunications.length === 0 || jobs.length === 0) return map;
    const titleToJobId = new Map();
    jobs.forEach(job => { if (job.title) titleToJobId.set(job.title, job.id); });
    clientCommunications.forEach(comm => {
      const text = (comm.message_content || '') + ' ' + (comm.subject || '');
      titleToJobId.forEach((jobId, title) => {
        if (text.includes(title)) map.set(jobId, (map.get(jobId) || 0) + 1);
      });
    });
    return map;
  }, [clientCommunications, jobs]);

  // Pre-compute best match per candidate O(n) instead of O(n²)
  const bestMatchIdByCandidate = useMemo(() => {
    const map = new Map();
    matches.forEach(match => {
      const existing = map.get(match.candidate_id);
      if (!existing || (match.match_score || 0) > (existing.score || 0)) {
        map.set(match.candidate_id, { id: match.id, score: match.match_score || 0 });
      }
    });
    return map;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    return matches.filter(match => {
      if (!showAllMatches) {
        const candidate = candidatesMap.get(match.candidate_id);
        if (candidate?.status === "לא רלוונטי יותר" || candidate?.status === "לא מתאים - נסגר") {
          return false;
        }
        if (match.is_rejected_feedback) {
          return false;
        }
      }

      const matchesSearch = !searchTerm ||
        match.candidate_name.toLowerCase().includes(searchLower) ||
        match.job_title?.toLowerCase().includes(searchLower);

      let scoreMatches = true;
      if (matchScoreFilter === "90+") scoreMatches = match.match_score >= 90;
      else if (matchScoreFilter === "80+") scoreMatches = match.match_score >= 80;
      else if (matchScoreFilter === "70+") scoreMatches = match.match_score >= 70;
      else if (matchScoreFilter === "50+") scoreMatches = match.match_score >= 50;

      let priorityMatches = true;
      if (priorityFilter === "high") {
        const job = jobsMap.get(match.job_id);
        priorityMatches = job?.recruitment_priority === "עדיפות גיוס 1";
      }

      let fullMatchFilter = true;
      if (showFullMatchOnly) {
        try {
          const analysisData = match.detailed_analysis 
            ? (typeof match.detailed_analysis === 'string' ? JSON.parse(match.detailed_analysis) : match.detailed_analysis)
            : null;
          const isFullMatch = analysisData && 
            Array.isArray(analysisData) && 
            analysisData.length > 0 &&
            analysisData.every(item => item.is_match === 'true' || item.is_match === true);
          fullMatchFilter = isFullMatch;
        } catch (e) {
          fullMatchFilter = false;
        }
      }

      let bestFitFilter = true;
      if (showBestFitOnly) {
        bestFitFilter = bestMatchIdByCandidate.get(match.candidate_id)?.id === match.id;
      }

      let recentCvFilter = true;
      if (showRecentCvsOnly) {
        const candidate = candidatesMap.get(match.candidate_id);
        const cvDate = candidate?.cv_received_date || candidate?.source_email_date;
        if (cvDate) {
          const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
          recentCvFilter = new Date(cvDate) >= tenDaysAgo;
        } else {
          recentCvFilter = false;
        }
      }

      let handledMatches = true;
      if (handledFilter === "handled") {
        handledMatches = match.is_manually_handled === true;
      } else if (handledFilter === "unhandled") {
        handledMatches = !match.is_manually_handled;
      }

      let withTasksFilter = true;
      if (showWithTasksOnly) {
        const hasTask = (tasksCountByMatch?.get?.(match.id) || 0) > 0 ||
          rotemTasks.some(t => t.candidate_id === match.candidate_id);
        withTasksFilter = hasTask;
      }

      return matchesSearch && scoreMatches && priorityMatches && fullMatchFilter && bestFitFilter && recentCvFilter && handledMatches && withTasksFilter;
    });
  }, [matches, candidatesMap, searchTerm, matchScoreFilter, priorityFilter, jobsMap, showAllMatches, showFullMatchOnly, showBestFitOnly, showRecentCvsOnly, showWithTasksOnly, tasksCountByMatch, rotemTasks]);

  const getJobDetails = (jobId) => {
    return jobsMap.get(jobId) || null;
  };

  const getCandidateDetails = (candidateId) => {
    return candidatesMap.get(candidateId) || null;
  };

  const matchesByJob = useMemo(() => {
    const grouped = {};
    const carmitJobIds = new Set(carmitAssignedJobs.map(j => j.id));
    
    carmitAssignedJobs.forEach(job => {
      grouped[job.id] = {
        job_id: job.id,
        job_title: job.title,
        job_code: job.job_code,
        client_name: job.client_name,
        location: job.location,
        matches: []
      };
    });
    
    filteredMatches.forEach(match => {
      const jobKey = match.job_id;
      if (jobKey && carmitJobIds.has(jobKey)) {
        grouped[jobKey].matches.push(match);
      }
    });
    
    let sorted = Object.values(grouped).sort((a, b) => b.matches.length - a.matches.length);
    
    if (agentStatus?.focused_job_id) {
      const focusedJobId = agentStatus.focused_job_id;
      const focusedIndex = sorted.findIndex(g => g.job_id === focusedJobId);
      if (focusedIndex > 0) {
        const focusedJob = sorted.splice(focusedIndex, 1)[0];
        sorted.unshift(focusedJob);
      }
    }
    
    return sorted.slice(0, displayLimit);
  }, [filteredMatches, jobsMap, displayLimit, agentStatus, carmitAssignedJobs]);

  const toggleJobExpand = (jobId) => {
    setExpandedJobs(prev => {
      const newState = {
        ...prev,
        [jobId]: !prev[jobId]
      };
      localStorage.setItem('gc_expanded_jobs', JSON.stringify(newState));
      return newState;
    });
  };

  if (loading || !user) {
    return <LoadingSpinner message="טוען דף GC..." />;
  }

  if (!user || !user.can_view_matches) {
    return <Navigate to={createPageUrl("Dashboard")} />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <MatchesLoadingToast isLoading={loading} agentName="GC" />
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">GC - סוכן כללי</h1>
          <p className="text-xs md:text-base text-gray-600">Garbage Collector - מטפל במשרות שלא סווגו לסוכן מקצועי</p>
        </div>
      </div>

      {/* Agent Thinking Log */}
      <AgentThinkingLog 
        agentName="gc"
        agentDisplayName="GC"
        agentColor="gray"
      />

      <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face" 
                alt="GC" 
                className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 md:border-4 border-gray-300 shadow-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap text-base md:text-lg">
                  <span className="truncate">GC - כללי</span>
                  <Badge className="bg-gray-100 text-gray-800 text-xs whitespace-nowrap">
                    {carmitAssignedJobs.length} משרות
                  </Badge>
                </CardTitle>
                <p className="text-xs md:text-sm text-gray-600">
                  התאמות למשרות כלליות
                </p>
                
                {agentStatus?.focused_job_id && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="bg-gray-600 text-white">
                      <Target className="w-3 h-3 ml-1" />
                      ממוקד ב: {agentStatus.focused_job_title}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {agentStatus.focus_matches_found || 0} מועמדים נמצאו
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelFocus}
                      disabled={settingFocus}
                      className="h-6 text-xs text-red-600 hover:text-red-700"
                    >
                      בטל מיקוד
                    </Button>
                  </div>
                )}
                
                <div className="mt-2 flex gap-1 md:gap-3 flex-wrap">
                  {(() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    const gcMatches = matches.filter(m => m.match_score >= 80);
                    const todayCount = gcMatches.filter(m => new Date(m.created_date) >= todayStart).length;
                    const weekCount = gcMatches.filter(m => new Date(m.created_date) >= weekAgo).length;
                    const monthCount = gcMatches.filter(m => new Date(m.created_date) >= monthAgo).length;
                    return (
                      <>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <TrendingUp className="w-2 h-2 md:w-3 md:h-3 ml-1" />
                          <span className="hidden sm:inline">היום:</span> {todayCount}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          <Activity className="w-2 h-2 md:w-3 md:h-3 ml-1" />
                          <span className="hidden sm:inline">שבוע:</span> {weekCount}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                          <Calendar className="w-2 h-2 md:w-3 md:h-3 ml-1" />
                          <span className="hidden sm:inline">חודש:</span> {monthCount}
                        </Badge>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <Button
              onClick={handleRunAgent}
              disabled={runningAgent || agentStatus?.is_running}
              className="bg-gray-600 hover:bg-gray-700 gap-2"
              size="sm"
            >
              {runningAgent || agentStatus?.is_running ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              הפעל את GC
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Button Navigation */}
      <div className="flex gap-2 mb-6">
        <Button 
          onClick={() => setActiveTab("inbox")}
          className={`flex items-center gap-2 px-4 py-2 ${
            activeTab === "inbox" 
              ? 'bg-purple-600 text-white hover:bg-purple-700' 
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          <Inbox className="w-4 h-4" />
          דואר נכנס
        </Button>
        <Button 
          onClick={() => setActiveTab("outbox")}
          className={`flex items-center gap-2 px-4 py-2 ${
            activeTab === "outbox" 
              ? 'bg-gray-600 text-white hover:bg-gray-700' 
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          <Send className="w-4 h-4" />
          דואר יוצא
        </Button>
      </div>

      {/* Inbox Tab */}
      {activeTab === "inbox" && (
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Briefcase 
                  className={carmitAssignedJobs.length > 0 ? "w-6 h-6 text-purple-600" : "w-6 h-6 text-gray-400"} 
                  strokeWidth={carmitAssignedJobs.length > 0 ? 2.5 : 1.5}
                />
                <img 
                  src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=48&h=48&fit=crop&crop=face" 
                  alt="כרמית" 
                  className="w-12 h-12 rounded-full object-cover border-3 border-purple-300"
                />
                <div>
                  <span className="text-lg">כרמית הקצתה ל-GC</span>
                  <p className="text-sm text-gray-600 font-normal">משרות כלליות/לא מסווגות לטיפול</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {carmitAssignedJobs.length > 0 ? (
                <div className="space-y-2">
                  {carmitAssignedJobs.map(job => {
                    const isFocused = agentStatus?.is_running && agentStatus?.focused_job_id === job.id;
                    return (
                      <div 
                        key={job.id}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isFocused 
                            ? 'bg-gray-100 border-gray-400 shadow-md' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Briefcase className={`w-4 h-4 ${isFocused ? 'text-gray-600' : 'text-gray-500'}`} />
                              <span className="font-semibold text-gray-900">{job.title}</span>
                              {isFocused && (
                                <Badge className="bg-gray-600 text-white animate-pulse">
                                  <Target className="w-3 h-3 ml-1" />
                                  עובד כרגע
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 mr-6">
                              {job.job_code && <span>#{job.job_code}</span>}
                              {job.assigned_agent_name && <span className="mr-3">🎯 {job.assigned_agent_name}</span>}
                              {job.client_name && <span className="mr-3">🏢 {job.client_name}</span>}
                              {job.contact_person && <span className="mr-3">👤 {job.contact_person}</span>}
                              {job.location && <span className="mr-3">📍 {job.location}</span>}
                              <span className="mr-3">📅 {new Date(job.created_date).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  כרמית טרם הקצתה משרות ל-GC
                </p>
              )}
            </CardContent>
          </Card>
      )}

      {/* Outbox Tab */}
      {activeTab === "outbox" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <AgentFiltersBar
            agentColor="gray"
            agentName="GC"
            isRunning={runningAgent || agentStatus?.is_running}
            onRun={handleRunAgent}
            
            matchScoreFilter={matchScoreFilter}
            onMatchScoreChange={setMatchScoreFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            handledFilter={handledFilter}
            onHandledChange={setHandledFilter}
            showFullMatchOnly={showFullMatchOnly}
            onToggleFullMatch={() => setShowFullMatchOnly(!showFullMatchOnly)}
            showBestFitOnly={showBestFitOnly}
            onToggleBestFit={() => setShowBestFitOnly(!showBestFitOnly)}
            showRecentCvsOnly={showRecentCvsOnly}
            onToggleRecentCvs={() => setShowRecentCvsOnly(!showRecentCvsOnly)}
            showAllMatches={showAllMatches}
            onToggleShowAll={() => setShowAllMatches(!showAllMatches)}
            
            filteredCount={filteredMatches.length}
            totalCount={totalMatchesCount}
            
            onRefresh={loadData}
            onRevalidate={handleRevalidateMatches}
            isRevalidating={revalidating}
            
            showRecentCvsFilter={true}
            showFocusButton={true}
            onFocus={() => setFocusDialog(true)}
            isFocused={!!agentStatus?.focused_job_id}
            onCancelFocus={handleCancelFocus}
            showWithTasksOnly={showWithTasksOnly}
            onToggleWithTasks={() => setShowWithTasksOnly(!showWithTasksOnly)}
          />

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grouped" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className={`flex items-center gap-2 ${viewMode === "grouped" ? 'bg-gray-600 hover:bg-gray-700' : ''}`}
            >
              <Rows3 className="w-4 h-4" />
              חלוקה למשרות
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 ${viewMode === "table" ? 'bg-gray-600 hover:bg-gray-700' : ''}`}
            >
              <LayoutList className="w-4 h-4" />
              תצוגת טבלה
            </Button>
          </div>

          {filteredMatches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">אין התאמות להצגה</p>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        <UnifiedTableView
          matches={filteredMatches}
          jobs={jobs}
          candidates={candidates}
          agentColor="gray"
          notesCountByMatch={notesCountByMatch}
          communicationsCountByCandidate={communicationsCountByCandidate}
          clientCommunicationsCountByJob={clientCommunicationsCountByJob}
          candidateMatchCountMap={candidateMatchCountMap}
          betterMatchByMatchId={betterMatchByMatchId}
          revalidatingSingle={revalidatingSingle}
          tasksCountByMatch={tasksCountByMatch}
          userNotesCountByMatch={userNotesCountByMatch}
          agentConversationByMatch={agentConversationByMatch}
          user={user}
          onUnifiedSend={(match) => setUnifiedSendDialog({ isOpen: true, match })}
          onCommunicationHistory={(match) => setCommunicationHistoryDialog({ isOpen: true, match })}
          onClientCommunication={(match) => setClientCommunicationDialog({ isOpen: true, match })}
          onInterviewQuestions={(match) => {
            const candidate = getCandidateDetails(match.candidate_id);
            if (candidate) setInterviewDialogState({ isOpen: true, candidate });
          }}
          onAgentFeedback={(match) => setAgentFeedbackDialog({ isOpen: true, match })}
          onRevalidate={handleRevalidateSingle}
          onJustification={(match) => setJustificationDialog({ isOpen: true, match })}
          onNotes={(match) => setNotesDialog({ isOpen: true, match })}
          onCreateTask={(match) => {
            const cand = getCandidateDetails(match.candidate_id);
            if (cand) setCreateTaskDialog({ isOpen: true, candidate: cand, match });
          }}
          onCandidateTasks={(match) => {
            const cand = getCandidateDetails(match.candidate_id);
            if (cand) setCandidateTasksDialog({ isOpen: true, candidate: cand });
          }}
          onShowCandidateJobs={handleShowCandidateJobs}
          onEditCandidate={async (match) => {
            try {
              const candidateData = await base44.entities.Candidate.filter({ id: match.candidate_id });
              if (candidateData && candidateData.length > 0) {
                setEditingCandidate(candidateData[0]);
                setShowCandidateForm(true);
              }
            } catch (error) {
              console.error('Error loading candidate:', error);
            }
          }}
          onMarkIrrelevant={handleMarkCandidateIrrelevant}
          onDelete={handleDelete}
          onOpenResume={(candidate) => setResumeDialog({ isOpen: true, candidate })}
          onRefreshData={loadData}
        />
      ) : (
        <>
          {matchesByJob.map(jobGroup => {
            const isExpanded = expandedJobs[jobGroup.job_id] === true;

            return (
              <Card key={jobGroup.job_id} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleJobExpand(jobGroup.job_id)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Briefcase className="w-5 h-5 text-gray-600" />
                          <div className="text-right">
                            <CardTitle className="text-lg flex items-center gap-2">
                            {jobGroup.job_id && jobGroup.job_id !== 'no-job' && (() => {
                               const jobDetails = getJobDetails(jobGroup.job_id);
                               if (jobDetails?.description || jobDetails?.requirements) {
                                 return (
                                   <Popover>
                                     <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                       <button className="text-gray-700 hover:text-gray-900 underline decoration-dotted font-semibold text-right">
                                         {jobGroup.job_title}
                                       </button>
                                     </PopoverTrigger>
                                     <PopoverContent className="w-96 max-h-80 overflow-y-auto" align="start">
                                       <div className="space-y-3">
                                         <h4 className="font-semibold text-gray-900">{jobDetails.title}</h4>
                                         {jobDetails.description && (
                                           <div>
                                             <p className="text-xs font-medium text-gray-500 mb-1">תיאור המשרה:</p>
                                             <p className="text-sm text-gray-700 whitespace-pre-wrap">{jobDetails.description}</p>
                                           </div>
                                         )}
                                         {jobDetails.requirements && (
                                           <div>
                                             <p className="text-xs font-medium text-gray-500 mb-1">דרישות:</p>
                                             <p className="text-sm text-gray-700 whitespace-pre-wrap">{jobDetails.requirements}</p>
                                           </div>
                                         )}
                                       </div>
                                     </PopoverContent>
                                   </Popover>
                                 );
                               }
                               return <span>{jobGroup.job_title}</span>;
                             })() || <span>{jobGroup.job_title}</span>}
                            {agentStatus?.is_running && agentStatus?.focused_job_id === jobGroup.job_id && (
                              <Badge className="bg-gray-600 text-white animate-pulse">
                                <Activity className="w-3 h-3 ml-1" />
                                עובד כרגע
                              </Badge>
                            )}
                            </CardTitle>
                            <div className="text-sm text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
                              {jobGroup.job_code && <span>#{jobGroup.job_code}</span>}
                              {(() => {
                                const jobDetails = getJobDetails(jobGroup.job_id);
                                if (jobDetails?.security_clearance === 'רמה 1') {
                                  return <Badge className="bg-red-600 text-white font-bold text-xs">רמה 1</Badge>;
                                }
                                return null;
                              })()}
                              {(() => {
                                const jobDetails = getJobDetails(jobGroup.job_id);
                                if (jobDetails?.assigned_agent_name) {
                                  return <span>🎯 {jobDetails.assigned_agent_name}</span>;
                                }
                                return null;
                              })()}
                              {(() => {
                                const jobDetails = getJobDetails(jobGroup.job_id);
                                const priorityColors = {
                                  "עדיפות גיוס 1": "bg-red-100 text-red-800 border-red-300",
                                  "עדיפות גיוס 2": "bg-yellow-100 text-yellow-800 border-yellow-300",
                                  "עדיפות גיוס 3": "bg-orange-100 text-orange-800 border-orange-300",
                                  "עדיפות גיוס 4": "bg-green-100 text-green-800 border-green-300",
                                  "עדיפות גיוס 5": "bg-gray-100 text-gray-700 border-gray-300"
                                };
                                return jobDetails?.recruitment_priority ? (
                                  <Badge className={`${priorityColors[jobDetails.recruitment_priority]} font-bold text-xs border-2 ml-2`}>
                                    {jobDetails.recruitment_priority}
                                  </Badge>
                                ) : null;
                              })()}
                              {jobGroup.client_name && <span className="ml-3">🏢 <BlurredText>{jobGroup.client_name}</BlurredText></span>}
                              {(() => {
                                const jobDetails = getJobDetails(jobGroup.job_id);
                                return jobDetails?.contact_person ? <span className="ml-3">👤 <BlurredText>{jobDetails.contact_person}</BlurredText></span> : null;
                              })()}
                              {jobGroup.location && <span className="ml-3">📍 {jobGroup.location}</span>}
                              {(() => {
                                const jobDetails = getJobDetails(jobGroup.job_id);
                                return jobDetails?.created_date ? <span className="ml-3">📅 {new Date(jobDetails.created_date).toLocaleDateString('he-IL')}</span> : null;
                              })()}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <Badge className="bg-gray-100 text-gray-800">
                                {jobGroup.matches.length} מועמדים
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      {jobGroup.matches.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p>GC עדיין לא עבד על משרה זו</p>
                          <p className="text-xs text-gray-400 mt-1">המשרה הוקצתה על ידי כרמית וממתינה לעיבוד</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">מועמד</TableHead>
                            <TableHead className="min-w-[100px]">התאמה</TableHead>
                            <TableHead className="hidden md:table-cell min-w-[120px]">תאריכים</TableHead>
                            <TableHead className="min-w-[200px]">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                          <TableBody>
                            {jobGroup.matches.map(match => {
                            const isHandled = (
                              (tasksCountByMatch?.get?.(match.id) || 0) > 0 ||
                              (userNotesCountByMatch?.get?.(match.id) || 0) > 0 ||
                              agentConversationByMatch?.get?.(match.id) === true
                            );
                            return (
                              <TableRow key={match.id} className={isHandled ? 'bg-green-50 border-r-2 border-r-green-400' : !match.is_read ? 'bg-gray-50' : ''}>
                                <TableCell className="font-medium">
                                  {(() => {
                                    const candidateDetails = getCandidateDetails(match.candidate_id);
                                    return (
                                      <div className="flex items-start gap-2">
                                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                          <UserCheck className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <div>
                                         <div className="flex items-center gap-2">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (candidateDetails) {
                                                setResumeDialog({ isOpen: true, candidate: candidateDetails });
                                              } else {
                                                toast.error('טוען פרטי מועמד...');
                                                try {
                                                  const fullCandidate = await base44.entities.Candidate.filter({ id: match.candidate_id });
                                                  if (fullCandidate && fullCandidate.length > 0) {
                                                    setResumeDialog({ isOpen: true, candidate: fullCandidate[0] });
                                                  } else {
                                                    toast.error('לא נמצאו פרטי מועמד');
                                                  }
                                                } catch (error) {
                                                  console.error('Error loading candidate:', error);
                                                  toast.error('שגיאה בטעינת פרטי מועמד');
                                                }
                                              }
                                            }}
                                            className="text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer"
                                            title="לחץ לצפייה בקורות חיים"
                                          >
                                            <BlurredText>{match.candidate_name}</BlurredText>
                                          </button>
                                         </div>
                                          {candidateDetails?.skills_summary && (
                                            <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate" title={candidateDetails.skills_summary}>
                                              {candidateDetails.skills_summary.length > 80 
                                                ? candidateDetails.skills_summary.substring(0, 80) + '...' 
                                                : candidateDetails.skills_summary}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <MatchReasonsPopover 
                                    matchScore={match.match_score} 
                                    matchReasons={match.match_reasons}
                                    detailedAnalysis={match.detailed_analysis}
                                    betterMatch={betterMatchByMatchId.get(match.id)}
                                  />
                                </TableCell>
                                <TableCell className="text-xs hidden md:table-cell">
                                  {(() => {
                                    const candidateDetails = getCandidateDetails(match.candidate_id);
                                    const cvDate = candidateDetails?.cv_received_date || candidateDetails?.source_email_date;
                                    return (
                                      <div className="space-y-1">
                                        <div className="text-gray-600">
                                          <span className="font-medium">קו"ח: </span>
                                          {cvDate ? (
                                            <>
                                              {new Date(cvDate).toLocaleDateString('he-IL')}
                                              <span className="text-gray-400 mr-2 ml-1">
                                                {new Date(cvDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            </>
                                          ) : '-'}
                                        </div>
                                        <div className="text-gray-500">
                                          <span className="font-medium">התאמה: </span>
                                          {new Date(match.created_date).toLocaleDateString('he-IL')}
                                          <span className="text-gray-400 mr-2 ml-1">
                                            {new Date(match.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>
                                 <DropdownMenu>
                                   <DropdownMenuTrigger asChild>
                                     <Button variant="ghost" size="icon" className="h-8 w-8">
                                       <MoreHorizontal className="w-4 h-4" />
                                     </Button>
                                   </DropdownMenuTrigger>
                                   <DropdownMenuContent className="w-52">
                                      <DropdownMenuItem onClick={() => { const c = getCandidateDetails(match.candidate_id); setTimelineDialog({ open: true, candidate: c || { id: match.candidate_id, full_name: match.candidate_name } }); }}>
                                        <ClipboardList className="w-4 h-4 text-blue-700 shrink-0 ml-2" />
                                        ציר זמן מועמד
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setUnifiedSendDialog({ isOpen: true, match })}>
                                        <Send className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                                        שלח הודעה
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setCommunicationHistoryDialog({ isOpen: true, match })}>
                                        <MessageCircle className={`w-4 h-4 shrink-0 ml-2 ${communicationsCountByCandidate.get(match.candidate_id) > 0 ? 'text-purple-600' : 'text-purple-400'}`} />
                                        הסטוריית מועמד
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setClientCommunicationDialog({ isOpen: true, match })}>
                                        <Building className={`w-4 h-4 shrink-0 ml-2 ${clientCommunicationsCountByJob.get(match.job_id) > 0 ? 'text-blue-600' : 'text-blue-400'}`} />
                                        הסטוריית לקוח
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        const candidate = getCandidateDetails(match.candidate_id);
                                        if (candidate) {
                                          setInterviewDialogState({ isOpen: true, candidate });
                                        }
                                      }}>
                                        <BrainCircuit className="w-4 h-4 text-purple-600 shrink-0 ml-2" />
                                        שאלות לראיון
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setAgentFeedbackDialog({ isOpen: true, match })}>
                                        <Bot className="w-4 h-4 shrink-0 ml-2 text-gray-600" />
                                        שיחה עם GC
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleRevalidateSingle(match)} disabled={revalidatingSingle === match.id}>
                                        {revalidatingSingle === match.id ? (
                                          <Loader2 className="w-4 h-4 text-blue-600 shrink-0 ml-2 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                                        )}
                                        בדוק מחדש
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setJustificationDialog({ isOpen: true, match })}>
                                        <Lightbulb className="w-4 h-4 text-orange-600 shrink-0 ml-2" />
                                        נמק התאמה
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setNotesDialog({ isOpen: true, match })}>
                                        <MessageSquare className={`w-4 h-4 shrink-0 ml-2 ${notesCountByMatch.get(match.id) > 0 ? 'text-gray-800' : 'text-gray-400'}`} />
                                        הערות {notesCountByMatch.get(match.id) > 0 && `(${notesCountByMatch.get(match.id)})`}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => {
                                        const cand = getCandidateDetails(match.candidate_id);
                                        if (cand) setCreateTaskDialog({ isOpen: true, candidate: cand, match });
                                      }}>
                                        <PlusSquare className="w-4 h-4 shrink-0 ml-2 text-blue-600" />
                                        יצירת משימה
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        const cand = getCandidateDetails(match.candidate_id);
                                        if (cand) setCandidateTasksDialog({ isOpen: true, candidate: cand });
                                      }}>
                                        <ClipboardList className="w-4 h-4 shrink-0 ml-2 text-blue-500" />
                                        משימות
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleShowCandidateJobs(match)}>
                                        <Briefcase className={`w-4 h-4 shrink-0 ml-2 ${(candidateMatchCountMap[match.candidate_id] || 0) > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                                        משרות נוספות {(candidateMatchCountMap[match.candidate_id] || 0) > 0 && `(${candidateMatchCountMap[match.candidate_id]})`}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={async () => {
                                        try {
                                          const candidateData = await base44.entities.Candidate.filter({ id: match.candidate_id });
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
                                      <DropdownMenuItem onClick={() => handleMarkCandidateIrrelevant(match)}>
                                        <UserMinus className="w-4 h-4 text-orange-500 shrink-0 ml-2" />
                                        להסיר מועמד זה מהמערכת
                                      </DropdownMenuItem>
                                      {user?.can_delete_matches && (
                                        <DropdownMenuItem
                                          onClick={() => handleDelete(match.id)}
                                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                        >
                                          <Trash2 className="w-4 h-4 shrink-0 ml-2" />
                                          מחק התאמה
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                 </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                            })}
                          </TableBody>
                          </Table>
                          </div>
                          )}
                          </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
          {(() => {
            const grouped = {};
            filteredMatches.forEach(match => {
              const jobKey = match.job_id || 'no-job';
              if (!grouped[jobKey]) grouped[jobKey] = { matches: [] };
              grouped[jobKey].matches.push(match);
            });
            const totalGroups = Object.keys(grouped).length;
            const hasMore = totalGroups > displayLimit;

            if (hasMore) {
              return (
                <div className="text-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => setDisplayLimit(prev => prev + 10)}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    טען עוד ({totalGroups - displayLimit} משרות נוספות)
                  </Button>
                </div>
              );
            }
            return null;
          })()}
            </>
          )}
          </div>
          )}

      <AgentFeedbackDialog
        isOpen={agentFeedbackDialog.isOpen}
        onClose={() => setAgentFeedbackDialog({ isOpen: false, match: null })}
        match={agentFeedbackDialog.match}
        agentType="gc"
        user={user}
        onMatchRejected={(matchId) => {
          setMatches(prev => prev.map(m => 
            m.id === matchId ? { ...m, is_rejected_feedback: true } : m
          ));
          setAgentFeedbackDialog({ isOpen: false, match: null });
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title || "אישור פעולה"}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText || "אישור"}
        cancelText="ביטול"
        variant={confirmDialog.variant || "default"}
      />

      <MatchNotesDialog
        match={notesDialog.match}
        isOpen={notesDialog.isOpen}
        onClose={() => setNotesDialog({ isOpen: false, match: null })}
      />

      <PipedriveHistoryDialog
        candidate={pipedriveHistoryDialog.candidate}
        isOpen={pipedriveHistoryDialog.isOpen}
        onClose={() => setPipedriveHistoryDialog({ isOpen: false, candidate: null })}
        onHistoryUpdated={() => loadData()}
      />

      <AgentFocusDialog
        isOpen={focusDialog}
        onClose={() => setFocusDialog(false)}
        jobs={carmitAssignedJobs}
        onFocusSet={handleSetFocus}
        isLoading={settingFocus}
        agentName="GC"
        agentColor="gray"
      />

      <CandidateResumeDialog
        isOpen={resumeDialog.isOpen}
        onClose={() => setResumeDialog({ isOpen: false, candidate: null })}
        candidate={resumeDialog.candidate}
      />

      <MatchJustificationDialog
        isOpen={justificationDialog.isOpen}
        onClose={() => setJustificationDialog({ isOpen: false, match: null })}
        match={justificationDialog.match}
        candidate={getCandidateDetails(justificationDialog.match?.candidate_id)}
        job={getJobDetails(justificationDialog.match?.job_id)}
        agentType="gc"
      />

      <UnifiedSendDialog
        isOpen={unifiedSendDialog.isOpen}
        onClose={() => setUnifiedSendDialog({ isOpen: false, match: null })}
        match={unifiedSendDialog.match}
        candidate={getCandidateDetails(unifiedSendDialog.match?.candidate_id)}
        job={getJobDetails(unifiedSendDialog.match?.job_id)}
        agentName="GC"
        onMatchRemoved={(matchId) => {
          setMatches(prev => prev.filter(m => m.id !== matchId));
        }}
      />

      <CandidateCommunicationHistory
        candidateId={communicationHistoryDialog.match?.candidate_id}
        candidateName={communicationHistoryDialog.match?.candidate_name || ''}
        open={communicationHistoryDialog.isOpen}
        onClose={() => setCommunicationHistoryDialog({ isOpen: false, match: null })}
      />

      <ClientCommunicationHistory
        jobId={clientCommunicationDialog.match?.job_id}
        jobTitle={clientCommunicationDialog.match?.job_title || ''}
        open={clientCommunicationDialog.isOpen}
        onClose={() => setClientCommunicationDialog({ isOpen: false, match: null })}
      />

      <InterviewQuestionsDialog
        isOpen={interviewDialogState.isOpen}
        onClose={() => setInterviewDialogState({ isOpen: false, candidate: null })}
        candidate={interviewDialogState.candidate}
      />

      <Dialog open={showCandidateForm} onOpenChange={setShowCandidateForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCandidate ? "עריכת מועמד" : "הוספת מועמד"}</DialogTitle>
          </DialogHeader>
          <CandidateForm
            candidate={editingCandidate}
            onSubmit={() => {
              setShowCandidateForm(false);
              setEditingCandidate(null);
            }}
            onCancel={() => {
              setShowCandidateForm(false);
              setEditingCandidate(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <CreateTaskDialog
        open={createTaskDialog.isOpen}
        onClose={() => setCreateTaskDialog({ isOpen: false, candidate: null, match: null })}
        candidate={createTaskDialog.candidate}
        match={createTaskDialog.match}
        agentName="GC"
      />
      <CandidateTasksDialog
        open={candidateTasksDialog.isOpen}
        onClose={() => setCandidateTasksDialog({ isOpen: false, candidate: null })}
        candidate={candidateTasksDialog.candidate}
      />

      <CandidateTimelineDialog
        open={timelineDialog.open}
        candidate={timelineDialog.candidate}
        onClose={() => setTimelineDialog({ open: false, candidate: null })}
      />

      <Dialog open={candidateJobsDialog.isOpen} onOpenChange={(open) => {
        if (!open) setCandidateJobsDialog({ isOpen: false, candidate: null, matches: [], loading: false });
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>משרות שהמועמד הותאם אליהן - {candidateJobsDialog.candidate?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {candidateJobsDialog.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : candidateJobsDialog.matches && candidateJobsDialog.matches.length > 0 ? (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {candidateJobsDialog.matches.map((match) => (
                  <div key={match.id} className="p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{match.job_title}</span>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">{Math.round(match.match_score)}%</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {match.job_code && <span>קוד: {match.job_code}</span>}
                      {match.client_name && <span className="mr-3">לקוח: {match.client_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">לא נמצאו משרות נוספות</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}