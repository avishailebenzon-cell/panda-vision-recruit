import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MoreHorizontal, Send, MessageCircle, Building, BrainCircuit, Bot, RefreshCw,
  Lightbulb, MessageSquare, PlusSquare, ClipboardList, Briefcase, UserIcon, UserMinus,
  Trash2, ArrowUpDown, UserCheck, Loader2, GitCommitHorizontal, CheckCircle2, Circle, Group, Info
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MatchReasonsPopover from './MatchReasonsPopover';
import BlurredText from '../ui/BlurredText';
import CopyOnHover from '../ui/CopyOnHover';
import { toast } from 'sonner';
import CandidateTimelineDialog from '../candidates/CandidateTimelineDialog';
import { base44 } from '@/api/base44Client';

export default function UnifiedTableView({
  matches,
  jobs,
  candidates,
  agentColor = 'orange',
  notesCountByMatch = new Map(),
  communicationsCountByCandidate = new Map(),
  clientCommunicationsCountByJob = new Map(),
  candidateMatchCountMap = {},
  betterMatchByMatchId = new Map(),
  revalidatingSingle,
  tasksCountByMatch = new Map(),
  userNotesCountByMatch = new Map(),
  agentConversationByMatch = new Map(),
  user,
  onUnifiedSend,
  onCommunicationHistory,
  onClientCommunication,
  onInterviewQuestions,
  onAgentFeedback,
  onRevalidate,
  onJustification,
  onNotes,
  onCreateTask,
  onCandidateTasks,
  onShowCandidateJobs,
  onEditCandidate,
  onMarkIrrelevant,
  onDelete,
  onOpenResume,
  onRefreshData
}) {
  const [sortConfig, setSortConfig] = useState({ key: 'match_score', direction: 'desc' });
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null); // { match, x, y }
  const contextMenuRef = useRef(null);
  const [timelineDialog, setTimelineDialog] = useState({ open: false, candidate: null });
  const [markingHandled, setMarkingHandled] = useState(null);
  const [localMatches, setLocalMatches] = useState(matches);
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem('unifiedTableGroupBy') || 'none');

  // Sync localMatches when matches prop changes
  useEffect(() => {
    setLocalMatches(matches);
  }, [matches]);

  const handleMarkAsHandled = async (match) => {
    const isCurrentlyHandled = match.is_manually_handled;
    setMarkingHandled(match.id);
    
    try {
      // Update local state immediately for instant visual feedback
      setLocalMatches(prev => prev.map(m => 
        m.id === match.id 
          ? { 
              ...m, 
              is_manually_handled: !isCurrentlyHandled,
              manually_handled_date: !isCurrentlyHandled ? new Date().toISOString() : null,
              manually_handled_by_user_id: !isCurrentlyHandled ? user.id : null,
              manually_handled_by_user_name: !isCurrentlyHandled ? user.full_name || user.email : null
            }
          : m
      ));
      
      // Update in database
      await base44.entities.Match.update(match.id, {
        is_manually_handled: !isCurrentlyHandled,
        manually_handled_date: !isCurrentlyHandled ? new Date().toISOString() : null,
        manually_handled_by_user_id: !isCurrentlyHandled ? user.id : null,
        manually_handled_by_user_name: !isCurrentlyHandled ? user.full_name || user.email : null
      });
      
      toast.success(isCurrentlyHandled ? 'סימון הטיפול בוטל' : 'ההתאמה סומנה כטופלה');
      
      // Trigger parent refresh in background
      onRefreshData?.();
    } catch (error) {
      console.error('Error marking as handled:', error);
      toast.error('שגיאה בעדכון סטטוס הטיפול');
      // Revert local state on error
      setLocalMatches(matches);
    } finally {
      setMarkingHandled(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const handleRowClick = (e, match) => {
    // Only open if clicking on an empty area (the TableRow itself or TableCell), not on interactive elements
    const tag = e.target.tagName.toLowerCase();
    const interactiveTags = ['button', 'a', 'input', 'textarea', 'select', 'label', 'svg', 'path', 'span', 'p'];
    if (interactiveTags.includes(tag)) return;
    if (e.target.closest('button, a, input, [role="checkbox"], [data-radix-collection-item]')) return;

    e.preventDefault();
    setContextMenu({ match, x: e.clientX, y: e.clientY });
  };

  const jobsMap = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);
  const candidatesMap = useMemo(() => new Map(candidates.map(c => [c.id, c])), [candidates]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedMatches = useMemo(() => {
    const sorted = [...localMatches];
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
        aVal = new Date(a.created_date);
        bVal = new Date(b.created_date);
      } else if (sortConfig.key === 'priority') {
        const jobA = jobsMap.get(a.job_id);
        const jobB = jobsMap.get(b.job_id);
        const priorityMap = {
          "עדיפות גיוס 1": 1,
          "עדיפות גיוס 2": 2,
          "עדיפות גיוס 3": 3,
          "עדיפות גיוס 4": 4,
          "עדיפות גיוס 5": 5
        };
        aVal = priorityMap[jobA?.recruitment_priority] || 99;
        bVal = priorityMap[jobB?.recruitment_priority] || 99;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [localMatches, sortConfig, jobsMap]);

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
      } else if (groupBy === 'priority') {
        const job = jobsMap.get(match.job_id);
        groupKey = job?.recruitment_priority || 'ללא עדיפות';
        groupLabel = job?.recruitment_priority || 'ללא עדיפות';
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { key: groupKey, label: groupLabel, matches: [] });
      }
      groups.get(groupKey).matches.push(match);
    });
    
    return Array.from(groups.values());
  }, [sortedMatches, groupBy, jobsMap]);

  const toggleSelectAll = () => {
    if (selectedMatches.size === localMatches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(localMatches.map(m => m.id)));
    }
  };

  const toggleSelect = (matchId) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

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

  const ContextMenuContent = ({ match }) => {
    if (!match) return null;
    const menuItems = [
      { label: 'ציר זמן מועמד', icon: <GitCommitHorizontal className="w-4 h-4 text-blue-700" />, onClick: () => { const c = candidatesMap.get(match.candidate_id); setTimelineDialog({ open: true, candidate: c || { id: match.candidate_id, full_name: match.candidate_name } }); } },
      null,
      { 
        label: match.is_manually_handled ? '✓ סומן כטופלה - בטל' : 'סמן התאמה כטופלה', 
        icon: match.is_manually_handled 
          ? <CheckCircle2 className="w-4 h-4 text-blue-700" /> 
          : <Circle className="w-4 h-4 text-gray-500" />, 
        onClick: () => handleMarkAsHandled(match),
        special: match.is_manually_handled
      },
      null,
      { label: 'שלח הודעה', icon: <Send className="w-4 h-4 text-blue-600" />, onClick: () => onUnifiedSend?.(match) },
      { label: 'הסטוריית מועמד', icon: <MessageCircle className={`w-4 h-4 ${communicationsCountByCandidate.get(match.candidate_id) > 0 ? 'text-purple-600' : 'text-purple-400'}`} />, onClick: () => onCommunicationHistory?.(match) },
      { label: 'הסטוריית לקוח', icon: <Building className={`w-4 h-4 ${clientCommunicationsCountByJob.get(match.job_id) > 0 ? 'text-blue-600' : 'text-blue-400'}`} />, onClick: () => onClientCommunication?.(match) },
      { label: 'שאלות לראיון', icon: <BrainCircuit className="w-4 h-4 text-purple-600" />, onClick: () => onInterviewQuestions?.(match) },
      { label: 'שיחה עם הסוכן', icon: <Bot className={`w-4 h-4 text-${agentColor}-600`} />, onClick: () => onAgentFeedback?.(match) },
      { label: 'בדוק מחדש', icon: <RefreshCw className="w-4 h-4 text-blue-600" />, onClick: () => onRevalidate?.(match) },
      { label: 'נמק התאמה', icon: <Lightbulb className={`w-4 h-4 text-${agentColor}-600`} />, onClick: () => onJustification?.(match) },
      { label: `הערות${notesCountByMatch.get(match.id) > 0 ? ` (${notesCountByMatch.get(match.id)})` : ''}`, icon: <MessageSquare className={`w-4 h-4 ${notesCountByMatch.get(match.id) > 0 ? 'text-gray-800' : 'text-gray-400'}`} />, onClick: () => onNotes?.(match) },
      null,
      { label: 'יצירת משימה', icon: <PlusSquare className="w-4 h-4 text-blue-600" />, onClick: () => onCreateTask?.(match) },
      { label: 'משימות', icon: <ClipboardList className="w-4 h-4 text-blue-500" />, onClick: () => onCandidateTasks?.(match) },
      { label: `משרות נוספות${(candidateMatchCountMap[match.candidate_id] || 0) > 0 ? ` (${candidateMatchCountMap[match.candidate_id]})` : ''}`, icon: <Briefcase className={`w-4 h-4 ${(candidateMatchCountMap[match.candidate_id] || 0) > 0 ? 'text-blue-600' : 'text-gray-400'}`} />, onClick: () => onShowCandidateJobs?.(match) },
      null,
      { label: 'עריכת מועמד', icon: <UserIcon className="w-4 h-4" />, onClick: () => onEditCandidate?.(match) },
      { label: 'סמן כלא רלוונטי', icon: <UserMinus className={`w-4 h-4 text-${agentColor}-500`} />, onClick: () => onMarkIrrelevant?.(match) },
      ...(user?.can_delete_matches ? [{ label: 'מחק התאמה', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDelete?.(match), danger: true }] : []),
    ];
    return (
      <div
        ref={contextMenuRef}
        style={{
          position: 'fixed',
          top: Math.min(contextMenu.y, window.innerHeight - 420),
          right: Math.max(window.innerWidth - contextMenu.x, 8),
          zIndex: 9999
        }}
        className="bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-52 text-sm"
        dir="rtl"
      >
        {menuItems.map((item, i) =>
          item === null ? (
            <div key={i} className="border-t border-gray-100 my-1" />
          ) : (
            <button
              key={i}
              className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-right ${
                item.danger 
                  ? 'text-red-600 hover:bg-red-50' 
                  : item.special 
                    ? 'text-blue-700 font-semibold bg-blue-50' 
                    : 'text-gray-700'
              }`}
              onClick={() => { setContextMenu(null); item.onClick(); }}
            >
              {item.icon}
              {item.label}
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <>
    <div className="space-y-4">
      {/* Summary and grouping controls */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className={`w-4 h-4 text-${agentColor}-600`} />
            <span className="font-semibold text-gray-700">מוצגים כעת:</span>
            <Badge className={`bg-${agentColor}-100 text-${agentColor}-800 font-bold`}>
              {localMatches.length} מועמדים
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Group className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">קיבוץ לפי:</span>
            <Select value={groupBy} onValueChange={(val) => { setGroupBy(val); localStorage.setItem('unifiedTableGroupBy', val); }}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא קיבוץ</SelectItem>
                <SelectItem value="candidate">שם מועמד</SelectItem>
                <SelectItem value="job">משרה</SelectItem>
                <SelectItem value="priority">עדיפות</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedMatches.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-blue-900">
              נבחרו {selectedMatches.size} התאמות
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedMatches(new Set())}
            >
              בטל בחירה
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={async () => {
                if (!confirm(`לסמן ${selectedMatches.size} התאמות כטופלו?`)) return;
                try {
                  // Update local state immediately for all selected matches
                  setLocalMatches(prev => prev.map(m => 
                    selectedMatches.has(m.id)
                      ? { 
                          ...m, 
                          is_manually_handled: true,
                          manually_handled_date: new Date().toISOString(),
                          manually_handled_by_user_id: user.id,
                          manually_handled_by_user_name: user.full_name || user.email
                        }
                      : m
                  ));
                  
                  // Update in database
                  const updates = Array.from(selectedMatches).map(matchId =>
                    base44.entities.Match.update(matchId, {
                      is_manually_handled: true,
                      manually_handled_date: new Date().toISOString(),
                      manually_handled_by_user_id: user.id,
                      manually_handled_by_user_name: user.full_name || user.email
                    })
                  );
                  await Promise.all(updates);
                  
                  setSelectedMatches(new Set());
                  toast.success(`${selectedMatches.size} התאמות סומנו כטופלו`);
                  onRefreshData?.();
                } catch (error) {
                  console.error('Error in bulk mark as handled:', error);
                  toast.error('שגיאה בעדכון ההתאמות');
                  // Revert local state on error
                  setLocalMatches(matches);
                }
              }}
            >
              <CheckCircle2 className="w-4 h-4 ml-1" />
              סמן כטופלה
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50"
              onClick={async () => {
                if (!confirm(`לפתוח שיחה עם הסוכן עבור ${selectedMatches.size} התאמות?`)) return;
                const selectedMatchObjects = localMatches.filter(m => selectedMatches.has(m.id));
                for (const match of selectedMatchObjects) {
                  onAgentFeedback?.(match);
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
                setSelectedMatches(new Set());
              }}
            >
              <Bot className="w-4 h-4 ml-1" />
              שיחה עם הסוכן
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-orange-600 text-orange-600 hover:bg-orange-50"
              onClick={async () => {
                if (!confirm(`לסמן ${selectedMatches.size} מועמדים כלא רלוונטיים? פעולה זו תסיר אותם מכל ההתאמות במערכת.`)) return;
                try {
                  const selectedMatchObjects = localMatches.filter(m => selectedMatches.has(m.id));
                  const candidateIds = [...new Set(selectedMatchObjects.map(m => m.candidate_id))];
                  
                  const updates = candidateIds.map(candidateId =>
                    base44.entities.Candidate.update(candidateId, {
                      status: "לא מתאים - נסגר"
                    })
                  );
                  await Promise.all(updates);
                  
                  setSelectedMatches(new Set());
                  toast.success(`${candidateIds.length} מועמדים סומנו כלא רלוונטיים`);
                  onRefreshData?.();
                } catch (error) {
                  toast.error('שגיאה בעדכון המועמדים');
                }
              }}
            >
              <UserMinus className="w-4 h-4 ml-1" />
              סמן כלא רלוונטי
            </Button>
            {user?.can_delete_matches && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (!confirm(`למחוק ${selectedMatches.size} התאמות? פעולה זו אינה ניתנת לביטול.`)) return;
                  try {
                    // Update local state immediately - remove selected matches
                    setLocalMatches(prev => prev.filter(m => !selectedMatches.has(m.id)));
                    
                    // Delete from database
                    const deletes = Array.from(selectedMatches).map(matchId =>
                      base44.entities.Match.delete(matchId)
                    );
                    await Promise.all(deletes);
                    
                    setSelectedMatches(new Set());
                    toast.success(`${selectedMatches.size} התאמות נמחקו`);
                    onRefreshData?.();
                  } catch (error) {
                    console.error('Error in bulk delete:', error);
                    toast.error('שגיאה במחיקת ההתאמות');
                    // Revert local state on error
                    setLocalMatches(matches);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 ml-1" />
                מחק התאמות
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedMatches.size === localMatches.length && localMatches.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="min-w-[150px]">
                <SortButton column="candidate_name">מועמד</SortButton>
              </TableHead>
              <TableHead className="min-w-[180px]">
                <SortButton column="job_title">משרה</SortButton>
              </TableHead>
              <TableHead className="min-w-[100px]">
                <SortButton column="match_score">התאמה</SortButton>
              </TableHead>
              <TableHead className="min-w-[100px]">
                <SortButton column="priority">עדיפות</SortButton>
              </TableHead>
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
                    <TableCell colSpan={7} className="font-bold text-gray-800 py-2">
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
              
              const hasTask = (tasksCountByMatch.get(match.id) || 0) > 0;
              const hasAgentConversation = agentConversationByMatch.get(match.id) === true;
              
              const isHandled = (
                hasTask ||
                (userNotesCountByMatch.get(match.id) || 0) > 0 ||
                hasAgentConversation
              );

              // Only use the actual manually_handled flag from the database
              const isManuallyHandled = match.is_manually_handled === true;

              return (
                <TableRow 
                  key={match.id} 
                  className={`${
                    isManuallyHandled 
                      ? 'bg-gradient-to-l from-blue-200 via-cyan-200 to-blue-200 border-r-4 border-r-blue-600 shadow-md' 
                      : isHandled 
                        ? 'bg-green-50 border-r-2 border-r-green-400' 
                        : !match.is_read 
                          ? `bg-${agentColor}-50` 
                          : ''
                  } hover:bg-gray-50 cursor-default`}
                  onClick={(e) => handleRowClick(e, match)}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedMatches.has(match.id)}
                      onCheckedChange={() => toggleSelect(match.id)}
                    />
                  </TableCell>
                  
                  <TableCell className="font-medium">
                    <div className="flex items-start gap-2">
                      <div className={`w-8 h-8 bg-${agentColor}-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <UserCheck className={`w-4 h-4 text-${agentColor}-600`} />
                      </div>
                      <div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenResume) {
                              onOpenResume(candidate || { id: match.candidate_id, full_name: match.candidate_name });
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
                    <div className="flex-1">
                      {job && (job.description || job.requirements) ? (
                        <Popover>
                          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="font-medium text-blue-700 hover:text-blue-900 underline decoration-dotted text-right w-full text-start">
                              {match.job_title}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 max-h-80 overflow-y-auto" align="start">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">{job.title}</h4>
                                <button
                                  onClick={() => {
                                    const text = [job.title, job.description, job.requirements, job.dana_supplement].filter(Boolean).join('\n\n');
                                    navigator.clipboard.writeText(text);
                                    toast.success('הטקסט הועתק ללוח');
                                  }}
                                  className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 hover:bg-gray-50 transition-colors"
                                  title="העתק טקסט משרה"
                                >
                                  העתק
                                </button>
                              </div>
                              {job.description && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">תיאור המשרה:</p>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
                                </div>
                              )}
                              {job.requirements && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">דרישות:</p>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.requirements}</p>
                                </div>
                              )}
                              {job.dana_supplement && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">תוספת דנה:</p>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.dana_supplement}</p>
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
                      betterMatch={betterMatchByMatchId.get(match.id)}
                    />
                  </TableCell>

                  <TableCell>
                    {(() => {
                      const priorityColors = {
                        "עדיפות גיוס 1": "bg-red-100 text-red-800 border-red-300",
                        "עדיפות גיוס 2": "bg-yellow-100 text-yellow-800 border-yellow-300",
                        "עדיפות גיוס 3": "bg-orange-100 text-orange-800 border-orange-300",
                        "עדיפות גיוס 4": "bg-green-100 text-green-800 border-green-300",
                        "עדיפות גיוס 5": "bg-gray-100 text-gray-700 border-gray-300"
                      };
                      return job?.recruitment_priority ? (
                        <Badge className={`${priorityColors[job.recruitment_priority]} font-bold text-xs border`}>
                          {job.recruitment_priority}
                        </Badge>
                      ) : <span className="text-gray-400 text-xs">-</span>;
                    })()}
                    {job?.security_clearance === 'רמה 1' && (
                      <Badge className="bg-red-600 text-white font-bold text-xs mr-1">רמה 1</Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-xs hidden lg:table-cell">
                    {(() => {
                      const cvDate = candidate?.cv_received_date || candidate?.source_email_date;
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

                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-52">
                        <DropdownMenuItem onClick={() => { const c = candidatesMap.get(match.candidate_id); setTimelineDialog({ open: true, candidate: c || { id: match.candidate_id, full_name: match.candidate_name } }); }}>
                          <GitCommitHorizontal className="w-4 h-4 text-blue-700 shrink-0 ml-2" />
                          ציר זמן מועמד
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleMarkAsHandled(match)}
                          disabled={markingHandled === match.id}
                          className={match.is_manually_handled ? 'bg-blue-50 text-blue-700 font-semibold' : ''}
                        >
                          {markingHandled === match.id ? (
                            <Loader2 className="w-4 h-4 shrink-0 ml-2 animate-spin text-blue-700" />
                          ) : match.is_manually_handled ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 ml-2 text-blue-700" />
                          ) : (
                            <Circle className="w-4 h-4 shrink-0 ml-2 text-gray-500" />
                          )}
                          {match.is_manually_handled ? '✓ סומן כטופלה - בטל' : 'סמן התאמה כטופלה'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onUnifiedSend?.(match)}>
                          <Send className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                          שלח הודעה
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCommunicationHistory?.(match)}>
                          <MessageCircle className={`w-4 h-4 shrink-0 ml-2 ${communicationsCountByCandidate.get(match.candidate_id) > 0 ? 'text-purple-600' : 'text-purple-400'}`} />
                          הסטוריית מועמד
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onClientCommunication?.(match)}>
                          <Building className={`w-4 h-4 shrink-0 ml-2 ${clientCommunicationsCountByJob.get(match.job_id) > 0 ? 'text-blue-600' : 'text-blue-400'}`} />
                          הסטוריית לקוח
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onInterviewQuestions?.(match)}>
                          <BrainCircuit className="w-4 h-4 text-purple-600 shrink-0 ml-2" />
                          שאלות לראיון
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAgentFeedback?.(match)}>
                          <Bot className={`w-4 h-4 text-${agentColor}-600 shrink-0 ml-2`} />
                          שיחה עם הסוכן
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRevalidate?.(match)} disabled={revalidatingSingle === match.id}>
                          {revalidatingSingle === match.id ? (
                            <Loader2 className="w-4 h-4 text-blue-600 shrink-0 ml-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                          )}
                          בדוק מחדש
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onJustification?.(match)}>
                          <Lightbulb className={`w-4 h-4 text-${agentColor}-600 shrink-0 ml-2`} />
                          נמק התאמה
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onNotes?.(match)}>
                          <MessageSquare className={`w-4 h-4 shrink-0 ml-2 ${notesCountByMatch.get(match.id) > 0 ? 'text-gray-800' : 'text-gray-400'}`} />
                          הערות {notesCountByMatch.get(match.id) > 0 && `(${notesCountByMatch.get(match.id)})`}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onCreateTask?.(match)}>
                          <PlusSquare className="w-4 h-4 shrink-0 ml-2 text-blue-600" />
                          יצירת משימה
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCandidateTasks?.(match)}>
                          <ClipboardList className="w-4 h-4 shrink-0 ml-2 text-blue-500" />
                          משימות
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onShowCandidateJobs?.(match)}>
                          <Briefcase className={`w-4 h-4 shrink-0 ml-2 ${(candidateMatchCountMap[match.candidate_id] || 0) > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                          משרות נוספות {(candidateMatchCountMap[match.candidate_id] || 0) > 0 && `(${candidateMatchCountMap[match.candidate_id]})`}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEditCandidate?.(match)}>
                          <UserIcon className="w-4 h-4 shrink-0 ml-2" />
                          עריכת מועמד
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkIrrelevant?.(match)}>
                          <UserMinus className={`w-4 h-4 text-${agentColor}-500 shrink-0 ml-2`} />
                          סמן כלא רלוונטי
                        </DropdownMenuItem>
                        {user?.can_delete_matches && (
                          <DropdownMenuItem
                            onClick={async () => {
                              if (selectedMatches.size > 0 && selectedMatches.has(match.id)) {
                                // Bulk delete all selected
                                if (!confirm(`למחוק ${selectedMatches.size} התאמות מסומנות? פעולה זו אינה ניתנת לביטול.`)) return;
                                try {
                                  setLocalMatches(prev => prev.filter(m => !selectedMatches.has(m.id)));
                                  await Promise.all(Array.from(selectedMatches).map(id => base44.entities.Match.delete(id)));
                                  setSelectedMatches(new Set());
                                  toast.success(`${selectedMatches.size} התאמות נמחקו`);
                                  onRefreshData?.();
                                } catch (error) {
                                  toast.error('שגיאה במחיקת ההתאמות');
                                  setLocalMatches(matches);
                                }
                              } else {
                                onDelete?.(match);
                              }
                            }}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 shrink-0 ml-2" />
                            {selectedMatches.size > 0 && selectedMatches.has(match.id)
                              ? `מחק ${selectedMatches.size} התאמות מסומנות`
                              : 'מחק התאמה'}
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
    </div>
    {contextMenu && <ContextMenuContent match={contextMenu.match} />}
    <CandidateTimelineDialog
      open={timelineDialog.open}
      candidate={timelineDialog.candidate}
      onClose={() => setTimelineDialog({ open: false, candidate: null })}
    />
    </>
  );
}