import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Send, MessageSquare, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import UnifiedSendDialog from "@/components/matches/UnifiedSendDialog";
import MatchNotesDialog from "@/components/matches/MatchNotesDialog";

export default function MobileNaamaPage() {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [agentStatus, setAgentStatus] = useState(null);
  const [scoreFilter, setScoreFilter] = useState("80+");
  const [selectedRows, setSelectedRows] = useState(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [matchesData, jobsData, candidatesData] = await Promise.all([
        base44.entities.Match.filter({ user_name: 'נעמה (סוכן AI)' }, '-created_date'),
        base44.entities.Job.list(),
        base44.entities.Candidate.list('-created_date', 500)
      ]);

      setMatches(matchesData);
      setJobs(jobsData);
      setCandidates(candidatesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("שגיאה בטעינת נתונים");
    }
    setLoading(false);
  };

  const loadAgentStatus = async () => {
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'naama' });
      if (statuses.length > 0) {
        setAgentStatus(statuses[0]);
      }
    } catch (error) {
      console.error("Error loading agent status:", error);
    }
  };

  useEffect(() => {
    loadData();
    loadAgentStatus();
  }, []);

  useEffect(() => {
    const filtered = matches.filter(m => {
      const scoreMatch = scoreFilter === "80+" 
        ? (m.match_score || 0) >= 80
        : scoreFilter === "70+"
        ? (m.match_score || 0) >= 70
        : true;

      const searchMatch = !searchTerm ||
        m.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.job_title?.toLowerCase().includes(searchTerm.toLowerCase());

      return scoreMatch && searchMatch;
    });

    setFilteredMatches(filtered);
  }, [matches, searchTerm, scoreFilter]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      const { runNaamaAgent } = await import('@/functions/runNaamaAgent');
      await runNaamaAgent({});
      toast.success('נעמה התחילה לרוץ');
      setTimeout(() => {
        loadAgentStatus();
      }, 2000);
    } catch (error) {
      console.error('Error running agent:', error);
      toast.error('שגיאה בהפעלת נעמה');
    } finally {
      setRunningAgent(false);
    }
  };

  const handleMatchSelected = (match) => {
    setSelectedMatch(match);
  };

  const handleMatchRemoved = (matchId) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setSelectedMatch(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const notesCount = selectedMatch
    ? matches.filter(m => m.id === selectedMatch.id).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Agent Card */}
      <Card className="bg-gradient-to-r from-orange-100 to-orange-50 border-orange-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">נעמה - תוכנה</CardTitle>
              <p className="text-xs text-gray-600">
                {filteredMatches.length} התאמות
              </p>
            </div>
            <Button
              onClick={handleRunAgent}
              disabled={runningAgent || agentStatus?.is_running}
              className="bg-orange-600 hover:bg-orange-700 gap-2 h-10"
              size="sm"
            >
              {runningAgent || agentStatus?.is_running ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              הפעלה
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="חיפוש..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 h-10"
          />
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {["50+", "70+", "80+"].map(score => (
          <Button
            key={score}
            variant={scoreFilter === score ? "default" : "outline"}
            size="sm"
            onClick={() => setScoreFilter(score)}
            className={scoreFilter === score ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            {score}
          </Button>
        ))}
      </div>

      {/* Matches Table */}
      {filteredMatches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            אין התאמות להצגה
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="text-right">מועמד</TableHead>
                  <TableHead className="text-right">משרה</TableHead>
                  <TableHead className="text-right w-20">ציון</TableHead>
                  <TableHead className="text-right w-20">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.map(match => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(match.id)}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedRows);
                          if (checked) newSelected.add(match.id);
                          else newSelected.delete(match.id);
                          setSelectedRows(newSelected);
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {match.candidate_name}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-600">
                      {match.job_title}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-orange-100 text-orange-800">
                        {Math.round(match.match_score || 0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMatchSelected(match)}
                        className="h-8 text-xs"
                      >
                        פרטים
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Match Details Sheet */}
      {selectedMatch && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto z-50">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">פרטי התאמה</h3>
              <Button
                variant="ghost"
                onClick={() => setSelectedMatch(null)}
                className="text-xs"
              >
                סגור
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600">מועמד</p>
                <p className="text-sm text-gray-900">{selectedMatch.candidate_name}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600">משרה</p>
                <p className="text-sm text-gray-900">{selectedMatch.job_title}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600">ציון התאמה</p>
                <p className="text-2xl font-bold text-orange-600">
                  {Math.round(selectedMatch.match_score || 0)}%
                </p>
              </div>

              {selectedMatch.match_reasons && (
                <div>
                  <p className="text-xs font-semibold text-gray-600">סיבות התאמה</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedMatch.match_reasons}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => setShowSendDialog(true)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2 h-10"
                >
                  <Send className="w-4 h-4" />
                  שלח
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNotesDialog(true)}
                  className="flex-1 gap-2 h-10"
                >
                  <MessageSquare className="w-4 h-4" />
                  הערות
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {selectedMatch && showSendDialog && (
        <UnifiedSendDialog
          isOpen={showSendDialog}
          onClose={() => setShowSendDialog(false)}
          match={selectedMatch}
          candidate={candidates.find(c => c.id === selectedMatch.candidate_id)}
          job={jobs.find(j => j.id === selectedMatch.job_id)}
          agentName="נעמה"
          onMatchRemoved={handleMatchRemoved}
        />
      )}

      {selectedMatch && showNotesDialog && (
        <MatchNotesDialog
          match={selectedMatch}
          isOpen={showNotesDialog}
          onClose={() => setShowNotesDialog(false)}
        />
      )}
    </div>
  );
}