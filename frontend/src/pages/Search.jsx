import React, { useState, useEffect } from "react";
import { Job } from "@/entities/Job";
import { Candidate } from "@/entities/Candidate";
import { User } from "@/entities/User";
import { SearchLog } from "@/entities/SearchLog";
import { Match } from "@/entities/Match";
import { InvokeLLM, SendEmail, UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search as SearchIcon,
  Briefcase,
  Users,
  FileText,
  Star,
  AlertTriangle,
  Loader2,
  MapPin,
  Shield,
  CircleDot,
  X,
  UserSearch,
  LogOut,
  UserCheck,
  Ban,
  BrainCircuit,
  Upload,
  CheckCircle,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { agentSDK } from "@/agents";
import ReactMarkdown from 'react-markdown';
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CandidateStatus } from "@/entities/CandidateStatus";
import { MatchNote } from "@/entities/MatchNote";
import { applySynonyms } from '@/functions/applySynonyms';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import HeatmapDisplay from '../components/search/HeatmapDisplay';
import JobMatchAnalysisDialog from '../components/search/JobMatchAnalysisDialog';
import { calculateGeoFit } from '@/functions/calculateGeoFit';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Eye } from "lucide-react";
import { calculateCandidateAge, isOlderThan60 } from '../components/search/CandidateAgeCalculator';

const securityClearanceLevels = ["רמה 1", "רמה 2", "רמה 3", "סווג נמוך", "ללא סווג"];

export default function Search() {
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  // Initial search mode might depend on permissions, but default to 'existing' or 'freetext'
  const [searchMode, setSearchMode] = useState("existing");
  const [selectedJob, setSelectedJob] = useState("");
  const [freeTextDescription, setFreeTextDescription] = useState("");

  const [jobStatusFilter, setJobStatusFilter] = useState("פעילה");
  const [securityClearance, setSecurityClearance] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchRadius, setSearchRadius] = useState(25);

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [cleanupMessage, setCleanupMessage] = useState(""); // New state for cleanup message

  const [aiAgentRunning, setAiAgentRunning] = useState(false);
  const [aiAgentResults, setAiAgentResults] = useState(null);
  const [showAiResults, setShowAiResults] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [findingJobsForCandidate, setFindingJobsForCandidate] = useState(false);
  const [foundJobsResults, setFoundJobsResults] = useState(null);
  const [showFoundJobsResults, setShowFoundJobsResults] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [savingMatches, setSavingMatches] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [abortController, setAbortController] = useState(null); // State for cancellation
  const [searchProgressText, setSearchProgressText] = useState(""); // NEW: For user feedback

  const [appliedSynonyms, setAppliedSynonyms] = useState([]); // NEW STATE

  // Expert Search states
  const [expertResumeText, setExpertResumeText] = useState('');
  const [expertUploadedFile, setExpertUploadedFile] = useState(null);
  const [isExpertUploading, setIsExpertUploading] = useState(false);
  const [isExpertExtracting, setIsExpertExtracting] = useState(false);
  const [expertSearchLoading, setExpertSearchLoading] = useState(false);
  const [expertResults, setExpertResults] = useState(null);
  const [expertAgentProgress, setExpertAgentProgress] = useState('');
  const [expertSavedMatchesCount, setExpertSavedMatchesCount] = useState(0);
  const [expertInputMode, setExpertInputMode] = useState('text');
  
  // Job Match Analysis Dialog
  const [selectedJobMatch, setSelectedJobMatch] = useState(null);
  const [showJobMatchDialog, setShowJobMatchDialog] = useState(false);

  // Derived state to check if any search is running
  const isAnySearchRunning = searching || aiAgentRunning || findingJobsForCandidate || expertSearchLoading;

  // Function to handle stopping the current search
  const handleStopSearch = () => {
    if (abortController) {
      abortController.abort(); // Signal cancellation
      setAbortController(null);
    }
    // Reset all search states
    setSearching(false);
    setAiAgentRunning(false);
    setFindingJobsForCandidate(false);
    setError("החיפוש בוטל על ידי המשתמש.");
    setSearchProgressText("");
  };

  // Function to reset all search-related states
  const resetAllSearchResults = () => {
    setResults([]);
    setSelectedMatches(new Set());
    setAiAgentResults(null);
    setShowAiResults(false);
    setFoundJobsResults(null);
    setShowFoundJobsResults(false);
    setError("");
    setSearchProgressText(""); // Reset progress text
    setAppliedSynonyms([]); // Reset synonyms on new search
  };

  // Helper function to enhance search text with synonyms
  const enhanceSearchText = async (searchText) => {
    if (!searchText || searchText.trim() === '') {
      setAppliedSynonyms([]);
      return searchText;
    }
    try {
      const { data } = await applySynonyms({ searchText });
      
      if (data && data.appliedSynonyms && data.appliedSynonyms.length > 0) {
        setAppliedSynonyms(data.appliedSynonyms);
        return data.enhancedText;
      }
      
      setAppliedSynonyms([]);
      return searchText;
    } catch (error) {
      console.error('Error applying synonyms:', error);
      setAppliedSynonyms([]);
      return searchText;
    }
  };

  // Handle navigation blocking when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (selectedMatches.size > 0) {
        e.preventDefault();
        e.returnValue = ''; // Standard for older browsers to show a custom message
        // Note: This only triggers the native browser confirmation dialog.
        // It does not trigger the custom React Dialog. For custom dialogs on internal navigation,
        // a router-specific blocking mechanism (like react-router-dom's useBlocker) is typically used.
        // Since useBlocker was removed, this useEffect handles browser-level confirmation only.
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedMatches.size]);

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (searchMode === 'existing' && selectedJob) {
        const job = jobs.find(j => j.id === selectedJob);
        if (job) {
            setSearchLocation(job.location || "");
            setSecurityClearance(job.security_clearance || "");
        }
    }
  }, [selectedJob, searchMode, jobs]);

  const loadData = async () => {
    try {
      const [jobsList, candidatesList] = await Promise.all([
        Job.list("-created_date"),
        Candidate.list("-created_date")
      ]);
      setJobs(jobsList);
      setCandidates(candidatesList);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("שגיאה בטעינת הנתונים");
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const handleLogout = async () => {
    await User.logout();
    window.location.reload();
  };

  // Check user permissions for UI display
  const canUseExistingJob = currentUser?.search_can_use_existing_job;
  const canUseFreetext = true; // Always allow freetext search for everyone
  const canFindJobsForCandidate = currentUser?.search_can_find_jobs_for_candidate;
  const canUseLevel1Agent = currentUser?.search_can_use_level1_agent;
  const canUseJobFinderAgent = currentUser?.search_can_use_job_finder_agent; // This should ideally be removed if `findJobsForCandidate` is the new standard
  const canSeeAdvancedFilters = currentUser?.search_can_see_advanced_filters;
  const canUseExpertSearch = currentUser?.can_view_expert_search;

  const handleMatchSelection = (candidateName, candidateId) => {
    const newSelectedMatches = new Set(selectedMatches);
    
    if (newSelectedMatches.has(candidateId)) {
      newSelectedMatches.delete(candidateId);
    } else {
      newSelectedMatches.add(candidateId);
    }
    
    setSelectedMatches(newSelectedMatches);
  };

  const notifyAdminsOfNewMatches = async (newMatches, jobInfo) => {
    // Only send notifications if the current user is a 'client'
    if (currentUser.app_role === 'client') {
      const allUsers = await User.list();
      const notificationRecipients = allUsers.filter(u => u.receives_match_notifications);

      if (notificationRecipients.length === 0) {
        console.warn("No users configured to receive match notifications.");
        return;
      }

      const matchesSummary = newMatches.map(match => `
- מועמד: ${match.candidate_name}
- משרה: ${match.job_title}
${match.free_text_query ? `  (תיאור חופשי: ${match.free_text_query.substring(0, Math.min(match.free_text_query.length, 100))}...)` : ''}
      `).join('\n');

      const subject = `[PandaRecruitAI] ${newMatches.length} התאמות חדשות נרשמו במערכת`;
      const body = `
שלום,

${newMatches.length} התאמות חדשות נרשמו במערכת על ידי ${currentUser.full_name} (${currentUser.app_role}).

פרטי ההתאמות:
${matchesSummary}

משתמש שיצר: ${currentUser.full_name} (${currentUser.app_role})
תאריך: ${new Date().toLocaleString('he-IL')}

לצפייה במערכת:
${window.location.origin}${createPageUrl("Matches")}

בברכה,
מערכת PandaRecruitAI
      `;

      for (const recipient of notificationRecipients) {
        await SendEmail({
          to: recipient.email,
          subject: subject,
          body: body,
          from_name: 'PandaRecruitAI System'
        });
      }
    }
  };

  const saveMatches = async () => {
    if (selectedMatches.size === 0) {
      setError("אנא בחר לפחות מועמד אחד לשמירה כהתאמה");
      return;
    }
    
    setSavingMatches(true);
    setError("");

    try {
      const currentUser = await User.me();
      
      let jobInfo = null;
      if (searchMode === "existing" && selectedJob) {
        jobInfo = jobs.find(j => j.id === selectedJob);
      }

      // NEW: Get initial status from CandidateStatus entity
      const initialStatuses = await CandidateStatus.filter({ status_number: 1 });
      if (initialStatuses.length === 0) {
          console.error("Initial status (status_number: 1) not found in CandidateStatus entity.");
          setError("שגיאה: לא הוגדר סטטוס התחלתי למכונת המצבים. פנה למנהל המערכת.");
          setSavingMatches(false);
          return;
      }
      const initialStatus = initialStatuses[0];

      // Get existing matches to check for duplicates
      const existingMatches = await Match.list();
      
      const matchesToCreate = [];
      const duplicateMatches = [];
      
      for (const candidateId of selectedMatches) {
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate) {
          const candidateName = `${candidate.first_name} ${candidate.last_name}`;
          
          // Check for duplicate matches
          const isDuplicate = existingMatches.some(existingMatch => {
            const sameCandidateId = existingMatch.candidate_id === candidateId;
            
            if (searchMode === "existing" && jobInfo) {
              // For existing job search, check if same candidate + same job
              return sameCandidateId && existingMatch.job_id === jobInfo.id;
            } else {
              // For freetext search, check if same candidate + same freetext query
              return sameCandidateId && existingMatch.free_text_query === freeTextDescription;
            }
          });
          
          if (isDuplicate) {
            duplicateMatches.push(candidateName);
          } else {
            matchesToCreate.push({
              job_id: jobInfo?.id || null,
              job_title: jobInfo?.title || (searchMode === 'freetext' ? "חיפוש טקסט חופשי" : null), // Ensure job_title is set for freetext
              free_text_query: searchMode === 'freetext' ? freeTextDescription : null,
              candidate_id: candidate.id,
              candidate_name: candidateName,
              user_id: currentUser.id,
              user_name: currentUser.full_name,
              user_app_role: currentUser.app_role || 'N/A',
              status: initialStatus.status_name, // NEW: Use initial status name
              status_number: initialStatus.status_number, // NEW: Use initial status number
              is_read: false // NEW: Added is_read field
            });
          }
        }
      }

      // Handle duplicate matches
      if (duplicateMatches.length > 0) {
        const duplicateMessage = duplicateMatches.length === 1 
          ? `המועמד ${duplicateMatches[0]} כבר נשמר עם התאמה זו ומטופל על ידי המערכת.`
          : `המועמדים הבאים כבר נשמרו עם התאמה זו ומטופלים על ידי המערכת: ${duplicateMatches.join(', ')}.`;
        
        if (matchesToCreate.length === 0) {
          // All matches are duplicates
          setError(duplicateMessage);
          setSavingMatches(false);
          return;
        } else {
          // Some matches are duplicates, show warning but continue
          setCleanupMessage(duplicateMessage + ` נשמרו ${matchesToCreate.length} התאמות חדשות.`);
        }
      }

      // Save new matches
      if (matchesToCreate.length > 0) {
        const createdMatches = await Match.bulkCreate(matchesToCreate); // Assuming bulkCreate returns the created entities with their IDs
        
        // NEW: Add system note for each created match
        for (const newMatch of createdMatches) {
          const noteText = `התאמה נוצרה על ידי ${currentUser.full_name}.`;
          await MatchNote.create({
              match_id: newMatch.id,
              user_id: currentUser.id,
              user_name: currentUser.full_name,
              note_text: noteText,
              is_system_note: true
          });
        }
        
        await notifyAdminsOfNewMatches(matchesToCreate, jobInfo);
        
        if (duplicateMatches.length === 0) {
          // No duplicates, show success message
          setCleanupMessage(`נשמרו ${matchesToCreate.length} התאמות חדשות בהצלחה!`);
        }
      }
      
      setTimeout(() => setCleanupMessage(""), 7000); // Longer timeout for duplicate messages
      setSelectedMatches(new Set());
      setResults([]); // Clear search results
      setError("");

    } catch (err) {
      console.error("Error saving matches:", err);
      setError("שגיאה בשמירת ההתאמות.");
    } finally {
        setSavingMatches(false);
    }
  };

  const runLevel1Agent = async () => {
    if ((searchMode === "existing" && !selectedJob) || (searchMode === "freetext" && !freeTextDescription.trim())) {
      setError("אנא בחר משרה או הזן תיאור חופשי לפני הפעלת הסוכן.");
      return;
    }

    setAiAgentRunning(true);
    resetAllSearchResults(); // Clear all previous results

    const controller = new AbortController();
    setAbortController(controller);
    setSearchProgressText("מפעיל סוכן AI (רמה 1)...");

    try {
      let jobInfo;

      if (searchMode === "existing") {
        jobInfo = jobs.find(j => j.id === selectedJob);
      } else {
        jobInfo = {
          title: "משרה לפי תיאור חופשי",
          description: freeTextDescription,
          requirements: freeTextDescription,
        };
      }

      // Enhance the query with synonyms before sending to agent
      const enhancedQuery = await enhanceSearchText(freeTextDescription); // Use freeTextDescription for agent prompt

      setSearchProgressText("מתחבר לסוכן AI...");
      
      // Try to find existing conversation or create new one
      let conversation;
      try {
        const existingConversations = await agentSDK.listConversations({ agent_name: "level1_specialist" });
        if (existingConversations && existingConversations.length > 0) {
          conversation = await agentSDK.getConversation(existingConversations[0].id);
        } else {
          conversation = await agentSDK.createConversation({
            agent_name: "level1_specialist",
            metadata: {
              name: `חיפוש רמה 1: ${jobInfo.title}`,
              description: "ניתוח מועמדים בעלי סיווג רמה 1 למשרה מתקדמת"
            }
          });
        }
      } catch (convError) {
        // Fallback to creating new conversation if listing fails
        conversation = await agentSDK.createConversation({
          agent_name: "level1_specialist",
          metadata: {
            name: `חיפוש רמה 1: ${jobInfo.title}`,
            description: "ניתוח מועמדים בעלי סיווג רמה 1 למשרה מתקדמת"
          }
        });
      }

      const agentPrompt = `
אני זקוק לניתוח מתקדם של מועמדים בעלי סיווג בטחוני רמה 1 עבור המשרה הבאה:

**פרטי המשרה:**
- כותרת: ${jobInfo.title}
- תיאור: ${jobInfo.description}
- דרישות: ${jobInfo.requirements}
- מיקום: ${jobInfo.location || 'לא צוין'}
- סיווג נדרש: ${securityClearance || 'רמה 1'}

**המשימה שלך:**
בחן את כל המועמדים במאגר בעלי סיווג "רמה 1" וממצא את המועמדים המתאימים ביותר.

**הנחיות מיוחדות:**
1. התמקד רק במועמדים עם סיווג "רמה 1"
2. הפעל חשיבה יצירתית - חפש התאמות לא ברורות
3. זהה פוטנטיאל להסתגלות בין תחומים טכנולוגיים
4. התחשב בכך שמועמדי רמה 1 נדירים - כל אחד מהם יכול להיות רלוונטי
5. חפש חיבורים בין פרויקטים קודמים לדרישות החדשות
6. הצע גם מועמדים שיכולים להיות מתאימים עם הכשרה קצרה

תיאור המשרה המקורי: ${freeTextDescription}
תיאור מורחב עם מילים נרדפות: ${enhancedQuery}

דרישות נוספות:
- סיווג בטחוני: ${(securityClearance && securityClearance !== 'all') ? securityClearance : 'אין דרישה ספציפית'}
- מיקום: ${searchLocation || 'אין דרישה ספציפית'}
- רדיוס חיפוש: ${searchLocation ? `${searchRadius} ק"מ` : 'לא רלוונטי'}

בצע חיפוש מעמיק ומתמחה של מועמדים בעלי סיווג רמה 1. 
התמקד במועמדים שיש להם ניסיון מתאים בתחומים הנדרשים.
בזכור לקחת בחשבון גם את המילים הנרדפות שצוינו בתיאור המורחב.

אנא החזר רשימת המועמדים המתאימים ביותר עם נימוק מפורט לכל אחד.
      `;

      setSearchProgressText("שולח בקשה לסוכן AI...");
      await agentSDK.addMessage(conversation, {
        role: "user",
        content: agentPrompt
      });

      setSearchProgressText("ממתין לתגובת סוכן AI...");
      const waitForResponse = new Promise((resolve, reject) => {
        let responseReceived = false;
        let unsubscribe = () => {};

        const timeout = setTimeout(() => {
          if (!responseReceived) {
            unsubscribe();
            reject(new Error("Timeout waiting for agent response"));
          }
        }, 300000); // 5 minutes timeout

        const checkAborted = setInterval(() => {
            if (controller.signal.aborted) {
                clearTimeout(timeout);
                unsubscribe();
                clearInterval(checkAborted);
                reject(new Error("Agent stopped by user."));
            }
        }, 500);

        unsubscribe = agentSDK.subscribeToConversation(conversation.id, (data) => {
          if (!responseReceived && data.messages && data.messages.length > 0) {
            const lastMessage = data.messages[data.messages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
              responseReceived = true;
              clearTimeout(timeout);
              clearInterval(checkAborted);
              unsubscribe();
              resolve(lastMessage.content);
            }
          }
        });
      });

      const finalResponse = await waitForResponse;
      
      if (controller.signal.aborted) return;

      if (finalResponse) {
        setAiAgentResults({
          analysis: finalResponse,
          conversationId: conversation.id,
          jobTitle: jobInfo.title
        });
        setShowAiResults(true);
        setSearchProgressText("ניתוח סוכן AI הושלם.");
      } else {
        setError("הסוכן לא החזיר תגובה תקינה.");
      }

    } catch (error) {
      console.error("Error running Level 1 agent:", error);
      if (controller.signal.aborted || error.name === "AbortError") {
        setError("החיפוש בוטל על ידי המשתמש.");
      } else if (error.message === "Timeout waiting for agent response") {
        setError("הסוכן לא הגיב תוך הזמן הקצוב (5 דקות). ייתכן שהסוכן עדיין מעבד את הבקשה - נסה שוב בעוד כמה רגעים.");
      } else {
        setError(`שגיאה בהפעלת הסוכן המתמחה: ${error.message}`);
      }
    } finally {
      setAiAgentRunning(false);
      setAbortController(null);
      setSearchProgressText("");
    }
  };

  const findJobsForCandidate = async () => {
    if (!selectedCandidate) {
      setError("אנא בחר מועמד לפני שתמשיך.");
      return;
    }

    setFindingJobsForCandidate(true);
    resetAllSearchResults();

    const controller = new AbortController();
    setAbortController(controller);
    setSearchProgressText("מאתר משרות מתאימות למועמד...");

    try {
      const candidateInfo = candidates.find(c => c.id === selectedCandidate);
      if (!candidateInfo) {
        throw new Error("Candidate not found");
      }

      // Pre-filter active jobs
      setSearchProgressText("אוסף משרות פעילות...");
      const activeJobs = jobs.filter(job => job.status === "פעילה").slice(0, 40);

      if (activeJobs.length === 0) {
        setError("לא נמצאו משרות פעילות במערכת לנתח.");
        setFindingJobsForCandidate(false);
        setSearchProgressText("");
        return;
      }

      const jobsContext = activeJobs.map(job => `
- ID: ${job.id}
- כותרת: ${job.title}
- תיאור: ${job.description ? job.description.substring(0, 250) + '...' : 'לא צוין'}
- דרישות: ${job.requirements ? job.requirements.substring(0, 250) + '...' : 'לא צוין'}
- מיקום: ${job.location || 'לא צוין'}
- סיווג נדרש: ${job.security_clearance || 'לא צוין'}
- ציון בסיס ללא גיאו: ${job.base_score_without_geo || 'לא מוגדר'}
- ציון בסיס עם גיאו: ${job.base_score_with_geo || 'לא מוגדר'}
`).join('');

      setSearchProgressText("שולח נתונים לניתוח AI מפורט...");
      const prompt = `
אתה סוכן גיוס מומחה המתמחה במציאת משרות מתאימות למועמדים בעלי הסמכה בטחונית. 
המטרה שלך היא למצוא את המשרות הטובות ביותר עבור המועמד הנתון מתוך רשימת המשרות הפעילות.

**פרטי המועמד:**
שם: ${candidateInfo.first_name} ${candidateInfo.last_name}
סיווג בטחוני: ${candidateInfo.security_clearance || 'לא צוין'}
סיכום כישורים: ${candidateInfo.skills_summary || 'לא צוין'}
השכלה: ${candidateInfo.education || 'לא צוין'}
ניסיון עיקרי: ${candidateInfo.main_experience || 'לא צוין'}
עיר: ${candidateInfo.city || 'לא צוין'}
טקסט קו"ח מלא (קטע): ${candidateInfo.full_text ? candidateInfo.full_text.substring(0, 800) + '...' : 'לא צוין'}

**שיקולים מרכזיים לחישוב ההתאמה:**
1. **ניצול סיווג בטחוני**: סיווג בטחוני הוא יתרון משמעותי ונדיר. תעדף משרות שדורשות או מרוויחות ממנו.
2. **התאמה מקיפה**: התחשב בכל ההיבטים - כישורים, ניסיון, השכלה, סיווג, מיקום.
3. **התאמה יצירתית**: חפש התאמות לא-ברורות שבהן כישורי הליבה והסיווג של המועמד הופכים אותו למועמד חזק.

**רשימת משרות פעילות לניתוח:**
${jobsContext}

**המשימה שלך:**
נתח כל משרה ובדוק התאמה סעיף-מול-סעיף מול דרישות המשרה וקורות חיים של המועמד.

לכל משרה ספק:
- ציון התאמה (0-100)
- ניתוח מפורט סעיף-אחר-סעיף (detailed_analysis): לכל דרישה במשרה - האם המועמד עונה עליה ואיך
- נקודות חוזק
- נקודות חולשה
- המלצה כוללת

החזר את 3-5 המשרות הטובות ביותר (או פחות אם אין התאמות טובות).
`;

      const responseSchema = {
        type: "object",
        properties: {
          recommended_jobs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                job_id: { type: "string" },
                job_title: { type: "string" },
                match_score: { type: "number" },
                strengths: { type: "string" },
                weaknesses: { type: "string" },
                recommendation: { type: "string" },
                detailed_analysis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      requirement: { type: "string", description: "דרישה מהמשרה" },
                      candidate_qualification: { type: "string", description: "האם המועמד עונה עליה ואיך" },
                      is_match: { type: "string", enum: ["true", "false", "partial"] }
                    },
                    required: ["requirement", "candidate_qualification", "is_match"]
                  }
                }
              },
              required: ["job_id", "job_title", "match_score", "strengths", "detailed_analysis"]
            }
          }
        }
      };

      const result = await InvokeLLM({
        prompt: prompt,
        response_json_schema: responseSchema,
        signal: controller.signal,
        add_context_from_internet: false
      });
      
      if (controller.signal.aborted) return;
      setSearchProgressText("מחשב התאמה גיאוגרפית...");

      if (result && result.recommended_jobs) {
        // Calculate geo for each job
        const jobsWithGeo = [];
        for (const jobMatch of result.recommended_jobs) {
          const job = jobs.find(j => j.id === jobMatch.job_id);
          let geoData = null;

          if (job) {
            try {
              const { calculateGeoFit } = await import('@/functions/calculateGeoFit');
              const geoResponse = await calculateGeoFit({
                candidate_id: candidateInfo.id,
                job_id: job.id
              });
              geoData = geoResponse.data?.result;
            } catch (geoErr) {
              console.log('Geo calculation failed:', geoErr);
            }
          }

          jobsWithGeo.push({
            ...jobMatch,
            job: job,
            geoData: geoData
          });
        }

        setFoundJobsResults({
          analysis: jobsWithGeo,
          candidateName: `${candidateInfo.first_name} ${candidateInfo.last_name}`,
          candidateInfo: candidateInfo
        });
        setShowFoundJobsResults(true);
        setSearchProgressText("איתור משרות הושלם.");
      } else {
        setError("החיפוש המהיר לא החזיר תוצאות תקינות.");
      }

    } catch (error) {
      console.error("Error finding jobs for candidate:", error);
      if (controller.signal.aborted || error.name === "AbortError") {
          setError("החיפוש בוטל על ידי המשתמש.");
      } else {
        setError(`שגיאה באיתור משרות למועמד: ${error.message}. אנא נסה שוב.`);
      }
    } finally {
      setFindingJobsForCandidate(false);
      setAbortController(null);
      setSearchProgressText("");
    }
  };

  const performSearch = async () => {
    if ((searchMode === "existing" && !selectedJob) || (searchMode === "freetext" && !freeTextDescription.trim())) {
      setError("אנא בחר משרה או הזן תיאור חופשי.");
      return;
    }

    setSearching(true);
    resetAllSearchResults(); // Clear all previous results

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const currentUser = await User.me();

      // --- Step 1: Pre-filtering Candidates ---
      setSearchProgressText("מסנן מועמדים רלוונטיים...");
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for UI update

      let relevantCandidates = [...candidates];
      if (securityClearance && securityClearance !== 'all') { // Corrected check for 'all'
        relevantCandidates = relevantCandidates.filter(c => c.security_clearance === securityClearance);
      }

      // --- Step 2: Synonym Expansion & Prompt Preparation ---
      setSearchProgressText("מרחיב את החיפוש עם מילים נרדפות...");
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for UI update

      let jobInfoForPrompt;
      let descriptionForPrompt;
      let requirementsForPrompt;

      if (searchMode === "existing") {
        jobInfoForPrompt = jobs.find(j => j.id === selectedJob);
        descriptionForPrompt = await enhanceSearchText(jobInfoForPrompt?.description || '');
        requirementsForPrompt = await enhanceSearchText(jobInfoForPrompt?.requirements || '');
      } else { // freetext mode
        jobInfoForPrompt = {
          title: "משרה לפי תיאור חופשי",
          description: freeTextDescription,
          requirements: freeTextDescription,
        };
        descriptionForPrompt = await enhanceSearchText(freeTextDescription);
        requirementsForPrompt = descriptionForPrompt;
      }
      
      const jobTextCombined = (descriptionForPrompt + " " + requirementsForPrompt).toLowerCase();
      const jobKeywords = jobTextCombined.match(/\b(\w{3,})\b/g) || []; // Extract words of 3+ chars
      const uniqueKeywords = [...new Set(jobKeywords)];

      if (uniqueKeywords.length > 0) {
        relevantCandidates = relevantCandidates.map(candidate => {
            const candidateText = (candidate.skills_summary || "" ) + " " + (candidate.full_text || "");
            const candidateTextLower = candidateText.toLowerCase();
            let score = 0;
            uniqueKeywords.forEach(keyword => {
                if (candidateTextLower.includes(keyword)) {
                    score++;
                }
            });
            return { ...candidate, relevanceScore: score };
        }).filter(c => c.relevanceScore > 0) // Keep only candidates that match at least one keyword
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 30); // Limit to top 30 most relevant candidates for LLM processing
      } else {
        // If no keywords derived, just take a subset of pre-filtered candidates
        relevantCandidates = relevantCandidates.slice(0, 30);
      }

      if (relevantCandidates.length === 0) {
        setError("לא נמצאו מועמדים התואמים לסינון הראשוני. נסה להרחיב את החיפוש.");
        setSearching(false);
        setSearchProgressText("");
        return;
      }

      // --- Step 3: LLM Analysis ---
      setSearchProgressText(`שולח ${relevantCandidates.length} מועמדים לניתוח AI...`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for UI update
      
      const candidateContext = relevantCandidates.map((c, idx) => `
${idx + 1}. ID: ${c.id}, שם: ${c.first_name} ${c.last_name}
- כישורים: ${c.skills_summary || 'לא צוין'}
- כתובת: ${c.address || 'לא צוין'}
- סיווג בטחוני: ${c.security_clearance || 'לא צוין'}
- קו"ח: ${c.full_text ? c.full_text.substring(0, 400) + '...' : 'לא צוין'}
`).join('');

      let analysisPrompt;
      const basePrompt = `
משימה: לנתח את המועמדים הבאים ולהעריך את התאמתם למשרה. החזר JSON עם התאמות.

פרטי משרה:
- כותרת: ${jobInfoForPrompt?.title}
- תיאור מורחב: ${descriptionForPrompt}
- דרישות מורחבות: ${requirementsForPrompt}
- מיקום: ${searchLocation || 'לא צוין'}
- סיווג נדרש: ${(securityClearance && securityClearance !== 'all') ? securityClearance : 'אין דרישה'}

מועמדים לניתוח:
${candidateContext}
`;

      if (searchMode === "existing") {
        analysisPrompt = basePrompt + "\n**הנחיות קפדניות לניתוח:**\n1. התאמה מקצועית מדויקת: בדוק התאמה מלאה בין דרישות המשרה לניסיון המועמד. ודא שהמועמד עבד בדיוק באותם תחומים הנדרשים במשרה ומכיר את הטכנולוגיות/כלים הספציפיים. אל תקבל תחליפים. ציון זה יהווה 70% מהציון הכולל.\n2. סיווג בטחוני: אם נדרש סיווג בטחוני - המועמד חייב להיות בעל סיווג זהה או גבוה יותר. אין פשרות על סיווג בטחוני.\n3. התאמת השכלה: אם המשרה מחייבת תואר/הכשרה ספציפית - המועמד חייב להיות בעל ההשכלה המתאימה.\n4. התאמת מיקום: אם צוין מיקום, חשב מרחק גאוגרפי. מועמד מחוץ לרדיוס המותר מקבל ציון 0 במיקום. ציון זה יהווה 30% מהציון הכולל אם צוין מיקום.\n5. ציון התאמה מינימלי: רק מועמדים עם ציון 80 ומעלה יכללו בתוצאות.\n6. אל תמציא או תניח: אם אין מידע ברור, הניח שאין לו. אל תניח שמועמד 'יכול ללמוד'.\n\n**חשוב:** כלול בתוצאות רק מועמדים עם ציון התאמה של 80 ומעלה. עדיף למצוא פחות מועמדים איכותיים מאשר הרבה מועמדים לא מתאימים.";
      } else {
        analysisPrompt = basePrompt + "\n**הנחיות לניתוח:**\n1. התאמה מקצועית: בדוק התאמה לדרישות המשרה הכלליות (כישורים, ניסיון וכו') וסיווג בטחוני. ציון זה יהווה 70% מהציון הכולל.\n2. התאמת מיקום: אם צוין מיקום, הערך את מרחק המגורים של המועמד ממיקום המשרה. ציון זה יהווה 30% מהציון הכולל אם צוין מיקום, אחרת 100% מהציון יתבסס על התאמה מקצועית.\n3. כלול בתוצאות רק מועמדים עם ציון התאמה כולל של 40 ומעלה.";
      }

      const result = await InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  candidate_name: { type: "string" },
                  match_score: { type: "number" },
                  strengths: { type: "array", items: { type: "string" }},
                  weaknesses: { type: "array", items: { type: "string" }},
                  recommendation: { type: "string" },
                  notes: { type: "string" }
                }
              }
            }
          }
        },
        signal: controller.signal, // Pass the abort signal
        add_context_from_internet: false // Added as per outline
      });
      
      if (controller.signal.aborted) return;
      
      setSearchProgressText("מעבד תוצאות שהתקבלו...");

      const wasSuccessful = result?.matches && result.matches.length > 0;
      const resultsCount = wasSuccessful ? result.matches.length : 0;

      await SearchLog.create({
          user_email: currentUser.email,
          search_mode: searchMode,
          job_id: searchMode === 'existing' ? selectedJob : null,
          free_text_query: searchMode === 'freetext' ? freeTextDescription.substring(0, 200) : null,
          results_count: resultsCount,
          was_successful: wasSuccessful,
      });

      if (wasSuccessful) {
        let sortedMatches;
        
        if (searchMode === "existing") {
          // עבור משרות קיימות - רק ציון 80 ומעלה
          sortedMatches = result.matches
            .filter(match => match.match_score >= 80)
            .sort((a, b) => b.match_score - a.match_score);
        } else {
          // עבור חיפוש חופשי - ציון רגיל 40 ומעלה
          sortedMatches = result.matches
            .filter(match => match.match_score >= 40)
            .sort((a, b) => b.match_score - a.match_score);
        }

        setResults(sortedMatches);
        setSearchProgressText("חיפוש הושלם.");
        
        if (sortedMatches.length === 0) {
          if (searchMode === "existing") {
            setError("לא נמצאו מועמדים העונים על הקריטריונים הקפדניים של המשרה. נסה חיפוש חופשי לגמישות רבה יותר.");
          } else {
            setError("החיפוש לא הניב תוצאות מתאימות.");
          }
        }
      } else {
        setResults([]);
        setError("החיפוש לא הניב תוצאות מתאימות.");
      }

    } catch (error) {
      console.error("Error performing search:", error);
      if (controller.signal.aborted || error.name === "AbortError") {
        setError("החיפוש בוטל על ידי המשתמש.");
      } else {
        setError("שגיאה בביצוע הח חיפוש. ייתכן שהתיאור מורכב מדי. נסה לפשט אותו.");
      }
    } finally {
        setSearching(false);
        setSearchProgressText("");
        setAbortController(null);
    }
  };

  const filteredJobs = jobs.filter(job =>
    jobStatusFilter === "all" || job.status === jobStatusFilter
  );

  const levelOneCandidates = candidates.filter(c => c.security_clearance === "רמה 1");

  // Expert Search functions
  const handleExpertFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('יש להעלות קובץ PDF או Word בלבד (.pdf, .docx, .doc)');
      return;
    }

    setError('');
    setIsExpertUploading(true);

    try {
      const { file_url } = await UploadFile({ file });
      setExpertUploadedFile({ name: file.name, url: file_url });
      
      setIsExpertUploading(false);
      setIsExpertExtracting(true);

      const extractionResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            full_text: {
              type: "string",
              description: "הטקסט המלא של קורות החיים"
            }
          }
        }
      });

      if (extractionResult.status === "success" && extractionResult.output?.full_text) {
        setExpertResumeText(extractionResult.output.full_text);
        setExpertInputMode('file');
      } else {
        throw new Error('לא ניתן לחלץ טקסט מהקובץ');
      }

    } catch (error) {
      console.error('Error processing file:', error);
      setError('שגיאה בעיבוד הקובץ. אנא נסה שוב או הדבק את הטקסט ידנית.');
      setExpertUploadedFile(null);
    } finally {
      setIsExpertUploading(false);
      setIsExpertExtracting(false);
    }
  };

  const clearExpertFile = () => {
    setExpertUploadedFile(null);
    setExpertResumeText('');
    setExpertInputMode('text');
    const fileInput = document.getElementById('expert-resume-file-upload');
    if (fileInput) fileInput.value = '';
  };

  const getExpertScoreColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const saveExpertResultsToSystem = async (agentResults) => {
    try {
      const { candidate_details, matches } = agentResults;

      const nameParts = (candidate_details.full_name || 'מועמד מומחה').split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '(לא צוין)';

      const newCandidate = await Candidate.create({
        first_name: firstName,
        last_name: lastName,
        email: candidate_details.email || `expert-search-${Date.now()}@example.com`,
        phone_primary: candidate_details.phone || 'לא צוין',
        full_text: expertResumeText,
        resume_file_url: expertUploadedFile?.url || '',
        original_filename: expertUploadedFile?.name || '',
        status: 'מועמד'
      });

      const statuses = await CandidateStatus.list();
      const recommendationStatus = statuses.find(s => s.status_name?.includes('המלצה אוטומטית')) || 
                                   statuses.find(s => s.status_number === 1) || 
                                   { status_name: 'המלצה אוטומטית', status_number: 1 };

      let createdMatches = 0;
      for (const match of matches) {
        if (match.match_score >= 40) {
          await Match.create({
            job_id: match.job_id,
            job_title: match.job_title,
            candidate_id: newCandidate.id,
            candidate_name: `${firstName} ${lastName}`,
            user_id: 'agent_recruitment_specialist',
            user_name: 'מומחה גיוס AI',
            user_app_role: 'system',
            status: recommendationStatus.status_name,
            status_number: recommendationStatus.status_number,
            is_read: false,
            match_score: match.match_score,
            match_reasons: match.strengths?.join(', ') || '',
            is_automatic_recommendation: true
          });
          createdMatches++;
        }
      }
      setExpertSavedMatchesCount(createdMatches);

    } catch (error) {
      console.error('Error saving agent results to system:', error);
      setError('שגיאה בשמירת תוצאות הסוכן במערכת. הניתוח הוצג אך לא נשמר.');
    }
  };

  const runExpertSearch = async () => {
    if (!expertResumeText.trim()) {
      setError('אנא הדבק קורות חיים או העלה קובץ כדי להפעיל את הסוכן.');
      return;
    }
    
    setExpertSearchLoading(true);
    setError('');
    setExpertResults(null);
    setExpertSavedMatchesCount(0);
    setExpertAgentProgress('יוצר שיחה עם הסוכן...');

    try {
      // Try to find existing conversation or create new one
      let conversation;
      try {
        const existingConversations = await agentSDK.listConversations({ agent_name: 'recruitment_specialist' });
        if (existingConversations && existingConversations.length > 0) {
          conversation = await agentSDK.getConversation(existingConversations[0].id);
        } else {
          conversation = await agentSDK.createConversation({
            agent_name: 'recruitment_specialist',
            metadata: { 
              name: `ניתוח מועמד - ${new Date().toLocaleString('he-IL')}`,
              source: expertInputMode === 'file' ? `קובץ: ${expertUploadedFile?.name}` : 'טקסט ידני'
            }
          });
        }
      } catch (convError) {
        conversation = await agentSDK.createConversation({
          agent_name: 'recruitment_specialist',
          metadata: { 
            name: `ניתוח מועמד - ${new Date().toLocaleString('he-IL')}`,
            source: expertInputMode === 'file' ? `קובץ: ${expertUploadedFile?.name}` : 'טקסט ידני'
          }
        });
      }

      setExpertAgentProgress('שולח קורות חיים לניתוח...');

      const prompt = `אנא נתח את קורות החיים הבאים ומצא משרות מתאימות:\n\n${expertResumeText}`;

      await agentSDK.addMessage(conversation, {
        role: 'user',
        content: prompt
      });

      setExpertAgentProgress('הסוכן מעבד את הבקשה...');

      const waitForResponse = new Promise((resolve, reject) => {
        let lastContent = '';
        let hasStarted = false;
        
        const unsubscribe = agentSDK.subscribeToConversation(conversation.id, (data) => {
          const lastMessage = data.messages[data.messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            if (!hasStarted && lastMessage.content) {
              hasStarted = true;
              setExpertAgentProgress('הסוכן מתחיל להחזיר תוצאות...');
            }
            
            if (lastMessage.content) {
              lastContent = lastMessage.content;
              
              if (lastContent.includes('}') && lastContent.includes('{')) {
                try {
                  const jsonMatch = lastContent.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.matches && Array.isArray(parsed.matches)) {
                      unsubscribe();
                      resolve(jsonStr);
                      return;
                    }
                  }
                } catch (e) {
                  // Continue waiting
                }
              }
            }
          }
          
          if (data.status === 'completed' && lastContent) {
            unsubscribe();
            resolve(lastContent);
          }
        });
        
        setTimeout(() => {
          unsubscribe();
          reject(new Error("Timeout waiting for agent response."));
        }, 300000);
      });

      const agentResponse = await waitForResponse;
      setExpertAgentProgress('מעבד תוצאות...');
      
      try {
        let cleanResponse = agentResponse.trim();
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanResponse = jsonMatch[0];
        }
        
        const parsedResponse = JSON.parse(cleanResponse);
        
        if (!parsedResponse.matches || !Array.isArray(parsedResponse.matches) || !parsedResponse.candidate_details) {
          throw new Error('Invalid response format from agent');
        }
        
        setExpertResults(parsedResponse);
        setExpertAgentProgress('שומר התאמות במערכת...');
        
        await saveExpertResultsToSystem(parsedResponse);
        
        setExpertAgentProgress('');
        
      } catch (parseError) {
        console.error("Failed to parse agent JSON response:", agentResponse);
        setError("הסוכן החזיר תשובה בפורמט לא תקין. נסה שוב.");
      }

    } catch (e) {
      console.error('Error running agent:', e);
      if (e.message.includes('Timeout')) {
        setError('הסוכן לוקח יותר זמן מהצפוי לעיבוד. אנא נסה שוב.');
      } else if (e.message.includes('agent not found') || e.message.includes('Agent not found')) {
        setError('סוכן החיפוש המומחה לא נמצא. אנא פנה למנהל המערכת.');
      } else {
        setError(`שגיאה בהפעלת הסוכן: ${e.message}`);
      }
    } finally {
      setExpertSearchLoading(false);
      setExpertAgentProgress('');
    }
  };

  // User not logged in page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6">
            <SearchIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">חיפוש מועמדים</h1>
          <p className="text-lg text-gray-600 mb-8">התחבר כדי לגשת למערכת החיפוש</p>
          <Button onClick={handleLogout} className="bg-blue-600 hover:bg-blue-700">
            <LogOut className="w-4 h-4 ml-2" />
            התחבר למערכת
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <img 
            src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face" 
            alt="יעל" 
            className="w-16 h-16 rounded-full object-cover border-4 border-blue-200 shadow-lg"
          />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">יעל - חיפוש מועמדים</h1>
            <p className="text-sm md:text-base text-gray-600">ציידת המועמדים, מצא מועמדים מתאימים למשרות</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-green-600 hover:text-green-800 border-green-500 hover:bg-green-50"
            onClick={() => window.location.href = createPageUrl("Candidates")}
          >
            <Users className="w-4 h-4 ml-2" />
            מועמדים
          </Button>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <LogOut className="w-4 h-4 ml-2" />
            יציאה מהמערכת
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* NEW: Search progress indicator */}
      {isAnySearchRunning && searchProgressText && (
        <Alert className="bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-700 font-medium">
                    {searchProgressText}
                </AlertDescription>
            </div>
        </Alert>
      )}

      {cleanupMessage && (
        <Alert>
          <AlertDescription>{cleanupMessage}</AlertDescription>
        </Alert>
      )}

      {/* Display Applied Synonyms */}
      {appliedSynonyms.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">
            מילים נרדפות שיושמו בחיפוש:
          </h3>
          <div className="flex flex-wrap gap-2">
            {appliedSynonyms.map((synonym, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700"
              >
                {synonym.original} &rarr; {synonym.synonym}
                <span className="ml-1 text-blue-500">({synonym.category})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>בחר סוג חיפוש</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* חיפוש למשרה קיימת - מותנה בהרשאה */}
            {canUseExistingJob && (
              <Card 
                className={`cursor-pointer border-2 transition-colors ${
                  isAnySearchRunning ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'
                } ${
                  searchMode === "existing" ? "border-blue-500 bg-blue-50" : "border-gray-200"
                }`}
                onClick={() => !isAnySearchRunning && setSearchMode("existing")}
              >
                <CardContent className="p-4 text-center">
                  <Briefcase className="mx-auto h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold">חיפוש למשרה קיימת</h3>
                  <p className="text-sm text-gray-600">בחר משרה וממצא מועמדים מתאימים</p>
                </CardContent>
              </Card>
            )}

            {/* חיפוש חופשי - תמיד זמין */}
            <Card 
              className={`cursor-pointer border-2 transition-colors ${
                  isAnySearchRunning ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'
                } ${
                searchMode === "freetext" ? "border-blue-500 bg-blue-50" : "border-gray-200"
              }`}
              onClick={() => !isAnySearchRunning && setSearchMode("freetext")}
            >
              <CardContent className="p-4 text-center">
                <FileText className="mx-auto h-8 w-8 text-green-600 mb-2" />
                <h3 className="font-semibold">חיפוש לפי תיאור חופשי</h3>
                <p className="text-sm text-gray-600">תאר את הדרישות בצורה חופשית</p>
              </CardContent>
            </Card>

            {/* חיפוש משרות למועמד - מותנה בהרשאה */}
            {canFindJobsForCandidate && (
              <Card 
                className={`cursor-pointer border-2 transition-colors ${
                  isAnySearchRunning ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'
                } ${
                  searchMode === "jobs_for_candidate" ? "border-blue-500 bg-blue-50" : "border-gray-200"
                }`}
                onClick={() => !isAnySearchRunning && setSearchMode("jobs_for_candidate")}
              >
                <CardContent className="p-4 text-center">
                  <UserSearch className="mx-auto h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-semibold">מציאת משרות למועמד</h3>
                  <p className="text-sm text-gray-600">בחר מועמד ומצא משרות מתאימה</p>
                </CardContent>
              </Card>
            )}

            {/* חיפוש מומחה - מותנה בהרשאה */}
            {canUseExpertSearch && (
              <Card 
                className={`cursor-pointer border-2 transition-colors ${
                  isAnySearchRunning ? 'opacity-50 cursor-not-allowed' : 'hover:border-purple-300'
                } ${
                  searchMode === "expert" ? "border-purple-500 bg-purple-50" : "border-gray-200"
                }`}
                onClick={() => !isAnySearchRunning && setSearchMode("expert")}
              >
                <CardContent className="p-4 text-center">
                  <BrainCircuit className="mx-auto h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-semibold">חיפוש מומחה</h3>
                  <p className="text-sm text-gray-600">העלה קו"ח ומצא משרות מתאימות עם AI</p>
                </CardContent>
              </Card>
            )}
          </div>
          {/* אם אין למשתמש הרשאות מתקדמות, ודא שיש לו לפחות חיפוש חופשי */}
          {!canUseExistingJob && !canFindJobsForCandidate && searchMode !== "freetext" && (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4">החיפוש החופשי זמין תמיד לכל המשתמשים</p>
              <Button onClick={() => setSearchMode("freetext")} className="bg-green-600 hover:bg-green-700" disabled={isAnySearchRunning}>
                עבור לחיפוש חופשי
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* חיפוש למשרה קיימת */}
      {searchMode === "existing" && canUseExistingJob && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">הגדרת חיפוש למשרה קיימת</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                    <Label htmlFor="job-status-filter" className="text-xs">סנן משרות</Label>
                    <Select value={jobStatusFilter} onValueChange={setJobStatusFilter} disabled={isAnySearchRunning}>
                        <SelectTrigger id="job-status-filter" className="mt-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="פעילה">משרות פעילות</SelectItem>
                            <SelectItem value="all">כלל המשרות</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="md:col-span-3">
                    <Label htmlFor="job-select" className="text-xs">בחר משרה</Label>
                    <Select value={selectedJob} onValueChange={setSelectedJob} disabled={isAnySearchRunning}>
                        <SelectTrigger id="job-select" className="mt-1">
                            <SelectValue placeholder="בחר משרה לחיפוש..." />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredJobs.map(job => (
                                <SelectItem key={job.id} value={job.id}>
                                {job.title} - {job.client_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* חיפוש חופשי - תמיד זמין */}
      {searchMode === "freetext" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">הגדרת חיפוש לפי תיאור חופשי</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="job-description" className="text-sm md:text-base">תיאור המשרה הדרושה:</Label>
              <Textarea
                id="job-description"
                placeholder="הדבק או כתב כאן את תיאור המשרה, הדרישות והכישורים הנדרשים..."
                value={freeTextDescription}
                onChange={(e) => setFreeTextDescription(e.target.value)}
                rows={4}
                className="resize-none mt-1 text-sm md:text-base"
                disabled={isAnySearchRunning}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* חיפוש מומחה */}
      {searchMode === "expert" && canUseExpertSearch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-purple-600" />
              חיפוש מומחה
            </CardTitle>
            <CardDescription>העלה קובץ קורות חיים (PDF/Word) או הדבק טקסט והפעל סוכן AI לניתוח התאמה מול כלל המשרות הפעילות</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload Section */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-purple-400 transition-colors">
              <div className="text-center">
                {expertUploadedFile ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-green-600" />
                      <div className="text-right">
                        <div className="font-medium text-green-800">{expertUploadedFile.name}</div>
                        <div className="text-sm text-green-600">הקובץ הועלה ועובד בהצלחה</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearExpertFile}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">העלאת קובץ קורות חיים</h3>
                    <p className="text-sm text-gray-500 mb-4">גרור קובץ לכאן או לחץ לבחירה</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleExpertFileUpload}
                      disabled={isExpertUploading || isExpertExtracting}
                      className="hidden"
                      id="expert-resume-file-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('expert-resume-file-upload').click()}
                      disabled={isExpertUploading || isExpertExtracting}
                      className="mb-2"
                    >
                      {isExpertUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          מעלה קובץ...
                        </>
                      ) : isExpertExtracting ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          מחלץ טקסט...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 ml-2" />
                          בחר קובץ
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-400">תומך בקבצי PDF ו-Word (.pdf, .docx, .doc)</p>
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">או</span>
              </div>
            </div>

            {/* Text Input Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                הדבקת טקסט ידני
              </label>
              <Textarea
                value={expertResumeText}
                onChange={(e) => {
                  setExpertResumeText(e.target.value);
                  if (e.target.value && expertInputMode === 'file') {
                    setExpertInputMode('text');
                  }
                }}
                placeholder="...הדבק כאן את טקסט קורות החיים"
                rows={10}
                className="text-sm"
                disabled={expertSearchLoading || isExpertUploading || isExpertExtracting}
              />
            </div>

            <Button 
              onClick={runExpertSearch} 
              disabled={expertSearchLoading || isExpertUploading || isExpertExtracting || !expertResumeText.trim()} 
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {expertSearchLoading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  {expertAgentProgress || 'הסוכן בפעולה...'}
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4 ml-2" />
                  הפעל סוכן ונתח התאמות
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expert Search Results */}
      {searchMode === "expert" && expertResults && (
        <>
          {expertSavedMatchesCount > 0 && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                הניתוח הושלם! <strong>{expertSavedMatchesCount}</strong> התאמות חדשות נשמרו במערכת ויוצגו במסך 'ניהול התאמות'.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>תוצאות ניתוח הסוכן</CardTitle>
              <CardDescription>
                {expertResults.analysis_summary}
                {expertInputMode === 'file' && expertUploadedFile && (
                  <span className="block text-sm text-blue-600 mt-2">
                    מקור: {expertUploadedFile.name}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="heatmap" className="w-full">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
                  <TabsTrigger value="heatmap"><LayoutGrid className="w-4 h-4 ml-2" />תצוגת מפת חום</TabsTrigger>
                  <TabsTrigger value="table"><TableIcon className="w-4 h-4 ml-2" />תצוגת טבלה</TabsTrigger>
                </TabsList>
                <TabsContent value="heatmap" className="pt-4">
                  <HeatmapDisplay matches={expertResults.matches} />
                </TabsContent>
                <TabsContent value="table" className="pt-4">
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>משרה</TableHead>
                          <TableHead className="text-center">ציון התאמה</TableHead>
                          <TableHead>נקודות חוזק</TableHead>
                          <TableHead>נקודות חולשה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expertResults.matches.sort((a, b) => b.match_score - a.match_score).map(match => (
                          <TableRow key={match.job_id}>
                            <TableCell className="font-medium whitespace-nowrap">{match.job_title}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={getExpertScoreColor(match.match_score)}>{match.match_score}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-green-700 min-w-[200px]">
                              <ul className="list-disc pl-4">
                                  {match.strengths.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </TableCell>
                            <TableCell className="text-xs text-amber-700 min-w-[200px]">
                              <ul className="list-disc pl-4">
                                  {match.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* חיפוש משרות למועמד */}
      {searchMode === "jobs_for_candidate" && canFindJobsForCandidate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">חשיבה הפוכה - איתור משרות למועמד</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="candidate-select" className="text-xs">בחר מועמד (סיווג רמה 1)</Label>
              <Select value={selectedCandidate} onValueChange={setSelectedCandidate} disabled={isAnySearchRunning}>
                  <SelectTrigger id="candidate-select" className="mt-1">
                      <SelectValue placeholder="בחר מועמד לאיתור משרה..." />
                  </SelectTrigger>
                  <SelectContent>
                      {levelOneCandidates.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            <Button
              onClick={findJobsForCandidate}
              disabled={isAnySearchRunning || !selectedCandidate}
              className="w-full bg-teal-600 hover:bg-teal-700"
              size="lg"
            >
              {findingJobsForCandidate ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מאתר משרות...
                </>
              ) : (
                <>
                  <UserSearch className="w-4 h-4 ml-2" />
                  מצא משרות מתאימות (חיפוש מהיר)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Advanced Filters and Search/AI Agent Buttons */}
      {(searchMode === "existing" || searchMode === "freetext") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">מסננים ופעולות חיפוש</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canSeeAdvancedFilters && (
              <>
                <h3 className="text-md font-semibold mb-3">מסננים מתקדמים</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="security-clearance" className="flex items-center gap-1 text-xs mb-1">
                      <Shield className="w-3 h-3" />
                      סיווג בטחוני
                    </Label>
                    <Select value={securityClearance} onValueChange={setSecurityClearance} disabled={isAnySearchRunning}>
                      <SelectTrigger id="security-clearance">
                        <SelectValue placeholder="בחר סיווג" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הסיווגים</SelectItem> {/* Changed value from "" to "all" */}
                        {securityClearanceLevels.map(level => (
                          <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="location" className="flex items-center gap-1 text-xs mb-1">
                      <MapPin className="w-3 h-3" />
                      מיקום
                    </Label>
                    <Input
                      id="location"
                      placeholder="לדוגמא: תל אביב"
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      disabled={isAnySearchRunning}
                    />
                  </div>
                  <div>
                    <Label htmlFor="radius" className="flex items-center gap-1 text-xs mb-1">
                        <CircleDot className="w-3 h-3" />
                        רדיוס חיפוש (ק"מ)
                    </Label>
                    <Input
                      id="radius"
                      type="number"
                      placeholder="25"
                      value={searchRadius}
                      onChange={(e) => setSearchRadius(Number(e.target.value))}
                      disabled={isAnySearchRunning}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={performSearch}
                disabled={isAnySearchRunning}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    מחפש מועמדים...
                  </>
                ) : (
                  <>
                    <SearchIcon className="w-4 h-4 ml-2" />
                    חפש מועמדים מתאימים
                  </>
                )}
              </Button>

              {canUseLevel1Agent && (
                <Button
                  onClick={runLevel1Agent}
                  disabled={isAnySearchRunning}
                  variant="outline"
                  className="flex-1 border-purple-600 text-purple-600 hover:bg-purple-50"
                  size="lg"
                >
                  {aiAgentRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      סוכן מועמד רמה 1 פועל...
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4 ml-2" />
                      הפעל סוכן AI לאיתור יצירתי של מועמד רמה 1
                    </>
                  )}
                </Button>
              )}

              {isAnySearchRunning && (
                <Button
                  onClick={handleStopSearch}
                  variant="destructive"
                  size="lg"
                  className="flex-1"
                >
                  <Ban className="w-4 h-4 ml-2" />
                  עצור חיפוש
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {showFoundJobsResults && foundJobsResults && (
        <Card className="border-teal-200 bg-teal-50">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg md:text-xl text-teal-800 flex items-center gap-2">
                  <UserSearch className="w-5 h-5" />
                  הצעות משרה עבור {foundJobsResults.candidateName}
                </CardTitle>
                <p className="text-sm md:text-base text-teal-600">נמצאו {foundJobsResults.analysis.length} משרות מומלצות</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFoundJobsResults(false)}
                className="text-teal-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {foundJobsResults.analysis.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                לא נמצאו משרות מתאימות עבור מועמד זה.
              </div>
            ) : (
              foundJobsResults.analysis
                .sort((a, b) => b.match_score - a.match_score)
                .map((jobMatch) => (
                  <Card key={jobMatch.job_id} className="bg-white">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-base font-bold text-gray-800">{jobMatch.job_title}</CardTitle>
                          <div className="flex gap-2 mt-2">
                            <Badge className={
                              jobMatch.match_score >= 80 ? 'bg-green-100 text-green-800' :
                              jobMatch.match_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {jobMatch.match_score}% התאמה
                            </Badge>
                            {jobMatch.geoData && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {jobMatch.geoData.distance_km ? `${jobMatch.geoData.distance_km} ק"מ` : 'לא חושב'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedJobMatch(jobMatch);
                            setShowJobMatchDialog(true);
                          }}
                          className="text-xs"
                        >
                          <Eye className="w-4 h-4 ml-1" />
                          פרטים מלאים
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-green-700 text-sm mb-1">נקודות חוזק</h4>
                        <p className="text-xs text-gray-600">{jobMatch.strengths}</p>
                      </div>
                      {jobMatch.weaknesses && (
                        <div>
                          <h4 className="font-semibold text-orange-700 text-sm mb-1">נקודות לשיפור</h4>
                          <p className="text-xs text-gray-600">{jobMatch.weaknesses}</p>
                        </div>
                      )}
                      {jobMatch.recommendation && (
                        <div className="bg-gray-50 p-2 rounded-md">
                          <h4 className="font-semibold text-blue-700 text-sm mb-1">המלצת המערכת</h4>
                          <p className="text-xs text-gray-700">{jobMatch.recommendation}</p>
                        </div>
                      )}
                      
                      {/* Detailed Analysis Section */}
                      {jobMatch.detailed_analysis && jobMatch.detailed_analysis.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-between">
                              <span className="text-xs font-semibold">ניתוח סעיף-אחר-סעיף</span>
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50">
                                    <TableHead className="w-1/3">דרישת המשרה</TableHead>
                                    <TableHead className="w-1/3">כישורי המועמד</TableHead>
                                    <TableHead className="w-1/3 text-center">התאמה</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {jobMatch.detailed_analysis.map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-xs">{item.requirement}</TableCell>
                                      <TableCell className="text-xs">{item.candidate_qualification}</TableCell>
                                      <TableCell className="text-center">
                                        {item.is_match === "true" && (
                                          <Badge className="bg-green-100 text-green-800">✓ מתאים</Badge>
                                        )}
                                        {item.is_match === "false" && (
                                          <Badge className="bg-red-100 text-red-800">✗ חסר</Badge>
                                        )}
                                        {item.is_match === "partial" && (
                                          <Badge className="bg-yellow-100 text-yellow-800">~ חלקי</Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Geo Status Display */}
                      {jobMatch.geoData && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 ${
                          jobMatch.geoData.geo_status === 'APPROVED' ? 'bg-green-50 border border-green-200' :
                          jobMatch.geoData.geo_status === 'REJECTED' ? 'bg-red-50 border border-red-200' :
                          'bg-yellow-50 border border-yellow-200'
                        }`}>
                          <MapPin className={`w-4 h-4 ${
                            jobMatch.geoData.geo_status === 'APPROVED' ? 'text-green-600' :
                            jobMatch.geoData.geo_status === 'REJECTED' ? 'text-red-600' :
                            'text-yellow-600'
                          }`} />
                          <p className="text-xs">
                            {jobMatch.geoData.geo_status === 'APPROVED' && (
                              <span className="text-green-700">
                                מרחק: {jobMatch.geoData.distance_km} ק"מ (בתוך סף {jobMatch.geoData.threshold_km} ק"מ)
                              </span>
                            )}
                            {jobMatch.geoData.geo_status === 'REJECTED' && (
                              <span className="text-red-700">
                                מרחק: {jobMatch.geoData.distance_km} ק"מ (מעל סף {jobMatch.geoData.threshold_km} ק"מ)
                              </span>
                            )}
                            {jobMatch.geoData.geo_status === 'UNKNOWN_ALLOWED' && (
                              <span className="text-yellow-700">
                                לא ניתן לחשב מרחק - חסר מידע מיקום
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Job Match Analysis Dialog */}
      {selectedJobMatch && (
        <JobMatchAnalysisDialog
          isOpen={showJobMatchDialog}
          onClose={() => {
            setShowJobMatchDialog(false);
            setSelectedJobMatch(null);
          }}
          jobMatch={selectedJobMatch}
          candidate={foundJobsResults?.candidateInfo}
          job={selectedJobMatch.job}
        />
      )}
      
      {showAiResults && aiAgentResults && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg md:text-xl text-purple-800 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  ניתוח סוכן AI מתמחה - רמה 1
                </CardTitle>
                <p className="text-sm md:text-base text-purple-600">עבור: {aiAgentResults.jobTitle}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiResults(false)}
                className="text-purple-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown className="text-sm whitespace-pre-wrap">
                  {aiAgentResults.analysis}
                </ReactMarkdown>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg md:text-xl">תוצאות החיפוש</CardTitle>
                <p className="text-sm md:text-base text-gray-600">נמצאו {results.length} מועמדים מתאימים</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <AnimatePresence>
                {results.map((match, index) => {
                  const candidate = candidates.find(c =>
                    `${c.first_name} ${c.last_name}`.trim() === match.candidate_name.trim()
                  );
                  const isSelected = selectedMatches.has(candidate?.id);

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className={`border-r-4 border-r-blue-500 ${isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''}`}>
                        <CardHeader>
                         <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                           <div className="flex items-center gap-3">
                             <input
                               type="checkbox"
                               checked={isSelected}
                               onChange={() => handleMatchSelection(match.candidate_name, candidate?.id)}
                               className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                               disabled={isAnySearchRunning} // Disable checkbox during search
                             />
                             <div className="flex flex-col gap-2">
                               <CardTitle className="text-base md:text-lg">{match.candidate_name}</CardTitle>
                               <div className="flex gap-2 flex-wrap">
                                 {candidate && (
                                   <Badge className={`text-xs ${
                                     candidate.status === "מועמד" ? "bg-blue-100 text-blue-800" :
                                     candidate.status === "עובד חברה" ? "bg-green-100 text-green-800" :
                                     candidate.status === "לא מעוניין" ? "bg-red-100 text-red-800" :
                                     "bg-gray-100 text-gray-800"
                                   }`}>
                                     {candidate.status}
                                   </Badge>
                                 )}
                                 {candidate && (() => {
                                   const ageInfo = calculateCandidateAge(candidate);
                                   return !ageInfo.isEmpty && (
                                     <Badge variant="outline" className={isOlderThan60(candidate) ? 'border-orange-500 text-orange-700 bg-orange-50' : ''}>
                                       {ageInfo.age} שנים
                                     </Badge>
                                   );
                                 })()}
                               </div>
                             </div>
                           </div>
                           <Badge className={match.match_score >= 80 ? 'bg-green-100 text-green-800' : match.match_score >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                             {match.match_score}% התאמה
                           </Badge>
                         </div>
                        </CardHeader>
                        <CardContent className="space-y-3 md:space-y-4">
                          {/* Age Warning */}
                          {candidate && isOlderThan60(candidate) && (
                            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                              <p className="text-xs text-orange-700 font-semibold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                שים לב: המועמד בן/בת למעלה מ-60 שנים
                              </p>
                            </div>
                          )}
                          {match.strengths && match.strengths.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-green-700 flex items-center gap-2 mb-2 text-sm md:text-base">
                                <Star className="w-3 h-3 md:w-4 md:h-4" />
                                נקודות חוזק:
                              </h4>
                              <ul className="list-disc list-inside space-y-1">
                                {match.strengths.map((strength, i) => (
                                  <li key={i} className="text-xs md:text-sm text-green-600">{strength}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {match.weaknesses && match.weaknesses.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-orange-700 flex items-center gap-2 mb-2 text-sm md:text-base">
                                <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                                נקודות חולשה:
                              </h4>
                              <ul className="list-disc list-inside space-y-1">
                                {match.weaknesses.map((weakness, i) => (
                                  <li key={i} className="text-xs md:text-sm text-orange-600">{weakness}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {match.recommendation && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <h4 className="font-semibold text-blue-700 mb-1 text-sm md:text-base">המלצה:</h4>
                              <p className="text-xs md:text-sm text-blue-600">{match.recommendation}</p>
                            </div>
                          )}
                          {match.notes && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <h4 className="font-semibold text-gray-700 mb-1 text-sm md:text-base">הערות נוספות:</h4>
                              <p className="text-xs md:text-sm text-gray-600">{match.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="mt-6 flex justify-end">
            <Button onClick={saveMatches} disabled={selectedMatches.size === 0 || savingMatches || isAnySearchRunning}>
                 {savingMatches ? (
                    <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        שומר...
                    </>
                ) : (
                    <>
                        <UserCheck className="w-4 h-4 ml-2" />
                        שמור מועמדים נבחרים
                    </>
                )}
            </Button>
        </div>
      )}

      {!searching && results.length === 0 && !showAiResults && !showFoundJobsResults && (
        <div className="text-center py-8 md:py-12">
          <Users className="w-8 h-8 md:w-12 md:h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm md:text-base">בצע חיפוש כדי למצוא מועמדים מתאימים</p>
        </div>
      )}

      {/* Unsaved changes dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>שינויים שלא נשמרו</DialogTitle>
                  <DialogDescription>
                      בחרת מועמדים אך טרם שמרת אותם כהתאמה. אם תעזוב את הדף, הבחירות שלך יאבדו.
                      <br/>
                      האם אתה בטוח שברצונך לצאת?
                  </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 flex-row justify-end">
                  <Button variant="outline" onClick={() => setShowUnsavedDialog(false)}>
                      הישאר בעמוד
                  </Button>
                  <Button variant="destructive" onClick={() => {
                      setShowUnsavedDialog(false);
                      setSelectedMatches(new Set()); // Clear selections to allow navigation without further prompts
                  }}>
                      עזוב ללא שמירה
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}