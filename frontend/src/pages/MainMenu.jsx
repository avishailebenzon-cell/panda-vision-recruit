import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { User } from '@/entities/User';
import { Card } from '@/components/ui/card';
import {
  Users,
  Sun,
  Moon,
  Monitor,
  Building2,
  Heart,
  ServerCog,
  HelpCircle,
  Radar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import MainMenuTutorial, { useMainMenuTutorial } from '@/components/tutorial/MainMenuTutorial';
import ReleaseNotesDialog from '@/components/layout/ReleaseNotesDialog';

const getAutoTheme = () => {
  const hour = new Date().getHours();
  return (hour >= 6 && hour < 18) ? 'light' : 'dark';
};

const isVersionGreater = (newVersion, oldVersion) => {
  if (!oldVersion) return true;
  
  const parseVersion = (v) => v.split('.').map(Number);
  const newParts = parseVersion(newVersion);
  const oldParts = parseVersion(oldVersion);
  
  for (let i = 0; i < Math.max(newParts.length, oldParts.length); i++) {
    const newPart = newParts[i] || 0;
    const oldPart = oldParts[i] || 0;
    
    if (newPart > oldPart) return true;
    if (newPart < oldPart) return false;
  }
  
  return false;
};

export default function MainMenu() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'auto');
  const [inboxCount, setInboxCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [jobsInboxCount, setJobsInboxCount] = useState(0);
  const [employeeRequestsCount, setEmployeeRequestsCount] = useState(0);
  const [hilaDraftsCount, setHilaDraftsCount] = useState(0);
  const [systemVersion, setSystemVersion] = useState('1.0.0');
  const [currentVersion, setCurrentVersion] = useState(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const departmentsRef = React.useRef(null);
  const videoRef = React.useRef(null);
  
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && getAutoTheme() === 'dark');
  const { isOpen: isTutorialOpen, open: openTutorial, close: closeTutorial } = useMainMenuTutorial();

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const fetchSystemVersion = async () => {
      try {
        const versions = await base44.entities.SystemVersion.list();
        if (versions.length > 0) {
          setSystemVersion(versions[0].version);
          setCurrentVersion(versions[0]);
          
          // Check if current version is greater than user's last seen version
          const user = await User.me();
          if (isVersionGreater(versions[0].version, user.last_version_seen)) {
            setShowReleaseNotes(true);
          }
        }
      } catch (error) {
        console.error('Error loading system version:', error);
      }
    };
    fetchSystemVersion();
  }, []);

  const handleCloseReleaseNotes = async (dontShowAgain) => {
    setShowReleaseNotes(false);
    
    if (dontShowAgain && currentVersion && user) {
      try {
        await base44.auth.updateMe({
          last_version_seen: currentVersion.version
        });
      } catch (error) {
        console.error('Error updating last_version_seen:', error);
      }
    }
  };

  const cycleTheme = () => {
    const modes = ['auto', 'light', 'dark'];
    const currentIndex = modes.indexOf(themeMode);
    setThemeMode(modes[(currentIndex + 1) % modes.length]);
  };

  const getThemeIcon = () => {
    if (themeMode === 'auto') return <Monitor className="w-4 h-4" />;
    if (themeMode === 'light') return <Sun className="w-4 h-4" />;
    return <Moon className="w-4 h-4" />;
  };

  const getThemeLabel = () => {
    if (themeMode === 'auto') return 'אוטומטי';
    if (themeMode === 'light') return 'בהיר';
    return 'כהה';
  };

  const setDefaultPermissions = (user) => {
    const defaults = {
      admin: {
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: true,
        mainmenu_can_view_candidates_button: true,
        mainmenu_can_view_matches_button: true,
        mainmenu_can_view_clients_button: true,
        mainmenu_can_view_management_button: true,
      },
      hr: {
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: true,
        mainmenu_can_view_candidates_button: true,
        mainmenu_can_view_matches_button: true,
        mainmenu_can_view_clients_button: false,
        mainmenu_can_view_management_button: false,
      },
      client: {
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: false,
        mainmenu_can_view_candidates_button: false,
        mainmenu_can_view_matches_button: false,
        mainmenu_can_view_clients_button: false,
        mainmenu_can_view_management_button: false,
      }
    };

    const userAppRole = user.app_role || 'hr';
    return { ...defaults[userAppRole], ...user };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const currentUser = await User.me();
        const userWithPermissions = setDefaultPermissions(currentUser);
        setUser(userWithPermissions);

        // Fetch counts
        try {
          const [inbox, jobs, requests, drafts] = await Promise.all([
            base44.entities.NewCandidateInbox.filter({ is_processed: false }),
            base44.entities.NewJobInbox.filter({ is_viewed: false }),
            base44.entities.EmployeeRequest.filter({ status: 'חדשה' }),
            base44.entities.HilaDraft.filter({ status: 'pending_approval' })
          ]);
          setInboxCount(inbox.length);
          setJobsInboxCount(jobs.length);
          setEmployeeRequestsCount(requests.length);
          setHilaDraftsCount(drafts.length);

          // Calculate task count for dashboard
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
          console.error("Error loading counts:", error);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // Show splash screen for 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={createPageUrl("Home")} />;
  }

  // Room configuration with agents
  // Show splash screen
  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        >
          <source src="https://www.dropbox.com/scl/fi/tfzfuajxkoqr71j67w3pa/.mp4?rlkey=naegchq3g1tqsnpsx4cdotpad&st=3da23awe&dl=1" type="video/mp4" />
        </video>
      </div>
    );
  }

  const departments = [
    {
      name: "טיפול בלקוחות",
      icon: Building2,
      image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=400&fit=crop",
      color: "from-indigo-500 to-blue-600",
      visible: user.mainmenu_can_view_jobs_button || user.mainmenu_can_view_matches_button,
      rooms: [
        {
          name: "",
          agents: [
            {
              name: "נועה",
              role: "סנכרון משרות",
              avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("Jobs"),
              visible: user.mainmenu_can_view_jobs_button,
              count: jobsInboxCount,
              bgGradient: "from-blue-100 to-blue-50"
            },
            {
              name: "דנה",
              role: "קליטת משרות ואנשי קשר",
              avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("Jobs") + "?openDana=true",
              visible: user.mainmenu_can_view_jobs_button,
              count: jobsInboxCount,
              bgGradient: "from-cyan-100 to-cyan-50"
            },

            {
              name: "אלעד",
              role: "שליחת מועמדים",
              avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("EladPage"),
              visible: user.mainmenu_can_view_matches_button || user.mainmenu_can_view_management_button,
              bgGradient: "from-indigo-100 to-indigo-50"
            },

            {
               name: "מני",
               role: "מכירות אפקטיביות",
               avatar: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop&crop=face",
               link: createPageUrl("MeniPage"),
               visible: user.mainmenu_can_view_matches_button,
               bgGradient: "from-purple-100 to-purple-50"
             },
             {
              name: "איתן",
              role: "בדיקות איכות שירות",
              avatar: "https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("EitanManagement"),
              visible: user.mainmenu_can_view_matches_button || user.mainmenu_can_view_management_button,
              bgGradient: "from-teal-100 to-teal-50"
            }
          ]
        }
      ]
    },
    {
      name: "מחלקת הגיוס",
      icon: Building2,
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=400&fit=crop",
      color: "from-blue-500 to-purple-600",
      visible: user.mainmenu_can_view_dashboard_button || user.mainmenu_can_view_candidates_button || user.mainmenu_can_view_matches_button,
      rooms: [
        {
          name: "",
          agents: [{
            name: "כרמית",
            role: "מנהלת הגיוס",
            avatar: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=100&h=100&fit=crop&crop=faces&facepad=2",
            link: createPageUrl("Dashboard"),
            visible: user.mainmenu_can_view_dashboard_button,
            count: taskCount,
            bgGradient: "from-purple-100 to-purple-50"
          }]
        },
        {
          name: "",
          agentCategory: "סוכני גיוס",
          agents: [
            {
              name: "נעמה",
              role: "רכזת גיוס תחום תוכנה",
              avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("NaamaPage"),
              visible: user.mainmenu_can_view_matches_button,
              bgGradient: "from-orange-100 to-orange-50"
            },
            {
              name: "ליאור",
              role: "רכז הנדסת מערכת",
              avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("LiorPage"),
              visible: user.mainmenu_can_view_matches_button,
              bgGradient: "from-amber-100 to-amber-50"
            },
            {
              name: "רמי",
              role: "רכז רמה 1",
              avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("RamiPage"),
              visible: user.mainmenu_can_view_matches_button,
              bgGradient: "from-red-100 to-red-50"
            },
            {
              name: "איתי",
              role: "רכז IT",
              avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("ItayPage"),
              visible: user.mainmenu_can_view_matches_button,
              bgGradient: "from-indigo-100 to-indigo-50"
            },
            {
              name: "אליק",
              role: "רכז אלקטרוניקה",
              avatar: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("AlikPage"),
              visible: user.mainmenu_can_view_matches_button,
              bgGradient: "from-teal-100 to-teal-50"
            },
            {
              name: "אופיר",
              role: "רכז הנדסת מכונות",
              avatar: "https://images.unsplash.com/photo-1534308143481-c55f00be8bd7?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("OfirPage"),
              visible: user.mainmenu_can_view_matches_button,
              bgGradient: "from-emerald-100 to-emerald-50"
            },
            {
              name: "דגנית",
              role: "רכזת QA ובדיקות",
              avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=face",
              link: createPageUrl("DganitPage"),
              visible: user.mainmenu_can_view_matches_button,
              bgGradient: "from-violet-100 to-violet-50"
            },
            {
               name: "GC",
               role: "סוכן כללי",
               avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
               link: createPageUrl("GcPage"),
               visible: user.mainmenu_can_view_matches_button,
               bgGradient: "from-gray-100 to-gray-50"
             },
            {
               name: "אתגר",
               role: "סוכן ביטחוני",
               avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100&h=100&fit=crop&crop=face",
               link: createPageUrl("EtgarPage"),
               visible: user.mainmenu_can_view_matches_button,
               bgGradient: "from-orange-100 to-orange-50"
             }
          ]
        },
        {
           name: "",
           agentCategory: "טיפול במועמדים",
           agents: [
             {
               name: "יעל",
               role: "ציידת המועמדים",
               avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=face",
               link: createPageUrl("Candidates"),
               visible: user.mainmenu_can_view_candidates_button,
               count: inboxCount,
               bgGradient: "from-rose-100 to-rose-50"
             },

             {
               name: "טל",
               role: "קשרי מועמדים",
               avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
               link: createPageUrl("RotemPage"),
               visible: user.mainmenu_can_view_matches_button,
               bgGradient: "from-green-100 to-green-50"
             },
             {
               name: "הילה",
               role: "הפצת משרות",
               avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
               link: createPageUrl("HilaManagement"),
               visible: user.mainmenu_can_view_jobs_button,
               count: hilaDraftsCount,
               bgGradient: "from-pink-100 to-pink-50"
             }
           ]
         }
      ]
    },
    {
      name: "מחלקת משאבי אנוש",
      icon: Heart,
      image: "https://images.unsplash.com/photo-1552581234-26160f608093?w=800&h=400&fit=crop",
      color: "from-pink-500 to-rose-600",
      visible: user.mainmenu_can_view_management_button,
      rooms: [
        {
          name: 'משרד תכנון משא"ן',
          agents: [{
            name: "ענבר",
            role: 'תכנון משא"ן',
            avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
            link: createPageUrl("InbarManagement"),
            visible: user.mainmenu_can_view_management_button
          }]
        }
      ]
    },
    {
      name: "מחלקת מחשוב",
      icon: ServerCog,
      image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop",
      color: "from-gray-600 to-gray-800",
      visible: user.mainmenu_can_view_management_button,
      rooms: [
        {
          name: "חדר שרתים",
          agents: [{
            name: "רביב",
            role: "ניהול מערכת",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
            link: createPageUrl("Management"),
            visible: user.mainmenu_can_view_management_button
          }]
        }
      ]
    }
  ].filter(dept => dept.visible);

  return (
    <div 
      className={`min-h-screen p-4 md:p-8 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto relative">
        {/* Theme Toggle & Tutorial Button */}
         <div className="absolute top-0 left-0 z-10 flex gap-2">
           <Button
             variant="ghost"
             size="sm"
             onClick={cycleTheme}
             className={`${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-200'} gap-1.5 text-xs`}
           >
             {getThemeIcon()}
             <span className="hidden sm:inline">{getThemeLabel()}</span>
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={openTutorial}
             className={`${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-200'} gap-1.5 text-xs`}
             title="הצג מדריך (F1)"
           >
             <HelpCircle className="w-4 h-4" />
             <span className="hidden sm:inline">מדריך</span>
           </Button>
           <Link to={createPageUrl("RotemPage")}>
              <Button
                variant="ghost"
                size="sm"
                className={`${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-200'} gap-1.5 text-xs`}
                title="מועמדים לטיפול"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">מועמדים לטיפול</span>
              </Button>
            </Link>
            {(user?.can_view_management || user?.role === 'admin') && (
              <Link to={createPageUrl("CommandCenter")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-200'} gap-1.5 text-xs`}
                  title="מרכז פיקוד"
                >
                  <Radar className="w-4 h-4" />
                  <span className="hidden sm:inline">מרכז פיקוד</span>
                </Button>
              </Link>
            )}
         </div>

        {/* Header */}
        <div className="text-center mb-8 pt-8 sm:pt-0" data-tutorial="main-navigation">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
              isDark ? 'bg-gradient-to-br from-blue-600 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-purple-500'
            }`}>
              <Users className="w-7 h-7 text-white" />
            </div>
            <div className="text-right">
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>HRAI</h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>מערכת סוכני AI למשאבי אנוש • גרסה {systemVersion}</p>
            </div>
          </div>
          {user && (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>שלום, {user.full_name}</p>
          )}
        </div>

        {/* Floor Plan */}
        <div ref={departmentsRef} className="space-y-8" data-tutorial="activity-section">
          {departments.map((dept) => (
            <div key={dept.name}>
              {/* Department Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-1 flex-1 bg-gradient-to-l ${dept.color} rounded-full`}></div>
                <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${dept.color} text-white shadow-lg flex items-center gap-2`}>
                  <dept.icon className="w-5 h-5" />
                  <h2 className="text-lg font-bold">{dept.name}</h2>
                </div>
                <div className={`h-1 flex-1 bg-gradient-to-r ${dept.color} rounded-full`}></div>
              </div>

              {/* Department Container with Background Image */}
              <Card className={`p-6 relative overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                {/* Background Image Overlay */}
                <div 
                  className="absolute inset-0 opacity-5 bg-cover bg-center"
                  style={{ backgroundImage: `url(${dept.image})` }}
                ></div>
                
                {/* All Agents in Flat Grid with Category Labels */}
                <div className="relative space-y-6">
                  {dept.rooms.map((room) => {
                    const visibleAgents = room.agents.filter(a => a.visible);
                    if (visibleAgents.length === 0) return null;
                    
                    return (
                      <div key={room.name || room.agentCategory}>
                        {room.agentCategory && (
                          <div className={`text-xs font-semibold mb-3 px-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {room.agentCategory}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {visibleAgents.map((agent) => (
                            <Link key={agent.name} to={agent.link}>
                              <div className={`p-3 rounded-lg border transition-all hover:scale-105 hover:shadow-lg cursor-pointer h-full bg-gradient-to-br ${
                                agent.bgGradient || (isDark ? 'from-gray-800 to-gray-800 border-gray-600' : 'from-white to-white border-gray-200')
                              } ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-sm relative">
                                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                    {agent.count > 0 && (
                                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse shadow-lg">
                                        {agent.count}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {agent.name}
                                      </div>
                                      <div className={`w-2 h-2 rounded-full ${agent.count > 0 ? 'bg-green-500' : 'bg-gray-400'} animate-pulse`}></div>
                                    </div>
                                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                                      {agent.role}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`text-center mt-8 text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`} data-tutorial="quick-stats">
          <p>© 2024 HRAI - By Pandatech</p>
        </div>
      </div>

      {/* Tutorial */}
      <MainMenuTutorial isOpen={isTutorialOpen} onClose={closeTutorial} />

      {/* Release Notes Dialog */}
      {currentVersion && (
       <ReleaseNotesDialog
         isOpen={showReleaseNotes}
         onClose={handleCloseReleaseNotes}
         version={currentVersion.version}
         releaseNotes={currentVersion.release_notes}
       />
      )}
      </div>
      );
      }