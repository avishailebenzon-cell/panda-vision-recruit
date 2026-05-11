import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import UnifiedSendDialog from "@/components/matches/UnifiedSendDialog";
import MatchNotesDialog from "@/components/matches/MatchNotesDialog";

export default function MobileRamiPage() {
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
  
  const [selectedRows, setSelectedRows] = useState(new Set());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [matchesData, jobsData, candidatesData, statusesData] = await Promise.all([
          base44.entities.Match.filter({ user_app_role: "rami" }, '-created_date'),
          base44.entities.Job.list(),
          base44.entities.Candidate.list(),
          base44.entities.CandidateStatus.list()
        ]);
        
        setMatches(matchesData);
        setJobs(jobsData);
        setCandidates(candidatesData);
        setStatuses(statusesData);
      } catch (error) {
        console.error("Error loading data:", error);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    let filtered = [...matches];

    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.job_title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredMatches(filtered);
  }, [matches, searchTerm]);

  const handleMatchClick = async (match) => {
    setSelectedMatch(match);
    
    if (!match.is_read) {
      await base44.entities.Match.update(match.id, { is_read: true });
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_read: true } : m));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-red-100 to-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">רמי - מומחה רמה 1</CardTitle>
        </CardHeader>
      </Card>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="חיפוש..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

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
                      <Badge className="bg-red-100 text-red-800">
                        {Math.round(match.match_score || 0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMatchClick(match)}
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

      {selectedMatch && (
        <Card className="mt-4 p-4 fixed bottom-0 left-0 right-0 rounded-t-xl shadow-2xl">
          <div className="space-y-4 pb-24">
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
                <p className="text-2xl font-bold text-red-600">{Math.round(selectedMatch.match_score || 0)}%</p>
              </div>
              {selectedMatch.match_reasons && (
                <div>
                  <p className="text-xs font-semibold text-gray-600">סיבות התאמה</p>
                  <p className="text-xs text-gray-600 mt-1">{selectedMatch.match_reasons}</p>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setShowSendDialog(true)} className="flex-1 bg-red-600 hover:bg-red-700">שלח</Button>
                <Button variant="outline" onClick={() => setShowNotesDialog(true)} className="flex-1">הערות</Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {selectedMatch && showSendDialog && (
        <UnifiedSendDialog
          isOpen={showSendDialog}
          onClose={() => setShowSendDialog(false)}
          match={selectedMatch}
          candidate={candidates.find(c => c.id === selectedMatch.candidate_id)}
          job={jobs.find(j => j.id === selectedMatch.job_id)}
          agentName="רמי"
          onMatchRemoved={(id) => {
            setMatches(prev => prev.filter(m => m.id !== id));
            setSelectedMatch(null);
          }}
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