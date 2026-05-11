import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Zap,
  Briefcase,
  Users,
  Target,
  Circle,
  Edit2,
  Save,
  X,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  RefreshCcw,
  Info,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CandidateResumeDialog from "@/components/matches/CandidateResumeDialog";

// Export the Rotem tasks section as a separate component
export function RotemTasksSection({ rotemTasks, jobs, rotemLearningData, onDataChange, showOnlySent = false, showOnlyRejected = false }) {
  const [resumeDialog, setResumeDialog] = useState({ isOpen: false, candidate: null });
  
  // Filter tasks based on props
  const filteredTasks = rotemTasks.filter(task => {
    if (showOnlySent) return task.status !== 'נדחה על ידי טל';
    if (showOnlyRejected) return task.status === 'נדחה על ידי טל';
    return true;
  });

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">
          {showOnlySent ? 'אין משימות פעילות' : 'אין משימות נדחות'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {filteredTasks.map(task => {
          const taskJob = jobs?.find(j => j.id === task.job_id);
          
          return (
            <Card key={task.id} className={`border-2 ${
              task.status === 'נדחה על ידי טל' 
                ? 'border-red-200 bg-red-50/30' 
                : task.status === 'הסתיים'
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-blue-200 bg-blue-50/30'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const candidates = await base44.entities.Candidate.filter({ id: task.candidate_id });
                            if (candidates && candidates.length > 0) {
                              setResumeDialog({ isOpen: true, candidate: candidates[0] });
                            } else {
                              toast.error('לא נמצאו פרטי מועמד');
                            }
                          } catch (error) {
                            toast.error('שגיאה בטעינת פרטי מועמד');
                          }
                        }}
                        className="font-semibold text-gray-900 hover:text-blue-600 underline decoration-dotted cursor-pointer"
                        title="לחץ לצפייה בקורות חיים"
                      >
                        {task.candidate_name}
                      </button>
                      {task.match_score && (
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                          {task.match_score}% התאמה
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          task.status === 'הסתיים' ? 'bg-green-100 text-green-700 border-green-300' :
                          task.status === 'נדחה על ידי טל' ? 'bg-red-100 text-red-700 border-red-300' :
                          task.status === 'מאושר לשיחה' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                          task.status === 'בתהליך' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                          'bg-gray-100 text-gray-600 border-gray-300'
                        }`}
                      >
                        {task.status}
                      </Badge>
                      {task.priority && (
                        <Badge className={`text-xs ${
                          task.priority === 'גבוהה' ? 'bg-red-500 text-white' :
                          task.priority === 'בינונית' ? 'bg-yellow-500 text-white' :
                          'bg-gray-400 text-white'
                        }`}>
                          {task.priority}
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm">
                      <p className="text-gray-600">
                        <strong>משרה:</strong> {task.job_title || taskJob?.title || 'לא ידוע'}
                      </p>
                    </div>

                    {task.notes && (
                      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded-lg mt-2">
                        <p className="text-xs text-yellow-900">
                          <strong>הערות:</strong> {task.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CandidateResumeDialog
        isOpen={resumeDialog.isOpen}
        onClose={() => setResumeDialog({ isOpen: false, candidate: null })}
        candidate={resumeDialog.candidate}
      />
    </>
  );
}

export default function CarmitThinkingProcess({ onDataRefresh }) {
  const [agentStatuses, setAgentStatuses] = useState({});
  const [expandedJob, setExpandedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [learningReason, setLearningReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingRotemTask, setEditingRotemTask] = useState(null);
  const [rotemFeedback, setRotemFeedback] = useState('');
  const [rotemFeedbackType, setRotemFeedbackType] = useState('');
  const [showAllRejected, setShowAllRejected] = useState(false);
  const [resumeDialog, setResumeDialog] = useState({ isOpen: false, candidate: null });

  // Use React Query for data fetching
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['carmit-jobs'],
    queryFn: () => base44.entities.Job.filter({ status: 'פעילה' }),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: rotemTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['carmit-rotem-tasks'],
    queryFn: () => base44.entities.RotemTask.list('-created_date', 50),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: learningData = [], isLoading: learningLoading } = useQuery({
    queryKey: ['carmit-learning'],
    queryFn: () => base44.entities.CarmitLearning.filter({ is_active: true }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: rotemLearningData = [], isLoading: rotemLearningLoading } = useQuery({
    queryKey: ['carmit-rotem-learning'],
    queryFn: () => base44.entities.CarmitRotemLearning.filter({ is_active: true }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: rejectedMatches = [], isLoading: loadingRejected, refetch: refetchRejected } = useQuery({
    queryKey: ['rejected-matches'],
    queryFn: async () => {
      // Get Rotem tasks that were rejected by Tal
      const rejectedTasks = await base44.entities.RotemTask.filter({ status: 'נדחה על ידי טל' }, '-created_date', 50);
      
      // Transform to match format for consistency with UI
      return rejectedTasks.map(task => ({
        id: task.id,
        candidate_id: task.candidate_id,
        candidate_name: task.candidate_name,
        job_id: task.job_id,
        job_title: task.job_title,
        match_score: task.match_score,
        user_name: 'טל (קשרי מועמדים)',
        carmit_decision: 'rotem_rejected',
        carmit_reasoning: task.notes || 'המועמד נדחה על ידי טל',
        skip_type: 'rotem_rejected'
      }));
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false
  });

  const loading = jobsLoading || tasksLoading || learningLoading || rotemLearningLoading;

  const loadData = () => {
    window.location.reload();
  };

  // Poll agent statuses
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const agentStatusList = await base44.entities.AgentRunStatus.list();
        const statusMap = {};
        agentStatusList.forEach(s => {
          statusMap[s.agent_name] = s;
        });
        setAgentStatuses(statusMap);
      } catch (error) {
        console.error('Error loading agent statuses:', error);
      }
    };

    loadStatuses();
    const interval = setInterval(loadStatuses, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleOverrideRejection = async (match, shouldCreate) => {
    if (!rotemFeedback.trim()) {
      toast.error('נא להסביר לכרמית למה');
      return;
    }

    setSaving(true);
    try {
      const currentUser = await base44.auth.me();

      if (shouldCreate) {
        const candidate = await base44.entities.Candidate.get(match.candidate_id);
        
        await base44.entities.RotemTask.create({
          job_id: match.job_id,
          job_title: match.job_title,
          candidate_id: match.candidate_id,
          candidate_name: match.candidate_name,
          candidate_phone: candidate.phone_primary,
          status: 'לא החל',
          source: 'carmit_override',
          priority: 'גבוהה',
          match_score: match.match_score,
          match_id: match.id,
          match_reasons: match.match_reasons,
          detailed_analysis: match.detailed_analysis,
          notes: `דריסת החלטת כרמית: ${rotemFeedback}`
        });

        await base44.entities.Match.update(match.id, {
          carmit_decision: 'created_task',
          carmit_reviewed_date: new Date().toISOString()
        });

        toast.success('המשימה נוצרה לטל - כרמית למדה מההחלטה שלך');
      }

      await base44.entities.CarmitRotemLearning.create({
        task_id: match.id,
        candidate_id: match.candidate_id,
        candidate_name: match.candidate_name,
        job_id: match.job_id,
        job_title: match.job_title,
        source_agent: match.user_name,
        match_score: match.match_score,
        user_feedback: shouldCreate ? 'should_send' : 'should_not_send',
        feedback_reason: rotemFeedback,
        user_id: currentUser.id,
        user_name: currentUser.full_name
      });

      setEditingRotemTask(null);
      setRotemFeedback('');
      setRotemFeedbackType('');
      refetchRejected();
      if (onDataRefresh) onDataRefresh();
    } catch (error) {
      console.error("Error overriding rejection:", error);
      toast.error('שגיאה בעדכון ההחלטה');
    }
    setSaving(false);
  };

  const handleCancelRotemEdit = () => {
    setEditingRotemTask(null);
    setRotemFeedback('');
    setRotemFeedbackType('');
  };

  // Analyze which agent should handle which job based on job requirements and user overrides
  const analyzeJobAssignment = (job) => {
    // Check if user has overridden this job's assignment
    const override = learningData.find(l => l.job_id === job.id && l.is_active);
    
    if (override) {
      const agentInfo = {
        naama: { name: 'נעמה', color: 'orange' },
        alik: { name: 'אליק', color: 'teal' },
        itay: { name: 'איתי', color: 'indigo' },
        lior: { name: 'ליאור', color: 'amber' },
        ofir: { name: 'אופיר', color: 'emerald' },
        gc: { name: 'GC', color: 'gray' }
      };
      
      return {
        agent: override.user_override,
        name: agentInfo[override.user_override].name,
        color: agentInfo[override.user_override].color,
        score: 100,
        reason: `החלטת משתמש: ${override.learning_reason || 'שונה ידנית'}`,
        isOverride: true
      };
    }

    // Original automatic logic
    const title = (job.title || '').toLowerCase();
    const description = (job.description || '').toLowerCase();
    const requirements = (job.requirements || '').toLowerCase();
    const fullText = `${title} ${description} ${requirements}`;

    const liorKeywords = ['מערכת', 'system engineer', 'systems engineer', 'system architect', 'integration engineer', 'srs', 'sss', 'ssdd', 'icd', 'mbse', 'sysml', 'doors', 'polarion', 'מהנדס מערכת', 'הנדסת מערכת', 'מכ"מ', 'radar', 'שו"ב', 'c4i', 'bms'];
    const naamaKeywords = ['תוכנה', 'software', 'פייתון', 'python', 'java', 'c++', 'c#', 'javascript', 'react', 'angular', 'vue', 'node', 'backend', 'frontend', 'fullstack', 'מפתח', 'developer', 'programmer', 'תכנות'];
    const alikKeywords = ['אלקטרוניקה', 'electronics', 'אנלוג', 'analog', 'דיגיטלי', 'digital', 'pcb', 'hardware', 'fpga', 'vhdl', 'verilog', 'מעגלים', 'circuits'];
    const itayKeywords = ['it', 'מחשוב', 'devops', 'cloud', 'aws', 'azure', 'kubernetes', 'docker', 'linux', 'windows', 'network', 'security', 'סייבר', 'cyber', 'תשתיות'];
    const ofirKeywords = ['מכונות', 'mechanical', 'מכני', 'מתקנים', 'זביל', 'fixtures', 'solidworks', 'catia', 'nx', 'inventor', 'תכן מכני'];

    const liorScore = liorKeywords.filter(k => fullText.includes(k)).length;
    const naamaScore = naamaKeywords.filter(k => fullText.includes(k)).length;
    const alikScore = alikKeywords.filter(k => fullText.includes(k)).length;
    const itayScore = itayKeywords.filter(k => fullText.includes(k)).length;
    const ofirScore = ofirKeywords.filter(k => fullText.includes(k)).length;

    if (liorScore > naamaScore && liorScore > alikScore && liorScore > itayScore && liorScore > ofirScore) {
      return { agent: 'lior', name: 'ליאור', color: 'amber', score: liorScore, reason: 'משרה בתחום הנדסת מערכת', isOverride: false };
    } else if (ofirScore > naamaScore && ofirScore > alikScore && ofirScore > itayScore) {
      return { agent: 'ofir', name: 'אופיר', color: 'emerald', score: ofirScore, reason: 'משרה בתחום הנדסת מכונות', isOverride: false };
    } else if (naamaScore > alikScore && naamaScore > itayScore) {
      return { agent: 'naama', name: 'נעמה', color: 'orange', score: naamaScore, reason: 'משרה בתחום תוכנה', isOverride: false };
    } else if (alikScore > naamaScore && alikScore > itayScore) {
      return { agent: 'alik', name: 'אליק', color: 'teal', score: alikScore, reason: 'משרה בתחום אלקטרוניקה', isOverride: false };
    } else if (itayScore > naamaScore && itayScore > alikScore) {
      return { agent: 'itay', name: 'איתי', color: 'indigo', score: itayScore, reason: 'משרה בתחום IT', isOverride: false };
    } else {
      return { agent: 'gc', name: 'GC', color: 'gray', score: 0, reason: 'משרה כללית/לא מסווגת - מועבר ל-GC (Garbage Collector)', isOverride: false };
    }
  };

  const handleEditAssignment = (job, currentAssignment) => {
    setEditingJob(job.id);
    setSelectedAgent(currentAssignment.agent);
    setLearningReason('');
  };

  const handleCancelEdit = () => {
    setEditingJob(null);
    setSelectedAgent('');
    setLearningReason('');
  };

  const handleSaveOverride = async (job, originalAssignment) => {
    if (!selectedAgent || selectedAgent === originalAssignment.agent) {
      toast.error('אנא בחר סוכן שונה מההמלצה המקורית');
      return;
    }

    setSaving(true);
    try {
      const currentUser = await base44.auth.me();
      
      const title = (job.title || '').toLowerCase();
      const description = (job.description || '').toLowerCase();
      const requirements = (job.requirements || '').toLowerCase();
      const fullText = `${title} ${description} ${requirements}`;
      const keywords = fullText.split(/\s+/).filter(w => w.length > 3).slice(0, 20).join(', ');

      const existingLearning = learningData.filter(l => l.job_id === job.id);
      for (const learning of existingLearning) {
        await base44.entities.CarmitLearning.update(learning.id, { is_active: false });
      }

      const agentNames = { naama: 'נעמה', alik: 'אליק', itay: 'איתי', lior: 'ליאור', ofir: 'אופיר', gc: 'GC' };
      await base44.entities.CarmitLearning.create({
        job_id: job.id,
        job_title: job.title,
        original_assignment: originalAssignment.agent,
        user_override: selectedAgent,
        learning_reason: learningReason || `משתמש העדיף את ${agentNames[selectedAgent] || selectedAgent} למשרה זו`,
        job_keywords: keywords,
        user_id: currentUser.id,
        user_name: currentUser.full_name
      });

      const priorityField = `${selectedAgent}_priority`;
      const processedDateField = `${selectedAgent}_processed_date`;
      const oldPriorityField = `${originalAssignment.agent}_priority`;
      const oldProcessedDateField = `${originalAssignment.agent}_processed_date`;

      await base44.entities.Job.update(job.id, {
        [priorityField]: true,
        [processedDateField]: null,
        [oldPriorityField]: false,
        [oldProcessedDateField]: null
      });

      toast.success(`המשרה הועברה ל${agentNames[selectedAgent]} בעדיפות גבוהה!`);
      handleCancelEdit();
      window.location.reload();
    } catch (error) {
      console.error("Error saving override:", error);
      toast.error('שגיאה בשמירת ההעדפה');
    }
    setSaving(false);
  };

  const handleSyncAllLearning = async () => {
    setSyncing(true);
    try {
      const { syncCarmitLearningToJobs } = await import('@/functions/syncCarmitLearningToJobs');
      const result = await syncCarmitLearningToJobs({});
      
      if (result.data.success) {
        toast.success(`סונכרנו ${result.data.updatedCount} משרות בהתאם להחלטות שלך!`);
        window.location.reload();
      } else {
        toast.error('שגיאה בסנכרון');
      }
    } catch (error) {
      console.error("Error syncing learning to jobs:", error);
      toast.error('שגיאה בסנכרון ההחלטות');
    }
    setSyncing(false);
  };

  const getAgentStatus = (agentKey, jobId) => {
    const status = agentStatuses[agentKey];
    if (!status) return { status: 'idle', text: 'לא פעיל', icon: Clock, color: 'gray' };

    if (status.is_running) {
      if (status.focused_job_id === jobId) {
        return { 
          status: 'focused', 
          text: `עובד על המשרה כרגע (${status.focus_matches_found || 0} מועמדים)`, 
          icon: Zap, 
          color: 'green' 
        };
      }
      return { status: 'running', text: 'עובד על משרות אחרות...', icon: Loader2, color: 'blue' };
    }

    // Check if this agent processed this job recently
    const processedDateKey = `${agentKey}_processed_date`;
    const jobProcessedDate = jobId ? jobs.find(j => j.id === jobId)?.[processedDateKey] : null;
    
    if (jobProcessedDate) {
      const daysSince = Math.floor((Date.now() - new Date(jobProcessedDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < 1) {
        return { status: 'completed', text: 'טופל היום', icon: CheckCircle, color: 'green' };
      } else if (daysSince < 7) {
        return { status: 'recent', text: `טופל לפני ${daysSince} ימים`, icon: CheckCircle, color: 'blue' };
      }
    }

    return { status: 'pending', text: 'ממתין לטיפול', icon: Clock, color: 'yellow' };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 border-purple-200" dir="rtl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 text-right">
          <div className="text-right">
            <CardTitle className="flex items-center gap-3">
              <Brain className="w-7 h-7 text-purple-600" />
              <span>המוח של כרמית</span>
            </CardTitle>
            <p className="text-sm text-gray-600">איך כרמית מנתחת משרות ומחלקת אותן לסוכנים השונים</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAllLearning}
            disabled={syncing || learningData.length === 0}
            className="flex items-center gap-2"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCw className="w-4 h-4" />
            )}
            סנכרן החלטות ({learningData.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Rotem Tasks Section with Tabs */}
        <div className="space-y-3" dir="rtl">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=48&h=48&fit=crop&crop=face" 
              alt="טל" 
              className="w-12 h-12 rounded-full object-cover border-3 border-green-300 shadow-md"
            />
            <div className="text-right">
              <h3 className="text-lg font-semibold text-gray-800">החלטות כרמית - משימות לטל</h3>
              <p className="text-sm text-gray-600">איך כרמית מחליטה איזה מועמדים טל צריכה ליצור איתם קשר</p>
            </div>
          </div>

          <Tabs defaultValue="sent" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sent" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                משימות שהועברו לטל ({rotemTasks.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                משימות נדחות ({rejectedMatches.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sent" className="space-y-3 mt-4">
              <RotemTasksSection 
                rotemTasks={rotemTasks}
                jobs={jobs}
                rotemLearningData={rotemLearningData}
                onDataChange={onDataRefresh}
                showOnlySent={true}
              />
            </TabsContent>

            <TabsContent value="rejected" className="space-y-3 mt-4">
              {rejectedMatches.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">אין התאמות שנדחו</p>
                  <p className="text-xs text-gray-400 mt-2">כרמית החליטה שכל ההתאמות רלוונטיות לטל</p>
                </div>
              ) : (
                <>
                  <h4 className="font-medium text-red-700 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    התאמות שכרמית החליטה לא להעביר לטל ({rejectedMatches.length})
                  </h4>
                  <div className="space-y-2">
                    {rejectedMatches.slice(0, showAllRejected ? rejectedMatches.length : 10).map(match => {
                      const isEditingThisMatch = editingRotemTask === `rejected_${match.id}`;
                      const existingFeedback = rotemLearningData.find(l => l.task_id === match.id && l.is_active);

                      return (
                        <Card key={match.id} className={`border-2 ${
                          existingFeedback 
                            ? existingFeedback.user_feedback === 'should_send'
                              ? 'border-green-300 bg-green-50/50'
                              : 'border-red-300 bg-red-50/50'
                            : 'border-red-200 bg-red-50/30'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const candidates = await base44.entities.Candidate.filter({ id: match.candidate_id });
                                        if (candidates && candidates.length > 0) {
                                          setResumeDialog({ isOpen: true, candidate: candidates[0] });
                                        } else {
                                          toast.error('לא נמצאו פרטי מועמד');
                                        }
                                      } catch (error) {
                                        toast.error('שגיאה בטעינת פרטי מועמד');
                                      }
                                    }}
                                    className="font-semibold text-gray-900 hover:text-blue-600 underline decoration-dotted cursor-pointer"
                                    title="לחץ לצפייה בקורות חיים"
                                  >
                                    {match.candidate_name}
                                  </button>
                                  {match.match_score && (
                                    <Badge className="bg-purple-100 text-purple-800 text-xs">
                                      {match.match_score}% התאמה
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                                    <Circle className="w-3 h-3" />
                                    מקור: {match.user_name || 'לא ידוע'}
                                  </Badge>
                                  <Badge variant="outline" className="border-red-400 text-red-700 bg-red-50 flex items-center gap-1">
                                    <X className="w-3 h-3" />
                                    {match.skip_type === 'skipped_duplicate' ? 'כפילות' : 
                                     match.skip_type === 'skipped_status' ? 'סטטוס לא מתאים' :
                                     match.skip_type === 'skipped_geo_rejected' ? 'מרחק גיאוגרפי' :
                                     match.skip_type === 'skipped_geo_needs_review' ? 'נתוני מיקום' :
                                     'לא הועבר'}
                                  </Badge>
                                </div>

                                <div className="text-sm mb-2">
                                  <p className="text-gray-600">
                                    <strong>משרה:</strong> {match.job_title}
                                  </p>
                                </div>

                                <div className={`${match.skip_type === 'skipped_duplicate' ? 'bg-yellow-100 border-yellow-300' : 'bg-red-100 border-red-300'} border p-3 rounded-lg mt-2 text-right`}>
                                  <p className={`text-xs font-semibold mb-1 flex items-center gap-1 ${match.skip_type === 'skipped_duplicate' ? 'text-yellow-900' : 'text-red-900'}`}>
                                    <Brain className="w-3 h-3" />
                                    החלטת כרמית:
                                  </p>
                                  <p className={`text-xs whitespace-pre-wrap ${match.skip_type === 'skipped_duplicate' ? 'text-yellow-800' : 'text-red-800'}`}>
                                    {match.carmit_reasoning}
                                  </p>
                                </div>

                                {!isEditingThisMatch && !existingFeedback && (
                                  <div className="mt-3 pt-3 border-t border-red-200">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingRotemTask(`rejected_${match.id}`)}
                                      className="text-xs border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                      <Edit2 className="w-3 h-3 ml-1" />
                                      תן משוב לכרמית
                                    </Button>
                                  </div>
                                )}

                                {existingFeedback && (
                                  <div className={`mt-3 p-2 rounded-lg border ${
                                    existingFeedback.user_feedback === 'should_send'
                                      ? 'bg-green-100 border-green-300'
                                      : 'bg-red-100 border-red-300'
                                  }`}>
                                    <p className="text-xs font-semibold flex items-center gap-1 mb-1">
                                      {existingFeedback.user_feedback === 'should_send' ? (
                                        <ThumbsUp className="w-3 h-3 text-green-700" />
                                      ) : (
                                        <ThumbsDown className="w-3 h-3 text-red-700" />
                                      )}
                                      <span className={existingFeedback.user_feedback === 'should_send' ? 'text-green-900' : 'text-red-900'}>
                                        {existingFeedback.user_feedback === 'should_send' ? 'היה צריך לשלוח - תוקן' : 'החלטה נכונה'}
                                      </span>
                                    </p>
                                    <p className="text-xs text-gray-700">
                                      {existingFeedback.feedback_reason}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      משוב מ-{existingFeedback.user_name}
                                    </p>
                                  </div>
                                )}

                                {isEditingThisMatch && (
                                  <div className="mt-3 bg-purple-50 border-2 border-purple-300 p-3 rounded-lg space-y-3">
                                    <p className="font-semibold text-purple-900 text-sm flex items-center gap-2">
                                      <Brain className="w-4 h-4" />
                                      האם כרמית קיבלה החלטה נכונה?
                                    </p>
                                    
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant={rotemFeedbackType === 'should_not_send' ? 'default' : 'outline'}
                                        onClick={() => setRotemFeedbackType('should_not_send')}
                                        className={rotemFeedbackType === 'should_not_send' ? 'bg-green-600 hover:bg-green-700' : ''}
                                      >
                                        <ThumbsUp className="w-3 h-3 ml-1" />
                                        כן, החלטה נכונה
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={rotemFeedbackType === 'should_send' ? 'default' : 'outline'}
                                        onClick={() => setRotemFeedbackType('should_send')}
                                        className={rotemFeedbackType === 'should_send' ? 'bg-red-600 hover:bg-red-700' : ''}
                                      >
                                        <ThumbsDown className="w-3 h-3 ml-1" />
                                        לא, היה צריך לשלוח
                                      </Button>
                                    </div>

                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-gray-700">הסבר לכרמית:</label>
                                      <Textarea
                                        placeholder="למשל: 'המועמד בעצם רלוונטי כי...' או 'החלטה נכונה, המועמד באמת לא מתאים'"
                                        value={rotemFeedback}
                                        onChange={(e) => setRotemFeedback(e.target.value)}
                                        className="text-xs min-h-[50px]"
                                      />
                                    </div>

                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleOverrideRejection(match, rotemFeedbackType === 'should_send')}
                                        disabled={saving || !rotemFeedbackType || !rotemFeedback.trim()}
                                        className="bg-purple-600 hover:bg-purple-700"
                                      >
                                        {saving ? (
                                          <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                                        ) : (
                                          <Save className="w-3 h-3 ml-1" />
                                        )}
                                        {rotemFeedbackType === 'should_send' ? 'צור משימה ולמד' : 'שמור ולמד'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelRotemEdit}
                                        disabled={saving}
                                      >
                                        <X className="w-3 h-3 ml-1" />
                                        ביטול
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {rejectedMatches.length > 10 && !showAllRejected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllRejected(true)}
                      className="w-full text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <ChevronDown className="w-4 h-4 ml-1" />
                      הצג עוד {rejectedMatches.length - 10} התאמות שנדחו
                    </Button>
                  )}
                  {showAllRejected && rejectedMatches.length > 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllRejected(false)}
                      className="w-full text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <ChevronUp className="w-4 h-4 ml-1" />
                      הצג פחות
                    </Button>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Job Assignment Section */}
        <div className="mt-6 pt-6 border-t border-purple-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">חלוקת משרות לסוכנים</h3>
        </div>

        {jobs.map(job => {
            const assignment = analyzeJobAssignment(job);
            const agentStatus = getAgentStatus(assignment.agent, job.id);
            const isExpanded = expandedJob === job.id;
            const StatusIcon = agentStatus.icon;

            return (
              <Collapsible 
                key={job.id} 
                open={isExpanded} 
                onOpenChange={() => setExpandedJob(isExpanded ? null : job.id)}
              >
                <Card className={`border-2 ${
                  agentStatus.status === 'focused' ? 'border-green-400 bg-green-50' :
                  agentStatus.status === 'running' ? 'border-blue-400 bg-blue-50' :
                  agentStatus.status === 'completed' ? 'border-green-200 bg-white' :
                  'border-gray-200 bg-white'
                }`}>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Briefcase className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <h4 className="font-semibold text-gray-900 truncate">{job.title}</h4>
                            {job.job_code && (
                              <Badge variant="outline" className="text-xs">#{job.job_code}</Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className={`bg-${assignment.color}-100 text-${assignment.color}-800 flex items-center gap-1`}>
                              <Circle className="w-3 h-3" />
                              {assignment.name}
                              {assignment.isOverride && <Edit2 className="w-3 h-3 mr-1" />}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`flex items-center gap-1 border-${agentStatus.color}-400 text-${agentStatus.color}-700`}
                            >
                              <StatusIcon className={`w-3 h-3 ${agentStatus.status === 'running' || agentStatus.status === 'focused' ? 'animate-spin' : ''}`} />
                              {agentStatus.text}
                            </Badge>
                            {editingJob !== job.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditAssignment(job, assignment);
                                }}
                                className="h-6 text-xs text-purple-600 hover:text-purple-700"
                              >
                                <Edit2 className="w-3 h-3 ml-1" />
                                שנה
                              </Button>
                            )}
                          </div>

                          <p className="text-xs text-gray-500">
                            <strong>החלטת כרמית:</strong> {assignment.reason}
                            {assignment.isOverride && (
                              <Badge className="bg-purple-100 text-purple-700 text-xs mr-2">
                                <Brain className="w-3 h-3 ml-1" />
                                למדה מהמשתמש
                              </Badge>
                            )}
                          </p>
                        </div>

                        <Button variant="ghost" size="sm" className="flex-shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4 border-t">
                      <div className="space-y-3 mt-3">
                        {editingJob === job.id && (
                          <div className="bg-purple-50 border-2 border-purple-300 p-4 rounded-lg space-y-3">
                            <p className="font-semibold text-purple-900 flex items-center gap-2">
                              <Brain className="w-4 h-4" />
                              לימד את כרמית
                            </p>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">בחר את הסוכן המתאים:</label>
                              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                                <SelectTrigger>
                                  <SelectValue placeholder="בחר סוכן..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="naama">נעמה - תוכנה</SelectItem>
                                  <SelectItem value="alik">אליק - אלקטרוניקה</SelectItem>
                                  <SelectItem value="itay">איתי - IT</SelectItem>
                                  <SelectItem value="lior">ליאור - הנדסת מערכת</SelectItem>
                                  <SelectItem value="ofir">אופיר - הנדסת מכונות</SelectItem>
                                  <SelectItem value="gc">GC - סוכן כללי</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">הסבר לכרמית למה בחרת כך:</label>
                              <Textarea
                                placeholder="למשל: 'המשרה דורשת ידע ב-FPGA ולכן מתאימה לאליק' או 'משרה בתחום DevOps - איתי מומחה בזה'"
                                value={learningReason}
                                onChange={(e) => setLearningReason(e.target.value)}
                                className="text-sm min-h-[60px]"
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveOverride(job, assignment)}
                                disabled={saving}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                {saving ? (
                                  <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4 ml-1" />
                                )}
                                שמור ולמד
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={saving}
                              >
                                <X className="w-4 h-4 ml-1" />
                                ביטול
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded-lg text-sm text-right">
                          <p className="font-semibold text-gray-700 mb-1">פרטי המשרה:</p>
                          {job.client_name && <p className="text-gray-600">🏢 לקוח: {job.client_name}</p>}
                          {job.location && <p className="text-gray-600">📍 מיקום: {job.location}</p>}
                          {job.security_clearance && <p className="text-gray-600">🔒 סיווג: {job.security_clearance}</p>}
                        </div>

                        <div className="space-y-2 text-right">
                          <p className="font-semibold text-gray-700 text-sm mb-2">סטטוס סוכנים עבור משרה זו:</p>

                          {[
                            { key: 'naama', name: 'נעמה', color: 'orange', specialty: 'תוכנה' },
                            { key: 'alik', name: 'אליק', color: 'teal', specialty: 'אלקטרוניקה' },
                            { key: 'itay', name: 'איתי', color: 'indigo', specialty: 'IT' },
                            { key: 'lior', name: 'ליאור', color: 'amber', specialty: 'הנדסת מערכת' },
                            { key: 'ofir', name: 'אופיר', color: 'emerald', specialty: 'הנדסת מכונות' },
                            { key: 'gc', name: 'GC', color: 'gray', specialty: 'כללי' }
                          ].map(({ key, name, color, specialty }) => {
                            const status = getAgentStatus(key, job.id);
                            const Icon = status.icon;
                            const isAssigned = assignment.agent === key;

                            return (
                              <div 
                                key={key}
                                className={`p-2 rounded-lg border-2 ${
                                  isAssigned 
                                    ? `bg-${color}-50 border-${color}-300` 
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Circle className={`w-4 h-4 ${isAssigned ? `text-${color}-600` : 'text-gray-400'}`} />
                                    <span className={`text-sm font-medium ${isAssigned ? `text-${color}-900` : 'text-gray-600'}`}>
                                      {name} ({specialty})
                                    </span>
                                    {isAssigned && (
                                      <Badge className={`bg-${color}-600 text-white text-xs`}>
                                        נבחר
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Icon className={`w-4 h-4 text-${status.color}-600 ${
                                      status.status === 'running' || status.status === 'focused' ? 'animate-spin' : ''
                                    }`} />
                                    <span className="text-xs text-gray-600">{status.text}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {(job.naama_priority || job.alik_priority || job.itay_priority || job.lior_priority || job.ofir_priority || job.gc_priority) && (
                          <div className="bg-yellow-50 border border-yellow-200 p-2 rounded-lg">
                            <p className="text-xs text-yellow-800 font-semibold flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              משרה בעדיפות גבוהה למומחים:
                              {job.naama_priority && ' נעמה'}
                              {job.alik_priority && ' אליק'}
                              {job.itay_priority && ' איתי'}
                              {job.lior_priority && ' ליאור'}
                              {job.ofir_priority && ' אופיר'}
                              {job.gc_priority && ' GC'}
                            </p>
                          </div>
                        )}

                        {(() => {
                          const jobTasks = rotemTasks.filter(t => t.job_id === job.id);
                          if (jobTasks.length === 0) return null;

                          return (
                            <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-right">
                              <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                משימות שהועברו לטל ({jobTasks.length}):
                              </p>
                              <div className="space-y-1.5 text-right">
                                {jobTasks.slice(0, 3).map(task => (
                                  <div key={task.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-green-200">
                                    <span className="font-medium text-gray-700">{task.candidate_name}</span>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        task.status === 'הסתיים' ? 'bg-green-100 text-green-700 border-green-300' :
                                        task.status === 'מאושר לשיחה' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                        task.status === 'בתהליך' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                        'bg-gray-100 text-gray-600 border-gray-300'
                                      }`}
                                    >
                                      {task.status}
                                    </Badge>
                                  </div>
                                ))}
                                {jobTasks.length > 3 && (
                                  <p className="text-xs text-gray-500 text-center">
                                    ועוד {jobTasks.length - 3} משימות...
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        }
      </CardContent>

      {/* Resume Dialog */}
      <CandidateResumeDialog
        isOpen={resumeDialog.isOpen}
        onClose={() => setResumeDialog({ isOpen: false, candidate: null })}
        candidate={resumeDialog.candidate}
      />
    </Card>
  );
}