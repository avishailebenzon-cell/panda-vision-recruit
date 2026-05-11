import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { runRamiAgent } from "@/functions/runRamiAgent";
import { fetchPipedriveNotesForCandidate } from "@/functions/fetchPipedriveNotesForCandidate";
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
    Search, Trash2, MessageSquare, MessageCircle, Building,
    FileText, Circle, Send, ChevronDown, ChevronUp, Bot,
    Play, Loader2, RefreshCw, Database, UserCheck, Briefcase, Info, UserMinus,
    TrendingUp, Activity, Calendar, Lightbulb, Mail, BrainCircuit, MoreHorizontal,
    ClipboardList, PlusSquare, BadgeCheck, Target
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Settings, UserMinus as UserMinusIcon } from 'lucide-react';
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import BlurredText from "../components/ui/BlurredText";
import MatchNotesDialog from "../components/matches/MatchNotesDialog";
import SendMatchMessageDialog from "../components/matches/SendMatchMessageDialog";
import MatchReasonsPopover from "../components/matches/MatchReasonsPopover";
import AgentFeedbackDialog from "../components/matches/AgentFeedbackDialog";
import PipedriveHistoryDialog from "../components/matches/PipedriveHistoryDialog";
import CandidateResumeDialog from "../components/matches/CandidateResumeDialog";
import MatchJustificationDialog from "../components/matches/MatchJustificationDialog";
import SendTaskEmailDialog from "../components/matches/SendTaskEmailDialog";
import SendMatchWhatsappDialog from "../components/matches/SendMatchWhatsappDialog";
import UnifiedSendDialog from "../components/matches/UnifiedSendDialog";
import CandidateCommunicationHistory from "../components/candidates/CandidateCommunicationHistory";
import ClientCommunicationHistory from "../components/clients/ClientCommunicationHistory";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import InterviewQuestionsDialog from "../components/candidates/InterviewQuestionsDialog";
import CreateTaskDialog from "../components/tasks/CreateTaskDialog";
import CandidateTasksDialog from "../components/tasks/CandidateTasksDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import UnifiedTableView from "../components/matches/UnifiedTableView";
import HandledFilterButtons from "../components/matches/HandledFilterButtons";
import AgentFiltersBar from "../components/matches/AgentFiltersBar";
import { Rows3, LayoutList, User as UserIcon } from 'lucide-react';
import CandidateTimelineDialog from "../components/candidates/CandidateTimelineDialog";
import CandidateForm from "../components/candidates/CandidateFormDialog";

export default function RamiPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedJobs, setExpandedJobs] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  const [notesDialog, setNotesDialog] = useState({ isOpen: false, match: null });
  
  const [showSendClientMessageDialog, setShowSendClientMessageDialog] = useState(false);
  const [selectedMatchForMessage, setSelectedMatchForMessage] = useState(null);
  
  const [agentFeedbackDialog, setAgentFeedbackDialog] = useState({ isOpen: false, match: null, agentType: null });
  const [addingToRotem, setAddingToRotem] = useState(null);
  const [pipedriveHistoryDialog, setPipedriveHistoryDialog] = useState({ isOpen: false, candidate: null });
  const [resumeDialog, setResumeDialog] = useState({ isOpen: false, candidate: null });

  const queryClient = useQueryClient();
  const [runningAgent, setRunningAgent] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [revalidatingSingle, setRevalidatingSingle] = useState(null);
  const [revalidating, setRevalidating] = useState(false);
  const [matchScoreFilter, setMatchScoreFilter] = useState("80+");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showFullMatchOnly, setShowFullMatchOnly] = useState(false);
  const [showBestFitOnly, setShowBestFitOnly] = useState(false);
  const [justificationDialog, setJustificationDialog] = useState({ isOpen: false, match: null });
  const [unifiedSendDialog, setUnifiedSendDialog] = useState({ isOpen: false, match: null });
  const [communicationHistoryDialog, setCommunicationHistoryDialog] = useState({ isOpen: false, match: null });
  const [clientCommunicationDialog, setClientCommunicationDialog] = useState({ isOpen: false, match: null });
  const [candidateJobsDialog, setCandidateJobsDialog] = useState({ isOpen: false, candidate: null, matches: [], loading: false });
  const [activeTab, setActiveTab] = useState("outbox");
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [totalMatchesCount, setTotalMatchesCount] = useState(0);
  const [interviewDialogState, setInterviewDialogState] = useState({ isOpen: false, candidate: null });
  const [createTaskDialog, setCreateTaskDialog] = useState({ isOpen: false, candidate: null, match: null });
  const [candidateTasksDialog, setCandidateTasksDialog] = useState({ isOpen: false, candidate: null });
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" or "table"
  const [handledFilter, setHandledFilter] = useState("all"); // "all", "handled", "unhandled"
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [timelineDialog, setTimelineDialog] = useState({ open: false, candidate: null });

  // Fetch user - חייב להיות ראשון כי כל שאר ה-queries תלויים בו
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
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

  // Fetch matches with caching
  const { data: matches = [], isLoading: loadingMatches, refetch: refetchMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const data = await base44.entities.Match.filter({ user_name: 'רמי (סוכן AI)' });
      setTotalMatchesCount(data.length);
      return data;
    },
    enabled: !!user?.can_view_matches,
    staleTime: 30 * 1000,
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

  // Fetch jobs with caching
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: !!user?.can_view_matches,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch candidates with caching
  const { data: candidates = [] } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => base44.entities.Candidate.list('-created_date', 500),
    enabled: !!user?.can_view_matches,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch statuses
  const { data: candidateStatuses = [], isLoading: loadingStatuses } = useQuery({
    queryKey: ['candidateStatuses'],
    queryFn: () => base44.entities.CandidateStatus.list('status_number'),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch agent status
  const { data: agentStatus, refetch: refetchAgentStatus } = useQuery({
    queryKey: ['agentStatus', 'rami'],
    queryFn: async () => {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'rami' });
      return statuses[0] || null;
    },
    enabled: !!user,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      await runRamiAgent({});
      toast.success('הסוכן רמי התחיל לרוץ');
      setTimeout(() => {
        refetchAgentStatus();
      }, 2000);
    } catch (error) {
      console.error('Error running rami agent:', error);
      toast.error(`שגיאה בהפעלת הסוכן: ${error.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const loading = loadingMatches || loadingStatuses;

  const getStatusInfo = (statusNumber) => {
    const status = candidateStatuses.find(s => s.status_number === statusNumber);
    return status || {
      status_name: 'לא ידוע',
      color: '#6B7280',
      icon: 'Circle'
    };
  };

  const handleDelete = async (matchId) => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך למחוק את ההתאמה? לא ניתן לשחזר פעולה זו.",
      onConfirm: async () => {
        try {
          await base44.entities.Match.delete(matchId);
          queryClient.invalidateQueries(['matches']);
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
          toast.success("ההתאמה נמחקה בהצלחה");
        } catch (error) {
          console.error("Error deleting match:", error);
          toast.error("שגיאה במחיקת ההתאמה");
        }
      }
    });
  };

  const handleSendClientMessage = (match) => {
    setSelectedMatchForMessage(match);
    setShowSendClientMessageDialog(true);
  };

  const handleSendSuccess = () => {
    setShowSendClientMessageDialog(false);
    setSelectedMatchForMessage(null);
  };

  const handleAddToRotem = async (match, source) => {
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
        source: source
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
      message: `האם לסמן את ${match.candidate_name} כ"לא מתאים - נסגר"? המועמד יוסר לחלוטין מכל ההתאמות העתידיות במערכת - לא רק אצל רמי אלא אצל כל הסוכנים (נעמה, רועי, אליק, איתי, ליאור, אופיר, GC).`,
      confirmText: "סמן כלא מתאים",
      variant: "destructive",
      onConfirm: async () => {
        try {
          // Update candidate status to "לא מתאים - נסגר" in DB
          await base44.entities.Candidate.update(match.candidate_id, {
            status: "לא מתאים - נסגר"
          });
          
          // Refresh queries
          queryClient.invalidateQueries(['matches']);
          queryClient.invalidateQueries(['candidates']);
          
          toast.success(`${match.candidate_name} סומן כלא מתאים והוסר לחלוטין מכל ההתאמות במערכת`);
          
          // Create system note
          base44.entities.MatchNote.create({
            match_id: match.id,
            user_id: user.id,
            user_name: user.full_name || user.email,
            note_text: `המועמד סומן כ"לא מתאים - נסגר" על ידי רמי ולא יופיע בהתאמות עתידיות של כל הסוכנים`,
            is_system_note: true
          }).catch(e => console.error("Error creating note:", e));
        } catch (error) {
          console.error("Error marking candidate as irrelevant:", error);
          toast.error("שגיאה בסימון המועמד");
        }
      }
    });
  };

  const handleRevalidateSingle = async (match) => {
    setRevalidatingSingle(match.id);
    try {
      const response = await base44.functions.invoke('revalidateSingleMatch', { 
        match_id: match.id
      });
      
      if (response.data.action === 'deleted') {
        queryClient.invalidateQueries(['matches']);
        toast.success(`ההתאמה נמחקה - ${response.data.message}`);
      } else if (response.data.action === 'updated') {
        queryClient.invalidateQueries(['matches']);
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error('Error revalidating single match:', error);
      toast.error('שגיאה בבדיקה מחדש');
    } finally {
      setRevalidatingSingle(null);
    }
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

  const getJobDetails = useCallback((jobId) => {
    return jobsMap.get(jobId) || null;
  }, [jobsMap]);

  const getCandidateDetails = useCallback((candidateId) => {
    return candidatesMap.get(candidateId) || null;
  }, [candidatesMap]);

  const filteredMatches = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    return matches.filter(match => {
      if (match.user_name !== 'רמי (סוכן AI)') return false;
      
      if (!showAllMatches) {
        const candidate = candidatesMap.get(match.candidate_id);
        if (candidate?.status === "לא רלוונטי יותר" || candidate?.status === "לא מתאים - נסגר" || match.is_rejected_feedback) {
          return false;
        }
      }

      const matchesSearch = !searchTerm ||
        match.candidate_name.toLowerCase().includes(searchLower) ||
        match.job_title?.toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === "all" || match.status === statusFilter;

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

      // Apply full match filter
      let fullMatchFilter = true;
      if (showFullMatchOnly) {
        try {
          const analysisData = match.detailed_analysis 
            ? (typeof match.detailed_analysis === 'string' ? JSON.parse(match.detailed_analysis) : match.detailed_analysis)
            : null;
          const isFullMatch = analysisData && Array.isArray(analysisData) && analysisData.length > 0 &&
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

      // Apply handled filter
      let handledMatches = true;
      if (handledFilter === "handled") {
        handledMatches = match.is_manually_handled === true;
      } else if (handledFilter === "unhandled") {
        handledMatches = !match.is_manually_handled;
      }

      return matchesSearch && matchesStatus && scoreMatches && priorityMatches && fullMatchFilter && bestFitFilter && handledMatches;
    });
  }, [matches, candidatesMap, searchTerm, statusFilter, matchScoreFilter, priorityFilter, jobsMap, showAllMatches, showFullMatchOnly, showBestFitOnly]);

  const ramiByJob = useMemo(() => {
    const grouped = {};
    filteredMatches.forEach(match => {
      const jobKey = match.job_id || 'no-job';
      if (!grouped[jobKey]) {
        const jobDetails = jobsMap.get(match.job_id);
        grouped[jobKey] = {
          job_id: match.job_id,
          job_title: match.job_title,
          job_code: jobDetails?.job_code,
          client_name: jobDetails?.client_name,
          location: jobDetails?.location,
          requirements: jobDetails?.requirements,
          matches: []
        };
      }
      grouped[jobKey].matches.push(match);
    });
    
    const sorted = Object.values(grouped).sort((a, b) => b.matches.length - a.matches.length);
    return sorted.slice(0, displayLimit);
  }, [filteredMatches, jobsMap, displayLimit]);

  const totalJobGroups = useMemo(() => {
    const grouped = {};
    filteredMatches.forEach(match => {
      const jobKey = match.job_id || 'no-job';
      if (!grouped[jobKey]) grouped[jobKey] = true;
    });
    return Object.keys(grouped).length;
  }, [filteredMatches]);

  const toggleJobExpand = (jobId) => {
    setExpandedJobs(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };

  if (loading || loadingStatuses) {
    return <LoadingSpinner message="טוען דף רמי..." />;
  }

  if (!user || !user.can_view_matches) {
    return <Navigate to={createPageUrl("Dashboard")} />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">רמי - מומחה רמה 1</h1>
          <p className="text-xs md:text-base text-gray-600">התאמות ברמת הסיווג הגבוהה ביותר - רמה 1 בלבד</p>
        </div>
      </div>

      {/* Status Card */}
      <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-3">
                <Circle className="w-5 h-5 text-red-600" />
                <span>סטטוס הסוכן</span>
              </CardTitle>
              <div className="text-sm text-gray-600 mt-1">
                {agentStatus?.is_running ? (
                  <span className="text-red-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    רץ כרגע...
                  </span>
                ) : agentStatus?.last_run_end ? (
                  <span>ריצה אחרונה: {new Date(agentStatus.last_run_end).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                ) : (
                  <span>לא רץ עדיין</span>
                )}
              </div>
              
              {/* Stats for Rami's matches */}
              <div className="mt-3 flex gap-3">
                {(() => {
                  const now = new Date();
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  
                  const ramiMatches = matches.filter(m => {
                    const userName = m.user_name || '';
                    const score = m.match_score || 0;
                    return userName.includes('רמי') && score >= 90;
                  });
                  
                  const todayCount = ramiMatches.filter(m => {
                    try {
                      return m.created_date && new Date(m.created_date) >= todayStart;
                    } catch { return false; }
                  }).length;
                  
                  const weekCount = ramiMatches.filter(m => {
                    try {
                      return m.created_date && new Date(m.created_date) >= weekAgo;
                    } catch { return false; }
                  }).length;
                  
                  const monthCount = ramiMatches.filter(m => {
                    try {
                      return m.created_date && new Date(m.created_date) >= monthAgo;
                    } catch { return false; }
                  }).length;
                  
                  return (
                    <>
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        <TrendingUp className="w-3 h-3 ml-1" />
                        היום: {todayCount}
                      </Badge>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        <Activity className="w-3 h-3 ml-1" />
                        שבוע: {weekCount}
                      </Badge>
                      <Badge className="bg-purple-100 text-purple-800 text-xs">
                        <Calendar className="w-3 h-3 ml-1" />
                        חודש: {monthCount}
                      </Badge>
                    </>
                  );
                })()}
              </div>
            </div>
            <Badge className="bg-red-100 text-red-800">
              {filteredMatches.length} התאמות
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Button Navigation */}
      <div className="flex gap-2 mb-6">
        <Button 
          onClick={() => setActiveTab("outbox")}
          className={`flex items-center gap-2 px-4 py-2 ${
            activeTab === "outbox" 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          <Send className="w-4 h-4" />
          דואר יוצא
        </Button>
      </div>

      {/* Outbox Tab */}
      {activeTab === "outbox" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <AgentFiltersBar
            agentColor="red"
            agentName="רמי"
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
            showAllMatches={showAllMatches}
            onToggleShowAll={() => setShowAllMatches(!showAllMatches)}
            
            filteredCount={filteredMatches.length}
            totalCount={totalMatchesCount}
            
            onRefresh={() => {
              queryClient.invalidateQueries(['matches']);
              queryClient.invalidateQueries(['jobs']);
              queryClient.invalidateQueries(['candidates']);
              queryClient.invalidateQueries(['agentStatus']);
            }}
            onRevalidate={async () => {
              if (!confirm('לבדוק מחדש את כל ההתאמות של רמי? (10 התאמות בכל לחיצה)')) return;
              setRevalidating(true);
              try {
                const response = await base44.functions.invoke('revalidateAgentMatches', { agent_name: 'rami', limit: 10 });
                toast.success(`${response.message || 'הושלם'}\nעודכנו: ${response.updated || 0}, נמחקו: ${response.deleted || 0}`);
                queryClient.invalidateQueries(['matches']);
              } catch (error) {
                toast.error('שגיאה בבדיקה מחדש');
              } finally {
                setRevalidating(false);
              }
            }}
            isRevalidating={revalidating}
          />

      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={viewMode === "grouped" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("grouped")}
          className={`flex items-center gap-2 ${viewMode === "grouped" ? 'bg-red-600 hover:bg-red-700' : ''}`}
        >
          <Rows3 className="w-4 h-4" />
          חלוקה למשרות
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
          className={`flex items-center gap-2 ${viewMode === "table" ? 'bg-red-600 hover:bg-red-700' : ''}`}
        >
          <LayoutList className="w-4 h-4" />
          תצוגת טבלה
        </Button>
      </div>

      {/* Matches */}
      <div className="space-y-4">
        {filteredMatches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Circle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">אין התאמות של רמי עדיין</p>
              <p className="text-xs text-gray-400 mt-2">רמי מחפש התאמות בין מועמדי רמה 1 למשרות רמה 1</p>
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <UnifiedTableView
            matches={filteredMatches}
            jobs={jobs}
            candidates={candidates}
            agentColor="red"
            notesCountByMatch={notesCountByMatch}
            communicationsCountByCandidate={communicationsCountByCandidate}
            clientCommunicationsCountByJob={clientCommunicationsCountByJob}
            candidateMatchCountMap={candidateMatchCountMap}
            betterMatchByMatchId={betterMatchByMatchId}
            revalidatingSingle={revalidatingSingle}
            user={user}
            onUnifiedSend={(match) => setUnifiedSendDialog({ isOpen: true, match })}
            onCommunicationHistory={(match) => setCommunicationHistoryDialog({ isOpen: true, match })}
            onClientCommunication={(match) => setClientCommunicationDialog({ isOpen: true, match })}
            onInterviewQuestions={(match) => {
              const candidate = getCandidateDetails(match.candidate_id);
              if (candidate) setInterviewDialogState({ isOpen: true, candidate });
            }}
            onAgentFeedback={(match) => setAgentFeedbackDialog({ isOpen: true, match, agentType: 'rami' })}
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
          />
        ) : (
          <>
          {ramiByJob.map(jobGroup => {
            const isExpanded = expandedJobs[jobGroup.job_id] === true;
            
            return (
              <Card key={jobGroup.job_id} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleJobExpand(jobGroup.job_id)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="bg-red-50/50 hover:bg-red-100/50 transition-colors cursor-pointer">
                     <div className="flex items-center justify-between">
                       <div className="flex-1 text-right">
                         <CardTitle className="text-base md:text-lg flex items-center gap-1 md:gap-2 flex-wrap">
                           <Circle className="w-4 h-4 md:w-5 md:h-5 text-red-600 flex-shrink-0" />
                           {(() => {
                             const jobDetails = getJobDetails(jobGroup.job_id);
                             if (jobDetails?.description || jobDetails?.requirements) {
                               return (
                                 <Popover>
                                   <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                     <button className="text-red-700 hover:text-red-900 underline decoration-dotted font-semibold text-right truncate">
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
                             return <span className="truncate">{jobGroup.job_title}</span>;
                           })()}
                           {agentStatus?.is_running && agentStatus?.focused_job_id === jobGroup.job_id && (
                            <Badge className="bg-red-600 text-white animate-pulse text-xs">
                              <Activity className="w-2 h-2 md:w-3 md:h-3 ml-1" />
                              עובד
                            </Badge>
                          )}
                          <Badge className="bg-red-100 text-red-800 text-xs">רמה 1</Badge>
                           <Badge className="bg-blue-100 text-blue-800 text-xs whitespace-nowrap">
                             {jobGroup.matches.length} מועמדים
                           </Badge>
                         </CardTitle>
                          <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                          {jobGroup.job_code && <div>קוד משרה: {jobGroup.job_code}</div>}
                          {(() => {
                            const jobDetails = getJobDetails(jobGroup.job_id);
                            if (jobDetails?.assigned_agent_name) {
                              return <div>🎯 סיווג: {jobDetails.assigned_agent_name}</div>;
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
                              <div className="flex items-center gap-2">
                                <Badge className={`${priorityColors[jobDetails.recruitment_priority]} font-bold text-xs border-2`}>
                                  {jobDetails.recruitment_priority}
                                </Badge>
                              </div>
                            ) : null;
                          })()}
                          {jobGroup.client_name && <div>🏢 לקוח: <BlurredText>{jobGroup.client_name}</BlurredText></div>}
                          {(() => {
                            const jobDetails = getJobDetails(jobGroup.job_id);
                            return jobDetails?.contact_person ? <div>👤 איש קשר: <BlurredText>{jobDetails.contact_person}</BlurredText></div> : null;
                          })()}
                          {jobGroup.location && <div>📍 מיקום: {jobGroup.location}</div>}
                          {(() => {
                            const jobDetails = getJobDetails(jobGroup.job_id);
                            return jobDetails?.created_date ? <div>📅 נפתח: {new Date(jobDetails.created_date).toLocaleDateString('he-IL')}</div> : null;
                          })()}
                           {jobGroup.requirements && (
                             <div className="text-xs text-gray-500 mt-1">
                               דרישות מרכזיות: {jobGroup.requirements.length > 100 ? jobGroup.requirements.substring(0, 100) + '...' : jobGroup.requirements}
                             </div>
                           )}
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
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">מועמד</TableHead>
                            <TableHead className="min-w-[100px]">התאמה</TableHead>
                            <TableHead className="hidden md:table-cell min-w-[100px]">סטטוס</TableHead>
                            <TableHead className="hidden md:table-cell min-w-[120px]">תאריכים</TableHead>
                            <TableHead className="min-w-[200px]">פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobGroup.matches.map(match => {
                            const statusInfo = getStatusInfo(match.status_number);
                            const candidateDetails = getCandidateDetails(match.candidate_id);

                            return (
                              <TableRow key={match.id} className={!match.is_read ? 'bg-red-50' : ''}>
                                <TableCell className="font-medium">
                                  <div className="flex items-start gap-2">
                                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <UserCheck className="w-4 h-4 text-red-600" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <button
                                         onClick={async (e) => {
                                           e.stopPropagation();
                                           if (candidateDetails) {
                                             setResumeDialog({ isOpen: true, candidate: candidateDetails });
                                           } else {
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
                                        <Badge className="bg-red-500 text-white text-xs">רמה 1</Badge>
                                      </div>
                                      {candidateDetails?.skills_summary && (
                                        <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">
                                          {candidateDetails.skills_summary.substring(0, 60)}...
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <MatchReasonsPopover 
                                    matchScore={match.match_score} 
                                    matchReasons={match.match_reasons}
                                    betterMatch={betterMatchByMatchId.get(match.id)}
                                  />
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge
                                    style={{
                                      backgroundColor: statusInfo.color + '20',
                                      color: statusInfo.color,
                                      borderColor: statusInfo.color
                                    }}
                                    className="border text-xs"
                                  >
                                    {statusInfo.status_name}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs hidden md:table-cell">
                                  {(() => {
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
                                      <DropdownMenuItem onClick={() => setAgentFeedbackDialog({ isOpen: true, match, agentType: 'rami' })}>
                                        <Bot className="w-4 h-4 text-red-600 shrink-0 ml-2" />
                                        שיחה עם רמי
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
                                      <DropdownMenuItem onClick={() => handleMarkCandidateIrrelevant(match)}>
                                       <UserMinus className="w-4 h-4 text-orange-500 shrink-0 ml-2" />
                                       להסיר מועמד זה מהמערכת
                                      </DropdownMenuItem>
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
                                      <DropdownMenuItem onClick={() => {
                                       const c = getCandidateDetails(match.candidate_id);
                                       setTimelineDialog({ open: true, candidate: c || { id: match.candidate_id, full_name: match.candidate_name } });
                                      }}>
                                       <ClipboardList className="w-4 h-4 text-blue-700 shrink-0 ml-2" />
                                       ציר זמן מועמד
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
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
          {totalJobGroups > displayLimit && (
            <div className="text-center py-4">
              <Button
                variant="outline"
                onClick={() => setDisplayLimit(prev => prev + 10)}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                טען עוד ({totalJobGroups - displayLimit} משרות נוספות)
              </Button>
            </div>
          )}
          </>
          )}
          </div>
          </div>
          )}

      {/* Agent Feedback Dialog */}
      <AgentFeedbackDialog
        isOpen={agentFeedbackDialog.isOpen}
        onClose={() => setAgentFeedbackDialog({ isOpen: false, match: null, agentType: null })}
        match={agentFeedbackDialog.match}
        agentType={agentFeedbackDialog.agentType}
        user={user}
        onMatchRejected={(matchId) => {
          queryClient.invalidateQueries(['matches']);
          setAgentFeedbackDialog({ isOpen: false, match: null, agentType: null });
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

      {/* Send Message to Client Dialog */}
      {showSendClientMessageDialog && selectedMatchForMessage && (
        <SendMatchMessageDialog
          isOpen={showSendClientMessageDialog}
          onClose={() => {
            setShowSendClientMessageDialog(false);
            setSelectedMatchForMessage(null);
          }}
          match={selectedMatchForMessage}
          type="client"
          user={user}
          onSendSuccess={handleSendSuccess}
        />
      )}

      {/* Pipedrive History Dialog */}
      <PipedriveHistoryDialog
        candidate={pipedriveHistoryDialog.candidate}
        isOpen={pipedriveHistoryDialog.isOpen}
        onClose={() => setPipedriveHistoryDialog({ isOpen: false, candidate: null })}
        onHistoryUpdated={() => queryClient.invalidateQueries(['candidates'])}
      />

      {/* Candidate Resume Dialog */}
      <CandidateResumeDialog
        candidate={resumeDialog.candidate}
        isOpen={resumeDialog.isOpen}
        onClose={() => setResumeDialog({ isOpen: false, candidate: null })}
      />

      <MatchJustificationDialog
        isOpen={justificationDialog.isOpen}
        onClose={() => setJustificationDialog({ isOpen: false, match: null })}
        match={justificationDialog.match}
        candidate={getCandidateDetails(justificationDialog.match?.candidate_id)}
        job={getJobDetails(justificationDialog.match?.job_id)}
        agentType="rami"
      />

      <UnifiedSendDialog
        isOpen={unifiedSendDialog.isOpen}
        onClose={() => setUnifiedSendDialog({ isOpen: false, match: null })}
        match={unifiedSendDialog.match}
        candidate={getCandidateDetails(unifiedSendDialog.match?.candidate_id)}
        job={getJobDetails(unifiedSendDialog.match?.job_id)}
        agentName="רמי"
        onMatchRemoved={(matchId) => {
          queryClient.invalidateQueries({ queryKey: ['matches'] });
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

      <CreateTaskDialog
        open={createTaskDialog.isOpen}
        onClose={() => setCreateTaskDialog({ isOpen: false, candidate: null, match: null })}
        candidate={createTaskDialog.candidate}
        match={createTaskDialog.match}
        agentName="רמי"
      />
      <CandidateTasksDialog
        open={candidateTasksDialog.isOpen}
        onClose={() => setCandidateTasksDialog({ isOpen: false, candidate: null })}
        candidate={candidateTasksDialog.candidate}
      />

      <Dialog open={candidateJobsDialog.isOpen} onOpenChange={(open) => !open && setCandidateJobsDialog({ isOpen: false, candidate: null, matches: [], loading: false })}>
        <DialogContent className="max-w-3xl max-h-[80vh]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              משרות שהמועמד הותאם אליהן (80%+)
            </DialogTitle>
            {candidateJobsDialog.candidate && (
              <DialogDescription>
                {candidateJobsDialog.candidate.first_name} {candidateJobsDialog.candidate.last_name}
                {!candidateJobsDialog.loading && candidateJobsDialog.matches && ` - ${candidateJobsDialog.matches.length} משרות`}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {candidateJobsDialog.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {candidateJobsDialog.matches && candidateJobsDialog.matches.length > 0 ? (
                candidateJobsDialog.matches.map((match) => (
                  <div key={match.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{match.job_title}</span>
                          <Badge className="bg-blue-100 text-blue-800">
                            {match.match_score}% התאמה
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {match.job_code && (
                            <span><span className="font-medium">קוד:</span> {match.job_code}</span>
                          )}
                          {match.client_name && (
                            <span><span className="font-medium">לקוח:</span> {match.client_name}</span>
                          )}
                          {match.user_name && (
                            <span><span className="font-medium">סוכן:</span> {match.user_name}</span>
                          )}
                          <span><span className="font-medium">נוצרה:</span> {new Date(match.created_date).toLocaleDateString('he-IL')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-lg font-medium">לא נמצאו התאמות</p>
                  <p className="text-sm mt-1">אין למועמד זה התאמות משרות עם ציון 80% ומעלה</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              queryClient.invalidateQueries(['candidates']);
            }}
            onCancel={() => {
              setShowCandidateForm(false);
              setEditingCandidate(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <CandidateTimelineDialog
        open={timelineDialog.open}
        candidate={timelineDialog.candidate}
        onClose={() => setTimelineDialog({ open: false, candidate: null })}
      />
    </div>
  );
}