import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { runItayAgent } from '@/functions/runItayAgent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { MobileTabs, MobileTabsButtons, MobileTabButton, MobileTabsContent } from '@/components/ui/mobile-tabs';

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
  TrendingUp,
  Calendar,
  FileText,
  Server,
  Target,
  Inbox,
  Send,
  Lightbulb,
  Mail,
  BrainCircuit,
  BadgeCheck,
  Rows3,
  LayoutList
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
import AgentFocusDialog from "../components/matches/AgentFocusDialog";
import AgentThinkingLog from "../components/matches/AgentThinkingLog";
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
import CandidateForm from "../components/candidates/CandidateFormDialog";
import UnifiedTableView from "../components/matches/UnifiedTableView";
import AgentFiltersBar from "../components/matches/AgentFiltersBar";
import CandidateTimelineDialog from "../components/candidates/CandidateTimelineDialog";
import { User as UserIcon, MoreHorizontal, PlusSquare, ClipboardList } from 'lucide-react';

export default function ItayPage() {
  const queryClient = useQueryClient();
  const [matches, setMatches] = useState([]);

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
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedJobs, setExpandedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('itay_expanded_jobs');
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
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [agentStatus, setAgentStatus] = useState(null);
  const [runningAgent, setRunningAgent] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [focusDialog, setFocusDialog] = useState(false);
  const [settingFocus, setSettingFocus] = useState(false);
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
  const [interviewDialogState, setInterviewDialogState] = useState({ isOpen: false, candidate: null });
  const [candidateJobsDialog, setCandidateJobsDialog] = useState({ isOpen: false, candidate: null, matches: [], loading: false });
  const [notes, setNotes] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [clientCommunications, setClientCommunications] = useState([]);
  const [rotemTasks, setRotemTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("outbox");
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [totalMatchesCount, setTotalMatchesCount] = useState(0);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [createTaskDialog, setCreateTaskDialog] = useState({ isOpen: false, candidate: null, match: null });
  const [candidateTasksDialog, setCandidateTasksDialog] = useState({ isOpen: false, candidate: null });
  const [viewMode, setViewMode] = useState("table"); // "grouped" or "table"
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
        base44.entities.Match.filter({ user_name: 'איתי (סוכן AI)' }, '-created_date'),
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

      // Determine which jobs belong to Itay
      const itayJobIds = new Set(
        jobList
          .filter(job => {
            const searchText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
            
            // Exclude software jobs first
            const softwareKeywords = ['תוכנה', 'software', 'developer', 'מפתח', 'embedded', 'firmware', 'c++', 'python', 'java', 'c#', 'react', 'frontend', 'backend'];
            const hasSoftware = softwareKeywords.some(kw => searchText.includes(kw));
            if (hasSoftware) return false;
            
            // IT keywords
            const itKeywords = ['devops', 'cloud', 'aws', 'azure', 'network', 'security', 'סייבר', 'cyber', 'תשתיות', 'helpdesk', 'noc', 'dba', 'sysadmin'];
            return itKeywords.some(kw => searchText.includes(kw)) || searchText.includes('מחשוב');
          })
          .map(job => job.id)
      );
      
      const filteredMatchList = matchList.filter(m => {
        // Filter jobs that don't belong to Itay
        if (!itayJobIds.has(m.job_id)) {
          return false;
        }
        return true;
      });
      
      setMatches(filteredMatchList);
      setJobs(jobList);
      setCandidates(candidateList);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const loadAgentStatus = async () => {
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'itay' });
      if (statuses.length > 0) {
        setAgentStatus(statuses[0]);
      }
    } catch (error) {
      console.error("Error loading agent status:", error);
    }
  };

  // Use Carmit's assignment decision instead of local analysis
  const carmitAssignedJobs = useMemo(() => {
    return jobs.filter(j => j.status === 'פעילה' && j.assigned_agent === 'itay');
  }, [jobs]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      await runItayAgent({});
      toast.success('איתי התחיל לרוץ');
      setTimeout(() => {
        loadAgentStatus();
      }, 2000);
    } catch (error) {
      console.error('Error running itay agent:', error);
      toast.error(`שגיאה בהפעלת הסוכן: ${error.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleSetFocus = async (job) => {
    setSettingFocus(true);
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'itay' });
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
          agent_name: 'itay',
          ...focusData
        });
      }
      
      toast.success(`איתי ממוקד על: ${job.title}`);
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
        toast.success("המיקוד של איתי בוטל");
        loadAgentStatus();
      }
    } catch (error) {
      console.error("Error canceling focus:", error);
      toast.error("שגיאה בביטול המיקוד");
    }
    setSettingFocus(false);
  };

  const handleRevalidateMatches = async () => {
    if (!confirm('לבדוק מחדש את ההתאמות הקיימות של איתי? התהליך יעדכן תיאורים וימחק התאמות שכבר לא מתאימות (10 התאמות בכל לחיצה)')) {
      return;
    }

    setRevalidating(true);
    try {
      const response = await base44.functions.invoke('revalidateAgentMatches', { 
        agent_name: 'itay',
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

  // Real-time subscription for job and candidate updates - OPTIMIZED to prevent refresh loop
  useEffect(() => {
    if (!user?.can_view_matches) return;
    
    const unsubscribeJob = base44.entities.Job.subscribe((event) => {
      // Only update jobs state, not full reload
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
        
        // Remove matches if candidate became irrelevant
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
          await base44.entities.Match.delete(matchId);
          setMatches(prev => prev.filter(m => m.id !== matchId));
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
          toast.success("ההתאמה נמחקה בהצלחה");
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
        source: "itay"
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
      message: `האם לסמן את ${match.candidate_name} כ"לא מתאים - נסגר"? המועמד יוסר לחלוטין מכל ההתאמות העתידיות במערכת - לא רק אצל איתי אלא אצל כל הסוכנים (נעמה, רועי, רמי, אליק, ליאור, אופיר, GC).`,
      confirmText: "סמן כלא מתאים",
      variant: "destructive",
      onConfirm: async () => {
        try {
          localStorage.setItem('itay_viewMode', viewMode);
          localStorage.setItem('itay_expanded_jobs', JSON.stringify(expandedJobs));
          
          // Update candidate status to "לא מתאים - נסגר" in DB
          await base44.entities.Candidate.update(match.candidate_id, {
            status: "לא מתאים - נסגר"
          });
          
          // Update local state
          setCandidates(prev => prev.map(c => 
            c.id === match.candidate_id ? {...c, status: "לא מתאים - נסגר"} : c
          ));
          
          // Remove all matches with this candidate from local state
          setMatches(prev => prev.filter(m => m.candidate_id !== match.candidate_id));
          
          // Close dialog
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" });
          
          toast.success(`${match.candidate_name} סומן כלא מתאים והוסר לחלוטין מכל ההתאמות במערכת`);
          
          // Create system note
          base44.entities.MatchNote.create({
            match_id: match.id,
            user_id: user.id,
            user_name: user.full_name || user.email,
            note_text: `המועמד סומן כ"לא מתאים - נסגר" על ידי איתי ולא יופיע בהתאמות עתידיות של כל הסוכנים`,
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

  const tasksCountByMatch = useMemo(() => {
    const map = new Map();
    rotemTasks.forEach(task => {
      if (task.match_id) map.set(task.match_id, (map.get(task.match_id) || 0) + 1);
    });
    return map;
  }, [rotemTasks]);

  const userNotesCountByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => {
      if (!note.is_system_note) map.set(note.match_id, (map.get(note.match_id) || 0) + 1);
    });
    return map;
  }, [notes]);

  const agentConversationByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => {
      if (!note.is_system_note && note.note_text?.includes('💬 משוב לסוכן')) map.set(note.match_id, true);
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
        // Filter out irrelevant candidates immediately
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
  }, [matches, candidatesMap, searchTerm, matchScoreFilter, priorityFilter, jobsMap, showAllMatches, showFullMatchOnly, showBestFitOnly, showRecentCvsOnly]);

  const getJobDetails = (jobId) => jobsMap.get(jobId) || null;
  const getCandidateDetails = (candidateId) => candidatesMap.get(candidateId) || null;

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
    
    // Add matches ONLY for jobs assigned to Itay by Carmit
    filteredMatches.forEach(match => {
      const jobKey = match.job_id;
      
      // Only include matches for jobs that are in carmitAssignedJobs
      if (jobKey && carmitJobIds.has(jobKey)) {
        grouped[jobKey].matches.push(match);
      }
    });
    
    const sorted = Object.values(grouped).sort((a, b) => b.matches.length - a.matches.length);
    return sorted.slice(0, displayLimit);
  }, [filteredMatches, jobsMap, displayLimit, carmitAssignedJobs]);

  const toggleJobExpand = (jobId) => {
    setExpandedJobs(prev => {
      const newState = {
        ...prev,
        [jobId]: !prev[jobId]
      };
      localStorage.setItem('itay_expanded_jobs', JSON.stringify(newState));
      return newState;
    });
  };

  if (loading || !user) {
    return <LoadingSpinner message="טוען דף איתי..." />;
  }

  if (!user || !user.can_view_matches) {
    return <Navigate to={createPageUrl("Dashboard")} />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">איתי - מומחה IT</h1>
          <p className="text-xs md:text-base text-gray-600">סוכן AI להתאמות בין מועמדים למשרות IT</p>
        </div>
      </div>

      {/* Agent Thinking Log */}
      <AgentThinkingLog 
        agentName="itay"
        agentDisplayName="איתי"
        agentColor="indigo"
      />

      {/* Agent Card */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <img 
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face" 
                alt="איתי" 
                className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 md:border-4 border-indigo-200 shadow-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap text-base md:text-lg">
                  <span className="truncate">איתי - IT</span>
                  <Badge className="bg-indigo-100 text-indigo-800 text-xs whitespace-nowrap">
                    {carmitAssignedJobs.length} משרות
                  </Badge>
                </CardTitle>
                <p className="text-xs md:text-sm text-gray-600">
                  התאמות למשרות IT
                </p>
                
                {agentStatus?.focused_job_id && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white">
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
                    
                    const itayMatches = matches.filter(m => m.match_score >= 90);
                    
                    return (
                      <>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <TrendingUp className="w-2 h-2 md:w-3 md:h-3 ml-1" />
                          <span className="hidden sm:inline">היום:</span> {itayMatches.filter(m => new Date(m.created_date) >= todayStart).length}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          <Activity className="w-2 h-2 md:w-3 md:h-3 ml-1" />
                          <span className="hidden sm:inline">שבוע:</span> {itayMatches.filter(m => new Date(m.created_date) >= weekAgo).length}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                          <Calendar className="w-2 h-2 md:w-3 md:h-3 ml-1" />
                          <span className="hidden sm:inline">חודש:</span> {itayMatches.filter(m => new Date(m.created_date) >= monthAgo).length}
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
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              size="sm"
            >
              {runningAgent || agentStatus?.is_running ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              הפעל את איתי
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
              ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          <Send className="w-4 h-4" />
          דואר יוצא
        </Button>
      </div>

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
                  <span className="text-lg">כרמית הקצתה לאיתי</span>
                  <p className="text-sm text-gray-600 font-normal">משרות IT לטיפול</p>
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
                            ? 'bg-indigo-50 border-indigo-400 shadow-md' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Briefcase className={`w-4 h-4 ${isFocused ? 'text-indigo-600' : 'text-gray-500'}`} />
                              <span className="font-semibold text-gray-900">{job.title}</span>
                              {isFocused && (
                                <Badge className="bg-indigo-600 text-white animate-pulse">
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
                  כרמית טרם הקצתה משרות לאיתי
                </p>
              )}
            </CardContent>
          </Card>
      )}

      {activeTab === "outbox" && (
          <div className="space-y-6">
          <AgentFiltersBar
            agentColor="indigo"
            agentName="איתי"
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
          />

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grouped" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className={`flex items-center gap-2 ${viewMode === "grouped" ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
            >
              <Rows3 className="w-4 h-4" />
              חלוקה למשרות
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 ${viewMode === "table" ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
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
          agentColor="indigo"
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
          onRefreshData={() => queryClient.invalidateQueries({ queryKey: ['itay-matches'] })}
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
                          <Server className="w-5 h-5 text-indigo-600" />
                          <div className="text-right">
                            <CardTitle className="text-lg flex items-center gap-2">
                            {jobGroup.job_id && jobGroup.job_id !== 'no-job' && (() => {
                               const jobDetails = getJobDetails(jobGroup.job_id);
                               if (jobDetails?.description || jobDetails?.requirements) {
                                 return (
                                   <Popover>
                                     <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                       <button className="text-indigo-700 hover:text-indigo-900 underline decoration-dotted font-semibold text-right">
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
                              <Badge className="bg-indigo-600 text-white animate-pulse">
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
                              <Badge className="bg-indigo-100 text-indigo-800">
                                {jobGroup.matches.length} מועמדים
                              </Badge>
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
                          <p>איתי עדיין לא עבד על משרה זו</p>
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
                            <TableRow key={match.id} className={isHandled ? 'bg-green-50 border-r-2 border-r-green-400' : !match.is_read ? 'bg-indigo-50' : ''}>
                              <TableCell className="font-medium">
                                {(() => {
                                  const candidateDetails = getCandidateDetails(match.candidate_id);
                                  return (
                                    <div className="flex items-start gap-2">
                                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <UserCheck className="w-4 h-4 text-indigo-600" />
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
                                          <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">
                                            {candidateDetails.skills_summary.substring(0, 80)}...
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
                                     <Bot className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                                     שיחה עם איתי
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

                            if (totalGroups > displayLimit) {
                            return (
                            <div className="text-center py-4">
                            <Button variant="outline" onClick={() => setDisplayLimit(prev => prev + 10)} className="gap-2">
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
                            agentType="itay"
        user={user}
        onMatchRejected={(matchId) => {
          setMatches(prev => prev.filter(m => m.id !== matchId));
          setAgentFeedbackDialog({ isOpen: false, match: null });
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: null })}
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
        agentName="איתי"
        agentColor="indigo"
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
        agentType="itay"
      />

      <UnifiedSendDialog
        isOpen={unifiedSendDialog.isOpen}
        onClose={() => setUnifiedSendDialog({ isOpen: false, match: null })}
        match={unifiedSendDialog.match}
        candidate={getCandidateDetails(unifiedSendDialog.match?.candidate_id)}
        job={getJobDetails(unifiedSendDialog.match?.job_id)}
        agentName="איתי"
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
        agentName="איתי"
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
    </div>
  );
}