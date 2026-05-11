import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { runDganitAgent } from '@/functions/runDganitAgent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  UserCheck, Search, Trash2, MessageSquare, MessageCircle, Building,
  Briefcase, ChevronDown, ChevronUp, Bot, Info, Play, Loader2,
  RefreshCw, Activity, Database, Target, TrendingUp, Calendar,
  FileText, Cpu, Inbox, Send, Lightbulb, BrainCircuit, MoreHorizontal,
  BadgeCheck, LayoutList, Rows3, PlusSquare, ClipboardList
} from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { UserMinus, User as UserIcon } from 'lucide-react';
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
import UnifiedSendDialog from "../components/matches/UnifiedSendDialog";
import CandidateCommunicationHistory from "../components/candidates/CandidateCommunicationHistory";
import ClientCommunicationHistory from "../components/clients/ClientCommunicationHistory";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import InterviewQuestionsDialog from "../components/candidates/InterviewQuestionsDialog";
import UnifiedTableView from "../components/matches/UnifiedTableView";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CandidateForm from "../components/candidates/CandidateFormDialog";
import CreateTaskDialog from "../components/tasks/CreateTaskDialog";
import CandidateTasksDialog from "../components/tasks/CandidateTasksDialog";
import HandledFilterButtons from "../components/matches/HandledFilterButtons";
import CandidateTimelineDialog from "../components/candidates/CandidateTimelineDialog";

export default function DganitPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedJobs, setExpandedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('dganit_expanded_jobs');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  const [notesDialog, setNotesDialog] = useState({ isOpen: false, match: null });
  const [agentFeedbackDialog, setAgentFeedbackDialog] = useState({ isOpen: false, match: null });
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
  const [viewMode, setViewMode] = useState("table"); // "grouped" or "table"
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [createTaskDialog, setCreateTaskDialog] = useState({ isOpen: false, candidate: null, match: null });
  const [candidateTasksDialog, setCandidateTasksDialog] = useState({ isOpen: false, candidate: null });
  const [handledFilter, setHandledFilter] = useState("all"); // "all", "handled", "unhandled"
  const [timelineDialog, setTimelineDialog] = useState({ open: false, candidate: null });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const { data: rotomTasks = [] } = useQuery({
    queryKey: ['rotom-tasks'],
    queryFn: () => base44.entities.RotemTask.list(),
    enabled: !!user?.can_view_matches,
    staleTime: 30 * 1000
  });

  const { data: agentConversations = [] } = useQuery({
    queryKey: ['agent-conversations'],
    queryFn: () => base44.entities.ConversationTask.list(),
    enabled: !!user?.can_view_matches,
    staleTime: 30 * 1000
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
    queryKey: ['dganit-matches'],
    queryFn: async () => {
      const data = await base44.entities.Match.filter({ user_name: 'דגנית (סוכנת AI)' }, '-created_date');
      setTotalMatchesCount(data.length);
      return data;
    },
    enabled: !!user?.can_view_matches,
    staleTime: 30 * 1000
  });

  const candidateMatchCountMap = useMemo(() => {
    const map = {};
    matches.forEach(m => {
      if (m.candidate_id) map[m.candidate_id] = (map[m.candidate_id] || 0) + 1;
    });
    return map;
  }, [matches]);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: !!user?.can_view_matches,
    staleTime: 2 * 60 * 1000
  });

  useEffect(() => {
    if (!user?.can_view_matches) return;
    const unsubscribe = base44.entities.Job.subscribe(() => {
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
    queryKey: ['agent-status-dganit'],
    queryFn: async () => {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'dganit' });
      return statuses.length > 0 ? statuses[0] : null;
    },
    enabled: !!user?.can_view_matches,
    refetchInterval: 5000,
    staleTime: 3000
  });

  const carmitAssignedJobs = useMemo(() => {
    return jobs.filter(j => j.status === 'פעילה' && j.assigned_agent === 'dganit');
  }, [jobs]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      await runDganitAgent({});
      toast.success('דגנית התחילה לרוץ');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['agent-status-dganit'] }), 2000);
    } catch (error) {
      toast.error(`שגיאה בהפעלת הסוכנת: ${error.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleSetFocus = async (job) => {
    setSettingFocus(true);
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'dganit' });
      const focusData = {
        focused_job_id: job.id, focused_job_title: job.title,
        focus_start_time: new Date().toISOString(), focus_matches_found: 0
      };
      if (statuses.length > 0) {
        await base44.entities.AgentRunStatus.update(statuses[0].id, focusData);
      } else {
        await base44.entities.AgentRunStatus.create({ agent_name: 'dganit', ...focusData });
      }
      toast.success(`דגנית ממוקדת על: ${job.title}`);
      setFocusDialog(false);
      queryClient.invalidateQueries({ queryKey: ['agent-status-dganit'] });
    } catch (error) {
      toast.error('שגיאה בהגדרת מיקוד');
    }
    setSettingFocus(false);
  };

  const handleCancelFocus = async () => {
    setSettingFocus(true);
    try {
      if (agentStatus) {
        await base44.entities.AgentRunStatus.update(agentStatus.id, {
          focused_job_id: null, focused_job_title: null, focus_start_time: null, focus_matches_found: 0
        });
        toast.success("המיקוד של דגנית בוטל");
        queryClient.invalidateQueries({ queryKey: ['agent-status-dganit'] });
      }
    } catch (error) {
      toast.error("שגיאה בביטול המיקוד");
    }
    setSettingFocus(false);
  };

  const handleRevalidateMatches = async () => {
    if (!confirm('לבדוק מחדש את כל ההתאמות הקיימות של דגנית?')) return;
    setRevalidating(true);
    toast.loading('מתחיל בדיקה מחדש...', { id: 'revalidate-all' });
    try {
      const response = await base44.functions.invoke('revalidateAllAgentMatches', { agent_name: 'dganit' });
      toast.success(`הושלמה! נבדקו: ${response.data.processed}, עודכנו: ${response.data.updated}, נמחקו: ${response.data.deleted}`, { id: 'revalidate-all', duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['dganit-matches'] });
    } catch (error) {
      toast.error('שגיאה בבדיקה מחדש', { id: 'revalidate-all' });
    } finally {
      setRevalidating(false);
    }
  };

  const handleRevalidateSingle = async (match) => {
    setRevalidatingSingle(match.id);
    try {
      const response = await base44.functions.invoke('revalidateSingleMatch', { match_id: match.id });
      if (response.data.action === 'deleted' || response.data.action === 'updated') {
        queryClient.invalidateQueries({ queryKey: ['dganit-matches'] });
        toast.success(response.data.message);
      }
    } catch (error) {
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
          queryClient.invalidateQueries({ queryKey: ['dganit-matches'] });
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
        } catch (error) {
          toast.error("שגיאה במחיקת ההתאמה");
        }
      }
    });
  };

  const handleMarkCandidateIrrelevant = async (match) => {
    setConfirmDialog({
      isOpen: true,
      title: "סימון מועמד כלא מתאים",
      message: `האם לסמן את ${match.candidate_name} כ"לא מתאים - נסגר"? המועמד יוסר מכל ההתאמות העתידיות.`,
      confirmText: "סמן כלא מתאים",
      variant: "destructive",
      onConfirm: async () => {
        try {
          await base44.entities.Candidate.update(match.candidate_id, { status: "לא מתאים - נסגר" });
          queryClient.invalidateQueries({ queryKey: ['candidates'] });
          queryClient.invalidateQueries({ queryKey: ['dganit-matches'] });
          toast.success(`${match.candidate_name} סומן כלא מתאים`);
        } catch (error) {
          toast.error("שגיאה בסימון המועמד");
        }
      }
    });
  };

  const handleShowCandidateJobs = async (match) => {
    const candidate = getCandidateDetails(match.candidate_id);
    if (!candidate) return;
    setCandidateJobsDialog({ isOpen: true, candidate, matches: null, loading: true });
    try {
      const allMatches = await base44.entities.Match.filter({ candidate_id: candidate.id, match_score: { $gte: 80 } }, '-match_score', 50);
      const jobsMap = new Map(jobs.map(j => [j.id, j]));
      const matchesWithJobDetails = allMatches
        .map(m => ({ ...m, job_code: jobsMap.get(m.job_id)?.job_code, job_title: m.job_title || jobsMap.get(m.job_id)?.title, client_name: jobsMap.get(m.job_id)?.client_name }))
        .filter(m => m.job_code || m.job_title)
        .sort((a, b) => b.match_score - a.match_score);
      setCandidateJobsDialog(prev => ({ ...prev, matches: matchesWithJobDetails, loading: false }));
    } catch (error) {
      setCandidateJobsDialog(prev => ({ ...prev, matches: [], loading: false }));
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
    notes.forEach(note => map.set(note.match_id, (map.get(note.match_id) || 0) + 1));
    return map;
  }, [notes]);

  const communicationsCountByCandidate = useMemo(() => {
    const map = new Map();
    communications.forEach(comm => {
      if (comm.candidate_id) map.set(comm.candidate_id, (map.get(comm.candidate_id) || 0) + 1);
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

  const tasksCountByMatch = useMemo(() => {
    const map = new Map();
    rotomTasks.forEach(task => {
      const matchId = task.match_id;
      if (matchId) {
        map.set(matchId, (map.get(matchId) || 0) + 1);
      }
    });
    return map;
  }, [rotomTasks]);

  const userNotesCountByMatch = useMemo(() => {
    const map = new Map();
    notes.filter(n => !n.is_system_note).forEach(note => {
      map.set(note.match_id, (map.get(note.match_id) || 0) + 1);
    });
    return map;
  }, [notes]);

  const agentConversationByMatch = useMemo(() => {
    const map = new Map();
    agentConversations.forEach(conv => {
      if (conv.match_id) {
        map.set(conv.match_id, true);
      }
    });
    return map;
  }, [agentConversations]);

  const filteredMatches = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return matches.filter(match => {
      if (!showAllMatches) {
        const candidate = candidatesMap.get(match.candidate_id);
        if (candidate?.status === "לא רלוונטי יותר" || candidate?.status === "לא מתאים - נסגר" || match.is_rejected_feedback) return false;
      }
      const matchesSearch = !searchTerm || match.candidate_name.toLowerCase().includes(searchLower) || match.job_title?.toLowerCase().includes(searchLower);
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
        bestFitFilter = bestMatchIdByCandidate.get(match.candidate_id)?.id === match.id;
      }
      // Apply handled filter
      let handledMatches = true;
      if (handledFilter === "handled") {
        handledMatches = match.is_manually_handled === true;
      } else if (handledFilter === "unhandled") {
        handledMatches = !match.is_manually_handled;
      }
      return matchesSearch && scoreMatches && priorityMatches && fullMatchFilter && bestFitFilter && handledMatches;
    });
  }, [matches, candidates, candidatesMap, searchTerm, matchScoreFilter, priorityFilter, jobsMap, showAllMatches, showFullMatchOnly, showBestFitOnly]);

  const getJobDetails = (jobId) => jobsMap.get(jobId) || null;
  const getCandidateDetails = (candidateId) => candidatesMap.get(candidateId) || null;

  const matchesByJob = useMemo(() => {
    const grouped = {};
    const carmitJobIds = new Set(carmitAssignedJobs.map(j => j.id));
    carmitAssignedJobs.forEach(job => {
      grouped[job.id] = { job_id: job.id, job_title: job.title, job_code: job.job_code, client_name: job.client_name, location: job.location, matches: [] };
    });
    filteredMatches.forEach(match => {
      if (match.job_id && carmitJobIds.has(match.job_id)) grouped[match.job_id].matches.push(match);
    });
    let sorted = Object.values(grouped).sort((a, b) => b.matches.length - a.matches.length);
    if (agentStatus?.focused_job_id) {
      const focusedIndex = sorted.findIndex(g => g.job_id === agentStatus.focused_job_id);
      if (focusedIndex > 0) { const fj = sorted.splice(focusedIndex, 1)[0]; sorted.unshift(fj); }
    }
    return sorted.slice(0, displayLimit);
  }, [filteredMatches, jobsMap, displayLimit, agentStatus, carmitAssignedJobs]);

  const toggleJobExpand = (jobId) => {
    setExpandedJobs(prev => {
      const newState = { ...prev, [jobId]: !prev[jobId] };
      localStorage.setItem('dganit_expanded_jobs', JSON.stringify(newState));
      return newState;
    });
  };

  if (matchesLoading || !user) return <LoadingSpinner message="טוען דף דגנית..." />;
  if (!user?.can_view_matches) return <Navigate to={createPageUrl("Dashboard")} />;

  const agentColor = "violet";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">דגנית - מומחית QA ובדיקות תוכנה</h1>
          <p className="text-xs md:text-base text-gray-600">סוכנת AI להתאמות בין מועמדים למשרות QA, איכות ובדיקות</p>
        </div>
      </div>

      <AgentThinkingLog agentName="dganit" agentDisplayName="דגנית" agentColor="violet" />

      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <img 
                src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&h=80&fit=crop&crop=face" 
                alt="דגנית" 
                className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 md:border-4 border-violet-200 shadow-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap text-base md:text-lg">
                  <span className="truncate">דגנית - QA ובדיקות</span>
                  <Badge className="bg-violet-100 text-violet-800 text-xs whitespace-nowrap">
                    {carmitAssignedJobs.length} משרות
                  </Badge>
                </CardTitle>
                <p className="text-xs md:text-sm text-gray-600">התאמות למשרות QA, איכות ובדיקות תוכנה</p>
                
                {agentStatus?.focused_job_id && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="bg-violet-600 text-white">
                      <Target className="w-3 h-3 ml-1" />
                      ממוקדת ב: {agentStatus.focused_job_title}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{agentStatus.focus_matches_found || 0} מועמדים נמצאו</Badge>
                    <Button size="sm" variant="ghost" onClick={handleCancelFocus} disabled={settingFocus} className="h-6 text-xs text-red-600 hover:text-red-700">בטל מיקוד</Button>
                  </div>
                )}
                
                <div className="mt-2 flex gap-1 md:gap-3 flex-wrap">
                  {(() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    const dganitMatches = matches.filter(m => m.match_score >= 90);
                    return (
                      <>
                        <Badge className="bg-green-100 text-green-800 text-xs"><TrendingUp className="w-2 h-2 md:w-3 md:h-3 ml-1" /><span className="hidden sm:inline">היום:</span> {dganitMatches.filter(m => new Date(m.created_date) >= todayStart).length}</Badge>
                        <Badge className="bg-blue-100 text-blue-800 text-xs"><Activity className="w-2 h-2 md:w-3 md:h-3 ml-1" /><span className="hidden sm:inline">שבוע:</span> {dganitMatches.filter(m => new Date(m.created_date) >= weekAgo).length}</Badge>
                        <Badge className="bg-purple-100 text-purple-800 text-xs"><Calendar className="w-2 h-2 md:w-3 md:h-3 ml-1" /><span className="hidden sm:inline">חודש:</span> {dganitMatches.filter(m => new Date(m.created_date) >= monthAgo).length}</Badge>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <Button onClick={handleRunAgent} disabled={runningAgent || agentStatus?.is_running} className="bg-violet-600 hover:bg-violet-700 gap-2" size="sm">
              {runningAgent || agentStatus?.is_running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              הפעל את דגנית
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex gap-2 mb-6">
        <Button onClick={() => setActiveTab("inbox")} className={`flex items-center gap-2 px-4 py-2 ${activeTab === "inbox" ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
          <Inbox className="w-4 h-4" /> דואר נכנס
        </Button>
        <Button onClick={() => setActiveTab("outbox")} className={`flex items-center gap-2 px-4 py-2 ${activeTab === "outbox" ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
          <Send className="w-4 h-4" /> דואר יוצא
        </Button>
      </div>

      {activeTab === "inbox" && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Briefcase className={carmitAssignedJobs.length > 0 ? "w-6 h-6 text-violet-600" : "w-6 h-6 text-gray-400"} strokeWidth={carmitAssignedJobs.length > 0 ? 2.5 : 1.5} />
              <img src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=48&h=48&fit=crop&crop=face" alt="כרמית" className="w-12 h-12 rounded-full object-cover border-3 border-purple-300" />
              <div>
                <span className="text-lg">כרמית הקצתה לדגנית</span>
                <p className="text-sm text-gray-600 font-normal">משרות QA לטיפול</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carmitAssignedJobs.length > 0 ? (
              <div className="space-y-2">
                {carmitAssignedJobs.map(job => {
                  const isFocused = agentStatus?.is_running && agentStatus?.focused_job_id === job.id;
                  return (
                    <div key={job.id} className={`p-3 rounded-lg border-2 transition-all ${isFocused ? 'bg-violet-50 border-violet-400 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Briefcase className={`w-4 h-4 ${isFocused ? 'text-violet-600' : 'text-gray-500'}`} />
                            <span className="font-semibold text-gray-900">{job.title}</span>
                            {isFocused && <Badge className="bg-violet-600 text-white animate-pulse"><Target className="w-3 h-3 ml-1" />עובדת כרגע</Badge>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 mr-6">
                            {job.job_code && <span>#{job.job_code}</span>}
                            {job.client_name && <span className="mr-3">🏢 {job.client_name}</span>}
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
              <p className="text-center text-gray-500 py-4">כרמית טרם הקצתה משרות QA לדגנית</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "outbox" && (
        <div className="space-y-6">
          <div className="flex gap-1 md:gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ['dganit-matches'] }); queryClient.invalidateQueries({ queryKey: ['jobs'] }); queryClient.invalidateQueries({ queryKey: ['agent-status-dganit'] }); }} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <RefreshCw className="w-3 h-3 md:w-4 md:h-4" /><span className="hidden sm:inline">רענן</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleRevalidateMatches} disabled={revalidating} className="flex items-center gap-1 md:gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 text-xs md:text-sm">
              {revalidating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span className="hidden lg:inline">בדוק מחדש</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => agentStatus?.focused_job_id ? handleCancelFocus() : setFocusDialog(true)} disabled={settingFocus} className={`flex items-center gap-1 md:gap-2 text-xs md:text-sm ${agentStatus?.focused_job_id ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-violet-300 text-violet-700 hover:bg-violet-50'}`}>
              <Target className="w-3 h-3 md:w-4 md:h-4" /><span className="hidden lg:inline">{agentStatus?.focused_job_id ? 'בטל מיקוד' : 'מקד'}</span>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={showAllMatches ? "default" : "outline"} size="sm" onClick={() => setShowAllMatches(!showAllMatches)} className={`flex items-center gap-1 md:gap-2 text-xs md:text-sm ${showAllMatches ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-300 text-purple-700 hover:bg-purple-50'}`}>
                    <Database className="w-3 h-3 md:w-4 md:h-4" /><span className="hidden lg:inline">{showAllMatches ? `הסתר (${filteredMatches.length})` : `הצג הכל (${totalMatchesCount})`}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{showAllMatches ? 'הצג רק התאמות פעילות' : 'הצג את כל ההתאמות'}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex flex-col gap-2 md:gap-4">
            <div className="flex gap-1 md:gap-2 flex-wrap">
              {["all", "50+", "70+", "80+", "90+"].map(filter => (
                <Button key={filter} variant={matchScoreFilter === filter ? "default" : "outline"} size="sm" onClick={() => setMatchScoreFilter(filter)} className={`text-xs md:text-sm ${matchScoreFilter === filter ? "bg-violet-600 hover:bg-violet-700" : ""}`}>
                  {filter === "all" ? "הכל" : filter + "%"}
                </Button>
              ))}
              <Button 
                variant={showFullMatchOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFullMatchOnly(!showFullMatchOnly)}
                className={`text-xs md:text-sm flex items-center gap-1 ${showFullMatchOnly ? "bg-green-600 hover:bg-green-700" : "border-green-300 text-green-700"}`}
              >
                <BadgeCheck className="w-3 h-3" />
                התאמה מלאה בלבד
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={showBestFitOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowBestFitOnly(!showBestFitOnly)}
                      className={`text-xs md:text-sm flex items-center gap-1 ${showBestFitOnly ? "bg-blue-600 hover:bg-blue-700" : "border-blue-300 text-blue-700"}`}
                    >
                      <Target className="w-3 h-3" />
                      Best Fit בלבד
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>מועמדים שזו המשרה הכי טובה שהותאמה להם במערכת</p>
                  </TooltipContent>
                </Tooltip>
                </TooltipProvider>
                </div>
                <HandledFilterButtons 
                filter={handledFilter}
                onFilterChange={setHandledFilter}
                agentColor="violet"
                />
                </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={viewMode === "grouped" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className={`flex items-center gap-2 ${viewMode === "grouped" ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
            >
              <Rows3 className="w-4 h-4" />
              חלוקה למשרות
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 ${viewMode === "table" ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
            >
              <LayoutList className="w-4 h-4" />
              תצוגת טבלה
            </Button>
          </div>

          {filteredMatches.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">אין התאמות להצגה</p></CardContent></Card>
          ) : viewMode === "table" ? (
            <UnifiedTableView
              matches={filteredMatches}
              jobs={jobs}
              candidates={candidates}
              agentColor="violet"
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
              onRefreshData={() => queryClient.invalidateQueries({ queryKey: ['dganit-matches'] })}
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
                              <Briefcase className="w-5 h-5 text-violet-600" />
                              <div className="text-right">
                                <CardTitle className="text-lg flex items-center gap-2">
                                  {jobGroup.job_title}
                                  {agentStatus?.is_running && agentStatus?.focused_job_id === jobGroup.job_id && (
                                    <Badge className="bg-violet-600 text-white animate-pulse"><Activity className="w-3 h-3 ml-1" />עובדת כרגע</Badge>
                                  )}
                                  {jobGroup.job_id && (() => {
                                    const jobDetails = getJobDetails(jobGroup.job_id);
                                    if (jobDetails?.description || jobDetails?.requirements) {
                                      return (
                                        <Popover>
                                          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-violet-600"><Info className="w-4 h-4" /></Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-96 max-h-80 overflow-y-auto" align="start">
                                            <div className="space-y-3">
                                              <h4 className="font-semibold">{jobDetails.title}</h4>
                                              {jobDetails.description && <div><p className="text-xs font-medium text-gray-500 mb-1">תיאור:</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{jobDetails.description}</p></div>}
                                              {jobDetails.requirements && <div><p className="text-xs font-medium text-gray-500 mb-1">דרישות:</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{jobDetails.requirements}</p></div>}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    }
                                    return null;
                                  })()}
                                </CardTitle>
                                <div className="text-sm text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
                                  {jobGroup.job_code && <span>#{jobGroup.job_code}</span>}
                                  {jobGroup.client_name && <span>🏢 {jobGroup.client_name}</span>}
                                  {jobGroup.location && <span>📍 {jobGroup.location}</span>}
                                </div>
                                <div className="flex gap-2 mt-1">
                                  <Badge className="bg-violet-100 text-violet-800">{jobGroup.matches.length} מועמדים</Badge>
                                </div>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="p-0">
                          {jobGroup.matches.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                              <Bot className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                              <p>דגנית עדיין לא עבדה על משרה זו</p>
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
                                    const candidateDetails = getCandidateDetails(match.candidate_id);
                                    return (
                                      <TableRow key={match.id} className={!match.is_read ? 'bg-violet-50' : ''}>
                                        <TableCell className="font-medium">
                                          <div className="flex items-start gap-2">
                                            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                              <UserCheck className="w-4 h-4 text-violet-600" />
                                            </div>
                                            <div>
                                              <button onClick={async (e) => { e.stopPropagation(); if (candidateDetails) { setResumeDialog({ isOpen: true, candidate: candidateDetails }); } }} className="text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer">{match.candidate_name}</button>
                                              {candidateDetails?.skills_summary && (
                                                <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{candidateDetails.skills_summary.length > 80 ? candidateDetails.skills_summary.substring(0, 80) + '...' : candidateDetails.skills_summary}</p>
                                              )}
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                         <MatchReasonsPopover matchScore={match.match_score} matchReasons={match.match_reasons} detailedAnalysis={match.detailed_analysis} betterMatch={betterMatchByMatchId.get(match.id)} />
                                        </TableCell>
                                        <TableCell className="text-xs hidden md:table-cell">
                                          {(() => {
                                            const cvDate = candidateDetails?.cv_received_date || candidateDetails?.source_email_date;
                                            return (
                                              <div className="space-y-1">
                                                <div className="text-gray-600"><span className="font-medium">קו"ח: </span>{cvDate ? new Date(cvDate).toLocaleDateString('he-IL') : '-'}</div>
                                                <div className="text-gray-500"><span className="font-medium">התאמה: </span>{new Date(match.created_date).toLocaleDateString('he-IL')}</div>
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
                                            <DropdownMenuContent className="w-52" side="bottom" align="end" avoidCollisions={true} sideOffset={8}>
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
                                              <DropdownMenuItem onClick={() => { const candidate = getCandidateDetails(match.candidate_id); if (candidate) setInterviewDialogState({ isOpen: true, candidate }); }}>
                                                <BrainCircuit className="w-4 h-4 text-purple-600 shrink-0 ml-2" />
                                                שאלות לראיון
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setAgentFeedbackDialog({ isOpen: true, match })}>
                                                <Bot className="w-4 h-4 text-violet-600 shrink-0 ml-2" />
                                                שיחה עם דגנית
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
                                              <DropdownMenuItem onClick={() => { const cand = getCandidateDetails(match.candidate_id); if (cand) setCreateTaskDialog({ isOpen: true, candidate: cand, match }); }}>
                                                <PlusSquare className="w-4 h-4 shrink-0 ml-2 text-blue-600" />
                                                יצירת משימה
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => { const cand = getCandidateDetails(match.candidate_id); if (cand) setCandidateTasksDialog({ isOpen: true, candidate: cand }); }}>
                                                <ClipboardList className="w-4 h-4 shrink-0 ml-2 text-blue-500" />
                                                משימות
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => handleShowCandidateJobs(match)}>
                                                <Briefcase className={`w-4 h-4 shrink-0 ml-2 ${(candidateMatchCountMap[match.candidate_id] || 0) > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                                                משרות נוספות {(candidateMatchCountMap[match.candidate_id] || 0) > 0 && `(${candidateMatchCountMap[match.candidate_id]})`}
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={async () => { try { const candidateData = await base44.entities.Candidate.filter({ id: match.candidate_id }); if (candidateData && candidateData.length > 0) { setEditingCandidate(candidateData[0]); setShowCandidateForm(true); } } catch (error) { console.error('Error loading candidate:', error); } }}>
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
                filteredMatches.forEach(match => { const jobKey = match.job_id || 'no-job'; if (!grouped[jobKey]) grouped[jobKey] = { matches: [] }; grouped[jobKey].matches.push(match); });
                const totalGroups = Object.keys(grouped).length;
                if (totalGroups > displayLimit) {
                  return (
                    <div className="text-center py-4">
                      <Button variant="outline" onClick={() => setDisplayLimit(prev => prev + 10)} className="gap-2">
                        <RefreshCw className="w-4 h-4" />טען עוד ({totalGroups - displayLimit} משרות נוספות)
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

      <AgentFeedbackDialog isOpen={agentFeedbackDialog.isOpen} onClose={() => setAgentFeedbackDialog({ isOpen: false, match: null })} match={agentFeedbackDialog.match} agentType="dganit" user={user} onMatchRejected={() => { queryClient.invalidateQueries({ queryKey: ['dganit-matches'] }); setAgentFeedbackDialog({ isOpen: false, match: null }); }} />
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" })} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title || "אישור פעולה"} message={confirmDialog.message} confirmText={confirmDialog.confirmText || "אישור"} cancelText="ביטול" variant={confirmDialog.variant || "default"} />
      <MatchNotesDialog match={notesDialog.match} isOpen={notesDialog.isOpen} onClose={() => setNotesDialog({ isOpen: false, match: null })} />
      <PipedriveHistoryDialog candidate={pipedriveHistoryDialog.candidate} isOpen={pipedriveHistoryDialog.isOpen} onClose={() => setPipedriveHistoryDialog({ isOpen: false, candidate: null })} onHistoryUpdated={() => queryClient.invalidateQueries({ queryKey: ['candidates'] })} />
      <AgentFocusDialog isOpen={focusDialog} onClose={() => setFocusDialog(false)} jobs={carmitAssignedJobs} onFocusSet={handleSetFocus} isLoading={settingFocus} agentName="דגנית" agentColor="violet" />
      <CandidateResumeDialog isOpen={resumeDialog.isOpen} onClose={() => setResumeDialog({ isOpen: false, candidate: null })} candidate={resumeDialog.candidate} />
      <MatchJustificationDialog isOpen={justificationDialog.isOpen} onClose={() => setJustificationDialog({ isOpen: false, match: null })} match={justificationDialog.match} candidate={getCandidateDetails(justificationDialog.match?.candidate_id)} job={getJobDetails(justificationDialog.match?.job_id)} agentType="dganit" />
      <UnifiedSendDialog isOpen={unifiedSendDialog.isOpen} onClose={() => setUnifiedSendDialog({ isOpen: false, match: null })} match={unifiedSendDialog.match} candidate={getCandidateDetails(unifiedSendDialog.match?.candidate_id)} job={getJobDetails(unifiedSendDialog.match?.job_id)} agentName="דגנית" onMatchRemoved={() => queryClient.invalidateQueries({ queryKey: ['dganit-matches'] })} />
      <CandidateCommunicationHistory candidateId={communicationHistoryDialog.match?.candidate_id} candidateName={communicationHistoryDialog.match?.candidate_name || ''} open={communicationHistoryDialog.isOpen} onClose={() => setCommunicationHistoryDialog({ isOpen: false, match: null })} />
      <ClientCommunicationHistory jobId={clientCommunicationDialog.match?.job_id} jobTitle={clientCommunicationDialog.match?.job_title || ''} open={clientCommunicationDialog.isOpen} onClose={() => setClientCommunicationDialog({ isOpen: false, match: null })} />
      <InterviewQuestionsDialog isOpen={interviewDialogState.isOpen} onClose={() => setInterviewDialogState({ isOpen: false, candidate: null })} candidate={interviewDialogState.candidate} />

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
        agentName="דגנית"
      />
      <CandidateTasksDialog
        open={candidateTasksDialog.isOpen}
        onClose={() => setCandidateTasksDialog({ isOpen: false, candidate: null })}
        candidate={candidateTasksDialog.candidate}
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