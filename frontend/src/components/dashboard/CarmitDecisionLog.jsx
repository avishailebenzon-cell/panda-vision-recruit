import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, CheckCircle, XCircle, AlertTriangle, Loader2, FileText, Calendar, Clock, Filter,
  ArrowUpDown, MoreHorizontal, Send, MessageCircle, Building, BrainCircuit, Bot, RefreshCw,
  Lightbulb, MessageSquare, PlusSquare, ClipboardList, Briefcase, User as UserIcon, UserMinus, Trash2,
  GitCommitHorizontal, Group, CheckSquare
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MatchReasonsPopover from '../matches/MatchReasonsPopover';
import BlurredText from '../ui/BlurredText';
import CopyOnHover from '../ui/CopyOnHover';
import { toast } from 'sonner';
import CandidateTimelineDialog from '../candidates/CandidateTimelineDialog';
import CandidateSummaryDialog from '../rotem/CandidateSummaryDialog';
import JobDetailsDialog from '../rotem/JobDetailsDialog';
import InterviewQuestionsDialog from '../candidates/InterviewQuestionsDialog';
import AgentFeedbackDialog from '../matches/AgentFeedbackDialog';
import MatchJustificationDialog from '../matches/MatchJustificationDialog';
import MatchNotesDialog from '../matches/MatchNotesDialog';
import CreateTaskDialog from '../tasks/CreateTaskDialog';
import CandidateTasksDialog from '../tasks/CandidateTasksDialog';
import CandidateFormDialog from '../candidates/CandidateFormDialog';
import UnifiedSendDialog from '../matches/UnifiedSendDialog';
import CandidateCommunicationHistory from '../candidates/CandidateCommunicationHistory';
import ClientCommunicationHistory from '../clients/ClientCommunicationHistory';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function CarmitDecisionLog() {
  const [matches, setMatches] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState({});
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [autoRejectingOld, setAutoRejectingOld] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });
  const [groupBy, setGroupBy] = useState('none');
  const [revalidatingSingle, setRevalidatingSingle] = useState(null);
  
  // Dialogs
  const [timelineDialog, setTimelineDialog] = useState({ open: false, candidate: null });
  const [candidateSummaryDialog, setCandidateSummaryDialog] = useState({ isOpen: false, candidate: null });
  const [jobDetailsDialog, setJobDetailsDialog] = useState({ isOpen: false, job: null });
  const [interviewDialog, setInterviewDialog] = useState({ isOpen: false, match: null });
  const [feedbackDialog, setFeedbackDialog] = useState({ isOpen: false, match: null });
  const [justificationDialog, setJustificationDialog] = useState({ isOpen: false, match: null });
  const [notesDialog, setNotesDialog] = useState({ isOpen: false, match: null });
  const [createTaskDialog, setCreateTaskDialog] = useState({ isOpen: false, match: null });
  const [tasksDialog, setTasksDialog] = useState({ isOpen: false, match: null });
  const [candidateFormDialog, setCandidateFormDialog] = useState({ isOpen: false, candidate: null });
  const [unifiedSendDialog, setUnifiedSendDialog] = useState({ isOpen: false, match: null });
  const [communicationDialog, setCommunicationDialog] = useState({ isOpen: false, match: null });
  const [clientCommunicationDialog, setClientCommunicationDialog] = useState({ isOpen: false, match: null });
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, match: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [currentUser, allMatches, allJobs, allCandidates] = await Promise.all([
        base44.auth.me(),
        base44.entities.Match.filter({}, '-created_date', 1000),
        base44.entities.Job.list('-created_date', 500),
        base44.entities.Candidate.list('-created_date', 1000)
      ]);
      
      setUser(currentUser);
      setJobs(allJobs);
      setCandidates(allCandidates);
      
      const jobsMap = {};
      allJobs.forEach(job => { jobsMap[job.id] = job; });
      
      const enrichedMatches = allMatches
        .filter(match => match.job_id)
        .map(match => ({
          ...match,
          job_title: match.job_title || jobsMap[match.job_id]?.title || 'לא ידוע'
        }));
      
      setMatches(enrichedMatches);

      const matchIds = allMatches.map(m => m.id);
      if (matchIds.length > 0) {
        const carmitNotes = await base44.entities.MatchNote.filter({
          match_id: { $in: matchIds }
        });
        
        const notesMap = {};
        carmitNotes.forEach(note => {
          notesMap[note.match_id] = note.note_text;
        });
        setNotes(notesMap);
      }
    } catch (error) {
      console.error('Error loading Carmit decisions:', error);
    }
    setLoading(false);
  };

  const autoRejectOldPendingMatches = async () => {
    setAutoRejectingOld(true);
    try {
      // Find matches pending review for more than 7 days with low score
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const oldPendingMatches = matches.filter(match => 
        !match.carmit_decision && // No decision yet
        new Date(match.created_date) < sevenDaysAgo && // Older than 7 days
        (match.match_score || 0) < 75 // Low score
      );

      if (oldPendingMatches.length === 0) {
        toast.info('לא נמצאו התאמות ישנות לדחייה אוטומטית');
        setAutoRejectingOld(false);
        return;
      }

      const confirmMsg = `נמצאו ${oldPendingMatches.length} התאמות ישנות עם ציון נמוך.\nהאם לדחות אותן אוטומטית?`;
      if (!confirm(confirmMsg)) {
        setAutoRejectingOld(false);
        return;
      }

      // Get "לא רלוונטי" status
      const allStatuses = await base44.entities.CandidateStatus.list();
      const rejectedStatus = allStatuses.find(s => s.status_name?.includes('לא רלוונטי'));
      
      if (!rejectedStatus) {
        toast.error('לא נמצא סטטוס "לא רלוונטי" במערכת');
        setAutoRejectingOld(false);
        return;
      }

      // Update all old pending matches
      let updated = 0;
      for (const match of oldPendingMatches) {
        try {
          await base44.entities.Match.update(match.id, {
            carmit_decision: 'skipped_status',
            carmit_reviewed_date: new Date().toISOString(),
            status_number: rejectedStatus.status_number,
            status: rejectedStatus.status_name
          });

          // Add a note from Carmit
          await base44.entities.MatchNote.create({
            match_id: match.id,
            user_id: 'carmit_auto',
            user_name: 'כרמית (סוכן AI)',
            note_text: `נדחה אוטומטית - התאמה ישנה מעל 7 ימים עם ציון נמוך (${match.match_score}%). המועמד כנראה לא מתאים למשרה.`,
            is_system_note: true
          });

          updated++;
        } catch (err) {
          console.error(`Error rejecting match ${match.id}:`, err);
        }
      }

      toast.success(`${updated} התאמות נדחו אוטומטית`);
      await loadData();
    } catch (error) {
      console.error('Error auto-rejecting old matches:', error);
      toast.error('שגיאה בדחיית התאמות ישנות');
    }
    setAutoRejectingOld(false);
  };

  const getDecisionConfig = (decision) => {
    const configs = {
      'created_task': { 
        icon: CheckCircle, 
        color: 'bg-green-100 text-green-800', 
        label: 'העברתי לטל',
        description: 'כרמית יצרה משימה לטל'
      },
      'skipped_pipedrive': { 
        icon: XCircle, 
        color: 'bg-red-100 text-red-800', 
        label: 'נדחה - Pipedrive',
        description: 'נמצאה סיבה ב-Pipedrive שלא להעביר'
      },
      'skipped_status': { 
        icon: XCircle, 
        color: 'bg-orange-100 text-orange-800', 
        label: 'נדחה - סטטוס',
        description: 'סטטוס המועמד לא מאפשר התקדמות'
      },
      'skipped_duplicate': { 
        icon: AlertTriangle, 
        color: 'bg-yellow-100 text-yellow-800', 
        label: 'כפילות',
        description: 'משימה כבר קיימת עבור התאמה זו'
      },
      'skipped_deadline': { 
        icon: Calendar, 
        color: 'bg-gray-100 text-gray-800', 
        label: 'דד-ליין עבר',
        description: 'המועד האחרון למשרה חלף'
      },
      'skipped_geo_rejected': { 
        icon: XCircle, 
        color: 'bg-red-100 text-red-800', 
        label: 'נדחה - גיאוגרפיה',
        description: 'מרחק גיאוגרפי מעבר לסף'
      },
      'skipped_geo_needs_review': { 
        icon: AlertTriangle, 
        color: 'bg-yellow-100 text-yellow-800', 
        label: 'נדחה זמנית - מיקום',
        description: 'נתוני מיקום דורשים תיקון'
      },
      null: {
        icon: Clock,
        color: 'bg-blue-100 text-blue-800',
        label: 'ממתין לבדיקת כרמית',
        description: 'התאמה חדשה שכרמית עדיין לא בדקה'
      }
    };
    return configs[decision] || { 
      icon: FileText, 
      color: 'bg-gray-100 text-gray-800', 
      label: decision || 'לא ידוע',
      description: 'החלטה לא מוכרת'
    };
  };

  const candidatesMap = useMemo(() => new Map(candidates.map(c => [c.id, c])), [candidates]);
  const jobsMap = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          match.candidate_name?.toLowerCase().includes(search) ||
          match.job_title?.toLowerCase().includes(search) ||
          match.carmit_decision?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      if (decisionFilter === 'pending') {
        if (match.carmit_decision) return false;
      } else if (decisionFilter !== 'all') {
        if (match.carmit_decision !== decisionFilter) return false;
      }

      const score = match.match_score || 0;
      if (score < minScore || score > maxScore) return false;

      return true;
    });
  }, [matches, searchTerm, decisionFilter, minScore, maxScore]);

  const sortedMatches = useMemo(() => {
    const sorted = [...filteredMatches];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      if (sortConfig.key === 'match_score') {
        aVal = a.match_score || 0;
        bVal = b.match_score || 0;
      } else if (sortConfig.key === 'candidate_name') {
        aVal = a.candidate_name || '';
        bVal = b.candidate_name || '';
      } else if (sortConfig.key === 'job_title') {
        aVal = a.job_title || '';
        bVal = b.job_title || '';
      } else if (sortConfig.key === 'created_date') {
        aVal = new Date(a.carmit_reviewed_date || a.created_date);
        bVal = new Date(b.carmit_reviewed_date || b.created_date);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredMatches, sortConfig]);

  const groupedMatches = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: null, matches: sortedMatches }];
    }

    const groups = new Map();
    
    sortedMatches.forEach(match => {
      let groupKey, groupLabel;
      
      if (groupBy === 'candidate') {
        groupKey = match.candidate_id;
        groupLabel = match.candidate_name;
      } else if (groupBy === 'job') {
        groupKey = match.job_id;
        groupLabel = match.job_title;
      } else if (groupBy === 'decision') {
        const config = getDecisionConfig(match.carmit_decision);
        groupKey = match.carmit_decision || 'pending';
        groupLabel = config.label;
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { key: groupKey, label: groupLabel, matches: [] });
      }
      groups.get(groupKey).matches.push(match);
    });
    
    return Array.from(groups.values());
  }, [sortedMatches, groupBy]);

  const SortButton = ({ column, children }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(column)}
      className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1"
    >
      {children}
      <ArrowUpDown className="w-3 h-3" />
    </Button>
  );

  const handleRevalidate = async (match) => {
    setRevalidatingSingle(match.id);
    try {
      await base44.functions.invoke('revalidateSingleMatch', { match_id: match.id });
      toast.success('ההתאמה נבדקה מחדש');
      await loadData();
    } catch (error) {
      toast.error('שגיאה בבדיקה מחדש');
    }
    setRevalidatingSingle(null);
  };

  const handleMarkIrrelevant = async (match) => {
    if (!confirm(`לסמן את ${match.candidate_name} כלא רלוונטי?`)) return;
    try {
      await base44.entities.Candidate.update(match.candidate_id, {
        status: "לא מתאים - נסגר"
      });
      toast.success('המועמד סומן כלא רלוונטי');
      await loadData();
    } catch (error) {
      toast.error('שגיאה בעדכון המועמד');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.match) return;
    try {
      await base44.entities.Match.delete(deleteDialog.match.id);
      toast.success('ההתאמה נמחקה');
      setDeleteDialog({ isOpen: false, match: null });
      await loadData();
    } catch (error) {
      toast.error('שגיאה במחיקת ההתאמה');
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary and grouping controls */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckSquare className="w-4 h-4 text-pink-600" />
            <span className="font-semibold text-gray-700">מוצגים:</span>
            <Badge className="bg-pink-100 text-pink-800 font-bold">
              {filteredMatches.length} מועמדים
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Group className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">קיבוץ:</span>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא קיבוץ</SelectItem>
                <SelectItem value="candidate">מועמד</SelectItem>
                <SelectItem value="job">משרה</SelectItem>
                <SelectItem value="decision">החלטה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="חפש לפי שם מועמד, משרה או החלטה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        
        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
          <SelectTrigger className="w-full md:w-56">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="כל ההחלטות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל ההחלטות</SelectItem>
            <SelectItem value="pending">ממתין לבדיקה</SelectItem>
            <SelectItem value="created_task">העברתי לטל</SelectItem>
            <SelectItem value="skipped_pipedrive">נדחה - Pipedrive</SelectItem>
            <SelectItem value="skipped_status">נדחה - סטטוס</SelectItem>
            <SelectItem value="skipped_duplicate">כפילות</SelectItem>
            <SelectItem value="skipped_deadline">דד-ליין עבר</SelectItem>
            <SelectItem value="skipped_geo_rejected">נדחה - גיאוגרפיה</SelectItem>
            <SelectItem value="skipped_geo_needs_review">נדחה זמנית - מיקום</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 items-center">
          <Label className="text-sm whitespace-nowrap">ציון:</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            placeholder="מינימום"
            className="w-20"
          />
          <span className="text-gray-400">-</span>
          <Input
            type="number"
            min="0"
            max="100"
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            placeholder="מקסימום"
            className="w-20"
          />
        </div>

        <Button onClick={loadData} variant="outline" size="sm" className="whitespace-nowrap">
          <Loader2 className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          רענן
        </Button>
        
        <Button 
          onClick={autoRejectOldPendingMatches} 
          variant="destructive" 
          size="sm" 
          className="whitespace-nowrap"
          disabled={autoRejectingOld}
        >
          {autoRejectingOld ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4 ml-2" />
          )}
          דחה התאמות ישנות
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="min-w-[150px]">
                  <SortButton column="candidate_name">מועמד</SortButton>
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <SortButton column="job_title">משרה</SortButton>
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <SortButton column="match_score">התאמה</SortButton>
                </TableHead>
                <TableHead className="min-w-[140px]">החלטת כרמית</TableHead>
                <TableHead className="hidden lg:table-cell min-w-[150px]">
                  <SortButton column="created_date">תאריכים</SortButton>
                </TableHead>
                <TableHead className="min-w-[60px] text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedMatches.map(group => (
                <React.Fragment key={group.key}>
                  {group.label && (
                    <TableRow className="bg-gray-100 hover:bg-gray-100">
                      <TableCell colSpan={6} className="font-bold text-gray-800 py-2">
                        <div className="flex items-center gap-2">
                          <Group className="w-4 h-4" />
                          {group.label}
                          <Badge variant="outline" className="mr-2">
                            {group.matches.length} התאמות
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {group.matches.map(match => {
                    const candidate = candidatesMap.get(match.candidate_id);
                    const job = jobsMap.get(match.job_id);
                    const config = getDecisionConfig(match.carmit_decision);
                    const Icon = config.icon;
                    
                    return (
                      <TableRow 
                        key={match.id} 
                        className={`${!match.carmit_decision ? 'bg-pink-50' : ''} hover:bg-gray-50`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <UserIcon className="w-4 h-4 text-pink-600" />
                            </div>
                            <div>
                              <button
                                onClick={() => {
                                  if (candidate) {
                                    setCandidateSummaryDialog({ isOpen: true, candidate });
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer"
                              >
                                <BlurredText>{match.candidate_name}</BlurredText>
                              </button>
                              {candidate?.skills_summary && (
                                <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate" title={candidate.skills_summary}>
                                  {candidate.skills_summary.length > 60 
                                    ? candidate.skills_summary.substring(0, 60) + '...' 
                                    : candidate.skills_summary}
                                </p>
                              )}
                              <div className="flex gap-2 mt-0.5">
                                {candidate?.email && (
                                  <CopyOnHover value={candidate.email} className="text-xs text-gray-400" />
                                )}
                                {candidate?.phone_primary && (
                                  <CopyOnHover value={candidate.phone_primary} className="text-xs text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            {job && (job.description || job.requirements) ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="font-medium text-blue-700 hover:text-blue-900 underline decoration-dotted text-right">
                                    {match.job_title}
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
                              <div className="font-medium text-gray-900">{match.job_title}</div>
                            )}
                            <div className="text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
                              {job?.job_code && <span>#{job.job_code}</span>}
                              {job?.client_name && <span>🏢 <BlurredText>{job.client_name}</BlurredText></span>}
                              {job?.location && <span>📍 {job.location}</span>}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <MatchReasonsPopover 
                            matchScore={match.match_score} 
                            matchReasons={match.match_reasons}
                            detailedAnalysis={match.detailed_analysis}
                          />
                        </TableCell>

                        <TableCell>
                          <Badge className={config.color}>
                            <Icon className="w-3 h-3 ml-1" />
                            {config.label}
                          </Badge>
                          {notes[match.id] && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]" title={notes[match.id]}>
                              {notes[match.id].substring(0, 50)}...
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-xs hidden lg:table-cell">
                          <div className="space-y-1">
                            <div className="text-gray-600">
                              <span className="font-medium">התאמה: </span>
                              {new Date(match.created_date).toLocaleDateString('he-IL')}
                              <span className="text-gray-400 mr-2 ml-1">
                                {new Date(match.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {match.carmit_reviewed_date && (
                              <div className="text-gray-500">
                                <span className="font-medium">החלטה: </span>
                                {new Date(match.carmit_reviewed_date).toLocaleDateString('he-IL')}
                                <span className="text-gray-400 mr-2 ml-1">
                                  {new Date(match.carmit_reviewed_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
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
                              <DropdownMenuItem onClick={() => setTimelineDialog({ open: true, candidate: candidate || { id: match.candidate_id, full_name: match.candidate_name } })}>
                                <GitCommitHorizontal className="w-4 h-4 text-blue-700 shrink-0 ml-2" />
                                ציר זמן מועמד
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setUnifiedSendDialog({ isOpen: true, match })}>
                                <Send className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                                שלח הודעה
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCommunicationDialog({ isOpen: true, match })}>
                                <MessageCircle className="w-4 h-4 text-purple-600 shrink-0 ml-2" />
                                הסטוריית מועמד
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setClientCommunicationDialog({ isOpen: true, match })}>
                                <Building className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                                הסטוריית לקוח
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setInterviewDialog({ isOpen: true, match })}>
                                <BrainCircuit className="w-4 h-4 text-purple-600 shrink-0 ml-2" />
                                שאלות לראיון
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setFeedbackDialog({ isOpen: true, match })}>
                                <Bot className="w-4 h-4 text-pink-600 shrink-0 ml-2" />
                                שיחה עם הסוכן
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRevalidate(match)} disabled={revalidatingSingle === match.id}>
                                {revalidatingSingle === match.id ? (
                                  <Loader2 className="w-4 h-4 text-blue-600 shrink-0 ml-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                                )}
                                בדוק מחדש
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setJustificationDialog({ isOpen: true, match })}>
                                <Lightbulb className="w-4 h-4 text-pink-600 shrink-0 ml-2" />
                                נמק התאמה
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setNotesDialog({ isOpen: true, match })}>
                                <MessageSquare className="w-4 h-4 shrink-0 ml-2 text-gray-800" />
                                הערות
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setCreateTaskDialog({ isOpen: true, match })}>
                                <PlusSquare className="w-4 h-4 shrink-0 ml-2 text-blue-600" />
                                יצירת משימה
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTasksDialog({ isOpen: true, match })}>
                                <ClipboardList className="w-4 h-4 shrink-0 ml-2 text-blue-500" />
                                משימות
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                if (candidate) {
                                  setCandidateFormDialog({ isOpen: true, candidate });
                                }
                              }}>
                                <UserIcon className="w-4 h-4 shrink-0 ml-2" />
                                עריכת מועמד
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMarkIrrelevant(match)}>
                                <UserMinus className="w-4 h-4 text-pink-500 shrink-0 ml-2" />
                                סמן כלא רלוונטי
                              </DropdownMenuItem>
                              {user?.can_delete_matches && (
                                <DropdownMenuItem
                                  onClick={() => setDeleteDialog({ isOpen: true, match })}
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
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-sm text-gray-500 text-center space-y-1">
        <div>סה"כ {sortedMatches.length} החלטות מתוך {matches.length} התאמות</div>
        <div className="text-xs">
          ממתינות לבדיקה: {matches.filter(m => !m.carmit_decision).length} | 
          אושרו לטל: {matches.filter(m => m.carmit_decision === 'created_task').length} | 
          נדחו: {matches.filter(m => m.carmit_decision && m.carmit_decision !== 'created_task').length}
        </div>
      </div>

      {/* Dialogs */}
      <CandidateTimelineDialog
        open={timelineDialog.open}
        candidate={timelineDialog.candidate}
        onClose={() => setTimelineDialog({ open: false, candidate: null })}
      />
      
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

      <InterviewQuestionsDialog
        isOpen={interviewDialog.isOpen}
        onClose={() => setInterviewDialog({ isOpen: false, match: null })}
        match={interviewDialog.match}
      />

      <AgentFeedbackDialog
        isOpen={feedbackDialog.isOpen}
        onClose={() => setFeedbackDialog({ isOpen: false, match: null })}
        match={feedbackDialog.match}
        agentType="carmit"
      />

      <MatchJustificationDialog
        isOpen={justificationDialog.isOpen}
        onClose={() => setJustificationDialog({ isOpen: false, match: null })}
        match={justificationDialog.match}
        agentType="carmit"
      />

      <MatchNotesDialog
        isOpen={notesDialog.isOpen}
        onClose={() => setNotesDialog({ isOpen: false, match: null })}
        match={notesDialog.match}
        onNotesUpdated={loadData}
      />

      <CreateTaskDialog
        open={createTaskDialog.isOpen}
        onClose={() => setCreateTaskDialog({ isOpen: false, match: null })}
        candidate={createTaskDialog.match ? candidatesMap.get(createTaskDialog.match.candidate_id) : null}
        match={createTaskDialog.match}
        onTaskCreated={() => {
          setCreateTaskDialog({ isOpen: false, match: null });
          toast.success('המשימה נוצרה');
        }}
        agentName="כרמית"
      />

      <CandidateTasksDialog
        isOpen={tasksDialog.isOpen}
        onClose={() => setTasksDialog({ isOpen: false, match: null })}
        candidateId={tasksDialog.match?.candidate_id}
        candidateName={tasksDialog.match?.candidate_name}
      />

      <Dialog open={candidateFormDialog.isOpen} onOpenChange={(open) => !open && setCandidateFormDialog({ isOpen: false, candidate: null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת מועמד</DialogTitle>
          </DialogHeader>
          <CandidateFormDialog
            candidate={candidateFormDialog.candidate}
            onSubmit={async (formData) => {
              try {
                await base44.entities.Candidate.update(candidateFormDialog.candidate.id, formData);
                toast.success("המועמד עודכן בהצלחה");
                setCandidateFormDialog({ isOpen: false, candidate: null });
                await loadData();
              } catch (error) {
                toast.error("שגיאה בשמירת המועמד");
              }
            }}
            onCancel={() => setCandidateFormDialog({ isOpen: false, candidate: null })}
          />
        </DialogContent>
      </Dialog>

      <UnifiedSendDialog
        isOpen={unifiedSendDialog.isOpen}
        onClose={() => setUnifiedSendDialog({ isOpen: false, match: null })}
        match={unifiedSendDialog.match}
        agentName="כרמית"
      />

      <CandidateCommunicationHistory
        candidateId={communicationDialog.match?.candidate_id}
        candidateName={communicationDialog.match?.candidate_name || ''}
        open={communicationDialog.isOpen}
        onClose={() => setCommunicationDialog({ isOpen: false, match: null })}
      />

      <ClientCommunicationHistory
        jobId={clientCommunicationDialog.match?.job_id}
        jobTitle={clientCommunicationDialog.match?.job_title || ''}
        open={clientCommunicationDialog.isOpen}
        onClose={() => setClientCommunicationDialog({ isOpen: false, match: null })}
      />

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, match: null })}
        onConfirm={handleDelete}
        title="מחיקת התאמה"
        message={`האם למחוק את ההתאמה של ${deleteDialog.match?.candidate_name}?`}
        confirmText="מחק"
        variant="destructive"
      />
    </div>
  );
}