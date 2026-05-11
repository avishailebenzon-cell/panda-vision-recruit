import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, RefreshCw, Info } from 'lucide-react';
import { runMeniAgent } from '@/functions/runMeniAgent';
import { toast } from 'sonner';
import MeniTab from '@/components/matches/MeniTab';
import MatchNotesDialog from '@/components/matches/MatchNotesDialog';
import AgentThinkingLog from '@/components/matches/AgentThinkingLog';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function MeniPage() {
  const [user, setUser] = useState(null);
  const [matches, setMatches] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [notesDialog, setNotesDialog] = useState({ isOpen: false, match: null });
  const [agentStatus, setAgentStatus] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [matchList, candidateList, agentStatuses] = await Promise.all([
        base44.entities.Match.list('-created_date', 5000),
        base44.entities.Candidate.list('-created_date'),
        base44.entities.AgentRunStatus.list()
      ]);

      setMatches(matchList);
      setCandidates(candidateList);
      
      const meniStatus = agentStatuses.find(s => s.agent_name === 'meni');
      setAgentStatus(meniStatus);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('שגיאה בטעינת נתונים');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunMeni = async () => {
    setIsRunning(true);
    try {
      await runMeniAgent({});
      toast.success('מני התחיל לרוץ');
      setTimeout(() => {
        loadData();
      }, 2000);
    } catch (error) {
      console.error('Error running Meni:', error);
      toast.error('שגיאה בהרצת מני');
    }
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=80&h=80&fit=crop&crop=face" 
              alt="מני" 
              className="w-16 h-16 rounded-lg object-cover border-2 border-purple-200 shadow"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                מני - מכירות אפקטיביות
                <Badge className="bg-purple-100 text-purple-700 text-xs">
                  <Sparkles className="w-3 h-3 ml-1" />
                  AI
                </Badge>
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                התאמות מועמדי רמה 1 לאנשי קשר לפי תחום מקצועי
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleRunMeni}
              disabled={isRunning || isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  מריץ...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 ml-2" />
                  הרץ מני
                </>
              )}
            </Button>

            <Button 
              onClick={loadData}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              רענן
            </Button>
          </div>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-gray-700">
            מני מנתח מועמדי רמה 1 וממליץ על איזה אנשי קשר ניתן להעביר אותם על פי מידע שיש על כל איש קשר בפייפדרייב. התוצאות הן מרובות לכל מועמד.
          </AlertDescription>
        </Alert>

        {/* Agent Thinking Log */}
        <AgentThinkingLog 
          agentName="meni"
          agentDisplayName="מני"
          agentColor="purple"
        />

        {/* Meni Matches */}
        {isLoading ? (
          <LoadingSpinner message="טוען נתונים של מני..." />
        ) : (
          <MeniTab 
            matches={matches}
            candidates={candidates}
            onOpenNotes={(match) => setNotesDialog({ isOpen: true, match })}
            agentStatus={agentStatus}
          />
        )}

        {/* Notes Dialog */}
        <MatchNotesDialog
          match={notesDialog.match}
          isOpen={notesDialog.isOpen}
          onClose={() => setNotesDialog({ isOpen: false, match: null })}
        />
      </div>
    </div>
  );
}