import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Users, Briefcase, Building2, Heart } from 'lucide-react';

export default function MobileHome() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobsInboxCount, setJobsInboxCount] = useState(0);
  const [hilaDraftsCount, setHilaDraftsCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        const [inbox, jobs, drafts] = await Promise.all([
          base44.entities.NewCandidateInbox.filter({ is_processed: false }),
          base44.entities.NewJobInbox.filter({ is_viewed: false }),
          base44.entities.HilaDraft.filter({ status: 'pending_approval' })
        ]);
        
        setInboxCount(inbox.length);
        setJobsInboxCount(jobs.length);
        setHilaDraftsCount(drafts.length);

        const statuses = await base44.entities.CandidateStatus.list();
        const newStatusNumber = statuses.find(s => s.status_name?.includes('חדש'))?.status_number || 1;
        const successStatusNumber = statuses.find(s => s.status_name?.includes('מוצלח'))?.status_number;
        const closedStatusNumber = statuses.find(s => s.status_name?.includes('נסגר'))?.status_number;
        const excludeStatuses = [];
        if (successStatusNumber !== undefined) excludeStatuses.push(successStatusNumber);
        if (closedStatusNumber !== undefined) excludeStatuses.push(closedStatusNumber);

        let relevantMatches = [];
        if (excludeStatuses.length > 0) {
          relevantMatches = await base44.entities.Match.filter({ status_number: { $nin: excludeStatuses } });
        } else {
          relevantMatches = await base44.entities.Match.list();
        }

        const unreadTasks = relevantMatches.filter(m => m.status_number === newStatusNumber || !m.is_read);
        setTaskCount(unreadTasks.length);
      } catch (error) {
        console.error("Error loading data:", error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const departments = [
    {
      name: "מחלקת הגיוס",
      icon: Building2,
      color: "from-blue-500 to-purple-600",
      agents: [
        { name: "כרמית", role: "מנהלת הגיוס", link: "/MobileDashboard", count: taskCount, bgGradient: "from-purple-100 to-purple-50" },
        { name: "נעמה", role: "רכזת תוכנה", link: "/MobileNaamaPage", bgGradient: "from-orange-100 to-orange-50" },
        { name: "רמי", role: "מומחה רמה 1", link: "/MobileRamiPage", bgGradient: "from-red-100 to-red-50" },
        { name: "אליק", role: "מומחה אלקטרוניקה", link: "/MobileAlikPage", bgGradient: "from-teal-100 to-teal-50" }
      ]
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-purple-500">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-900">HRAI</h1>
            <p className="text-xs text-gray-600">מערכת סוכני AI</p>
          </div>
        </div>
        {user && (
          <p className="text-sm text-gray-600">שלום, {user.full_name}</p>
        )}
      </div>

      {/* Departments */}
      {departments.map((dept) => (
        <div key={dept.name}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`h-1 flex-1 bg-gradient-to-l ${dept.color} rounded-full`}></div>
            <div className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${dept.color} text-white shadow-lg flex items-center gap-2`}>
              <dept.icon className="w-4 h-4" />
              <h2 className="text-sm font-bold">{dept.name}</h2>
            </div>
            <div className={`h-1 flex-1 bg-gradient-to-r ${dept.color} rounded-full`}></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {dept.agents.map((agent) => (
              <Link key={agent.name} to={agent.link}>
                <Card className={`p-3 bg-gradient-to-br ${agent.bgGradient} border-gray-300 hover:shadow-lg transition-all active:scale-95`}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-gray-900">{agent.name}</div>
                      {agent.count > 0 && (
                        <Badge className="bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs p-0 animate-pulse">
                          {agent.count}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 line-clamp-2">{agent.role}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center text-xs text-gray-500 pt-4">
        <p>© 2024 HRAI - By Pandatech</p>
      </div>
    </div>
  );
}