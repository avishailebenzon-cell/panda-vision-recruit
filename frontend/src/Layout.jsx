import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { AccessLog } from "@/entities/AccessLog";
import { SendEmail } from "@/integrations/Core";
import { base44 } from "@/api/base44Client";

import {
  LayoutDashboard,
  Briefcase,
  Users,
  Building,
  LogOut,
  Mail,
  Search,
  Settings,
  Menu,
  X,
  Clock,
  UserCheck,
  HelpCircle,
  AlertTriangle,
  BrainCircuit,
  Heart,
  Send,
  Calendar,
  MessageCircle,
  UserCircle,
  ChevronDown,
  Circle,
  Smartphone,
  Monitor,
  Radar,
  Bell,
  Target,
  Award } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator } from
"@/components/ui/dropdown-menu";
import PandiChatWidget from "./components/chat/PandiChatWidget";
import { toast } from "sonner";
import GlobalSearchBar from "./components/layout/GlobalSearchBar";
import TaskNotificationsPanel from "./components/layout/TaskNotificationsPanel";
import CandidateAlertsPanel from "./components/layout/CandidateAlertsPanel";
import SystemStatusBar from "./components/layout/SystemStatusBar";
import ActiveUsers from "./components/layout/ActiveUsers";
import { PresentationModeProvider } from "./components/context/PresentationModeContext";
import { ViewModeProvider, useViewMode } from "./components/context/ViewModeContext";
import ReleaseNotesDialog from "./components/layout/ReleaseNotesDialog";
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, isPushNotificationSubscribed } from "@/lib/notificationUtils";


export default function Layout({ children, currentPageName }) {
  // Set RTL globally on document
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';

    // Inject Heebo font globally
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `*, *::before, *::after { font-family: 'Heebo', sans-serif !important; }`;
    document.head.appendChild(style);
  }, []);

  // NOTE: All background processes moved to scheduled automations (server-side).
  // This prevents credit duplication when multiple users are logged in simultaneously.

  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navItems, setNavItems] = useState({ recruitmentItems: [], hrItems: [], systemItems: [] });
  const [inboxCount, setInboxCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [jobsInboxCount, setJobsInboxCount] = useState(0);
  const [employeeRequestsCount, setEmployeeRequestsCount] = useState(0);
  const [hilaDraftsCount, setHilaDraftsCount] = useState(0);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const buildNavItems = (user, inboxCount, taskCount, jobsInboxCount, employeeRequestsCount, hilaDraftsCount) => {
    const departments = [
    {
      name: "",
      icon: null,
      visible: user.mainmenu_can_view_dashboard_button || user.can_view_management || user.role === 'admin',
      rooms: [
      {
        name: "",
        agents: [
        {
          name: "בית",
          path: createPageUrl("MainMenu"),
          icon: LayoutDashboard,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          visible: true
        },
        {
          name: "מרכז פיקוד",
          path: createPageUrl("CommandCenter"),
          icon: BrainCircuit,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          visible: user.can_view_management || user.role === 'admin'
        }]

      }]
    },
    {
      name: "מחלקת הגיוס",
      icon: Building,
      visible: user.mainmenu_can_view_dashboard_button || user.mainmenu_can_view_jobs_button || user.mainmenu_can_view_candidates_button || user.mainmenu_can_view_matches_button || user.mainmenu_can_view_clients_button,
      rooms: [
      {
        name: "מנהלת גיוס",
        agents: [{
          name: "כרמית - מנהלת הגיוס",
          path: createPageUrl("Dashboard"),
          icon: LayoutDashboard,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          visible: user.can_view_dashboard
        }]
      },
      {
        name: "חדר הגייסות",
        agents: [
        {
          name: "נעמה - רכזת תוכנה",
          path: createPageUrl("NaamaPage"),
          icon: Circle,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          visible: user.can_view_matches
        },
        {
          name: "רמי - רכז רמה 1",
          path: createPageUrl("RamiPage"),
          icon: Circle,
          color: "text-red-600",
          bgColor: "bg-red-50",
          visible: user.can_view_matches
        },

        {
          name: "אליק - רכז אלקטרוניקה",
          path: createPageUrl("AlikPage"),
          icon: Circle,
          color: "text-teal-600",
          bgColor: "bg-teal-50",
          visible: user.can_view_matches
        },
        {
          name: "איתי - רכז IT",
          path: createPageUrl("ItayPage"),
          icon: Circle,
          color: "text-indigo-600",
          bgColor: "bg-indigo-50",
          visible: user.can_view_matches
        },
        {
          name: "ליאור - רכז הנדסת מערכת",
          path: createPageUrl("LiorPage"),
          icon: Circle,
          color: "text-amber-600",
          bgColor: "bg-amber-50",
          visible: user.can_view_matches
        },
        {
          name: "אופיר - רכז הנדסת מכונות",
          path: createPageUrl("OfirPage"),
          icon: Circle,
          color: "text-emerald-600",
          bgColor: "bg-emerald-50",
          visible: user.can_view_matches
        },
        {
          name: "דגנית - רכזת QA",
          path: createPageUrl("DganitPage"),
          icon: Circle,
          color: "text-violet-600",
          bgColor: "bg-violet-50",
          visible: user.can_view_matches
        },
        {
          name: "GC - סוכן כללי",
          path: createPageUrl("GcPage"),
          icon: Circle,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          visible: user.can_view_matches
        },
        {
          name: "אתגר - סוכן ביטחוני",
          path: createPageUrl("EtgarPage"),
          icon: Target,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          visible: user.can_view_matches
        },
        {
          name: "דו\"ח התאמות זהב",
          path: createPageUrl("GoldMatchesReport"),
          icon: Award,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          visible: user.can_view_matches
        }]

      },

      {
        name: "טיפול במועמדים",
        agents: [
        {
          name: "יעל - ציידת המועמדים",
          path: createPageUrl("Candidates"),
          icon: Users,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          visible: user.can_view_candidates
        },

        {
          name: "טל - קשרי מועמדים",
          path: createPageUrl("RotemPage"),
          icon: MessageCircle,
          color: "text-green-600",
          bgColor: "bg-green-50",
          visible: user.can_view_matches
        },
        {
          name: "הילה - הפצת משרות",
          path: createPageUrl("HilaManagement"),
          icon: Send,
          color: "text-pink-600",
          bgColor: "bg-pink-50",
          count: hilaDraftsCount,
          visible: user.can_view_jobs
        },
        {
          name: "חפשנים",
          path: createPageUrl("Chafshanim"),
          icon: Search,
          color: "text-cyan-600",
          bgColor: "bg-cyan-50",
          visible: user.can_view_candidates || user.can_view_matches
        }]

      },
      {
        name: "טיפול בלקוחות",
        agents: [
        {
          name: "נועה ודנה - משרות",
          path: createPageUrl("Jobs"),
          icon: Briefcase,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          count: jobsInboxCount,
          visible: user.can_view_jobs
        },

        {
          name: "אלעד - שליחת מועמדים",
          path: createPageUrl("EladPage"),
          icon: Send,
          color: "text-indigo-600",
          bgColor: "bg-indigo-50",
          visible: user.can_view_matches || user.can_view_management
        },
        {
          name: "מני - מכירות אפקטיביות",
          path: createPageUrl("MeniPage"),
          icon: UserCheck,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          visible: user.can_view_matches
        },
        {
          name: "איתן - בדיקות איכות",
          path: createPageUrl("EitanManagement"),
          icon: UserCheck,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          visible: user.can_view_matches || user.can_view_management
        }]

      }]

    },
    {
      name: "מחלקת משאבי אנוש",
      icon: Heart,
      visible: user.can_view_management || user.role === 'admin',
      rooms: [
      {
        name: "",
        agents: [

        {
          name: 'ענבר - תוכנית משא"ן',
          path: createPageUrl("InbarManagement"),
          icon: Calendar,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          visible: user.can_view_management || user.role === 'admin'
        }]

      }]

    },
    {
      name: "מחלקת מחשוב",
      icon: Settings,
      visible: user.can_view_management || user.role === 'admin',
      rooms: [
      {
        name: "",
        agents: [{
          name: "רביב - ניהול מערכת",
          path: createPageUrl("Management"),
          icon: Settings,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          visible: user.can_view_management || user.role === 'admin'
        }]
      }]

    }];


    return { departments: departments.filter((d) => d.visible) };
  };

  const setDefaultPermissions = (user) => {
    const defaults = {
      admin: {
        can_view_dashboard: true,
        can_view_jobs: true,
        can_manage_jobs: true,
        can_view_candidates: true,
        can_manage_candidates: true,
        can_view_candidates_map: true,
        can_view_search: true,
        can_view_clients: true,
        can_manage_clients: true,
        can_view_management: true,
        can_manage_users: true,
        can_view_matches: true,
        can_manage_match_status: true,
        can_delete_matches: true,
        receives_match_notifications: true,
        can_view_help: true,
        can_send_email_to_clients: true,
        can_send_whatsapp_to_clients: true,
        can_send_messages_to_employees: true,
        search_can_use_existing_job: true,
        search_can_use_freetext: true,
        search_can_find_jobs_for_candidate: true,
        search_can_use_level1_agent: true,
        search_can_use_job_finder_agent: true,
        search_can_see_advanced_filters: true,
        can_view_expert_search: true, // Add permission for admin
        management_can_view_users: true,
        management_can_view_access_log: true,
        management_can_view_data_cleanup: true,
        management_can_edit_invitation_messages: true,
        management_can_view_synonyms: true,

        dashboard_can_view_stats_cards: true,
        dashboard_can_view_client_marked_candidates: true,
        dashboard_can_view_candidate_inbox: true,
        dashboard_can_view_job_inbox: true,
        dashboard_can_view_journey_timeline: true,
        dashboard_can_view_recent_activity: true,
        dashboard_can_view_weekly_stats: true,
        mainmenu_can_view_quick_search: true,
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: true,
        mainmenu_can_view_candidates_button: true,
        mainmenu_can_view_matches_button: true,
        mainmenu_can_view_clients_button: true,
        mainmenu_can_view_candidates_map_button: true,
        mainmenu_can_view_management_button: true,
        mainmenu_can_view_activity_section: true,
        mainmenu_can_view_quick_stats: true
      },
      hr: {
        can_view_dashboard: true,
        can_view_jobs: true,
        can_manage_jobs: true,
        can_view_candidates: true,
        can_manage_candidates: true,
        can_view_candidates_map: true,
        can_view_search: true,
        can_view_clients: false,
        can_manage_clients: false,
        can_view_management: false,
        can_manage_users: false,
        can_view_matches: true,
        can_manage_match_status: false,
        can_delete_matches: false,
        receives_match_notifications: false,
        can_view_help: true,
        can_send_email_to_clients: true,
        can_send_whatsapp_to_clients: true,
        can_send_messages_to_employees: true,
        search_can_use_existing_job: true,
        search_can_use_freetext: true,
        search_can_find_jobs_for_candidate: true,
        search_can_use_level1_agent: true,
        search_can_use_job_finder_agent: true,
        search_can_see_advanced_filters: true,
        can_view_expert_search: true, // Add permission for hr
        management_can_view_users: false,
        management_can_view_access_log: false,
        management_can_view_data_cleanup: false,
        management_can_edit_invitation_messages: false,
        management_can_view_synonyms: true,
        management_can_view_scheduler: false,
        dashboard_can_view_stats_cards: true,
        dashboard_can_view_client_marked_candidates: true,
        dashboard_can_view_candidate_inbox: true,
        dashboard_can_view_job_inbox: true,
        dashboard_can_view_journey_timeline: true,
        dashboard_can_view_recent_activity: true,
        dashboard_can_view_weekly_stats: true,
        mainmenu_can_view_quick_search: true,
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: true,
        mainmenu_can_view_candidates_button: true,
        mainmenu_can_view_matches_button: true,
        mainmenu_can_view_clients_button: false,
        mainmenu_can_view_candidates_map_button: true,
        mainmenu_can_view_management_button: false,
        mainmenu_can_view_activity_section: true,
        mainmenu_can_view_quick_stats: true
      },
      client: {
        can_view_dashboard: true,
        can_view_jobs: false,
        can_manage_jobs: false,
        can_view_candidates: false,
        can_manage_candidates: false,
        can_view_candidates_map: false,
        can_view_search: true,
        can_view_clients: false,
        can_manage_clients: false,
        can_view_management: false,
        can_manage_users: false,
        can_view_matches: false,
        can_manage_match_status: false,
        can_delete_matches: false,
        receives_match_notifications: false,
        can_view_help: true,
        can_send_email_to_clients: false,
        can_send_whatsapp_to_clients: false,
        can_send_messages_to_employees: false,
        search_can_use_existing_job: false,
        search_can_use_freetext: true,
        search_can_find_jobs_for_candidate: false,
        search_can_use_level1_agent: false,
        search_can_use_job_finder_agent: false,
        search_can_see_advanced_filters: false,
        can_view_expert_search: false, // Deny permission for client
        management_can_view_users: false,
        management_can_view_access_log: false,
        management_can_view_data_cleanup: false,
        management_can_edit_invitation_messages: false,
        management_can_view_synonyms: false,
        management_can_view_scheduler: false, // Added for client role, defaulted to false
        dashboard_can_view_stats_cards: true,
        dashboard_can_view_client_marked_candidates: true,
        dashboard_can_view_candidate_inbox: false,
        dashboard_can_view_job_inbox: false,
        dashboard_can_view_journey_timeline: true,
        dashboard_can_view_recent_activity: true,
        dashboard_can_view_weekly_stats: true,
        mainmenu_can_view_quick_search: true,
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: false,
        mainmenu_can_view_candidates_button: false,
        mainmenu_can_view_matches_button: false,
        mainmenu_can_view_clients_button: false,
        mainmenu_can_view_candidates_map_button: false,
        mainmenu_can_view_management_button: false,
        mainmenu_can_view_activity_section: false,
        mainmenu_can_view_quick_stats: true
      }
    };

    const userAppRole = user.app_role || 'hr';
    // Fix: Ensure user-specific settings override defaults
    return { ...defaults[userAppRole], ...user };
  };

  // Function to notify admin about new user registration - UPDATED
  const notifyAdminAboutNewUser = async (newUser) => {
    try {
      const adminUsers = await User.filter({ role: 'admin' });

      // Create direct link to management system for user approval
      const managementUrl = `${window.location.origin}${createPageUrl("Management")}`;

      for (const admin of adminUsers) {
        await SendEmail({
          to: admin.email,
          subject: '[PandaHRAI] משתמש חדש ממתין לאישור - דרוש אישור מיידי',
          body: `
שלום ${admin.full_name},

משתמש חדש נרשם למערכת PandaHRAI וממתין לאישור שלך:

📋 פרטי המשתמש:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• שם: ${newUser.full_name}
• אימייל: ${newUser.email}
• תאריך הרשמה: ${new Date().toLocaleDateString('he-IL')} בשעה ${new Date().toLocaleTimeString('he-IL')}
• סטטוס נוכחי: ממתין לאישור

🔗 אישור המשתמש:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
כדי לאשר את המשתמש ולהגדיר את ההרשאות שלו, לחץ על הקישור הבא:

👉 ${managementUrl}

לחלופין, תוכל להיכנס למערכת PandaHRAI ולעבור למסך "ניהול" → "ניהול משתמשים".

⚠️ חשוב: המשתמש לא יוכל להיכנס למערכת עד לאישור שלך.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
בברכה,
מערכת PandaHRAI (התרעה אוטומטית)
          `,
          from_name: 'PandaHRAI - התרעות מערכת'
        });
      }

      console.log(`Admin notification sent for new user: ${newUser.full_name} (${newUser.email})`);

    } catch (error) {
      console.error('Error notifying admin about new user:', error);

      // Try to log the error for debugging
      try {
        await AccessLog.create({
          user_email: 'system@pandatech.co.il',
          user_name: 'System Error Logger',
          app_role: 'system',
          event_type: 'admin_notification_failed',
          page_name: 'Layout',
          page_url: window.location.pathname,
          error_details: `Failed to notify admin about new user ${newUser.full_name}: ${error.message}`
        });
      } catch (logError) {
        console.error('Failed to log admin notification error:', logError);
      }
    }
  };

  useEffect(() => {
    const initializeNotifications = async () => {
      const isSubscribed = await isPushNotificationSubscribed();
      setNotificationsEnabled(isSubscribed);
      
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch (error) {
          console.error('Service worker registration failed:', error);
        }
      }
    };
    initializeNotifications();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      // Allow public access to CandidateOnboarding and Unsubscribe pages
      if (currentPageName === 'CandidateOnboarding' || currentPageName === 'Unsubscribe' || window.location.pathname.includes('/Unsubscribe')) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const currentUser = await User.me();

        // Check if user is approved
        if (currentUser.approval_status === 'pending') {
          setUser({ ...currentUser, isPendingApproval: true });
          setLoading(false);
          return;
        }

        if (currentUser.approval_status === 'rejected') {
          setUser({ ...currentUser, isRejected: true });
          setLoading(false);
          return;
        }

        // Check if this is a new user (no approval_status set) and handle accordingly
        // Only set to pending if not an admin (admins are auto-approved for their role)
        if (!currentUser.approval_status && currentUser.role !== 'admin') {
          try {
            // Check if there's an invitation with predefined permissions
            const invitations = await base44.entities.UserInvitation.filter({
              email: currentUser.email.toLowerCase()
            });

            let updateData = { approval_status: 'pending' };

            if (invitations && invitations.length > 0) {
              const invitation = invitations[0];

              // If invitation has predefined permissions, auto-approve with those permissions
              if (invitation.predefined_permissions && Object.keys(invitation.predefined_permissions).length > 0) {
                console.log('Found predefined permissions in invitation - auto-approving user');
                updateData = {
                  ...invitation.predefined_permissions,
                  approval_status: 'approved',
                  approved_date: new Date().toISOString()
                };

                // Update invitation status
                await base44.entities.UserInvitation.update(invitation.id, {
                  invitation_status: 'approved',
                  user_id: currentUser.id,
                  approved_date: new Date().toISOString()
                });
              }
            }

            // Set user status
            await base44.entities.User.updateMyUserData(updateData);

            // If still pending (no predefined permissions), notify admin
            if (updateData.approval_status === 'pending') {
              await notifyAdminAboutNewUser({
                ...currentUser,
                approval_status: 'pending'
              });

              setUser({ ...currentUser, isPendingApproval: true });
              setLoading(false);
              return;
            } else {
              // Auto-approved - refresh user data
              const updatedUser = await base44.entities.User.me();
              const userWithPermissions = setDefaultPermissions(updatedUser);
              setUser(userWithPermissions);
            }
          } catch (error) {
            console.error('Error processing new user:', error);
            // Even if there's an error, set as pending to prevent loop
            setUser({ ...currentUser, isPendingApproval: true });
            setLoading(false);
            return;
          }
        }

        // Set permissions for approved users (or existing admins)
        const userWithPermissions = setDefaultPermissions(currentUser);

        setUser(userWithPermissions);

        // Check for new version and show release notes
        checkForNewVersion(userWithPermissions);

        const hasLogged = sessionStorage.getItem('login_event_logged');
        if (!hasLogged) {
          await AccessLog.create({
            user_email: currentUser.email,
            user_name: currentUser.full_name,
            app_role: currentUser.app_role || 'N/A',
            event_type: 'login_success'
          });
          sessionStorage.setItem('login_event_logged', 'true');
        }

      } catch (e) {
        setUser(null);
        sessionStorage.removeItem('login_event_logged');
      }
      setLoading(false);
    };
    fetchUser();
  }, [currentPageName]);

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

  const checkForNewVersion = async (user) => {
    try {
      const versions = await base44.entities.SystemVersion.list();
      if (versions.length === 0) return;
      
      const latestVersion = versions[0];
      setCurrentVersion(latestVersion);
      
      // Check if current version is greater than user's last seen version
      if (isVersionGreater(latestVersion.version, user.last_version_seen)) {
        setShowReleaseNotes(true);
      }
    } catch (error) {
      console.error('Error checking version:', error);
    }
  };

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

  // Effect to fetch only critical counts - taskCount
  // Removed other counts to prevent rate limiting
  useEffect(() => {
    let isActive = true;

    const fetchCounts = async () => {
      if (!user || !isActive) return;

      // Only fetch Rotem tasks count - most critical for operations
      if (user.can_view_matches) {
        try {
          const allTasks = await base44.entities.RotemTask.list('-created_date');
          const openTasks = allTasks.filter(task => 
            task.status !== 'הסתיים' && 
            task.status !== 'הסתיים מוצלח' && 
            task.status !== 'לא ליצור קשר' && 
            task.status !== 'מועמד לא עונה'
          );
          if (isActive) setTaskCount(openTasks.length);
        } catch (error) {
          console.log("Rotem tasks error:", error?.message);
          if (isActive) setTaskCount(0);
        }
      }
    };

    // Delay 5 seconds before fetch
    const timeoutId = setTimeout(fetchCounts, 5000);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [user]);

  // Effect to rebuild navigation when user or counts change
  useEffect(() => {
    if (user) {
      const items = buildNavItems(user, inboxCount, taskCount, jobsInboxCount, employeeRequestsCount, hilaDraftsCount);
      setNavItems(items);
    }
  }, [user, inboxCount, taskCount, jobsInboxCount, employeeRequestsCount, hilaDraftsCount]);

  // New effect to log page visits
  useEffect(() => {
    const logPageVisit = async () => {
      // Only log if user is not pending or rejected
      if (user && !user.isPendingApproval && !user.isRejected && location.pathname) {
        try {
          // Get page name from pathname
          const pathSegments = location.pathname.split('/').filter(Boolean);
          const pageName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'Home';

          // Don't log the same page visit multiple times in a row for the same user
          const lastLoggedPageKey = sessionStorage.getItem('last_logged_page_key');
          const currentPageKey = `${user.email}_${pageName}`;

          if (lastLoggedPageKey !== currentPageKey) {
            await AccessLog.create({
              user_email: user.email,
              user_name: user.full_name,
              app_role: user.app_role || 'N/A',
              event_type: 'page_visit',
              page_name: pageName,
              page_url: location.pathname
            });

            sessionStorage.setItem('last_logged_page_key', currentPageKey);
          }
        } catch (error) {
          console.error('Error logging page visit:', error);
        }
      }
    };

    // Add a small delay to avoid logging too frequently (e.g., during rapid redirects)
    const timeoutId = setTimeout(logPageVisit, 500);
    return () => clearTimeout(timeoutId); // Cleanup timeout on unmount or dependency change
  }, [user, location.pathname]); // Depend on user and path to re-run when they change

  // Effect for F1 key and closing sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        navigate(createPageUrl('Help'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    setSidebarOpen(false); // Close sidebar on path change

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [location.pathname, navigate]);

  const handleLogout = async () => {
    await User.logout();
    sessionStorage.removeItem('login_event_logged');
    sessionStorage.removeItem('last_logged_page_key');
    window.location.href = createPageUrl("Home");
  };

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>;
  }

  // Handle pending approval users
  if (user?.isPendingApproval) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <style>{` .b44-edit-badge { display: none !important; } `}</style>
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-20 h-20 bg-yellow-100 border-4 border-yellow-200 rounded-full flex items-center justify-center mb-6">
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">החשבון ממתין לאישור</h1>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <Alert variant="default" className="text-right">
              <AlertDescription>
                שלום {user.full_name},
                <br /><br />
                בקשתך להתחבר למערכת התקבלה והיא ממתינה כעת לאישור מנהל.
                <br /><br />
                תקבל/י הודעת מייל ברגע שהחשבון יאושר.
              </AlertDescription>
            </Alert>
          </div>
          <Button onClick={handleLogout} variant="outline" className="mt-6">
            <LogOut className="w-4 h-4 ml-2" />
            התנתקות
          </Button>
        </div>
      </div>);

  }

  // Handle rejected users
  if (user?.isRejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <style>{` .b44-edit-badge { display: none !important; } `}</style>
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-20 h-20 bg-red-100 border-4 border-red-200 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">הגישה נדחתה</h1>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <Alert variant="destructive" className="text-right">
              <AlertDescription>
                שלום {user.full_name},
                <br /><br />
                לצערנו, בקשת הגישה שלך למערכת נדחתה על ידי מנהל.
                <br /><br />
                לפרטים נוספים, אנא צור קשר עם מנהל המערכת בארגונך.
              </AlertDescription>
            </Alert>
          </div>
          <Button onClick={handleLogout} variant="outline" className="mt-6">
            <LogOut className="w-4 h-4 ml-2" />
            התנתקות
          </Button>
        </div>
      </div>);

  }

  // Handle public pages (CandidateOnboarding, Unsubscribe)
  if (currentPageName === 'CandidateOnboarding' || currentPageName === 'Unsubscribe' || window.location.pathname.includes('/Unsubscribe')) {
    return (
      <div dir="rtl" className="bg-gray-50 min-h-screen">
        <style>{`
          .b44-edit-badge {
            display: none !important;
          }
        `}</style>
        <main>{children}</main>
      </div>);

  }

  // Handle client role - now includes help button and Pandi
  if (!user || user.app_role === 'client') {
    return (
      <div dir="rtl" className="bg-gray-50 min-h-screen">
          <style>{`
            /* This is a workaround to hide the 'Edit with base44' badge. */
            /* The official way is through your project settings. */
            .b44-edit-badge {
              display: none !important;
            }
          `}</style>
          <main className="p-4 md:p-8">{children}</main>
          {/* Floating Help Button */}
          <Button
          variant="default"
          size="icon"
          className="fixed bottom-14 left-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-40"
          onClick={() => navigate(createPageUrl('Help'))}
          title="עזרה (F1)">

            <HelpCircle className="h-7 w-7" />
          </Button>
          {/* Pandi Chat Widget */}
          <PandiChatWidget />
        </div>);

  }

  return (
    <PresentationModeProvider>
    <LayoutContent
          children={children}
          currentPageName={currentPageName}
          user={user}
          loading={loading}
          navItems={navItems}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          handleLogout={handleLogout}
          notifyAdminAboutNewUser={notifyAdminAboutNewUser}
          taskCount={taskCount}
          notificationsEnabled={notificationsEnabled}
          setNotificationsEnabled={setNotificationsEnabled} />

    </PresentationModeProvider>);

}

function LayoutContent({
  children,
  currentPageName,
  user,
  loading,
  navItems,
  sidebarOpen,
  setSidebarOpen,
  handleLogout,
  taskCount,
  notificationsEnabled,
  setNotificationsEnabled
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { viewMode, isMobileView, toggleViewMode, forcedMode, isMobileDevice } = useViewMode();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      <style>{`
        .b44-edit-badge { display: none !important; }
      `}</style>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 right-0 w-64 bg-white border-l border-gray-200 p-4 md:p-6 
        flex flex-col h-screen z-50 transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">HRAI</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-grow overflow-y-auto text-sm">
          <style>{`
            .tree-line-dept { position: relative; }
            .tree-line-dept::before {
              content: '';
              position: absolute;
              right: 7px;
              top: 24px;
              bottom: 8px;
              width: 1px;
              background: #d1d5db;
            }
            .tree-line-room { position: relative; }
            .tree-line-room::before {
              content: '';
              position: absolute;
              right: 19px;
              top: 20px;
              bottom: 8px;
              width: 1px;
              background: #e5e7eb;
            }
            .tree-node-dept {
              position: relative;
              padding-right: 20px;
            }
            .tree-node-dept::before {
              content: '';
              position: absolute;
              right: 7px;
              top: 50%;
              width: 10px;
              height: 1px;
              background: #d1d5db;
            }
            .tree-node-room {
              position: relative;
              padding-right: 20px;
            }
            .tree-node-room::before {
              content: '';
              position: absolute;
              right: 19px;
              top: 50%;
              width: 10px;
              height: 1px;
              background: #e5e7eb;
            }
            .tree-node-agent {
              position: relative;
              padding-right: 20px;
            }
            .tree-node-agent::before {
              content: '';
              position: absolute;
              right: 31px;
              top: 50%;
              width: 10px;
              height: 1px;
              background: #e5e7eb;
            }
            .tree-line-agent-group { position: relative; }
            .tree-line-agent-group::before {
              content: '';
              position: absolute;
              right: 31px;
              top: 0;
              bottom: 8px;
              width: 1px;
              background: #e5e7eb;
            }
          `}</style>
          
          {/* Root node */}
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <span className="text-gray-400 text-xs font-mono">📁</span>
            <span className="text-xs font-bold text-gray-600">HRAI</span>
          </div>

          {navItems.departments?.map((dept, deptIdx) => {
            const DeptIcon = dept.icon;
            const isLastDept = deptIdx === navItems.departments.length - 1;
            const allRooms = dept.rooms?.filter(r => (r.agents || []).some(a => a.visible)) || [];
            
            return (
              <div key={dept.name} className="tree-line-dept">
                {/* Department row (only if named) */}
                {dept.name && (
                <div className="tree-node-dept flex items-center gap-2 py-1.5 px-2">
                  <DeptIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-gray-600 truncate">{dept.name}</span>
                </div>
                )}

                {/* Rooms */}
                {allRooms.map((room, roomIdx) => {
                  const visibleAgents = room.agents?.filter((a) => a.visible) || [];
                  if (visibleAgents.length === 0) return null;
                  const isLastRoom = roomIdx === allRooms.length - 1;

                  return (
                    <div key={room.name || roomIdx} className="tree-line-room mr-3">
                      {/* Room label (only if named) */}
                      {room.name && room.name !== "בית" && (
                        <div className="tree-node-room flex items-center gap-2 py-1 px-2">
                          <span className="text-xs text-gray-500 font-medium truncate">{room.name}</span>
                        </div>
                      )}

                      {/* Agents */}
                      <div className={`tree-line-agent-group mr-3`}>
                        {visibleAgents.map((agent, agentIdx) => {
                          const AgentIcon = agent.icon;
                          const isActive = location.pathname === agent.path;

                          return (
                            <div key={agent.name} className="tree-node-agent">
                              <Link
                                to={agent.path}
                                className={`flex items-center gap-2 py-1 px-2 rounded-md transition-all group ${
                                  isActive
                                    ? `${agent.bgColor} ${agent.color} font-semibold`
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                                onClick={() => setSidebarOpen(false)}
                              >
                                <AgentIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? agent.color : 'text-gray-400'}`} />
                                <span className="text-xs truncate">{agent.name}</span>
                                {agent.count > 0 && (
                                  <Badge className="mr-auto bg-red-500 hover:bg-red-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs p-0 animate-pulse">
                                    {agent.count}
                                  </Badge>
                                )}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm md:text-base group hover:bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {user.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-gray-700">פרופיל משתמש</span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5 text-sm text-gray-500">
                {user.full_name}
              </div>
              <DropdownMenuSeparator />
              {user.can_view_help &&
              <DropdownMenuItem onClick={() => {navigate(createPageUrl("Help"));setSidebarOpen(false);}}>
                  <HelpCircle className="w-4 h-4 ml-2" />
                  עזרה
                </DropdownMenuItem>
              }
              <DropdownMenuItem onClick={() => {navigate(createPageUrl("FeedbackReport"));setSidebarOpen(false);}}>
                <Mail className="w-4 h-4 ml-2" />
                דווח על תקלה/פיצ'ר
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 ml-2" />
                התנתקות
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-2 flex items-center justify-between sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="mr-2">
            <Menu className="w-6 h-6" />
          </Button>

          <div className="flex-1 flex justify-center px-2 hidden md:flex">
            <GlobalSearchBar />
          </div>

          <div className="flex items-center gap-3">
            {/* Active Users Indicator */}
            <ActiveUsers />

            {/* Task Notifications */}
            {user && !user.isPendingApproval && !user.isRejected && (
              <TaskNotificationsPanel />
            )}

            {/* Candidate Alerts (Tal WhatsApp) */}
            {user && !user.isPendingApproval && !user.isRejected && user.can_view_matches && (
              <CandidateAlertsPanel />
            )}

            {/* Candidates for Handling Alert */}
            {user && !user.isPendingApproval && !user.isRejected && user.can_view_matches && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('RotemPage'))}
                className="relative gap-1.5 text-gray-600 hover:text-gray-900"
                title="מועמדים לטיפול"
              >
                <div className="relative">
                  <Users className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white bg-red-500">
                    {taskCount > 9 ? "9+" : taskCount}
                  </span>
                </div>
                <span className="text-xs hidden sm:inline">מועמדים לטיפול</span>
              </Button>
            )}

            {/* Command Center Button */}
            {user && (user.can_view_management || user.role === 'admin') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('CommandCenter'))}
                className="gap-1.5 text-gray-600 hover:text-gray-900"
              >
                <Radar className="w-4 h-4" />
                <span className="hidden sm:inline">מרכז פיקוד</span>
              </Button>
            )}
            
            {/* Notification Toggle */}
            {user && !user.isPendingApproval && !user.isRejected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    if (notificationsEnabled) {
                      await unsubscribeFromPushNotifications();
                      setNotificationsEnabled(false);
                      toast.success('התרעות כבו');
                    } else {
                      const subscription = await subscribeToPushNotifications();
                      if (subscription) {
                        setNotificationsEnabled(true);
                        toast.success('התרעות הופעלו');
                      }
                    }
                  } catch (error) {
                    toast.error('שגיאה בהפעלת/כיבוי התרעות');
                  }
                }}
                className="gap-2"
                title={notificationsEnabled ? 'כבה התרעות' : 'הפעל התרעות'}
              >
                <Bell className={`w-4 h-4 ${notificationsEnabled ? 'fill-current' : ''}`} />
              </Button>
            )}

            {/* View Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleViewMode}
              className="gap-2"
              title={`מצב נוכחי: ${isMobileView ? 'טלפון' : 'דסקטופ'}${forcedMode ? ' (ידני)' : ' (אוטומטי)'}`}>

              {isMobileView ?
              <>
                  <Monitor className="w-4 h-4" />
                  <span className="text-xs">דסקטופ</span>
                </> :

              <>
                  <Smartphone className="w-4 h-4" />
                  <span className="text-xs">טלפון</span>
                </>
              }
            </Button>
          </div>
        </header>
        <main className={`flex-1 ${isMobileView ? 'p-2' : 'p-4 md:p-6 lg:p-8'} pb-12`}>
          {children}
        </main>
      </div>

      {/* Floating Help Button */}
      {user && !user.isPendingApproval && !user.isRejected && user.app_role !== 'client' && user.can_view_help &&
      <Button
        variant="default"
        size="icon"
        className="fixed bottom-14 left-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-40"
        onClick={() => navigate(createPageUrl('Help'))}
        title="עזרה (F1)">

          <HelpCircle className="h-7 w-7" />
        </Button>
      }

      {/* Pandi Chat Widget - Available on all screens */}
      {user && !user.isPendingApproval && !user.isRejected &&
      <PandiChatWidget />
      }

      {/* System Status Bar */}
      {user && !user.isPendingApproval && !user.isRejected &&
      <SystemStatusBar />
      }
    </div>);

}