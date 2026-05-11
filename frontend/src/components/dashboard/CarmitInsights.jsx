import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  TrendingUp,
  Users,
  Briefcase,
  Mail,
  Loader2,
  RotateCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Phone,
  ExternalLink,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building,
  MapPin,
  User
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Legend, Tooltip, CartesianGrid } from 'recharts';
import { base44 } from '@/api/base44Client';
import JobDetailsDialog from './JobDetailsDialog';

export default function CarmitInsights({ activeTab }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [approvedDrafts, setApprovedDrafts] = useState([]);
  const [stats, setStats] = useState({
    newCandidates24h: 0,
    newJobs24h: 0,
    stuckMatches: 0,
    messagesSent24h: 0,
    naamaLastRun: null,
    roeeLastRun: null,
    markedForAction: 0,
    waitingForResponse: 0,
    noMessageSent: 0
  });
  const [actionItems, setActionItems] = useState([]);

  const [rotemTasks, setRotemTasks] = useState([]);
  const [newAutoMatches, setNewAutoMatches] = useState([]);
  const [sendingToRotem, setSendingToRotem] = useState({});

  const [agentStatuses, setAgentStatuses] = useState({});
  const [jobs, setJobs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [jobDistribution, setJobDistribution] = useState([]);
  const [carmitLearningData, setCarmitLearningData] = useState([]);
  const [sortBy, setSortBy] = useState('job_code');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'thinking' || activeTab === 'distribution') {
      loadJobs();
      loadMatches();
      analyzeSystem();
      loadApprovedDrafts();
      loadRotemTasks();
      loadNewAutoMatches();
      loadCarmitLearningData();
    }
    
    // Poll agent statuses every 5 seconds for real-time updates in stats
    const interval = setInterval(async () => {
      try {
        const statusList = await base44.entities.AgentRunStatus.list();
        const statusMap = {};
        statusList.forEach(s => {
          statusMap[s.agent_name] = s;
        });
        setAgentStatuses(statusMap);
      } catch (error) {
        console.error('Error polling agent statuses:', error);
      }
    }, 5000);
    
    return () => clearInterval(interval);
    }, [activeTab]);

  // Update job distribution whenever jobs or CarmitLearning data change
  useEffect(() => {
    const analyzeJobAssignment = (job) => {
      // First, check if Carmit made a manual override decision for this job
      const manualOverride = carmitLearningData.find(cl => cl.job_id === job.id && cl.is_active);
      if (manualOverride) {
        return manualOverride.user_override;
      }

      const title = (job.title || '').toLowerCase();
      const description = (job.description || '').toLowerCase();
      const requirements = (job.requirements || '').toLowerCase();
      const fullText = `${title} ${description} ${requirements}`;

      const agentKeywords = {
        naama: ['תוכנה', 'software', 'פייתון', 'python', 'java', 'c++', 'javascript', 'developer', 'programmer'],
        dganit: ['qa', 'quality assurance', 'בדיקות תוכנה', 'בדיקות איכות', 'בודק תוכנה', 'test', 'testing', 'automation tester'],
        alik: ['אלקטרוניקה', 'electronics', 'אנלוג', 'analog', 'pcb', 'hardware', 'fpga'],
        itay: ['it', 'מחשוב', 'devops', 'cloud', 'aws', 'network', 'security', 'סייבר', 'תשתיות'],
        lior: ['מערכת', 'system engineer', 'systems engineer', 'system architect', 'integration engineer', 'srs', 'sss', 'ssdd', 'icd', 'mbse', 'sysml', 'doors', 'polarion', 'מהנדס מערכת', 'הנדסת מערכת', 'מכ"מ', 'radar', 'שו"ב', 'c4i', 'bms'],
        ofir: ['מכונות', 'mechanical', 'מכני', 'solidworks', 'catia', 'תכן מכני']
      };

      const scores = {};
      Object.keys(agentKeywords).forEach(agent => {
        scores[agent] = agentKeywords[agent].filter(k => fullText.includes(k)).length;
      });

      const maxScore = Math.max(...Object.values(scores));
      if (maxScore === 0) return 'gc';
      
      const assignedAgent = Object.keys(scores).find(agent => scores[agent] === maxScore);
      return assignedAgent || 'gc';
    };

    const activeJobs = jobs.filter(j => j.status === 'פעילה');
    const jobsByAgent = {
      naama: 0,
      dganit: 0,
      rami: 0,
      alik: 0,
      itay: 0,
      lior: 0,
      ofir: 0,
      gc: 0
    };

    activeJobs.forEach(job => {
      // Check for Rami (level 1) first
      if (job.security_clearance === 'רמה 1') {
        jobsByAgent.rami++;
      } else {
        const assignedTo = analyzeJobAssignment(job);
        jobsByAgent[assignedTo]++;
      }
    });

    const chartData = [
      { name: 'נעמה - תוכנה', value: jobsByAgent.naama, color: '#f97316' },
      { name: 'דגנית - QA', value: jobsByAgent.dganit, color: '#8b5cf6' },
      { name: 'רמי - רמה 1', value: jobsByAgent.rami, color: '#dc2626' },
      { name: 'אליק - אלקטרוניקה', value: jobsByAgent.alik, color: '#14b8a6' },
      { name: 'איתי - IT', value: jobsByAgent.itay, color: '#6366f1' },
      { name: 'ליאור - הנדסת מערכת', value: jobsByAgent.lior, color: '#f59e0b' },
      { name: 'אופיר - מכונות', value: jobsByAgent.ofir, color: '#10b981' },
      { name: 'GC - כללי', value: jobsByAgent.gc, color: '#6b7280' }
    ].filter(d => d.value > 0);

    setJobDistribution(chartData);
  }, [jobs, carmitLearningData]);

  const loadJobs = async () => {
    try {
      const jobsList = await base44.entities.Job.list('-created_date', 200);
      setJobs(jobsList);
    } catch (e) {
      console.log('Could not load jobs');
    }
  };

  const loadCarmitLearningData = async () => {
    try {
      const data = await base44.entities.CarmitLearning.filter({ is_active: true });
      setCarmitLearningData(data);
    } catch (e) {
      console.error('Error loading Carmit learning data:', e);
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortedJobs = () => {
    const activeJobs = jobs.filter(j => j.status === 'פעילה');
    
    return [...activeJobs].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'job_code':
          aVal = a.job_code || '';
          bVal = b.job_code || '';
          break;
        case 'title':
          aVal = a.title || '';
          bVal = b.title || '';
          break;
        case 'client':
          aVal = a.client_name || '';
          bVal = b.client_name || '';
          break;
        case 'agent':
          const getAgent = (job) => {
            const override = carmitLearningData.find(cl => cl.job_id === job.id && cl.is_active);
            if (override) return override.user_override;
            if (job.assigned_agent) return job.assigned_agent;
            return 'zz'; // For sorting unassigned to end
          };
          aVal = getAgent(a);
          bVal = getAgent(b);
          break;
        case 'location':
          aVal = a.location || '';
          bVal = b.location || '';
          break;
        case 'created_date':
          aVal = new Date(a.created_date || 0);
          bVal = new Date(b.created_date || 0);
          break;
        case 'deadline':
          aVal = a.deadline ? new Date(a.deadline) : new Date('9999-12-31');
          bVal = b.deadline ? new Date(b.deadline) : new Date('9999-12-31');
          break;
        case 'agent_status': {
          const getAgentStatusOrder = (job) => {
            const agentKey = (() => {
              const override = carmitLearningData.find(cl => cl.job_id === job.id && cl.is_active);
              if (override) return override.user_override;
              return job.assigned_agent || 'gc';
            })();
            const s = agentStatuses[agentKey] || {};
            if (s.focused_job_id === job.id) return 0; // working here = first
            if (s.is_running && s.focused_job_id && s.focused_job_id !== job.id) return 1; // working elsewhere
            return 2; // idle
          };
          aVal = getAgentStatusOrder(a);
          bVal = getAgentStatusOrder(b);
          break;
        }
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const handleAgentChange = async (jobId, newAgent) => {
    try {
      // Check if there's an existing override
      const existing = carmitLearningData.find(cl => cl.job_id === jobId && cl.is_active);
      
      if (existing) {
        // Update existing override
        await base44.entities.CarmitLearning.update(existing.id, {
          user_override: newAgent,
          override_date: new Date().toISOString()
        });
      } else {
        // Create new override
        await base44.entities.CarmitLearning.create({
          job_id: jobId,
          user_override: newAgent,
          override_date: new Date().toISOString(),
          is_active: true
        });
      }
      
      // Update job's assigned_agent field
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        const agentNames = {
          naama: 'נעמה (תוכנה)',
          dganit: 'דגנית (QA)',
          rami: 'רמי (רמה 1)',
          alik: 'אליק (אלקטרוניקה)',
          itay: 'איתי (IT)',
          lior: 'ליאור (הנדסת מערכת)',
          ofir: 'אופיר (מכונות)',
          gc: 'GC (כללי)'
        };
        
        await base44.entities.Job.update(jobId, {
          assigned_agent: newAgent,
          assigned_agent_name: agentNames[newAgent],
          assignment_date: new Date().toISOString()
        });
      }
      
      toast.success('הסוכן עודכן בהצלחה');
      await loadCarmitLearningData();
      await loadJobs();
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('שגיאה בעדכון הסוכן');
    }
  };

  const refreshData = async () => {
    await Promise.all([
      loadJobs(),
      loadMatches(),
      analyzeSystem(),
      loadApprovedDrafts(),
      loadRotemTasks(),
      loadNewAutoMatches(),
      loadCarmitLearningData()
    ]);
  };

  const loadMatches = async () => {
    try {
      const matchesList = await base44.entities.Match.list('-created_date', 1000);
      setMatches(matchesList);
    } catch (e) {
      console.log('Could not load matches');
    }
  };

  const loadRotemTasks = async () => {
    try {
      const { RotemTask } = await import('@/entities/RotemTask');
      const tasks = await RotemTask.filter({ status: 'לא החל' }, '-created_date', 50);
      setRotemTasks(tasks);
    } catch (e) {
      console.log('Could not load Rotem tasks');
    }
  };

  const loadNewAutoMatches = async () => {
    try {
      const { Match } = await import('@/entities/Match');
      const { CandidateStatus } = await import('@/entities/CandidateStatus');
      const { RotemTask } = await import('@/entities/RotemTask');
      const { Candidate } = await import('@/entities/Candidate');
      
      // Get automatic recommendations status
      const allStatuses = await CandidateStatus.list();
      const autoRecStatus = allStatuses.find(s => s.status_name?.includes('המלצה אוטומטית'));
      
      if (!autoRecStatus) return;

      // Get all automatic matches from AI agents
      const autoMatches = await Match.filter({ 
        status_number: autoRecStatus.status_number,
        is_automatic_recommendation: true,
        is_read: false
      }, '-created_date', 50);

      // Get existing Rotem tasks to avoid duplicates
      const existingTasks = await RotemTask.list();
      const existingMatchIds = new Set(existingTasks.map(t => t.match_id));

      // Filter out matches that already have Rotem tasks
      let newMatches = autoMatches.filter(m => !existingMatchIds.has(m.id));

      // Filter out company employees - Carmit doesn't send employees to Rotem
      const candidateIds = [...new Set(newMatches.map(m => m.candidate_id))];
      const candidates = await Candidate.filter({ id: { $in: candidateIds } });
      const employeeCandidateIds = new Set(
        candidates.filter(c => c.status === 'עובד חברה').map(c => c.id)
      );
      
      // Remove matches with company employees
      newMatches = newMatches.filter(m => !employeeCandidateIds.has(m.candidate_id));

      // Carmit's decision logic for each match
      const analyzedMatches = newMatches.map(match => {
        let priority = 'נמוך';
        let shouldSendToRotem = false;
        let carmitReasoning = '';

        // High priority criteria
        if (match.match_score >= 85) {
          priority = 'גבוה';
          shouldSendToRotem = true;
          carmitReasoning = 'התאמה מעולה (85+) - טל צריכה ליצור קשר מיידי';
        } else if (match.match_score >= 75 && match.user_name?.includes('רמי')) {
          priority = 'גבוה';
          shouldSendToRotem = true;
          carmitReasoning = 'התאמה טובה מרמי (רמה 1) - דורש טיפול מיידי';
        } else if (match.match_score >= 80) {
          priority = 'בינוני';
          shouldSendToRotem = true;
          carmitReasoning = 'התאמה טובה מאוד - שווה ליצור קשר';
        }

        return {
          ...match,
          carmit_priority: priority,
          carmit_should_contact: shouldSendToRotem,
          carmit_reasoning: carmitReasoning
        };
      });

      // Filter to only matches Carmit recommends
      const matchesForRotem = analyzedMatches.filter(m => m.carmit_should_contact);
      setNewAutoMatches(matchesForRotem);

    } catch (e) {
      console.error('Could not load new auto matches:', e);
    }
  };

  const sendMatchToRotem = async (match) => {
    setSendingToRotem(prev => ({ ...prev, [match.id]: true }));
    try {
      // Check if candidate is a company employee
      const { Candidate } = await import('@/entities/Candidate');
      const candidate = await Candidate.filter({ id: match.candidate_id });
      
      if (candidate.length > 0 && candidate[0].status === 'עובד חברה') {
        toast.error('כרמית לא מעבירה עובדי חברה לטל - המועמד כבר עובד אצלנו');
        setSendingToRotem(prev => ({ ...prev, [match.id]: false }));
        return;
      }

      const { RotemTask } = await import('@/entities/RotemTask');
      
      await RotemTask.create({
        match_id: match.id,
        candidate_id: match.candidate_id,
        candidate_name: match.candidate_name,
        candidate_phone: '', // Will be filled by Rotem
        job_id: match.job_id,
        job_title: match.job_title,
        source: match.user_name || 'auto',
        priority: match.carmit_priority || 'בינוני',
        task_type: 'initial_contact',
        status: 'לא החל',
        notes: `כרמית המליצה: ${match.carmit_reasoning}\nציון התאמה: ${match.match_score}`
      });

      toast.success(`המשימה נשלחה לטל - ${match.candidate_name}`);
      
      // Remove from local list
      setNewAutoMatches(prev => prev.filter(m => m.id !== match.id));
      
      // Reload Rotem tasks
      loadRotemTasks();
    } catch (error) {
      console.error('Error sending to Rotem:', error);
      toast.error('שגיאה בשליחת המשימה לטל');
    } finally {
      setSendingToRotem(prev => ({ ...prev, [match.id]: false }));
    }
  };

  const sendAllToRotem = async () => {
    for (const match of newAutoMatches) {
      await sendMatchToRotem(match);
      // Small delay between creates
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };



  const loadApprovedDrafts = async () => {
    try {
      const { HilaDraft } = await import('@/entities/HilaDraft');
      const drafts = await HilaDraft.filter({ status: 'approved' }, '-created_date', 3);
      setApprovedDrafts(drafts);
    } catch (e) {
      console.log('Could not load approved drafts');
    }
  };



  const analyzeSystem = async () => {
    setLoading(true);
    const newInsights = [];
    const newStats = { ...stats };

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Check new candidates in last 24h
      try {
        const { Candidate } = await import('@/entities/Candidate');
        const allCandidates = await Candidate.list('-created_date', 200);
        const recentCandidates = allCandidates.filter(c => 
          new Date(c.created_date) > twentyFourHoursAgo
        );
        newStats.newCandidates24h = recentCandidates.length;

        if (recentCandidates.length === 0) {
          newInsights.push({
            type: 'warning',
            agent: 'יעל',
            title: 'אין מועמדים חדשים ב-24 שעות האחרונות',
            message: 'יעל, למה אין מועמדים חדשים? אולי כדאי להגביר פרסומים ברשתות החברתיות?',
            action: 'בדקי את מקורות הגיוס'
          });
        }
      } catch (e) {
        console.log('Could not check candidates inbox');
      }

      // Check new jobs from Pipedrive
      try {
        const { Job } = await import('@/entities/Job');
        const allJobs = await Job.list('-created_date', 200);
        const recentJobs = allJobs.filter(j => 
          new Date(j.created_date) > twentyFourHoursAgo
        );
        newStats.newJobs24h = recentJobs.length;

        const { PipedriveSyncStatus } = await import('@/entities/PipedriveSyncStatus');
        const syncStatuses = await PipedriveSyncStatus.list('-last_run_time', 1);
        if (syncStatuses.length > 0 && syncStatuses[0].status === 'failed') {
          newInsights.push({
            type: 'error',
            agent: 'נועה',
            title: 'בעיה בסנכרון משרות מפייפדרייב',
            message: 'נועה, יש בעיה בקליטת משרות מפייפדרייב. רביב, בדוק את הלוגים הטכניים.',
            action: 'בדיקה טכנית נדרשת'
          });
        }
      } catch (e) {
        console.log('Could not check jobs inbox');
      }

      // Check agent run status
      try {
        const { AgentRunStatus } = await import('@/entities/AgentRunStatus');
        const agentStatuses = await AgentRunStatus.list();
        const naama = agentStatuses.find(s => s.agent_name === 'naama');
        const roee = agentStatuses.find(s => s.agent_name === 'roee');

        newStats.naamaLastRun = naama?.last_run_end;
        newStats.roeeLastRun = roee?.last_run_end;

        // Only show warning if last_run_end exists AND is older than 24 hours
        if (naama?.last_run_end) {
          const lastRun = new Date(naama.last_run_end);
          const now = new Date();
          const hoursSinceRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceRun > 24) {
            newInsights.push({
              type: 'warning',
              agent: 'נעמה',
              title: 'נעמה לא רצה ביממה האחרונה',
              message: `נעמה, את צריכה לרוץ ולחפש מועמדים למשרות. ריצה אחרונה: ${lastRun.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
              action: 'הפעלת נעמה'
            });
          }
        } else if (naama && !naama.last_run_end) {
          newInsights.push({
            type: 'warning',
            agent: 'נעמה',
            title: 'נעמה מעולם לא רצה',
            message: 'נעמה, את צריכה לרוץ ולחפש מועמדים למשרות.',
            action: 'הפעלת נעמה'
          });
        }

        if (roee?.last_run_end) {
          const lastRun = new Date(roee.last_run_end);
          const now = new Date();
          const hoursSinceRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceRun > 24) {
            newInsights.push({
              type: 'warning',
              agent: 'רועי',
              title: 'רועי לא רץ ביממה האחרונה',
              message: `רועי, אתה צריך לרוץ ולחפש משרות למועמדים. ריצה אחרונה: ${lastRun.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
              action: 'הפעלת רועי'
            });
          }
        } else if (roee && !roee.last_run_end) {
          newInsights.push({
            type: 'warning',
            agent: 'רועי',
            title: 'רועי מעולם לא רץ',
            message: 'רועי, אתה צריך לרוץ ולחפש משרות למועמדים.',
            action: 'הפעלת רועי'
          });
        }
      } catch (e) {
        console.log('Could not check agent status');
      }

      // Check stuck matches and candidates marked for action
      try {
        const { Match } = await import('@/entities/Match');
        const { CandidateStatus } = await import('@/entities/CandidateStatus');
        const allStatuses = await CandidateStatus.list();
        
        // Get all matches
        const allMatches = await Match.list('-updated_date');
        
        // Find stuck matches (status 1 = new, older than 48h)
        const stuckMatches = allMatches.filter(m => 
          m.status_number === 1 && 
          new Date(m.created_date) < new Date(fortyEightHoursAgo)
        );
        newStats.stuckMatches = stuckMatches.length;

        // Find matches marked by client (status 80 or 100 or contains "לקוח בחר")
        const clientChosenStatuses = allStatuses.filter(s => 
          s.status_name?.includes('לקוח בחר') || 
          s.status_name?.includes('לקוח סימן') ||
          s.status_number === 80 || 
          s.status_number === 100
        ).map(s => s.status_number);
        
        const markedMatches = allMatches.filter(m => clientChosenStatuses.includes(m.status_number));
        newStats.markedForAction = markedMatches.length;

        // Find matches waiting for response (sent to client but no update in 48h)
        const sentToClientStatuses = allStatuses.filter(s => 
          s.status_name?.includes('נשלח') || 
          s.status_name?.includes('הוצג')
        ).map(s => s.status_number);
        
        const waitingMatches = allMatches.filter(m => 
          sentToClientStatuses.includes(m.status_number) &&
          new Date(m.updated_date) < new Date(fortyEightHoursAgo)
        );
        newStats.waitingForResponse = waitingMatches.length;

        // Find matches with no message sent
        const noMessageMatches = allMatches.filter(m => 
          m.status_number === 1 && 
          new Date(m.created_date) < new Date(twentyFourHoursAgo)
        );
        newStats.noMessageSent = noMessageMatches.length;

        // Build action items for Carmit
        const newActionItems = [];

        // Urgent: Matches marked by client need immediate follow-up
        if (markedMatches.length > 0) {
          markedMatches.slice(0, 5).forEach(match => {
            const daysSinceUpdate = Math.floor((Date.now() - new Date(match.updated_date).getTime()) / (1000 * 60 * 60 * 24));
            newActionItems.push({
              type: 'urgent',
              matchId: match.id,
              candidateName: match.candidate_name,
              jobTitle: match.job_title,
              status: match.status,
              daysSinceUpdate,
              suggestion: daysSinceUpdate > 2 
                ? 'צריך לתאם ראיון או לעדכן את הלקוח על התקדמות' 
                : 'לוודא שנשלחה הודעה למועמד ולתאם זמינות'
            });
          });
        }

        // Warning: Matches waiting for response too long
        if (waitingMatches.length > 0) {
          waitingMatches.slice(0, 3).forEach(match => {
            newActionItems.push({
              type: 'waiting',
              matchId: match.id,
              candidateName: match.candidate_name,
              jobTitle: match.job_title,
              status: match.status,
              suggestion: 'לעקוב עם הלקוח - האם קיבל? האם רוצה לקבוע ראיון?'
            });
          });
        }

        // Info: New matches need first contact
        if (noMessageMatches.length > 0) {
          newActionItems.push({
            type: 'reminder',
            count: noMessageMatches.length,
            suggestion: `יש ${noMessageMatches.length} התאמות חדשות שעדיין לא נשלחה להן הודעה - נעמה ורועי, בבקשה ליצור קשר!`
          });
        }

        setActionItems(newActionItems);

        if (stuckMatches.length > 5) {
          newInsights.push({
            type: 'warning',
            agent: 'נעמה ורועי',
            title: `${stuckMatches.length} התאמות תקועות`,
            message: 'יש התאמות שלא התקדמו יותר מ-48 שעות. נעמה ורועי, צריך לקדם אותן או לסמן כלא רלוונטי.',
            action: 'קדמו התאמות או סמנו כלא רלוונטי'
          });
        }

        if (markedMatches.length > 0) {
          newInsights.push({
            type: 'error',
            agent: 'נעמה ורועי',
            title: `${markedMatches.length} מועמדים סומנו ע"י לקוחות!`,
            message: 'לקוחות סימנו מועמדים שמעניינים אותם - זה דורש טיפול מיידי! צריך ליצור קשר עם המועמדים ולתאם ראיונות.',
            action: 'צרו קשר עם המועמדים היום!'
          });
        }

        if (waitingMatches.length > 3) {
          newInsights.push({
            type: 'warning',
            agent: 'נעמה ורועי',
            title: `${waitingMatches.length} התאמות ממתינות לתגובת לקוח`,
            message: 'שלחתם מועמדים ללקוחות אבל לא קיבלתם תשובה. צריך לעקוב!',
            action: 'התקשרו ללקוחות לקבל פידבק'
          });
        }
      } catch (e) {
        console.log('Could not check stuck matches', e);
      }

      // Check outgoing messages
      try {
        const { EmailOutbox } = await import('@/entities/EmailOutbox');
        const allEmails = await EmailOutbox.list('-created_date', 100);
        const recentEmails = allEmails.filter(e => 
          new Date(e.created_date) > twentyFourHoursAgo
        );

        const { WhatsappOutbox } = await import('@/entities/WhatsappOutbox');
        const allWhatsapp = await WhatsappOutbox.list('-created_date', 100);
        const recentWhatsapp = allWhatsapp.filter(w => 
          new Date(w.created_date) > twentyFourHoursAgo
        );

        newStats.messagesSent24h = recentEmails.length + recentWhatsapp.length;

        if (newStats.messagesSent24h === 0 && newStats.stuckMatches > 0) {
          newInsights.push({
            type: 'error',
            agent: 'נעמה ורועי',
            title: 'אין הודעות יוצאות',
            message: 'לא נשלחו הודעות למועמדים או ללקוחות ב-24 שעות האחרונות, אבל יש התאמות ממתינות!',
            action: 'שלחו הודעות למועמדים'
          });
        }
      } catch (e) {
        console.log('Could not check outbox');
      }

      // If everything is good
      if (newInsights.length === 0) {
        newInsights.push({
          type: 'success',
          agent: 'כרמית',
          title: 'הכל מתנהל כשורה! 🎉',
          message: 'כל הסוכנים עובדים, יש מועמדים חדשים, התאמות מתקדמות והודעות יוצאות.',
          action: null
        });
      }

    } catch (error) {
      console.error('Error analyzing system:', error);
    }

    setStats(newStats);
    setInsights(newInsights);
    setLoading(false);
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <MessageSquare className="w-5 h-5 text-blue-500" />;
    }
  };

  const getInsightBg = (type) => {
    switch (type) {
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      case 'success': return 'bg-green-50 border-green-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200" dir="rtl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between text-right">
          <div className="flex items-center gap-3">
            <img 
              src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=60&h=60&fit=crop&crop=faces&facepad=2" 
              alt="כרמית" 
              className="w-12 h-12 rounded-full object-cover border-3 border-purple-300 shadow-md"
            />
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                כרמית - מחשבות ופעולות
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </CardTitle>
              <p className="text-sm text-gray-600">מנהלת הגיוס מפקחת על הצוות</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                if (!confirm('למחוק את כל הזיכרון של כרמית על התאמות שטיפלה בהן? היא תתייחס לכל ההתאמות מחדש.')) return;
                setLoading(true);
                try {
                  const response = await base44.functions.invoke('resetCarmitReviews', {});
                  toast.success(response.data.message || 'הזיכרון של כרמית אופס בהצלחה');
                  await refreshData();
                } catch (error) {
                  toast.error('שגיאה באיפוס הזיכרון של כרמית');
                }
              }}
              disabled={loading}
              className="text-purple-600 hover:text-purple-700"
            >
              <RotateCw className="w-4 h-4 mr-1" />
              אפס זיכרון
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={analyzeSystem}
              disabled={loading}
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          
          {/* Job Cards - Shows all active jobs with Carmit's decisions */}
          {activeTab === 'thinking' && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                החלטות כרמית על משרות לגייסות
                <Badge className="bg-blue-100 text-blue-800">
                  {jobs.filter(j => j.status === 'פעילה').length} משרות פעילות
                </Badge>
              </h4>
              
              <div className="overflow-x-auto border rounded-lg bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="min-w-[90px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('job_code')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          קוד {sortBy === 'job_code' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[180px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('title')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          משרה {sortBy === 'title' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[130px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('client')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          לקוח {sortBy === 'client' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[100px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('location')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          מיקום {sortBy === 'location' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[90px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('created_date')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          יצירה {sortBy === 'created_date' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[90px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('deadline')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          דדליין {sortBy === 'deadline' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('agent')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          החלטת כרמית {sortBy === 'agent' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[110px]">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('agent_status')} className="h-auto p-0 hover:bg-transparent font-semibold flex items-center gap-1">
                          סטטוס סוכן {sortBy === 'agent_status' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[170px]">שינוי סוכן</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSortedJobs().map((job) => {
                      const manualOverride = carmitLearningData.find(cl => cl.job_id === job.id && cl.is_active);
                      let carmitDecision = manualOverride ? manualOverride.user_override : (job.assigned_agent || null);
                      
                      if (!carmitDecision) {
                        const title = (job.title || '').toLowerCase();
                        const description = (job.description || '').toLowerCase();
                        const requirements = (job.requirements || '').toLowerCase();
                        const fullText = `${title} ${description} ${requirements}`;
                        const agentKeywords = {
                          naama: ['תוכנה', 'software', 'פייתון', 'python', 'java', 'c++', 'javascript', 'developer', 'programmer'],
                          dganit: ['qa', 'quality assurance', 'בדיקות תוכנה', 'בדיקות איכות', 'בודק תוכנה', 'test', 'testing', 'automation tester'],
                          rami: ['רמה 1', 'level 1'],
                          alik: ['אלקטרוניקה', 'electronics', 'אנלוג', 'analog', 'pcb', 'hardware', 'fpga'],
                          itay: ['it', 'מחשוב', 'devops', 'cloud', 'aws', 'network', 'security', 'סייבר', 'תשתיות'],
                          lior: ['מערכת', 'system engineer', 'systems engineer', 'system architect', 'integration engineer'],
                          ofir: ['מכונות', 'mechanical', 'מכני', 'solidworks', 'catia', 'תכן מכני']
                        };
                        if (job.security_clearance === 'רמה 1') {
                          carmitDecision = 'rami';
                        } else {
                          const scores = {};
                          Object.keys(agentKeywords).forEach(agent => {
                            scores[agent] = agentKeywords[agent].filter(k => fullText.includes(k)).length;
                          });
                          const maxScore = Math.max(...Object.values(scores));
                          carmitDecision = maxScore === 0 ? 'gc' : Object.keys(scores).find(agent => scores[agent] === maxScore) || 'gc';
                        }
                      }
                      
                      const agentNames = {
                        naama: 'נעמה - תוכנה',
                        dganit: 'דגנית - QA',
                        rami: 'רמי - רמה 1',
                        alik: 'אליק - אלקטרוניקה',
                        itay: 'איתי - IT',
                        lior: 'ליאור - הנדסת מערכת',
                        ofir: 'אופיר - מכונות',
                        gc: 'GC - כללי'
                      };
                      
                      const agentColors = {
                        naama: 'bg-orange-100 text-orange-800 border-orange-200',
                        dganit: 'bg-violet-100 text-violet-800 border-violet-200',
                        rami: 'bg-red-100 text-red-800 border-red-200',
                        alik: 'bg-teal-100 text-teal-800 border-teal-200',
                        itay: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                        lior: 'bg-amber-100 text-amber-800 border-amber-200',
                        ofir: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                        gc: 'bg-gray-100 text-gray-800 border-gray-200'
                      };
                      
                      const agentStatus = agentStatuses[carmitDecision] || {};
                      const isWorkingOnThisJob = agentStatus.focused_job_id === job.id;
                      const isWorkingOnOtherJob = agentStatus.is_running && agentStatus.focused_job_id && agentStatus.focused_job_id !== job.id;
                      
                      let workingStatus = '⚪ לא עובד';
                      let workingStatusColor = 'text-gray-500';
                      if (isWorkingOnThisJob) {
                        workingStatus = '🟢 עובד כאן';
                        workingStatusColor = 'text-green-600';
                      } else if (isWorkingOnOtherJob) {
                        workingStatus = '🟡 עובד אחרת';
                        workingStatusColor = 'text-amber-600';
                      }

                      const formatDate = (dateString) => {
                        if (!dateString) return '—';
                        return new Date(dateString).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jerusalem' });
                      };
                      
                      return (
                        <TableRow key={job.id} className="hover:bg-gray-50">
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px]">{job.job_code || '—'}</Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => { setSelectedJob(job); setJobDetailsOpen(true); }}
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-right"
                            >
                              {job.title}
                            </button>
                            {job.contact_person && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3" />{job.contact_person}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-700">
                              <Building className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              {job.client_name || '—'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              {job.location || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">{formatDate(job.created_date)}</TableCell>
                          <TableCell>
                            {job.deadline ? (
                              <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />{formatDate(job.deadline)}
                              </span>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${agentColors[carmitDecision]} border text-xs`}>
                              {agentNames[carmitDecision]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs ${workingStatusColor}`}>{workingStatus}</span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={job.assigned_agent || carmitDecision}
                              onValueChange={(value) => handleAgentChange(job.id, value)}
                            >
                              <SelectTrigger className="h-7 text-xs w-44">
                                <SelectValue placeholder="בחר סוכן" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="naama">נעמה - תוכנה</SelectItem>
                                <SelectItem value="dganit">דגנית - QA</SelectItem>
                                <SelectItem value="rami">רמי - רמה 1</SelectItem>
                                <SelectItem value="alik">אליק - אלקטרוניקה</SelectItem>
                                <SelectItem value="itay">איתי - IT</SelectItem>
                                <SelectItem value="lior">ליאור - הנדסת מערכת</SelectItem>
                                <SelectItem value="ofir">אופיר - מכונות</SelectItem>
                                <SelectItem value="gc">GC - כללי</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {jobs.filter(j => j.status === 'פעילה').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          אין משרות פעילות כרגע
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Job Details Dialog */}
              <JobDetailsDialog
                job={selectedJob}
                open={jobDetailsOpen}
                onClose={() => {
                  setJobDetailsOpen(false);
                  setSelectedJob(null);
                }}
              />
            </div>
          )}




          {/* Approved Drafts - Ready for Hila to Send */}
          {approvedDrafts.length > 0 && (
            <Alert className="bg-green-50 border-green-300">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription>
                <div className="font-medium mb-2 text-green-800">
                  טיוטות אושרו ע"י כרמית - ממתינות לשליחה ע"י הילה ({approvedDrafts.length})
                </div>
                {approvedDrafts.slice(0, 1).map(draft => (
                  <div key={draft.id} className="bg-white p-3 rounded border mb-2">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{draft.subject}</p>
                        <p className="text-xs text-gray-500">
                          {draft.jobs_count} משרות • אושר על ידי {draft.approved_by || 'כרמית'}
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-800 text-xs animate-pulse">
                        <Clock className="w-3 h-3 mr-1" />
                        ממתין לשליחה
                      </Badge>
                    </div>

                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {draft.body?.substring(0, 300)}...
                    </div>

                    {draft.approved_date && (
                      <p className="text-xs text-gray-500 mt-2">
                        אושר ב-{new Date(draft.approved_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
                      </p>
                    )}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Job Distribution Chart */}
          <div className="mt-4 pt-4 border-t text-right">
            <h4 className="font-medium text-gray-700 mb-3 text-sm">חלוקת משרות בין הסוכנים:</h4>
            <div className="bg-white rounded-lg p-6 border text-right">
              {jobDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={jobDistribution} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={130} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {jobDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="text-center text-sm text-gray-500 mt-2">
                    סה"כ {jobs.filter(j => j.status === 'פעילה').length} משרות פעילות
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  אין משרות פעילות כרגע
                </div>
              )}
            </div>
          </div>

          {/* Action Items Table - Combined Client Marked + Rotem Tasks */}
          {(actionItems.filter(item => item.type === 'urgent').length > 0 || rotemTasks.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  התאמות לטיפול מיידי
                  <Badge className="bg-red-100 text-red-800">
                    {actionItems.filter(item => item.type === 'urgent').length + rotemTasks.length}
                  </Badge>
                </h4>
                <Link to={createPageUrl('RotemPage')}>
                  <Button variant="outline" size="sm" className="gap-1">
                    <ExternalLink className="w-3 h-3" />
                    לדף טל
                  </Button>
                </Link>
              </div>
              
              <div className="bg-white rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-40">מועמד</TableHead>
                      <TableHead>משרה</TableHead>
                      <TableHead className="w-28">מקור</TableHead>
                      <TableHead className="w-28">סטטוס</TableHead>
                      <TableHead className="w-24">ימים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Client Marked Matches */}
                    {actionItems.filter(item => item.type === 'urgent').map((item, idx) => (
                      <TableRow key={`client-${idx}`} className="bg-red-50/50">
                        <TableCell className="font-medium">{item.candidateName}</TableCell>
                        <TableCell className="text-sm">{item.jobTitle}</TableCell>
                        <TableCell>
                          <Badge className="bg-red-100 text-red-800 text-xs">לקוח בחר</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{item.status}</TableCell>
                        <TableCell>
                          {item.daysSinceUpdate > 0 && (
                            <Badge variant="outline" className="text-xs">{item.daysSinceUpdate}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Rotem Tasks - Not Started */}
                    {rotemTasks.map((task) => {
                      const daysSinceCreated = Math.floor((Date.now() - new Date(task.created_date).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <TableRow key={`rotem-${task.id}`} className="bg-green-50/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {task.candidate_name}
                              {task.candidate_phone && (
                                <Phone className="w-3 h-3 text-green-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{task.job_title}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              {task.source === 'naama' ? 'נעמה' : 
                               task.source === 'dganit' ? 'דגנית' :
                               task.source === 'roee' ? 'רועי' : 
                               task.source === 'alik' ? 'אליק' : 
                               task.source === 'itay' ? 'איתי' : 
                               task.source === 'lior' ? 'ליאור' : 
                               task.source === 'ofir' ? 'אופיר' : 'ידני'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-100 text-amber-800 text-xs">ממתין לטל</Badge>
                          </TableCell>
                          <TableCell>
                            {daysSinceCreated > 0 && (
                              <Badge variant="outline" className="text-xs">{daysSinceCreated}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    
                    {actionItems.filter(item => item.type === 'urgent').length === 0 && rotemTasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                          אין התאמות ממתינות לטיפול
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Waiting for Response */}
          {actionItems.filter(item => item.type === 'waiting').length > 0 && (
            <Alert className="bg-orange-50 border-orange-300">
              <Clock className="w-4 h-4 text-orange-600" />
              <AlertDescription>
                <span className="font-medium text-orange-800">
                  {actionItems.filter(item => item.type === 'waiting').length} התאמות ממתינות לתגובת לקוח
                </span>
                <span className="text-sm text-orange-700 mr-2">- צריך לעקוב עם הלקוחות</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Carmit's New Auto Matches Analysis */}
          {newAutoMatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600" />
                  התאמות חדשות מסוכני הגיוס - החלטת כרמית
                  <Badge className="bg-purple-100 text-purple-800">
                    {newAutoMatches.length}
                  </Badge>
                </h4>
                <Button
                  size="sm"
                  onClick={sendAllToRotem}
                  disabled={Object.values(sendingToRotem).some(v => v)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {Object.values(sendingToRotem).some(v => v) ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Users className="w-4 h-4 mr-1" />
                  )}
                  שלח הכל לטל
                </Button>
              </div>

              <Alert className="bg-purple-50 border-purple-300">
                <AlertDescription>
                  <div className="font-medium mb-3 text-purple-800">
                    כרמית בדקה את ההתאמות החדשות מנעמה, דגנית, רמי, אליק, איתי, ליאור ואופיר והחליטה מי צריך טיפול מיידי:
                  </div>
                  
                  <div className="space-y-2">
                    {newAutoMatches.map(match => (
                      <div key={match.id} className="bg-white p-3 rounded border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{match.candidate_name}</span>
                              <Badge className={
                                match.carmit_priority === 'גבוה' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }>
                                עדיפות {match.carmit_priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {match.user_name}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">משרה:</span> {match.job_title}
                            </div>
                            
                            <div className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">ציון התאמה:</span> {match.match_score}/100
                            </div>
                            
                            <div className="text-sm bg-purple-50 p-2 rounded mt-2">
                              <span className="font-medium text-purple-800">החלטת כרמית:</span> {match.carmit_reasoning}
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={() => sendMatchToRotem(match)}
                            disabled={sendingToRotem[match.id]}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {sendingToRotem[match.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Users className="w-4 h-4 mr-1" />
                                שלח לנועה
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}


        </CardContent>
      )}
    </Card>
  );
}