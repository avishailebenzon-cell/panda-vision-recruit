import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";
import MobileMatchRow from "../components/MobileMatchRow";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import UnifiedSendDialog from "@/components/matches/UnifiedSendDialog";
import MatchNotesDialog from "@/components/matches/MatchNotesDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MobileLiorPage() {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [matchesData, jobsData, candidatesData, statusesData] = await Promise.all([
          base44.entities.Match.filter({ user_app_role: "lior" }, '-created_date'),
          base44.entities.Job.list(),
          base44.entities.Candidate.list(),
          base44.entities.CandidateStatus.list()
        ]);
        setMatches(matchesData); setJobs(jobsData); setCandidates(candidatesData); setStatuses(statusesData);
      } catch (error) {
        console.error("Error:", error);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    let filtered = [...matches];
    if (searchTerm) filtered = filtered.filter(m => m.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.job_title?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (statusFilter !== "all") filtered = filtered.filter(m => m.status === statusFilter);
    if (scoreFilter === "high") filtered = filtered.filter(m => m.match_score >= 80);
    else if (scoreFilter === "medium") filtered = filtered.filter(m => m.match_score >= 60 && m.match_score < 80);
    else if (scoreFilter === "low") filtered = filtered.filter(m => m.match_score < 60);
    if (readFilter === "unread") filtered = filtered.filter(m => !m.is_read);
    else if (readFilter === "read") filtered = filtered.filter(m => m.is_read);
    setFilteredMatches(filtered);
  }, [matches, searchTerm, statusFilter, scoreFilter, readFilter]);

  const handleMatchClick = async (match) => {
    setSelectedMatch(match);
    if (!match.is_read) {
      await base44.entities.Match.update(match.id, { is_read: true });
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_read: true } : m));
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div></div>;

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-amber-100 to-amber-50"><CardHeader className="pb-3"><CardTitle className="text-lg">ליאור - מומחה הנדסת מערכת</CardTitle></CardHeader></Card>
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative"><Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="חיפוש..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" /></div>
          <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal className="w-4 h-4" /></Button>
        </div>
        {showFilters && (
          <Card className="p-3 space-y-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="סטטוס" /></SelectTrigger><SelectContent><SelectItem value="all">כל הסטטוסים</SelectItem>{statuses.map(s => <SelectItem key={s.status_number} value={s.status_name}>{s.status_name}</SelectItem>)}</SelectContent></Select>
            <Select value={scoreFilter} onValueChange={setScoreFilter}><SelectTrigger><SelectValue placeholder="ציון" /></SelectTrigger><SelectContent><SelectItem value="all">כל הציונים</SelectItem><SelectItem value="high">גבוה (80%+)</SelectItem><SelectItem value="medium">בינוני (60-80%)</SelectItem><SelectItem value="low">נמוך (&lt;60%)</SelectItem></SelectContent></Select>
            <Select value={readFilter} onValueChange={setReadFilter}><SelectTrigger><SelectValue placeholder="מצב קריאה" /></SelectTrigger><SelectContent><SelectItem value="all">הכל</SelectItem><SelectItem value="unread">לא נקרא</SelectItem><SelectItem value="read">נקרא</SelectItem></SelectContent></Select>
          </Card>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-xs text-gray-600 px-1">{filteredMatches.length} התאמות</div>
        {filteredMatches.map(match => <MobileMatchRow key={match.id} match={match} onClick={() => handleMatchClick(match)} />)}
      </div>
      {selectedMatch && (
        <Sheet open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader><SheetTitle className="text-right">פרטי התאמה</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-4">
              <div><div className="text-sm font-semibold text-gray-700">מועמד</div><div className="text-base">{selectedMatch.candidate_name}</div></div>
              <div><div className="text-sm font-semibold text-gray-700">משרה</div><div className="text-base">{selectedMatch.job_title}</div></div>
              <div><div className="text-sm font-semibold text-gray-700">ציון התאמה</div><div className="text-2xl font-bold text-green-600">{Math.round(selectedMatch.match_score || 0)}%</div></div>
              <div><div className="text-sm font-semibold text-gray-700">סיבות התאמה</div><div className="text-sm text-gray-600">{selectedMatch.match_reasons || 'אין מידע'}</div></div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={() => setShowSendDialog(true)}>שלח ללקוח</Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowNotesDialog(true)}>הערות</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
      {selectedMatch && showSendDialog && <UnifiedSendDialog isOpen={showSendDialog} onClose={() => setShowSendDialog(false)} initialMatches={[selectedMatch]} jobs={jobs} candidates={candidates} statuses={statuses} onMatchesUpdate={() => { setMatches(prev => prev.filter(m => m.id !== selectedMatch.id)); setSelectedMatch(null); }} />}
      {selectedMatch && showNotesDialog && <MatchNotesDialog isOpen={showNotesDialog} onClose={() => setShowNotesDialog(false)} matchId={selectedMatch.id} />}
    </div>
  );
}