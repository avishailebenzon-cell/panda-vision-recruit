import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { runEtgarAgent } from '@/functions/runEtgarAgent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  UserCheck, Search, Trash2, MessageSquare, MessageCircle, Building, Briefcase,
  ChevronDown, ChevronUp, Bot, Play, Loader2, RefreshCw, Activity, Target,
  TrendingUp, Calendar, Send, Lightbulb, BrainCircuit, MoreHorizontal,
  ClipboardList, PlusSquare, User as UserIcon, LayoutList, Rows3, Inbox,
  Shield, MapPin,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { UserMinus } from 'lucide-react';
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import BlurredText from "../components/ui/BlurredText";
import MatchNotesDialog from "../components/matches/MatchNotesDialog";
import MatchReasonsPopover from "../components/matches/MatchReasonsPopover";
import AgentFeedbackDialog from "../components/matches/AgentFeedbackDialog";
import AgentThinkingLog from "../components/matches/AgentThinkingLog";
import CandidateResumeDialog from "../components/matches/CandidateResumeDialog";
import MatchesLoadingToast from "../components/matches/MatchesLoadingToast";
import MatchJustificationDialog from "../components/matches/MatchJustificationDialog";
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
import AgentFiltersBar from "../components/matches/AgentFiltersBar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Navigate } from 'react-router-dom';

export default function EtgarPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedJobs, setExpandedJobs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('etgar_expanded_jobs') || '{}'); } catch { return {}; }
  });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  const [notesDialog, setNotesDialog] = useState({ isOpen: false, match: null });
  const [agentFeedbackDialog, setAgentFeedbackDialog] = useState({ isOpen: false, match: null });
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [chafshanResults, setChafshanResults] = useState([]);
  const [runningAgent, setRunningAgent] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [resumeDialog, setResumeDialog] = useState({ isOpen: false, candidate: null });
  const [revalidatingSingle, setRevalidatingSingle] = useState(null);
  const [matchScoreFilter, setMatchScoreFilter] = useState(() => localStorage.getItem('etgar_matchScoreFilter') || "60+");
  const [priorityFilter, setPriorityFilter] = useState(() => localStorage.getItem('etgar_priorityFilter') || "all");
  const [showAllMatches, setShowAllMatches] = useState(() => localStorage.getItem('etgar_showAllMatches') === 'true');
  const [showBestFitOnly, setShowBestFitOnly] = useState(() => localStorage.getItem('etgar_showBestFitOnly') === 'true');
  const [handledFilter, setHandledFilter] = useState(() => localStorage.getItem('etgar_handledFilter') || "all");
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
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('etgar_viewMode') || "table");
  const [timelineDialog, setTimelineDialog] = useState({ open: false, candidate: null });

  useEffect(() => { localStorage.setItem('etgar_matchScoreFilter', matchScoreFilter); }, [matchScoreFilter]);
  useEffect(() => { localStorage.setItem('etgar_priorityFilter', priorityFilter); }, [priorityFilter]);
  useEffect(() => { localStorage.setItem('etgar_handledFilter', handledFilter); }, [handledFilter]);
  useEffect(() => { localStorage.setItem('etgar_showBestFitOnly', showBestFitOnly); }, [showBestFitOnly]);
  useEffect(() => { localStorage.setItem('etgar_showAllMatches', showAllMatches); }, [showAllMatches]);
  useEffect(() => { localStorage.setItem('etgar_viewMode', viewMode); }, [viewMode]);

  const candidateMatchCountMap = useMemo(() => {
    const map = {};
    matches.forEach(m => { if (m.candidate_id) map[m.candidate_id] = (map[m.candidate_id] || 0) + 1; });
    return map;
  }, [matches]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (!currentUser.can_view_matches) { setLoading(false); return; }

      const [matchList, jobList, candidateList, chafshanList] = await Promise.all([
        base44.entities.Match.filter({ user_name: 'אתגר (סוכן AI)' }, '-created_date'),
        base44.entities.Job.list(),
        base44.entities.Candidate.list('-created_date', 500),
        base44.entities.ChafshanResult.list('-created_date', 500),
      ]);

      setTotalMatchesCount(matchList.length);
      setMatches(matchList);
      setJobs(jobList);
      setCandidates(candidateList);
      setChafshanResults(chafshanList);

      Promise.all([
        base44.entities.MatchNote.list(),
        base44.entities.WhatsappMessage.list(),
        base44.entities.EmailLog.list(),
        base44.entities.EmailOutbox.list(),
        base44.entities.RotemTask.list('-created_date', 500),
      ]).then(([notesList, whatsappList, emailList, emailOutboxList, tasksList]) => {
        setNotes(notesList);
        setCommunications([...whatsappList, ...emailList]);
        setClientCommunications(emailOutboxList);
        setRotemTasks(tasksList);
      }).catch(e => console.warn('Secondary data load error:', e));

    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      await runEtgarAgent({});
      toast.success('אתגר התחיל לרוץ');
      setTimeout(loadData, 3000);
    } catch (error) {
      toast.error(`שגיאה בהפעלת הסוכן: ${error.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleDelete = async (matchId) => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך למחוק את ההתאמה?",
      onConfirm: async () => {
        try {
          setMatches(prev => prev.filter(m => m.id !== matchId));
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
          await base44.entities.Match.delete(matchId);
        } catch (error) {
          toast.error("שגיאה במחיקת ההתאמה");
          loadData();
        }
      }
    });
  };

  const handleMarkCandidateIrrelevant = async (match) => {
    setConfirmDialog({
      isOpen: true,
      title: "סימון מועמד כלא מתאים",
      message: `האם לסמן את ${match.candidate_name} כ"לא מתאים - נסגר"?`,
      confirmText: "סמן כלא מתאים",
      variant: "destructive",
      onConfirm: async () => {
        try {
          await base44.entities.Candidate.update(match.candidate_id, { status: "לא מתאים - נסגר" });
          setMatches(prev => prev.filter(m => m.candidate_id !== match.candidate_id));
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" });
          toast.success(`${match.candidate_name} סומן כלא מתאים`);
        } catch (error) {
          toast.error("שגיאה בסימון המועמד");
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" });
        }
      }
    });
  };

  const handleShowCandidateJobs = async (match) => {
    const candidate = candidatesMap.get(match.candidate_id);
    if (!candidate) return;
    setCandidateJobsDialog({ isOpen: true, candidate, matches: null, loading: true });
    try {
      const allMatches = await base44.entities.Match.filter({ candidate_id: candidate.id, match_score: { $gte: 60 } }, '-match_score', 50);
      const jobsMap2 = new Map(jobs.map(j => [j.id, j]));
      const matchesWithDetails = allMatches
        .map(m => ({ ...m, job_code: jobsMap2.get(m.job_id)?.job_code, client_name: jobsMap2.get(m.job_id)?.client_name }))
        .sort((a, b) => b.match_score - a.match_score);
      setCandidateJobsDialog(prev => ({ ...prev, matches: matchesWithDetails, loading: false }));
    } catch {
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

  const notesCountByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => map.set(note.match_id, (map.get(note.match_id) || 0) + 1));
    return map;
  }, [notes]);

  const tasksCountByMatch = useMemo(() => {
    const map = new Map();
    rotemTasks.forEach(task => { if (task.match_id) map.set(task.match_id, (map.get(task.match_id) || 0) + 1); });
    return map;
  }, [rotemTasks]);

  const userNotesCountByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => { if (!note.is_system_note) map.set(note.match_id, (map.get(note.match_id) || 0) + 1); });
    return map;
  }, [notes]);

  const agentConversationByMatch = useMemo(() => {
    const map = new Map();
    notes.forEach(note => { if (!note.is_system_note && note.note_text?.includes('💬 משוב לסוכן')) map.set(note.match_id, true); });
    return map;
  }, [notes]);

  const communicationsCountByCandidate = useMemo(() => {
    const map = new Map();
    communications.forEach(comm => { if (comm.candidate_id) map.set(comm.candidate_id, (map.get(comm.candidate_id) || 0) + 1); });
    return map;
  }, [communications]);

  const clientCommunicationsCountByJob = useMemo(() => {
    const map = new Map();
    if (clientCommunications.length === 0 || jobs.length === 0) return map;
    const titleToJobId = new Map();
    jobs.forEach(job => { if (job.title) titleToJobId.set(job.title, job.id); });
    clientCommunications.forEach(comm => {
      const text = (comm.message_content || '') + ' ' + (comm.subject || '');
      titleToJobId.forEach((jobId, title) => { if (text.includes(title)) map.set(jobId, (map.get(jobId) || 0) + 1); });
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

  const betterMatchByMatchId = useMemo(() => {
    const result = new Map();
    matches.forEach(match => {
      const betterMatches = matches.filter(m =>
        m.candidate_id === match.candidate_id && m.id !== match.id &&
        m.job_id !== match.job_id && (m.match_score || 0) > (match.match_score || 0)
      );
      if (betterMatches.length > 0) {
        const best = betterMatches.reduce((a, b) => (a.match_score || 0) > (b.match_score || 0) ? a : b);
        const job = jobsMap.get(best.job_id);
        result.set(match.id, { job_title: best.job_title || job?.title || '', job_code: job?.job_code || '', match_score: best.match_score });
      }
    });
    return result;
  }, [matches, jobsMap]);

  const filteredMatches = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return matches.filter(match => {
      if (!showAllMatches) {
        const candidate = candidatesMap.get(match.candidate_id);
        if (candidate?.status === "לא רלוונטי יותר" || candidate?.status === "לא מתאים - נסגר") return false;
        if (match.is_rejected_feedback) return false;
      }
      const matchesSearch = !searchTerm ||
        match.candidate_name?.toLowerCase().includes(searchLower) ||
        match.job_title?.toLowerCase().includes(searchLower);

      let scoreMatches = true;
      if (matchScoreFilter === "90+") scoreMatches = match.match_score >= 90;
      else if (matchScoreFilter === "80+") scoreMatches = match.match_score >= 80;
      else if (matchScoreFilter === "70+") scoreMatches = match.match_score >= 70;
      else if (matchScoreFilter === "60+") scoreMatches = match.match_score >= 60;

      let priorityMatches = true;
      if (priorityFilter === "high") {
        const job = jobsMap.get(match.job_id);
        priorityMatches = job?.recruitment_priority === "עדיפות גיוס 1";
      }

      let bestFitFilter = true;
      if (showBestFitOnly) bestFitFilter = bestMatchIdByCandidate.get(match.candidate_id)?.id === match.id;

      let handledMatches = true;
      if (handledFilter === "handled") handledMatches = match.is_manually_handled === true;
      else if (handledFilter === "unhandled") handledMatches = !match.is_manually_handled;

      return matchesSearch && scoreMatches && priorityMatches && bestFitFilter && handledMatches;
    });
  }, [matches, candidatesMap, searchTerm, matchScoreFilter, priorityFilter, jobsMap, showAllMatches, showBestFitOnly, bestMatchIdByCandidate, handledFilter]);

  const matchesByJob = useMemo(() => {
    const grouped = {};
    filteredMatches.forEach(match => {
      const jobKey = match.job_id || 'no-job';
      if (!grouped[jobKey]) {
        const job = jobsMap.get(jobKey);
        grouped[jobKey] = {
          job_id: jobKey, job_title: match.job_title || job?.title || 'לא ידוע',
          job_code: job?.job_code, client_name: job?.client_name || match.client_name,
          location: job?.location, matches: []
        };
      }
      grouped[jobKey].matches.push(match);
    });
    return Object.values(grouped).sort((a, b) => b.matches.length - a.matches.length).slice(0, displayLimit);
  }, [filteredMatches, jobsMap, displayLimit]);

  // Inbox stats
  const uniqueChafshanCandidates = useMemo(() => {
    return [...new Set(chafshanResults.map(r => r.candidate_id))];
  }, [chafshanResults]);

  const pendingChafshanCandidates = useMemo(() => {
    const pending = chafshanResults.filter(r => !r.etgar_status || r.etgar_status === 'pending');
    return [...new Set(pending.map(r => r.candidate_id))];
  }, [chafshanResults]);

  const getCandidateDetails = (candidateId) => candidatesMap.get(candidateId) || null;
  const getJobDetails = (jobId) => jobsMap.get(jobId) || null;

  const toggleJobExpand = (jobId) => {
    setExpandedJobs(prev => {
      const newState = { ...prev, [jobId]: !prev[jobId] };
      localStorage.setItem('etgar_expanded_jobs', JSON.stringify(newState));
      return newState;
    });
  };

  if (loading || !user) return <LoadingSpinner message="טוען דף אתגר..." />;
  if (!user?.can_view_matches) return <Navigate to={createPageUrl("Dashboard")} />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <MatchesLoadingToast isLoading={loading} agentName="אתגר" />
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">אתגר - סוכן ביטחוני</h1>
          <p className="text-xs md:text-base text-gray-600">סוכן AI אוטונומי להתאמות מהמגזר הביטחוני · עובר על תוצאות החפשנים (רפאל, אלביט, תע"א, רמה 1), מאתר מועמדים עם סיווג ביטחוני מתאים ומתאים אותם למשרות ביטחוניות פתוחות</p>
        </div>
      </div>

      {/* Agent Thinking Log - מוח אתגר */}
      <AgentThinkingLog
        agentName="etgar"
        agentDisplayName="אתגר"
        agentColor="orange"
      />

      {/* Agent Header Card */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center border-4 border-orange-200 shadow-lg flex-shrink-0">
                <Target className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 flex-wrap text-base md:text-lg">
                  <span>אתגר - ביטחוני</span>
                  <Badge className="bg-orange-100 text-orange-800 text-xs">
                    {uniqueChafshanCandidates.length} מועמדים מהחפשנים
                  </Badge>
                  {pendingChafshanCandidates.length > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs animate-pulse">
                      {pendingChafshanCandidates.length} ממתינים
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs md:text-sm text-gray-600">התאמות אוטונומיות למגזר הביטחוני</p>
                <div className="mt-2 flex gap-1 md:gap-3 flex-wrap">
                  {(() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    const todayCount = matches.filter(m => new Date(m.created_date) >= todayStart).length;
                    const weekCount = matches.filter(m => new Date(m.created_date) >= weekAgo).length;
                    const monthCount = matches.filter(m => new Date(m.created_date) >= monthAgo).length;
                    return (
                      <>
                        <Badge className="bg-green-100 text-green-800 text-xs"><TrendingUp className="w-2 h-2 md:w-3 md:h-3 ml-1" /><span className="hidden sm:inline">היום:</span> {todayCount}</Badge>
                        <Badge className="bg-blue-100 text-blue-800 text-xs"><Activity className="w-2 h-2 md:w-3 md:h-3 ml-1" /><span className="hidden sm:inline">שבוע:</span> {weekCount}</Badge>
                        <Badge className="bg-purple-100 text-purple-800 text-xs"><Calendar className="w-2 h-2 md:w-3 md:h-3 ml-1" /><span className="hidden sm:inline">חודש:</span> {monthCount}</Badge>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            {user?.role === 'admin' && (
              <Button onClick={handleRunAgent} disabled={runningAgent} className="bg-orange-600 hover:bg-orange-700 gap-2" size="sm">
                {runningAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                הפעל את אתגר
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Inbox / Outbox Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          onClick={() => setActiveTab("inbox")}
          className={`flex items-center gap-2 px-4 py-2 ${activeTab === "inbox" ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
        >
          <Inbox className="w-4 h-4" />
          דואר נכנס
          {pendingChafshanCandidates.length > 0 && (
            <Badge className="bg-red-500 text-white text-xs mr-1">{pendingChafshanCandidates.length}</Badge>
          )}
        </Button>
        <Button
          onClick={() => setActiveTab("outbox")}
          className={`flex items-center gap-2 px-4 py-2 ${activeTab === "outbox" ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
        >
          <Send className="w-4 h-4" />
          דואר יוצא
          <Badge className="bg-white/20 text-current text-xs mr-1">{totalMatchesCount}</Badge>
        </Button>
      </div>

      {/* INBOX - מועמדים מהחפשנים */}
      {activeTab === "inbox" && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-purple-600" />
              <div>
                <span className="text-lg">מועמדים שהחפשנים אותרו</span>
                <p className="text-sm text-gray-600 font-normal">מגזר ביטחוני / סיווג רמה 1</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chafshanResults.length === 0 ? (
              <p className="text-center text-gray-500 py-4">טרם אותרו מועמדים על ידי החפשנים</p>
            ) : (
              <div className="space-y-2">
                {/* Summary Row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'סה"כ מועמדים', value: uniqueChafshanCandidates.length, color: 'blue' },
                    { label: 'ממתינים לאתגר', value: pendingChafshanCandidates.length, color: 'yellow' },
                    { label: 'עובדו', value: uniqueChafshanCandidates.length - pendingChafshanCandidates.length, color: 'green' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`p-3 bg-${color}-50 rounded-lg text-center border border-${color}-100`}>
                      <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Chafshan breakdown by type */}
                {['rama1', 'elbit', 'rafael', 'taa'].map(type => {
                  const typeResults = chafshanResults.filter(r => r.chafshan_type === type);
                  if (typeResults.length === 0) return null;
                  const typeLabels = { rama1: 'רמה 1', elbit: 'אלביט/ELOP', rafael: 'רפאל', taa: 'תע"א' };
                  const typeColors = { rama1: 'red', elbit: 'blue', rafael: 'green', taa: 'purple' };
                  const col = typeColors[type];
                  const uniqueIds = [...new Set(typeResults.map(r => r.candidate_id))];
                  return (
                    <div key={type} className={`p-3 rounded-lg border-2 bg-white border-${col}-200`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`bg-${col}-100 text-${col}-800`}>{typeLabels[type]}</Badge>
                          <span className="text-sm text-gray-600">{uniqueIds.length} מועמדים</span>
                        </div>
                        <div className="flex gap-2 text-xs text-gray-500">
                          {(() => {
                            const pending = typeResults.filter(r => !r.etgar_status || r.etgar_status === 'pending');
                            const pendingIds = [...new Set(pending.map(r => r.candidate_id))].length;
                            const completedIds = uniqueIds.length - pendingIds;
                            return (
                              <>
                                {completedIds > 0 && <span className="text-green-600">✓ {completedIds} עובדו</span>}
                                {pendingIds > 0 && <span className="text-yellow-600 animate-pulse">⏳ {pendingIds} ממתינים</span>}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* OUTBOX - התאמות שאתגר יצר */}
      {activeTab === "outbox" && (
        <div className="space-y-6">
          <AgentFiltersBar
            agentColor="orange"
            agentName="אתגר"
            isRunning={runningAgent}
            onRun={handleRunAgent}
            matchScoreFilter={matchScoreFilter}
            onMatchScoreChange={setMatchScoreFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            handledFilter={handledFilter}
            onHandledChange={setHandledFilter}
            showBestFitOnly={showBestFitOnly}
            onToggleBestFit={() => setShowBestFitOnly(!showBestFitOnly)}
            showAllMatches={showAllMatches}
            onToggleShowAll={() => setShowAllMatches(!showAllMatches)}
            filteredCount={filteredMatches.length}
            totalCount={totalMatchesCount}
            onRefresh={loadData}
          />

          <div className="flex gap-2">
            <Button variant={viewMode === "grouped" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grouped")} className={`flex items-center gap-2 ${viewMode === "grouped" ? 'bg-orange-600 hover:bg-orange-700' : ''}`}>
              <Rows3 className="w-4 h-4" /> חלוקה למשרות
            </Button>
            <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => setViewMode("table")} className={`flex items-center gap-2 ${viewMode === "table" ? 'bg-orange-600 hover:bg-orange-700' : ''}`}>
              <LayoutList className="w-4 h-4" /> תצוגת טבלה
            </Button>
          </div>

          {filteredMatches.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">אין התאמות להצגה</p></CardContent></Card>
          ) : viewMode === "table" ? (
            <UnifiedTableView
              matches={filteredMatches}
              jobs={jobs}
              candidates={candidates}
              agentColor="orange"
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
              onInterviewQuestions={(match) => { const c = getCandidateDetails(match.candidate_id); if (c) setInterviewDialogState({ isOpen: true, candidate: c }); }}
              onAgentFeedback={(match) => setAgentFeedbackDialog({ isOpen: true, match })}
              onJustification={(match) => setJustificationDialog({ isOpen: true, match })}
              onNotes={(match) => setNotesDialog({ isOpen: true, match })}
              onCreateTask={(match) => { const c = getCandidateDetails(match.candidate_id); if (c) setCreateTaskDialog({ isOpen: true, candidate: c, match }); }}
              onCandidateTasks={(match) => { const c = getCandidateDetails(match.candidate_id); if (c) setCandidateTasksDialog({ isOpen: true, candidate: c }); }}
              onShowCandidateJobs={handleShowCandidateJobs}
              onEditCandidate={async (match) => {
                try {
                  const data = await base44.entities.Candidate.filter({ id: match.candidate_id });
                  if (data?.length > 0) { setEditingCandidate(data[0]); setShowCandidateForm(true); }
                } catch {}
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
                              <Briefcase className="w-5 h-5 text-orange-600" />
                              <div className="text-right">
                                <CardTitle className="text-lg">{jobGroup.job_title}</CardTitle>
                                <div className="text-sm text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
                                  {jobGroup.job_code && <span>#{jobGroup.job_code}</span>}
                                  {jobGroup.client_name && <span>🏢 <BlurredText>{jobGroup.client_name}</BlurredText></span>}
                                  {jobGroup.location && <span>📍 {jobGroup.location}</span>}
                                  {(() => {
                                    const jd = getJobDetails(jobGroup.job_id);
                                    return jd?.security_clearance ? <Badge className="bg-red-100 text-red-800 text-xs">{jd.security_clearance}</Badge> : null;
                                  })()}
                                </div>
                                <Badge className="bg-orange-100 text-orange-800 mt-1">{jobGroup.matches.length} מועמדים</Badge>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
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
                                  <TableHead className="hidden md:table-cell min-w-[120px]">תאריכים</TableHead>
                                  <TableHead className="min-w-[60px]">פעולות</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {jobGroup.matches.map(match => {
                                  const isHandled = (tasksCountByMatch?.get?.(match.id) || 0) > 0 || (userNotesCountByMatch?.get?.(match.id) || 0) > 0 || agentConversationByMatch?.get?.(match.id);
                                  const candidateDetails = getCandidateDetails(match.candidate_id);
                                  return (
                                    <TableRow key={match.id} className={isHandled ? 'bg-green-50 border-r-2 border-r-green-400' : !match.is_read ? 'bg-orange-50' : ''}>
                                      <TableCell className="font-medium">
                                        <div className="flex items-start gap-2">
                                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <UserCheck className="w-4 h-4 text-orange-600" />
                                          </div>
                                          <div>
                                            <button onClick={async () => {
                                              if (candidateDetails) { setResumeDialog({ isOpen: true, candidate: candidateDetails }); return; }
                                              try {
                                                const data = await base44.entities.Candidate.filter({ id: match.candidate_id });
                                                if (data?.length > 0) setResumeDialog({ isOpen: true, candidate: data[0] });
                                              } catch {}
                                            }} className="text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer">
                                              <BlurredText>{match.candidate_name}</BlurredText>
                                            </button>
                                            {candidateDetails?.skills_summary && (
                                              <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{candidateDetails.skills_summary.substring(0, 80)}{candidateDetails.skills_summary.length > 80 ? '...' : ''}</p>
                                            )}
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <MatchReasonsPopover matchScore={match.match_score} matchReasons={match.match_reasons} detailedAnalysis={match.detailed_analysis} betterMatch={betterMatchByMatchId.get(match.id)} />
                                      </TableCell>
                                      <TableCell className="text-xs hidden md:table-cell">
                                        <div className="space-y-1 text-gray-500">
                                          <div>{new Date(match.created_date).toLocaleDateString('he-IL')}</div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent className="w-52" side="bottom" align="end" avoidCollisions sideOffset={8}>
                                            <DropdownMenuItem onClick={() => setTimelineDialog({ open: true, candidate: candidateDetails || { id: match.candidate_id, full_name: match.candidate_name } })}>
                                              <ClipboardList className="w-4 h-4 text-blue-700 shrink-0 ml-2" />ציר זמן מועמד
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => setUnifiedSendDialog({ isOpen: true, match })}>
                                              <Send className="w-4 h-4 text-blue-600 shrink-0 ml-2" />שלח הודעה
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setCommunicationHistoryDialog({ isOpen: true, match })}>
                                              <MessageCircle className="w-4 h-4 text-purple-600 shrink-0 ml-2" />היסטוריית מועמד
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setAgentFeedbackDialog({ isOpen: true, match })}>
                                              <Bot className="w-4 h-4 text-orange-600 shrink-0 ml-2" />שיחה עם אתגר
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setJustificationDialog({ isOpen: true, match })}>
                                              <Lightbulb className="w-4 h-4 text-orange-600 shrink-0 ml-2" />נמק התאמה
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setNotesDialog({ isOpen: true, match })}>
                                              <MessageSquare className="w-4 h-4 text-gray-600 shrink-0 ml-2" />הערות {notesCountByMatch.get(match.id) > 0 && `(${notesCountByMatch.get(match.id)})`}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => { const c = getCandidateDetails(match.candidate_id); if (c) setCreateTaskDialog({ isOpen: true, candidate: c, match }); }}>
                                              <PlusSquare className="w-4 h-4 text-blue-600 shrink-0 ml-2" />יצירת משימה
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleMarkCandidateIrrelevant(match)}>
                                              <UserMinus className="w-4 h-4 text-orange-500 shrink-0 ml-2" />הסר מועמד
                                            </DropdownMenuItem>
                                            {user?.can_delete_matches && (
                                              <DropdownMenuItem onClick={() => handleDelete(match.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                                <Trash2 className="w-4 h-4 shrink-0 ml-2" />מחק התאמה
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
              {(() => {
                const totalGroups = Object.keys(filteredMatches.reduce((acc, m) => { acc[m.job_id || 'no'] = true; return acc; }, {})).length;
                if (totalGroups > displayLimit) return (
                  <div className="text-center py-4">
                    <Button variant="outline" onClick={() => setDisplayLimit(prev => prev + 10)} className="gap-2">
                      <RefreshCw className="w-4 h-4" />טען עוד ({totalGroups - displayLimit} משרות נוספות)
                    </Button>
                  </div>
                );
                return null;
              })()}
            </>
          )}
        </div>
      )}

      {/* Dialogs */}
      <AgentFeedbackDialog isOpen={agentFeedbackDialog.isOpen} onClose={() => setAgentFeedbackDialog({ isOpen: false, match: null })} match={agentFeedbackDialog.match} agentType="gc" user={user} onMatchRejected={(matchId) => { setMatches(prev => prev.map(m => m.id === matchId ? { ...m, is_rejected_feedback: true } : m)); setAgentFeedbackDialog({ isOpen: false, match: null }); }} />
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: null, title: "", confirmText: "", variant: "" })} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title || "אישור פעולה"} message={confirmDialog.message} confirmText={confirmDialog.confirmText || "אישור"} cancelText="ביטול" variant={confirmDialog.variant || "default"} />
      <MatchNotesDialog match={notesDialog.match} isOpen={notesDialog.isOpen} onClose={() => setNotesDialog({ isOpen: false, match: null })} />
      <CandidateResumeDialog isOpen={resumeDialog.isOpen} onClose={() => setResumeDialog({ isOpen: false, candidate: null })} candidate={resumeDialog.candidate} />
      <MatchJustificationDialog isOpen={justificationDialog.isOpen} onClose={() => setJustificationDialog({ isOpen: false, match: null })} match={justificationDialog.match} candidate={getCandidateDetails(justificationDialog.match?.candidate_id)} job={getJobDetails(justificationDialog.match?.job_id)} agentType="gc" />
      <CandidateCommunicationHistory candidateId={communicationHistoryDialog.match?.candidate_id} candidateName={communicationHistoryDialog.match?.candidate_name || ''} open={communicationHistoryDialog.isOpen} onClose={() => setCommunicationHistoryDialog({ isOpen: false, match: null })} />
      <ClientCommunicationHistory jobId={clientCommunicationDialog.match?.job_id} jobTitle={clientCommunicationDialog.match?.job_title || ''} open={clientCommunicationDialog.isOpen} onClose={() => setClientCommunicationDialog({ isOpen: false, match: null })} />
      <UnifiedSendDialog isOpen={unifiedSendDialog.isOpen} onClose={() => setUnifiedSendDialog({ isOpen: false, match: null })} match={unifiedSendDialog.match} candidate={getCandidateDetails(unifiedSendDialog.match?.candidate_id)} job={getJobDetails(unifiedSendDialog.match?.job_id)} agentName="אתגר" onMatchRemoved={(matchId) => setMatches(prev => prev.filter(m => m.id !== matchId))} />
      <InterviewQuestionsDialog isOpen={interviewDialogState.isOpen} onClose={() => setInterviewDialogState({ isOpen: false, candidate: null })} candidate={interviewDialogState.candidate} />
      <CreateTaskDialog open={createTaskDialog.isOpen} onClose={() => setCreateTaskDialog({ isOpen: false, candidate: null, match: null })} candidate={createTaskDialog.candidate} match={createTaskDialog.match} agentName="אתגר" />
      <CandidateTasksDialog open={candidateTasksDialog.isOpen} onClose={() => setCandidateTasksDialog({ isOpen: false, candidate: null })} candidate={candidateTasksDialog.candidate} />
      <CandidateTimelineDialog open={timelineDialog.open} candidate={timelineDialog.candidate} onClose={() => setTimelineDialog({ open: false, candidate: null })} />

      <Dialog open={showCandidateForm} onOpenChange={setShowCandidateForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCandidate ? "עריכת מועמד" : "הוספת מועמד"}</DialogTitle></DialogHeader>
          <CandidateForm candidate={editingCandidate} onSubmit={() => { setShowCandidateForm(false); setEditingCandidate(null); }} onCancel={() => { setShowCandidateForm(false); setEditingCandidate(null); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={candidateJobsDialog.isOpen} onOpenChange={(open) => { if (!open) setCandidateJobsDialog({ isOpen: false, candidate: null, matches: [], loading: false }); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>משרות שהמועמד הותאם אליהן - {candidateJobsDialog.candidate?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {candidateJobsDialog.loading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> :
              candidateJobsDialog.matches?.length > 0 ? (
                <div className="space-y-2">
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
              ) : <p className="text-center text-gray-500 py-4">לא נמצאו משרות נוספות</p>
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}