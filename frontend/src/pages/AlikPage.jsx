import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { runAlikAgent } from '@/functions/runAlikAgent';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Cpu,
  Inbox,
  Send,
  Lightbulb,
  Mail,
  BrainCircuit,
  MoreHorizontal,
  BadgeCheck,
  LayoutList,
  Rows3
} from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { UserMinus } from 'lucide-react';
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import MatchNotesDialog from "../components/matches/MatchNotesDialog";
import MatchReasonsPopover from "../components/matches/MatchReasonsPopover";
import AgentFeedbackDialog from "../components/matches/AgentFeedbackDialog";
import PipedriveHistoryDialog from "../components/matches/PipedriveHistoryDialog";
import AgentThinkingLog from "../components/matches/AgentThinkingLog";
import AgentFocusDialog from "../components/matches/AgentFocusDialog";
import CandidateResumeDialog from "../components/matches/CandidateResumeDialog";
import MatchJustificationDialog from "../components/matches/MatchJustificationDialog";
import SendTaskEmailDialog from "../components/matches/SendTaskEmailDialog";
import SendMatchWhatsappDialog from "../components/matches/SendMatchWhatsappDialog";
import UnifiedSendDialog from "../components/matches/UnifiedSendDialog";
import CandidateCommunicationHistory from "../components/candidates/CandidateCommunicationHistory";
import ClientCommunicationHistory from "../components/clients/ClientCommunicationHistory";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import InterviewQuestionsDialog from "../components/candidates/InterviewQuestionsDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CandidateForm from "../components/candidates/CandidateFormDialog";
import CreateTaskDialog from "../components/tasks/CreateTaskDialog";
import CandidateTasksDialog from "../components/tasks/CandidateTasksDialog";
import UnifiedTableView from "../components/matches/UnifiedTableView";
import CandidateTimelineDialog from "../components/candidates/CandidateTimelineDialog";
import { User as UserIcon, PlusSquare, ClipboardList } from 'lucide-react';
import HandledFilterButtons from "../components/matches/HandledFilterButtons";
import AgentFiltersBar from "../components/matches/AgentFiltersBar";

export default function AlikPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedJobs, setExpandedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('alik_expanded_jobs');
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
  const [runningAgent, setRunningAgent] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [focusDialog, setFocusDialog] = useState(false);
  const [resumeDialog, setResumeDialog] = useState({ isOpen: false, candidate: null });
  const [revalidating, setRevalidating] = useState(false);
  const [revalidatingSingle, setRevalidatingSingle] = useState(null);
  const [matchScoreFilter, setMatchScoreFilter] = useState("80+");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [justificationDialog, setJustificationDialog] = useState({ isOpen: false, match: null });
  const [showFullMatchOnly, setShowFullMatchOnly] = useState(false);
  const [showBestFitOnly, setShowBestFitOnly] = useState(false);
  const [showRecentCvsOnly, setShowRecentCvsOnly] = useState(false);
  const [handledFilter, setHandledFilter] = useState("all"); // "all", "handled", "unhandled"
  const [unifiedSendDialog, setUnifiedSendDialog] = useState({ isOpen: false, match: null });
  const [communicationHistoryDialog, setCommunicationHistoryDialog] = useState({ isOpen: false, match: null });
  const [clientCommunicationDialog, setClientCommunicationDialog] = useState({ isOpen: false, match: null });
  const [candidateJobsDialog, setCandidateJobsDialog] = useState({ isOpen: false, candidate: null, matches: [], loading: false });
  const [activeTab, setActiveTab] = useState("outbox");
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [totalMatchesCount, setTotalMatchesCount] = useState(0);
  const [interviewDialogState, setInterviewDialogState] = useState({ isOpen: false, candidate: null });
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [createTaskDialog, setCreateTaskDialog] = useState({ isOpen: false, candidate: null, match: null });
  const [candidateTasksDialog, setCandidateTasksDialog] = useState({ isOpen: false, candidate: null });
  const [viewMode, setViewMode] = useState("table"); // "grouped" or "table"
  const [timelineDialog, setTimelineDialog] = useState({ open: false, candidate: null });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: () => base44.entities.MatchNote.list(),
    enabled: !!user?.can_view_matches,
    staleTime: 30 * 1000
  });

  const { data: communications = [] } = useQuery({
    queryKey: ['communications'],
    queryFn: async () => {
      const [whatsapp, email] = await Promise.all([
        base44.entities.WhatsappMessage.list(),
        base44.entities.EmailLog.list()
      ]);
      return [...whatsapp, ...email];
    },
    enabled: !!user?.can_view_matches,
    staleTime: 60 * 1000
  });

  const { data: clientCommunications = [] } = useQuery({
    queryKey: ['client-communications'],
    queryFn: () => base44.entities.EmailOutbox.list(),
    enabled: !!user?.can_view_matches,
    staleTime: 60 * 1000
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['alik-matches'],
    queryFn: async () => {
      const data = await base44.entities.Match.filter({ user_name: 'אליק (סוכן AI)' }, '-created_date');
      setTotalMatchesCount(data.length);
      return data;
    },
    enabled: !!user?.can_view_matches,
    staleTime: 30 * 1000
  });

  // Count matches per candidate for briefcase visual indicator (filled = has matches)
  const candidateMatchCountMap = useMemo(() => {
    const map = {};
    matches.forEach(m => {
      if (m.candidate_id) {
        map[m.candidate_id] = (map[m.candidate_id] || 0) + 1;
      }
    });
    return map;
  }, [matches]);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: !!user?.can_view_matches,
    staleTime: 2 * 60 * 1000
  });

  // Real-time subscription for job updates
  useEffect(() => {
    if (!user?.can_view_matches) return;
    
    const unsubscribe = base44.entities.Job.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    });
    
    return unsubscribe;
  }, [user?.can_view_matches, queryClient]);

  const { data: candidates = [] } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => base44.entities.Candidate.list('-created_date', 500),
    enabled: !!user?.can_view_matches,
    staleTime: 2 * 60 * 1000
  });

  const { data: agentStatus } = useQuery({
    queryKey: ['agent-status-alik'],
    queryFn: async () => {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'alik' });
      return statuses.length > 0 ? statuses[0] : null;
    },
    enabled: !!user?.can_view_matches,
    refetchInterval: 5000,
    staleTime: 3000
  });

  const carmitAssignedJobs = useMemo(() => {
    // Use Carmit's assignment decision instead of local analysis
    return jobs.filter(j => j.status === 'פעילה' && j.assigned_agent === 'alik');
  }, [jobs]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      await runAlikAgent({});
      toast.success('אליק התחיל לרוץ');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['agent-status-alik'] });
      }, 2000);
    } catch (error) {
      console.error('Error running alik agent:', error);
      toast.error(`שגיאה בהפעלת הסוכן: ${error.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleSetFocus = async (job) => {
    setSettingFocus(true);
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'alik' });
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
          agent_name: 'alik',
          ...focusData
        });
      }
      
      toast.success(`אליק ממוקד על: ${job.title}`);
      setFocusDialog(false);
      queryClient.invalidateQueries({ queryKey: ['agent-status-alik'] });
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
        toast.success("המיקוד של אליק בוטל");
        queryClient.invalidateQueries({ queryKey: ['agent-status-alik'] });
      }
    } catch (error) {
      console.error("Error canceling focus:", error);
      toast.error("שגיאה בביטול המיקוד");
    }
    setSettingFocus(false);
  };

  const handleRevalidateMatches = async () => {
    if (!confirm('לבדוק מחדש את כל ההתאמות הקיימות של אליק? התהליך יעבור על כל ההתאמות, יעדכן תיאורים עם האלגוריתם המתקדם וימחק התאמות שכבר לא מתאימות. זה עשוי לקחת זמן...')) {
      return;
    }

    setRevalidating(true);
    toast.loading('מתחיל בדיקה מחדש של כל ההתאמות...', { id: 'revalidate-all' });
    
    try {
      const response = await base44.functions.invoke('revalidateAllAgentMatches', { 
        agent_name: 'alik'
      });
      
      toast.success(`בדיקה מחדש הושלמה!\nנבדקו: ${response.data.processed}\nעודכנו: ${response.data.updated}\nנמחקו: ${response.data.deleted}`, { id: 'revalidate-all', duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
    } catch (error) {
      console.error('Error revalidating matches:', error);
      toast.error('שגיאה בבדיקה מחדש של ההתאמות', { id: 'revalidate-all' });
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
        queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
        toast.success(`ההתאמה נמחקה - ${response.data.message}`);
      } else if (response.data.action === 'updated') {
        queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error('Error revalidating single match:', error);
      toast.error('שגיאה בבדיקה מחדש');
    } finally {
      setRevalidatingSingle(null);
    }
  };

  const handleDelete = async (matchId) => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך למחוק את ההתאמה? לא ניתן לשחזר פעולה זו.",
      onConfirm: async () => {
        try {
          await base44.entities.Match.delete(matchId);
          queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
        } catch (error) {
          console.error("Error deleting match:", error);
          toast.error("שגיאה במחיקת ההתאמה");
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
        source: "alik"
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
      message: `האם לסמן את ${match.candidate_name} כ"לא מתאים - נסגר"? המועמד יוסר לחלוטין מכל ההתאמות העתידיות במערכת - לא רק אצל אליק אלא אצל כל הסוכנים (נעמה, רועי, רמי, איתי, ליאור, אופיר, GC).`,
      confirmText: "סמן כלא מתאים",
      variant: "destructive",
      onConfirm: async () => {
        try {
          localStorage.setItem('alik_viewMode', viewMode);
          localStorage.setItem('alik_expanded_jobs', JSON.stringify(expandedJobs));
          
          await base44.entities.Candidate.update(match.candidate_id, {
            status: "לא מתאים - נסגר"
          });
          
          queryClient.invalidateQueries({ queryKey: ['candidates'] });
          queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
          
          toast.success(`${match.candidate_name} סומן כלא מתאים והוסר לחלוטין מכל ההתאמות במערכת`);
          
          base44.entities.MatchNote.create({
            match_id: match.id,
            user_id: user.id,
            user_name: user.full_name || user.email,
            note_text: `המועמד סומן כ"לא מתאים - נסגר" על ידי אליק ולא יופיע בהתאמות עתידיות של כל הסוכנים`,
            is_system_note: true
          }).catch(e => console.error("Error creating note:", e));
        } catch (error) {
          console.error("Error marking candidate as irrelevant:", error);
          toast.error("שגיאה בסימון המועמד");
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
    const agentNames = { 'naama': 'נעמה', 'alik': 'אליק', 'itay': 'איתי', 'lior': 'ליאור', 'ofir': 'אופיר', 'gc': 'GC', 'rami': 'רמי', 'dganit': 'דגנית' };
    matches.forEach(match => {
      const betterMatches = matches.filter(m => m.candidate_id === match.candidate_id && m.id !== match.id && m.job_id !== match.job_id && (m.match_score || 0) > (match.match_score || 0));
      if (betterMatches.length > 0) {
        const best = betterMatches.reduce((a, b) => (a.match_score || 0) > (b.match_score || 0) ? a : b);
        const job = jobsMap.get(best.job_id);
        result.set(match.id, { job_title: best.job_title || job?.title || '', job_code: job?.job_code || best.job_id, agent_name: agentNames[best.user_name?.split(' ')[0]?.toLowerCase()] || best.user_name || '', match_score: best.match_score });
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

  const { data: userTasks = [] } = useQuery({
    queryKey: ['user-tasks-alik'],
    queryFn: () => base44.entities.UserTask.list('-created_date', 500),
    enabled: !!user?.can_view_matches,
    staleTime: 60 * 1000
  });

  const tasksCountByMatch = useMemo(() => {
    const map = new Map();
    userTasks.forEach(task => {
      if (task.match_id) {
        map.set(task.match_id, (map.get(task.match_id) || 0) + 1);
      }
    });
    return map;
  }, [userTasks]);

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
        if (candidate?.status === "לא רלוונטי יותר" || candidate?.status === "לא מתאים - נסגר" || match.is_rejected_feedback) {
          return false;
        }
      }

      const matchesSearch = !searchTerm ||
        match.candidate_name.toLowerCase().includes(searchLower) ||
        match.job_title?.toLowerCase().includes(searchLower);

      // Apply match score filter
      let scoreMatches = true;
      if (matchScoreFilter === "90+") scoreMatches = match.match_score >= 90;
      else if (matchScoreFilter === "80+") scoreMatches = match.match_score >= 80;
      else if (matchScoreFilter === "70+") scoreMatches = match.match_score >= 70;
      else if (matchScoreFilter === "50+") scoreMatches = match.match_score >= 50;

      // Apply priority filter
      let priorityMatches = true;
      if (priorityFilter === "high") {
        const job = jobsMap.get(match.job_id);
        priorityMatches = job?.recruitment_priority === "עדיפות גיוס 1";
      }

      // Apply full match filter - only show matches where ALL requirements are met
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

      // Apply best fit filter - O(1) with precomputed map
      let bestFitFilter = true;
      if (showBestFitOnly) {
        const bestEntry = bestMatchIdByCandidate.get(match.candidate_id);
        bestFitFilter = bestEntry?.id === match.id;
      }

      // Apply recent CVs filter
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

      // Apply handled filter
      let handledMatches = true;
      if (handledFilter === "handled") {
        handledMatches = match.is_manually_handled === true;
      } else if (handledFilter === "unhandled") {
        handledMatches = !match.is_manually_handled;
      }

      return matchesSearch && scoreMatches && priorityMatches && fullMatchFilter && bestFitFilter && recentCvFilter && handledMatches;
    });
  }, [matches, candidates, candidatesMap, searchTerm, matchScoreFilter, priorityFilter, jobsMap, showAllMatches, showFullMatchOnly, showBestFitOnly, showRecentCvsOnly]);

  const getJobDetails = (jobId) => {
    return jobsMap.get(jobId) || null;
  };

  const getCandidateDetails = (candidateId) => {
    return candidatesMap.get(candidateId) || null;
  };

  const matchesByJob = useMemo(() => {
    const grouped = {};
    const carmitJobIds = new Set(carmitAssignedJobs.map(j => j.id));
    
    // Start with all Carmit-assigned jobs
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
    
    // Add matches ONLY for jobs assigned to Alik by Carmit
    filteredMatches.forEach(match => {
      const jobKey = match.job_id;
      
      // Only include matches for jobs that are in carmitAssignedJobs
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
      localStorage.setItem('alik_expanded_jobs', JSON.stringify(newState));
      return newState;
    });
  };

  if (matchesLoading || !user) {
    return <LoadingSpinner message="טוען דף אליק..." />;
  }

  if (!user || !user.can_view_matches) {
    return <Navigate to={createPageUrl("Dashboard")} />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">אליק - מומחה אלקטרוניקה</h1>
          <p className="text-xs md:text-base text-gray-600">סוכן AI להתאמות בין מועמדים למשרות אלקטרוניקה</p>
        </div>
      </div>

      {/* Agent Thinking Log */}
      <AgentThinkingLog 
        agentName="alik"
        agentDisplayName="אליק"
        agentColor="teal"
      />

      {/* Tabs for Inbox and Outbox */}
      <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face" 
                alt="אליק" 
                className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 md:border-4 border-teal-200 shadow-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap text-base md:text-lg">
                  <span className="truncate">אליק - אלקטרוניקה</span>
                  <Badge className="bg-teal-100 text-teal-800 text-xs whitespace-nowrap">
                    {carmitAssignedJobs.length} משרות
                  </Badge>
                </CardTitle>
                <p className="text-xs md:text-sm text-gray-600">
                  התאמות למשרות אלקטרוניקה
                </p>
                
                {agentStatus?.focused_job_id && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="bg-teal-600 text-white">
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
                
                {/* Stats for Alik's matches */}
                <div className="mt-2 flex gap-1 md:gap-3 flex-wrap">
                  {(() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    
                    const alikMatches = matches.filter(m => m.match_score >= 90);
                    
                    const todayCount = alikMatches.filter(m => 
                      new Date(m.created_date) >= todayStart
                    ).length;
                    
                    const weekCount = alikMatches.filter(m => 
                      new Date(m.created_date) >= weekAgo
                    ).length;
                    
                    const monthCount = alikMatches.filter(m => 
                      new Date(m.created_date) >= monthAgo
                    ).length;
                    
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
              className="bg-teal-600 hover:bg-teal-700 gap-2"
              size="sm"
            >
              {runningAgent || agentStatus?.is_running ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              הפעל את אליק
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
              ? 'bg-teal-600 text-white hover:bg-teal-700' 
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          <Send className="w-4 h-4" />
          דואר יוצא
        </Button>
      </div>

      {/* Inbox Tab - Carmit's Assignment */}
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
                  <span className="text-lg">כרמית הקצתה לאליק</span>
                  <p className="text-sm text-gray-600 font-normal">משרות אלקטרוניקה לטיפול</p>
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
                            ? 'bg-teal-50 border-teal-400 shadow-md' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Briefcase className={`w-4 h-4 ${isFocused ? 'text-teal-600' : 'text-gray-500'}`} />
                              <span className="font-semibold text-gray-900">{job.title}</span>
                              {isFocused && (
                                <Badge className="bg-teal-600 text-white animate-pulse">
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
                  כרמית טרם הקצתה משרות לאליק
                </p>
              )}
            </CardContent>
          </Card>
      )}

      {/* Outbox Tab - All Matches */}
      {activeTab === "outbox" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <AgentFiltersBar
            agentColor="teal"
            agentName="אליק"
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
            
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
              queryClient.invalidateQueries({ queryKey: ['jobs'] });
              queryClient.invalidateQueries({ queryKey: ['candidates'] });
              queryClient.invalidateQueries({ queryKey: ['agent-status-alik'] });
            }}
            onRevalidate={handleRevalidateMatches}
            isRevalidating={revalidating}
            
            showRecentCvsFilter={true}
            showFocusButton={true}
            onFocus={() => setFocusDialog(true)}
            isFocused={!!agentStatus?.focused_job_id}
            onCancelFocus={handleCancelFocus}
          />

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grouped" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className={`flex items-center gap-2 ${viewMode === "grouped" ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
            >
              <Rows3 className="w-4 h-4" />
              חלוקה למשרות
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 ${viewMode === "table" ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
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
              agentColor="teal"
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
              onRefreshData={() => queryClient.invalidateQueries({ queryKey: ['alik-matches'] })}
            />
          ) : (
            <>
              {matchesByJob.map(jobGroup => {
            const isExpanded = expandedJobs[jobGroup.job_id] === true;
            const autoMatches = jobGroup.matches.filter(m => m.is_automatic_recommendation);

            return (
              <Card key={jobGroup.job_id} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleJobExpand(jobGroup.job_id)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Briefcase className="w-5 h-5 text-teal-600" />
                          <div className="text-right">
                            <CardTitle className="text-lg flex items-center gap-2">
                            {jobGroup.job_id && jobGroup.job_id !== 'no-job' && (() => {
                               const jobDetails = getJobDetails(jobGroup.job_id);
                               if (jobDetails?.description || jobDetails?.requirements) {
                                 return (
                                   <Popover>
                                     <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                       <button className="text-teal-700 hover:text-teal-900 underline decoration-dotted font-semibold text-right">
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
                              <Badge className="bg-teal-600 text-white animate-pulse">
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
                              {jobGroup.client_name && <span className="ml-3">🏢 {jobGroup.client_name}</span>}
                              {(() => {
                                const jobDetails = getJobDetails(jobGroup.job_id);
                                return jobDetails?.contact_person ? <span className="ml-3">👤 {jobDetails.contact_person}</span> : null;
                              })()}
                              {jobGroup.location && <span className="ml-3">📍 {jobGroup.location}</span>}
                              {(() => {
                                const jobDetails = getJobDetails(jobGroup.job_id);
                                return jobDetails?.created_date ? <span className="ml-3">📅 {new Date(jobDetails.created_date).toLocaleDateString('he-IL')}</span> : null;
                              })()}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <Badge className="bg-teal-100 text-teal-800">
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
                          <p>אליק עדיין לא עבד על משרה זו</p>
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
                              <TableRow key={match.id} className={isHandled ? 'bg-green-50 border-r-2 border-r-green-400' : !match.is_read ? 'bg-teal-50' : ''}>
                                <TableCell className="font-medium">
                                  {(() => {
                                    const candidateDetails = getCandidateDetails(match.candidate_id);
                                    return (
                                      <div className="flex items-start gap-2">
                                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                          <UserCheck className="w-4 h-4 text-teal-600" />
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
                                              {match.candidate_name}
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
                                              <span className="text-gray-400 mr-1">
                                                {new Date(cvDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            </>
                                          ) : '-'}
                                        </div>
                                        <div className="text-gray-500">
                                          <span className="font-medium">התאמה: </span>
                                          {new Date(match.created_date).toLocaleDateString('he-IL')}
                                          <span className="text-gray-400 mr-1">
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
                                        <Bot className="w-4 h-4 text-teal-600 shrink-0 ml-2" />
                                        שיחה עם אליק
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

      {/* Agent Feedback Dialog */}
      <AgentFeedbackDialog
        isOpen={agentFeedbackDialog.isOpen}
        onClose={() => setAgentFeedbackDialog({ isOpen: false, match: null })}
        match={agentFeedbackDialog.match}
        agentType="alik"
        user={user}
        onMatchRejected={(matchId) => {
          queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
          setAgentFeedbackDialog({ isOpen: false, match: null });
        }}
      />

      {/* Confirm Dialog */}
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

      {/* Notes Dialog */}
      <MatchNotesDialog
        match={notesDialog.match}
        isOpen={notesDialog.isOpen}
        onClose={() => setNotesDialog({ isOpen: false, match: null })}
      />

      {/* Pipedrive History Dialog */}
      <PipedriveHistoryDialog
        candidate={pipedriveHistoryDialog.candidate}
        isOpen={pipedriveHistoryDialog.isOpen}
        onClose={() => setPipedriveHistoryDialog({ isOpen: false, candidate: null })}
        onHistoryUpdated={() => queryClient.invalidateQueries({ queryKey: ['candidates'] })}
      />

      <AgentFocusDialog
        isOpen={focusDialog}
        onClose={() => setFocusDialog(false)}
        jobs={carmitAssignedJobs}
        onFocusSet={handleSetFocus}
        isLoading={settingFocus}
        agentName="אליק"
        agentColor="teal"
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
        agentType="alik"
      />

      <UnifiedSendDialog
        isOpen={unifiedSendDialog.isOpen}
        onClose={() => setUnifiedSendDialog({ isOpen: false, match: null })}
        match={unifiedSendDialog.match}
        candidate={getCandidateDetails(unifiedSendDialog.match?.candidate_id)}
        job={getJobDetails(unifiedSendDialog.match?.job_id)}
        agentName="אליק"
        onMatchRemoved={(matchId) => {
          queryClient.invalidateQueries({ queryKey: ['alik-matches'] });
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

      {/* Candidate Jobs Dialog */}
      <CreateTaskDialog
        open={createTaskDialog.isOpen}
        onClose={() => setCreateTaskDialog({ isOpen: false, candidate: null, match: null })}
        candidate={createTaskDialog.candidate}
        match={createTaskDialog.match}
        agentName="אליק"
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{match.job_title}</span>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {Math.round(match.match_score)}%
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {match.job_code && <span>קוד: {match.job_code}</span>}
                          {match.client_name && <span className="mr-3">לקוח: {match.client_name}</span>}
                        </div>
                      </div>
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