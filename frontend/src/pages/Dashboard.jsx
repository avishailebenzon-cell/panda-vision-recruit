import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  Building,
  Mail,
  Send,
  Loader2,
  RotateCw,
  Eye,
  Star,
  Activity,
  ArrowRight,
  CheckSquare,
  AlertTriangle,
  BrainCircuit,
  MessageCircle,
  BarChart3,
  ListChecks,
  ClipboardList,
  GitMerge,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import CandidateJourneyTimeline from "../components/dashboard/CandidateJourneyTimeline";
import CandidateTagsBadges from "../components/candidates/CandidateTagsBadges";
import CarmitInsights from "../components/dashboard/CarmitInsights";
import { RotemTasksSection } from "../components/dashboard/CarmitThinkingProcess";

import AgentThinkingLog from "../components/management/AgentThinkingLog";
import CarmitAgentQueriesLog from "../components/dashboard/CarmitAgentQueriesLog";
import CarmitDecisionLog from "../components/dashboard/CarmitDecisionLog";
import { resetCarmitReviews } from "@/functions/resetCarmitReviews";
import { toast } from "sonner";
import { Brain } from "lucide-react";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import UserTasksCenterContent from "@/components/dashboard/UserTasksCenterContent";
import CandidateStatisticsCard from "../components/dashboard/CandidateStatisticsCard";

const setDefaultPermissions = (user) => {
  const defaultTrue = (prop) => prop !== false;
  return {
    ...user,
    can_view_dashboard: defaultTrue(user.can_view_dashboard),
    dashboard_can_view_stats_cards: defaultTrue(user.dashboard_can_view_stats_cards),
    dashboard_can_view_client_marked_candidates: defaultTrue(user.dashboard_can_view_client_marked_candidates),
    dashboard_can_view_candidate_inbox: defaultTrue(user.dashboard_can_view_candidate_inbox),
    dashboard_can_view_job_inbox: defaultTrue(user.dashboard_can_view_job_inbox),
    dashboard_can_view_journey_timeline: defaultTrue(user.dashboard_can_view_journey_timeline),
    dashboard_can_view_recent_activity: defaultTrue(user.dashboard_can_view_recent_activity),
    dashboard_can_view_weekly_stats: defaultTrue(user.dashboard_can_view_weekly_stats),
    can_view_jobs: defaultTrue(user.can_view_jobs),
    can_view_candidates: defaultTrue(user.can_view_candidates),
  };
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalCandidates: 0,
    totalSearches: 0,
    activeClients: 0
  });

  const [inboxCandidates, setInboxCandidates] = useState([]);
  const [inboxJobs, setInboxJobs] = useState([]);
  const [rotemTasks, setRotemTasks] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [carmitStatus, setCarmitStatus] = useState(null);
  const [markingAsHandled, setMarkingAsHandled] = useState({});
  const [selectedInboxItems, setSelectedInboxItems] = useState([]);
  const [showImportantOnly, setShowImportantOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('decisions');
  const [roteMSubTab, setRotemSubTab] = useState('sent');

  const loadJobsData = async (currentUserPermissions) => {
    if (currentUserPermissions.can_view_jobs) {
      const jobs = await base44.entities.Job.list();
      setAllJobs(jobs);
      setStats(prev => ({ ...prev, activeJobs: jobs.filter(j => j.status === 'פעילה').length }));
      return jobs;
    }
    setStats(prev => ({ ...prev, activeJobs: 0 }));
    setAllJobs([]);
    return [];
  };

  const loadCandidatesData = async (currentUserPermissions) => {
    if (currentUserPermissions.can_view_candidates) {
      const candidates = await base44.entities.Candidate.list();
      setStats(prev => ({ ...prev, totalCandidates: candidates.length }));
      return candidates;
    }
    setStats(prev => ({ ...prev, totalCandidates: 0 }));
    return [];
  };

  const loadClientsData = async () => {
    const clients = await base44.entities.Client.list();
    setAllClients(clients);
    setStats(prev => ({ ...prev, activeClients: clients.length }));
    return clients;
  };

  const loadMatchesData = async (currentUser) => {
    let allRelevantMatches = [];
    try {
      if (currentUser.app_role === 'admin' || currentUser.app_role === 'hr') {
        allRelevantMatches = await base44.entities.Match.list('-created_date');
      } else if (currentUser.app_role === 'client') {
        allRelevantMatches = await base44.entities.Match.filter({ user_id: currentUser.id }, '-created_date');
      }
      setAllMatches(allRelevantMatches);
      return allRelevantMatches;
    } catch (error) {
      console.error("Error loading matches:", error);
      setAllMatches([]);
      return [];
    }
  };

  const loadSearchLogsData = async (currentUser) => {
    const searches = await base44.entities.SearchLog.filter({ user_email: currentUser.email });
    setStats(prev => ({ ...prev, totalSearches: searches.length }));
    return searches;
  };

  const loadInboxCandidatesData = async () => {
    try {
      const candidateInboxItems = await base44.entities.NewCandidateInbox.filter({ is_processed: false });
      setInboxCandidates(candidateInboxItems);
      return candidateInboxItems;
    } catch (error) {
      console.error("Error loading candidate inbox:", error);
      setInboxCandidates([]);
      return [];
    }
  };

  const loadJobInboxData = async () => {
    try {
      const jobInboxItems = await base44.entities.NewJobInbox.filter({ is_viewed: false });
      setInboxJobs(jobInboxItems);
      return jobInboxItems;
    } catch (error) {
      console.error("Error loading job inbox:", error);
      setInboxJobs([]);
      return [];
    }
  };

  const loadRotemTasksData = async () => {
    try {
      const tasks = await base44.entities.RotemTask.list('-created_date', 50);
      setRotemTasks(tasks);
      return tasks;
    } catch (error) {
      console.error("Error loading Rotem tasks:", error);
      setRotemTasks([]);
      return [];
    }
  };

  useEffect(() => {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const currentUser = await base44.auth.me();
        const userWithPermissions = setDefaultPermissions(currentUser);
        setUser(userWithPermissions);

        await loadJobsData(userWithPermissions);
        await delay(1000);

        await loadClientsData();
        await delay(1000);

        await loadMatchesData(currentUser);
        await delay(1000);

        if (userWithPermissions.dashboard_can_view_stats_cards) {
          if (userWithPermissions.can_view_candidates) {
            await loadCandidatesData(userWithPermissions);
            await delay(1000);
          }
          await loadSearchLogsData(currentUser);
          await delay(1000);
        }

        if (userWithPermissions.dashboard_can_view_candidate_inbox) {
          await loadInboxCandidatesData();
          await delay(1000);
        }

        if (userWithPermissions.dashboard_can_view_job_inbox) {
          await loadJobInboxData();
          await delay(1000);
        }

        await loadRotemTasksData();
        await delay(1000);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      }
      setLoading(false);
    };

    loadDashboardData();
  }, []);

  useEffect(() => {
    const loadAutomaticRecommendations = async () => {
      if (!user?.dashboard_can_view_candidate_inbox) {
        setInboxCandidates(prev => prev.filter(c => !c.isAutomaticRecommendation));
        return;
      }

      if (allMatches.length > 0 && allJobs.length > 0) {
        try {
          await new Promise(resolve => setTimeout(resolve, 600));
          const allStatuses = await base44.entities.CandidateStatus.list();
          const recommendationStatus = allStatuses.find(s => 
            s.status_name && s.status_name.includes('המלצה אוטומטית')
          );

          if (recommendationStatus) {
            const recommendations = allMatches.filter(m => 
              m.status_number === recommendationStatus.status_number && 
              !m.is_read && 
              m.is_automatic_recommendation
            );

            const enrichedRecommendations = recommendations.map(rec => {
              const job = allJobs.find(j => j.id === rec.job_id);
              return {
                ...rec,
                isAutomaticRecommendation: true,
                jobInfo: job || { title: 'משרה לא נמצאה', client_name: 'לקוח לא ידוע' }
              };
            });

            setInboxCandidates(prev => {
              const existingNewCandidateInboxItems = prev.filter(c => !c.isAutomaticRecommendation);
              return [...existingNewCandidateInboxItems, ...enrichedRecommendations];
            });
          } else {
            setInboxCandidates(prev => prev.filter(c => !c.isAutomaticRecommendation));
          }
        } catch (error) {
          console.error("Error loading automatic recommendations:", error);
          setInboxCandidates(prev => prev.filter(c => !c.isAutomaticRecommendation));
        }
      } else {
        setInboxCandidates(prev => prev.filter(c => !c.isAutomaticRecommendation));
      }
    };

    loadAutomaticRecommendations();
  }, [allMatches, allJobs, user]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleCandidateHandled = async (inboxId) => {
    setMarkingAsHandled(prev => ({ ...prev, [inboxId]: true }));
    try {
      await base44.entities.NewCandidateInbox.update(inboxId, {
        is_processed: true,
        processed_date: new Date().toISOString()
      });
      setInboxCandidates(prev => prev.filter(c => c.id !== inboxId));
      setSelectedInboxItems(prev => prev.filter(id => id !== inboxId));
    } catch (error) {
      console.error("Error marking candidate as processed:", error);
    } finally {
      setMarkingAsHandled(prev => ({ ...prev, [inboxId]: false }));
    }
  };

  const handleBulkMarkAsHandled = async () => {
    if (selectedInboxItems.length === 0) return;
    
    const itemsToProcess = selectedInboxItems.filter(id => {
      const item = inboxCandidates.find(c => c.id === id);
      return item && !item.isAutomaticRecommendation;
    });

    if (itemsToProcess.length === 0) return;

    const loadingState = {};
    itemsToProcess.forEach(id => { loadingState[id] = true; });
    setMarkingAsHandled(prev => ({ ...prev, ...loadingState }));

    try {
      await Promise.all(itemsToProcess.map(id => 
        base44.entities.NewCandidateInbox.update(id, {
          is_processed: true,
          processed_date: new Date().toISOString()
        })
      ));
      setInboxCandidates(prev => prev.filter(c => !itemsToProcess.includes(c.id)));
      setSelectedInboxItems([]);
    } catch (error) {
      console.error("Error bulk marking candidates as processed:", error);
    } finally {
      const resetState = {};
      itemsToProcess.forEach(id => { resetState[id] = false; });
      setMarkingAsHandled(prev => ({ ...prev, ...resetState }));
    }
  };

  const toggleSelectInboxItem = (itemId) => {
    setSelectedInboxItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleSelectAllInbox = () => {
    const nonRecommendationItems = inboxCandidates.filter(c => !c.isAutomaticRecommendation);
    if (selectedInboxItems.length === nonRecommendationItems.length) {
      setSelectedInboxItems([]);
    } else {
      setSelectedInboxItems(nonRecommendationItems.map(c => c.id));
    }
  };

  const handleJobHandled = async (inboxId) => {
    setMarkingAsHandled(prev => ({ ...prev, [inboxId]: true }));
    try {
      await base44.entities.NewJobInbox.update(inboxId, {
        is_viewed: true,
        viewed_date: new Date().toISOString()
      });
      setInboxJobs(prev => prev.filter(j => j.id !== inboxId));
    } catch (error) {
      console.error("Error marking job as viewed:", error);
    } finally {
      setMarkingAsHandled(prev => ({ ...prev, [inboxId]: false }));
    }
  };

  if (loading) {
    return <LoadingSpinner message="טוען דשבורד כרמית..." />;
  }

  if (!user || user.can_view_dashboard === false) {
    return <Navigate to={createPageUrl("Search")} />;
  }

  return (
    <div className="space-y-6 p-4 md:p-8" dir="rtl">
      <div className="flex flex-col gap-3 text-right">
        <div className="flex items-center gap-3">
          <img 
            src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=100&h=100&fit=crop&crop=faces&facepad=2" 
            alt="כרמית" 
            className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 md:border-4 border-purple-200 shadow-lg"
          />
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
              כרמית - ניהול הגיוס
              {carmitStatus?.is_running && (
                <Badge className="bg-green-500 text-white animate-pulse text-xs">
                  <Activity className="w-3 h-3 ml-1" />
                  פעילה
                </Badge>
              )}
            </h1>
            <p className="text-xs md:text-base text-gray-600">
              {carmitStatus?.current_activity || 'מנצחת על כל הסוכנים במערך הגיוס'}
            </p>
          </div>
        </div>
      </div>



      {/* Pipedrive Sync Report Button */}
      <div className="flex justify-end">
        <Link to={createPageUrl("PipedriveSyncReport")}>
          <Button variant="outline" className="gap-2 text-sm">
            <GitMerge className="w-4 h-4" />
            דוח סנכרון Pipedrive
          </Button>
        </Link>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1 rounded-lg w-full mb-4">
          <TabsTrigger value="decisions" className="flex items-center gap-1.5 text-xs md:text-sm px-3 py-2">
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">החלטות על מועמדים</span>
            <span className="sm:hidden">מועמדים</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5 text-xs md:text-sm px-3 py-2">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">דווחי רכזי גיוס</span>
            <span className="sm:hidden">דווחים</span>
          </TabsTrigger>
          <TabsTrigger value="agent_queries" className="flex items-center gap-1.5 text-xs md:text-sm px-3 py-2">
            <ListChecks className="w-4 h-4" />
            <span className="hidden sm:inline">שיחות עם רכזי גיוס</span>
            <span className="sm:hidden">שיחות</span>
          </TabsTrigger>
          <TabsTrigger value="thinking" className="flex items-center gap-1.5 text-xs md:text-sm px-3 py-2">
            <BrainCircuit className="w-4 h-4" />
            <span className="hidden sm:inline">החלטות על משרות</span>
            <span className="sm:hidden">משרות</span>
          </TabsTrigger>
          <TabsTrigger value="rotem_contact" className="flex items-center gap-1.5 text-xs md:text-sm px-3 py-2">
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">משימות לטל</span>
            <span className="sm:hidden">טל</span>
          </TabsTrigger>
          <TabsTrigger value="user_tasks" className="flex items-center gap-1.5 text-xs md:text-sm px-3 py-2">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">משימות משתמש</span>
            <span className="sm:hidden">משימות</span>
          </TabsTrigger>
          <TabsTrigger value="candidate_stats" className="flex items-center gap-1.5 text-xs md:text-sm px-3 py-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">סטטיסטיקת מועמדים</span>
            <span className="sm:hidden">סטטיסטיקה</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                דווחי רכזי גיוס
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AgentThinkingLog agentName="carmit" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-pink-600" />
                החלטות כרמית על מועמדים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CarmitDecisionLog />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent_queries">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-indigo-600" />
                שיחות עם רכזי גיוס
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CarmitAgentQueriesLog />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thinking">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-blue-600" />
                החלטות כרמית על משרות לגייסות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CarmitInsights activeTab="thinking" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rotem_contact">
          <Tabs value={roteMSubTab} onValueChange={setRotemSubTab} dir="rtl">
            <TabsList className="mb-4">
              <TabsTrigger value="sent" className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                משימות שהועברו לטל
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                משימות נדחות
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sent">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    משימות שהועברו לטל
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RotemTasksSection 
                    rotemTasks={rotemTasks}
                    jobs={allJobs}
                    rotemLearningData={[]}
                    onDataChange={() => { loadRotemTasksData(); loadJobsData(user); }}
                    showOnlySent={true}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="rejected">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    משימות נדחות
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RotemTasksSection 
                    rotemTasks={rotemTasks}
                    jobs={allJobs}
                    rotemLearningData={[]}
                    onDataChange={() => { loadRotemTasksData(); loadJobsData(user); }}
                    showOnlyRejected={true}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="user_tasks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                ריכוז משימות משתמש
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserTasksCenterContent />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidate_stats">
          <CandidateStatisticsCard />
        </TabsContent>
      </Tabs>


    </div>
  );
}