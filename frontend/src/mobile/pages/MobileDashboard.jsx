import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileTabs, MobileTabsButtons, MobileTabButton, MobileTabsContent } from "@/components/ui/mobile-tabs";
import {
  CheckSquare,
  Activity,
  ListChecks,
  BrainCircuit,
  MessageCircle,
  ClipboardList,
  BarChart3,
  AlertTriangle
} from "lucide-react";
import AgentThinkingLog from "@/components/management/AgentThinkingLog";
import CarmitDecisionLog from "@/components/dashboard/CarmitDecisionLog";
import CarmitAgentQueriesLog from "@/components/dashboard/CarmitAgentQueriesLog";
import CarmitInsights from "@/components/dashboard/CarmitInsights";
import { RotemTasksSection } from "@/components/dashboard/CarmitThinkingProcess";
import UserTasksCenterContent from "@/components/dashboard/UserTasksCenterContent";
import CandidateStatisticsCard from "@/components/dashboard/CandidateStatisticsCard";

export default function MobileDashboard() {
  const [activeTab, setActiveTab] = useState('decisions');
  const [rotemSubTab, setRotemSubTab] = useState('sent');
  const [rotemTasks, setRotemTasks] = useState([]);
  const [allJobs, setAllJobs] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tasks, jobs] = await Promise.all([
          base44.entities.RotemTask.list('-created_date', 50),
          base44.entities.Job.list()
        ]);
        setRotemTasks(tasks);
        setAllJobs(jobs);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <img 
          src="https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=100&h=100&fit=crop&crop=faces&facepad=2" 
          alt="כרמית" 
          className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 shadow-lg"
        />
        <div>
          <h1 className="text-xl font-bold text-gray-800">כרמית - ניהול הגיוס</h1>
          <p className="text-xs text-gray-600">מנצחת על כל הסוכנים</p>
        </div>
      </div>

      <MobileTabs value={activeTab} onValueChange={setActiveTab}>
        <MobileTabsButtons>
          <MobileTabButton value="decisions" icon={CheckSquare} label="החלטות על מועמדים" color="pink" />
          <MobileTabButton value="activity" icon={Activity} label="דווחי רכזים" color="purple" />
          <MobileTabButton value="agent_queries" icon={ListChecks} label="שיחות עם רכזים" color="indigo" />
          <MobileTabButton value="thinking" icon={BrainCircuit} label="החלטות על משרות" color="blue" />
          <MobileTabButton value="rotem_contact" icon={MessageCircle} label="משימות לטל" color="green" />
          <MobileTabButton value="user_tasks" icon={ClipboardList} label="ריכוז משימות" color="blue" />
          <MobileTabButton value="candidate_stats" icon={BarChart3} label="סטטיסטיקה" color="teal" />
        </MobileTabsButtons>

        <MobileTabsContent tabValue="decisions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-pink-600" />
                החלטות כרמית על מועמדים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CarmitDecisionLog />
            </CardContent>
          </Card>
        </MobileTabsContent>

        <MobileTabsContent tabValue="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                דווחי רכזי גיוס
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AgentThinkingLog agentName="carmit" />
            </CardContent>
          </Card>
        </MobileTabsContent>

        <MobileTabsContent tabValue="agent_queries">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-600" />
                שיחות עם רכזי גיוס
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CarmitAgentQueriesLog />
            </CardContent>
          </Card>
        </MobileTabsContent>

        <MobileTabsContent tabValue="thinking">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-600" />
                החלטות כרמית על משרות לגייסות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CarmitInsights activeTab="thinking" />
            </CardContent>
          </Card>
        </MobileTabsContent>

        <MobileTabsContent tabValue="rotem_contact">
          <MobileTabs value={rotemSubTab} onValueChange={setRotemSubTab}>
            <MobileTabsButtons>
              <MobileTabButton value="sent" icon={MessageCircle} label="הועברו לטל" count={rotemTasks.length} color="green" />
              <MobileTabButton value="rejected" icon={AlertTriangle} label="נדחו" color="orange" />
            </MobileTabsButtons>

            <MobileTabsContent tabValue="sent">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">משימות שהועברו לטל</CardTitle>
                </CardHeader>
                <CardContent>
                  <RotemTasksSection 
                    rotemTasks={rotemTasks}
                    jobs={allJobs}
                    rotemLearningData={[]}
                    onDataChange={async () => {
                      const tasks = await base44.entities.RotemTask.list('-created_date', 50);
                      setRotemTasks(tasks);
                    }}
                    showOnlySent={true}
                  />
                </CardContent>
              </Card>
            </MobileTabsContent>

            <MobileTabsContent tabValue="rejected">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">משימות נדחות</CardTitle>
                </CardHeader>
                <CardContent>
                  <RotemTasksSection 
                    rotemTasks={rotemTasks}
                    jobs={allJobs}
                    rotemLearningData={[]}
                    onDataChange={async () => {
                      const tasks = await base44.entities.RotemTask.list('-created_date', 50);
                      setRotemTasks(tasks);
                    }}
                    showOnlyRejected={true}
                  />
                </CardContent>
              </Card>
            </MobileTabsContent>
          </MobileTabs>
        </MobileTabsContent>

        <MobileTabsContent tabValue="user_tasks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                ריכוז משימות משתמש
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserTasksCenterContent />
            </CardContent>
          </Card>
        </MobileTabsContent>

        <MobileTabsContent tabValue="candidate_stats">
          <CandidateStatisticsCard />
        </MobileTabsContent>
      </MobileTabs>
    </div>
  );
}