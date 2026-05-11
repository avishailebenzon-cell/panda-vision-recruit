import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { runChafshanim } from '@/functions/runChafshanim';
import CandidateResumeDialog from '../components/matches/CandidateResumeDialog';
import CandidateCommunicationHistory from '../components/candidates/CandidateCommunicationHistory';
import CandidateTimelineDialog from '../components/candidates/CandidateTimelineDialog';
import InterviewQuestionsDialog from '../components/candidates/InterviewQuestionsDialog';
import CandidateTasksDialog from '../components/tasks/CandidateTasksDialog';
import CreateTaskDialog from '../components/tasks/CreateTaskDialog';
import { Search, RefreshCw, User, Phone, MapPin, Shield, Eye, MessageCircle, Building2, ChevronUp, ChevronDown, ChevronsUpDown, Layers, MoreVertical, Clock, HelpCircle, Plus, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

const STATIC_CHAFSHANIM = [
  { id: 'rafael', label: 'חפשן רפאל', desc: 'מועמדים שעבדו ברפאל', color: 'bg-blue-50 text-blue-700 border-blue-200', tabColor: 'data-[state=active]:bg-blue-600 data-[state=active]:text-white' },
  { id: 'elbit', label: 'חפשן אלביט', desc: 'אלביט, IMI, תע"ש, אלאופ', color: 'bg-green-50 text-green-700 border-green-200', tabColor: 'data-[state=active]:bg-green-600 data-[state=active]:text-white' },
  { id: 'taa', label: 'חפשן תע"א', desc: 'תעשייה אווירית, IAI', color: 'bg-purple-50 text-purple-700 border-purple-200', tabColor: 'data-[state=active]:bg-purple-600 data-[state=active]:text-white' },
  { id: 'rama1', label: 'חפשן רמה 1', desc: 'סיווג בטחוני רמה 1', color: 'bg-red-50 text-red-700 border-red-200', tabColor: 'data-[state=active]:bg-red-600 data-[state=active]:text-white' },
];

const COLOR_THEME_MAP = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const SORT_COLS = [
  { key: 'candidate_name', label: 'שם מועמד' },
  { key: 'candidate_phone', label: 'טלפון' },
  { key: 'candidate_city', label: 'עיר' },
  { key: 'security_clearance', label: 'סיווג' },
  { key: 'detected_text', label: 'זוהה על בסיס' },
  { key: 'created_date', label: 'תאריך הוספה' },
];

export default function Chafshanim() {
  const [customConfigs, setCustomConfigs] = useState([]);
  const [results, setResults] = useState({ rafael: [], elbit: [], taa: [], rama1: [] });
  const [filtered, setFiltered] = useState({ rafael: [], elbit: [], taa: [], rama1: [] });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('rafael');
  const [search, setSearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCandidate, setHistoryCandidate] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showAll, setShowAll] = useState(false);
  const [timelineCandidate, setTimelineCandidate] = useState(null);
  const [interviewCandidate, setInterviewCandidate] = useState(null);
  const [tasksCandidate, setTasksCandidate] = useState(null);
  const [createTaskCandidate, setCreateTaskCandidate] = useState(null);

  const CHAFSHANIM = [
    ...STATIC_CHAFSHANIM,
    ...customConfigs.map(cfg => ({
      id: `custom_${cfg.id}`,
      label: cfg.name,
      desc: cfg.description || '',
      color: COLOR_THEME_MAP[cfg.color_theme] || COLOR_THEME_MAP.blue,
      tabColor: `data-[state=active]:bg-${cfg.color_theme || 'blue'}-600 data-[state=active]:text-white`,
    }))
  ];

  useEffect(() => { loadResults(); loadCustomConfigs(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    const newFiltered = {};
    CHAFSHANIM.forEach(c => {
      newFiltered[c.id] = q
        ? (results[c.id] || []).filter(r =>
            r.candidate_name?.toLowerCase().includes(q) ||
            r.candidate_city?.toLowerCase().includes(q) ||
            r.detected_text?.toLowerCase().includes(q)
          )
        : (results[c.id] || []);
    });
    setFiltered(newFiltered);
  }, [search, results]);

  const loadCustomConfigs = async () => {
    try {
      const customs = await base44.entities.CustomChafshanConfig.filter({ is_active: true });
      setCustomConfigs(customs || []);
    } catch {}
  };

  const loadResults = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ChafshanResult.list('-created_date', 5000);
      const allIds = [...STATIC_CHAFSHANIM.map(c => c.id)];
      const grouped = Object.fromEntries(allIds.map(id => [id, []]));
      (all || []).forEach(r => {
        if (!grouped[r.chafshan_type]) grouped[r.chafshan_type] = [];
        grouped[r.chafshan_type].push(r);
      });
      setResults(grouped);
      if (all && all.length > 0) setLastRun(all[0].created_date);
    } catch (e) {
      toast.error('שגיאה בטעינת נתונים');
    }
    setLoading(false);
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      await runChafshanim({ skip: 0 });
      toast.success('✅ הסריקה הופעלה ברקע - תוצאות יעדכנו אוטומטית. ניתן לעבור למסך אחר.');
    } catch (e) {
      toast.error('שגיאה בהפעלת החפשנים: ' + e.message);
    }
    setRunning(false);
    setTimeout(() => loadResults(), 3000);
  };

  const openCandidate = async (result) => {
    setCandidateLoading(true);
    try {
      const candidates = await base44.entities.Candidate.filter({ id: result.candidate_id });
      if (candidates && candidates.length > 0) {
        setSelectedCandidate(candidates[0]);
      } else {
        toast.error('המועמד לא נמצא במאגר');
      }
    } catch (e) {
      toast.error('שגיאה בטעינת המועמד');
    }
    setCandidateLoading(false);
  };

  const openHistory = (result) => {
    setHistoryCandidate({ id: result.candidate_id, full_name: result.candidate_name, phone_primary: result.candidate_phone });
    setShowHistory(true);
  };

  const openTimeline = async (result) => {
    const candidates = await base44.entities.Candidate.filter({ id: result.candidate_id });
    if (candidates && candidates.length > 0) setTimelineCandidate(candidates[0]);
  };

  const openInterview = async (result) => {
    const candidates = await base44.entities.Candidate.filter({ id: result.candidate_id });
    if (candidates && candidates.length > 0) setInterviewCandidate(candidates[0]);
  };

  const openTasks = async (result) => {
    const candidates = await base44.entities.Candidate.filter({ id: result.candidate_id });
    if (candidates && candidates.length > 0) setTasksCandidate(candidates[0]);
  };

  const openCreateTask = async (result) => {
    const candidates = await base44.entities.Candidate.filter({ id: result.candidate_id });
    if (candidates && candidates.length > 0) setCreateTaskCandidate(candidates[0]);
  };

  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const getSorted = (list) => {
    if (!sortConfig.key) return list;
    return [...list].sort((a, b) => {
      let aVal = a[sortConfig.key] || '';
      let bVal = b[sortConfig.key] || '';
      if (sortConfig.key === 'created_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      aVal = aVal.toString().toLowerCase();
      bVal = bVal.toString().toLowerCase();
      return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal, 'he') : bVal.localeCompare(aVal, 'he');
    });
  };

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline mr-1" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-3 h-3 inline mr-1 text-cyan-600" />
      : <ChevronDown className="w-3 h-3 inline mr-1 text-cyan-600" />;
  };

  const totalCount = CHAFSHANIM.reduce((sum, c) => sum + (results[c.id]?.length || 0), 0);

  const allResults = CHAFSHANIM.flatMap(c =>
    (results[c.id] || []).map(r => ({ ...r, _chafshan_label: c.label, _chafshan_color: c.color }))
  );
  const allFiltered = search
    ? allResults.filter(r =>
        r.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.candidate_city?.toLowerCase().includes(search.toLowerCase()) ||
        r.detected_text?.toLowerCase().includes(search.toLowerCase())
      )
    : allResults;

  const renderRow = (result, showChafshan = false) => (
    <tr key={result.id} className="hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-500" />
          </div>
          <span className="font-medium text-gray-900 text-sm">{result.candidate_name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-gray-600 text-sm">
          <Phone className="w-3 h-3 flex-shrink-0" />
          <span dir="ltr">{result.candidate_phone || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-gray-600 text-sm">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {result.candidate_city || '-'}
        </div>
      </td>
      <td className="px-4 py-3">
        {result.security_clearance && result.security_clearance !== 'לא רלוונטי' ? (
          <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-200 font-normal gap-1">
            <Shield className="w-3 h-3" />
            {result.security_clearance}
          </Badge>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      {showChafshan && (
        <td className="px-4 py-3">
          <Badge className={`text-xs font-normal border ${result._chafshan_color}`}>
            {result._chafshan_label}
          </Badge>
        </td>
      )}
      <td className="px-4 py-3">
        <Badge variant="outline" className="text-xs text-gray-600 font-normal max-w-32 truncate">
          <Building2 className="w-3 h-3 ml-1 flex-shrink-0" />
          <span className="truncate">{result.detected_text || 'זוהה'}</span>
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {result.created_date ? new Date(result.created_date).toLocaleDateString('he-IL') : '-'}
      </td>
      <td className="px-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => openCandidate(result)} className="gap-2 cursor-pointer" disabled={candidateLoading}>
              <Eye className="w-4 h-4" />
              פתח ק"ח
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openTimeline(result)} className="gap-2 cursor-pointer">
              <Clock className="w-4 h-4" />
              ציר זמן מועמד
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openInterview(result)} className="gap-2 cursor-pointer">
              <HelpCircle className="w-4 h-4" />
              שאלות למועמד
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openCreateTask(result)} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              הוסף משימה
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTasks(result)} className="gap-2 cursor-pointer">
              <CheckSquare className="w-4 h-4" />
              משימות
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );

  const renderTableHeader = (showChafshan = false) => (
    <tr className="border-b bg-gray-50/50">
      {[
        { key: 'candidate_name', label: 'שם מועמד' },
        { key: 'candidate_phone', label: 'טלפון' },
        { key: 'candidate_city', label: 'עיר' },
        { key: 'security_clearance', label: 'סיווג' },
        ...(showChafshan ? [{ key: '_chafshan_label', label: 'חפשן' }] : []),
        { key: 'detected_text', label: 'זוהה על בסיס' },
        { key: 'created_date', label: 'תאריך הוספה' },
      ].map(col => (
        <th key={col.key}
          className="px-4 py-3 text-right text-xs font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors"
          onClick={() => handleSort(col.key)}>
          <SortIcon col={col.key} />{col.label}
        </th>
      ))}
      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">פעולות</th>
    </tr>
  );

  return (
    <div className="p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">חפשנים</h1>
            <p className="text-sm text-gray-500">
              {totalCount.toLocaleString()} מועמדים זוהו סה"כ
              {lastRun && ` · עדכון אחרון: ${new Date(lastRun).toLocaleDateString('he-IL')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="חיפוש לפי שם / עיר..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48 h-9 text-sm"
          />
          <Button onClick={loadResults} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleRun} disabled={running} size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
            <Search className={`w-4 h-4 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'מריץ...' : 'הרץ חפשנים'}
          </Button>
        </div>
      </div>

      {/* Show All toggle */}
      <div className="mb-4">
        <Button
          variant={showAll ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowAll(v => !v)}
          className={`gap-2 ${showAll ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : ''}`}
        >
          <Layers className="w-4 h-4" />
          {showAll ? `כל התוצאות יחד (${allFiltered.length})` : 'הצג כל התוצאות יחד'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {CHAFSHANIM.map(c => (
          <button
            key={c.id}
            onClick={() => { setActiveTab(c.id); setShowAll(false); }}
            className={`rounded-xl p-4 border text-right transition-all ${c.color} ${activeTab === c.id && !showAll ? 'ring-2 ring-offset-1 ring-gray-400 shadow-md' : 'hover:shadow-sm'}`}
          >
            <div className="text-3xl font-bold">{results[c.id]?.length || 0}</div>
            <div className="text-sm font-semibold mt-1">{c.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{c.desc}</div>
          </button>
        ))}
      </div>

      {/* All results table */}
      {showAll && (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm mb-6">
          <div className="bg-gray-50 px-4 py-2 border-b text-xs text-gray-500 font-medium">
            {allFiltered.length} מועמדים — כל החפשנים
          </div>
          {loading ? (
            <div className="text-center py-10 text-gray-400">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
              <p>טוען...</p>
            </div>
          ) : allFiltered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>לא נמצאו תוצאות</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>{renderTableHeader(true)}</thead>
                <tbody className="divide-y divide-gray-100">
                  {getSorted(allFiltered).map(r => renderRow(r, true))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {!showAll && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-gray-100 p-1 rounded-xl gap-1">
            {CHAFSHANIM.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="gap-2 text-sm">
                {c.label}
                <span className="bg-white text-gray-600 border rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {search ? filtered[c.id]?.length : results[c.id]?.length || 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {CHAFSHANIM.map(c => (
            <TabsContent key={c.id} value={c.id}>
              {loading ? (
                <div className="text-center py-16 text-gray-400">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
                  <p>טוען...</p>
                </div>
              ) : !filtered[c.id]?.length ? (
                <div className="text-center py-16 text-gray-400">
                  <Search className="w-14 h-14 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">{search ? 'לא נמצאו תוצאות לחיפוש' : 'לא נמצאו מועמדים עדיין'}</p>
                  {!search && <p className="text-sm mt-1">לחץ "הרץ חפשנים" כדי לסרוק את המאגר</p>}
                </div>
              ) : (
                <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-4 py-2 border-b text-xs text-gray-500 font-medium">
                    {filtered[c.id].length} מועמדים
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>{renderTableHeader(false)}</thead>
                      <tbody className="divide-y divide-gray-100">
                        {getSorted(filtered[c.id]).map(r => renderRow(r, false))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Candidate Resume Dialog */}
      {selectedCandidate && (
        <CandidateResumeDialog
          candidate={selectedCandidate}
          open={!!selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onUpdate={(updated) => setSelectedCandidate(updated)}
        />
      )}

      {/* Communication History */}
      {showHistory && historyCandidate && (
        <CandidateCommunicationHistory
          candidate={historyCandidate}
          onClose={() => { setShowHistory(false); setHistoryCandidate(null); }}
        />
      )}

      {timelineCandidate && (
        <CandidateTimelineDialog
          candidate={timelineCandidate}
          isOpen={!!timelineCandidate}
          onClose={() => setTimelineCandidate(null)}
        />
      )}

      {interviewCandidate && (
        <InterviewQuestionsDialog
          candidate={interviewCandidate}
          isOpen={!!interviewCandidate}
          onClose={() => setInterviewCandidate(null)}
        />
      )}

      {tasksCandidate && (
        <CandidateTasksDialog
          candidate={tasksCandidate}
          isOpen={!!tasksCandidate}
          onClose={() => setTasksCandidate(null)}
        />
      )}

      {createTaskCandidate && (
        <CreateTaskDialog
          candidate={createTaskCandidate}
          isOpen={!!createTaskCandidate}
          onClose={() => setCreateTaskCandidate(null)}
          onSave={() => setCreateTaskCandidate(null)}
        />
      )}
    </div>
  );
}