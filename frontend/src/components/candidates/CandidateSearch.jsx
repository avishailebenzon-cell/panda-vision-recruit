import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { SearchLog } from "@/entities/SearchLog";
import { Match } from "@/entities/Match";
import { InvokeLLM, SendEmail, UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  UserCheck,
  Ban,
  BrainCircuit,
  Upload
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from 'react-markdown';
import { CandidateStatus } from "@/entities/CandidateStatus";
import { MatchNote } from "@/entities/MatchNote";
import { applySynonyms } from '@/functions/applySynonyms';

const securityClearanceLevels = ["רמה 1", "רמה 2", "רמה 3", "סווג נמוך", "ללא סווג"];

export default function CandidateSearch({ jobs: externalJobs, candidates: externalCandidates, currentUser }) {
  const [jobs, setJobs] = useState(externalJobs || []);
  const [candidates, setCandidates] = useState(externalCandidates || []);
  const [searchMode, setSearchMode] = useState("freetext");
  const [selectedJob, setSelectedJob] = useState("");
  const [freeTextDescription, setFreeTextDescription] = useState("");

  const [jobStatusFilter, setJobStatusFilter] = useState("פעילה");
  const [securityClearance, setSecurityClearance] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchRadius, setSearchRadius] = useState(25);

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [cleanupMessage, setCleanupMessage] = useState("");

  const [aiAgentRunning, setAiAgentRunning] = useState(false);
  const [aiAgentResults, setAiAgentResults] = useState(null);
  const [showAiResults, setShowAiResults] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [findingJobsForCandidate, setFindingJobsForCandidate] = useState(false);
  const [foundJobsResults, setFoundJobsResults] = useState(null);
  const [showFoundJobsResults, setShowFoundJobsResults] = useState(false);

  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [savingMatches, setSavingMatches] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [searchProgressText, setSearchProgressText] = useState("");
  const [appliedSynonyms, setAppliedSynonyms] = useState([]);

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

  const isAnySearchRunning = searching || aiAgentRunning || findingJobsForCandidate || expertSearchLoading;

  // Update data when props change
  useEffect(() => {
    if (externalJobs) setJobs(externalJobs);
  }, [externalJobs]);

  useEffect(() => {
    if (externalCandidates) setCandidates(externalCandidates);
  }, [externalCandidates]);

  useEffect(() => {
    if (searchMode === 'existing' && selectedJob) {
      const job = jobs.find(j => j.id === selectedJob);
      if (job) {
        setSearchLocation(job.location || "");
        setSecurityClearance(job.security_clearance || "");
      }
    }
  }, [selectedJob, searchMode, jobs]);

  const handleStopSearch = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setSearching(false);
    setAiAgentRunning(false);
    setFindingJobsForCandidate(false);
    setError("החיפוש בוטל על ידי המשתמש.");
    setSearchProgressText("");
  };

  const resetAllSearchResults = () => {
    setResults([]);
    setSelectedMatches(new Set());
    setAiAgentResults(null);
    setShowAiResults(false);
    setFoundJobsResults(null);
    setShowFoundJobsResults(false);
    setError("");
    setSearchProgressText("");
    setAppliedSynonyms([]);
  };

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

  // Check user permissions
  const canUseExistingJob = currentUser?.search_can_use_existing_job;
  const canFindJobsForCandidate = currentUser?.search_can_find_jobs_for_candidate;
  const canUseLevel1Agent = currentUser?.search_can_use_level1_agent;
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
    if (currentUser?.app_role === 'client') {
      const allUsers = await User.list();
      const notificationRecipients = allUsers.filter(u => u.receives_match_notifications);
      if (notificationRecipients.length === 0) return;

      const matchesSummary = newMatches.map(match => `- מועמד: ${match.candidate_name}\n- משרה: ${match.job_title}`).join('\n');
      const subject = `[PandaRecruitAI] ${newMatches.length} התאמות חדשות נרשמו במערכת`;
      const body = `שלום,\n\n${newMatches.length} התאמות חדשות נרשמו במערכת על ידי ${currentUser.full_name}.\n\nפרטי ההתאמות:\n${matchesSummary}\n\nבברכה,\nמערכת PandaRecruitAI`;

      for (const recipient of notificationRecipients) {
        await SendEmail({ to: recipient.email, subject, body, from_name: 'PandaRecruitAI System' });
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
      let jobInfo = null;
      if (searchMode === "existing" && selectedJob) {
        jobInfo = jobs.find(j => j.id === selectedJob);
      }

      const initialStatuses = await CandidateStatus.filter({ status_number: 1 });
      if (initialStatuses.length === 0) {
        setError("שגיאה: לא הוגדר סטטוס התחלתי למכונת המצבים.");
        setSavingMatches(false);
        return;
      }
      const initialStatus = initialStatuses[0];
      const existingMatches = await Match.list();
      
      const matchesToCreate = [];
      const duplicateMatches = [];
      
      for (const candidateId of selectedMatches) {
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate) {
          const candidateName = `${candidate.first_name} ${candidate.last_name}`;
          const isDuplicate = existingMatches.some(existingMatch => {
            const sameCandidateId = existingMatch.candidate_id === candidateId;
            if (searchMode === "existing" && jobInfo) {
              return sameCandidateId && existingMatch.job_id === jobInfo.id;
            } else {
              return sameCandidateId && existingMatch.free_text_query === freeTextDescription;
            }
          });
          
          if (isDuplicate) {
            duplicateMatches.push(candidateName);
          } else {
            matchesToCreate.push({
              job_id: jobInfo?.id || null,
              job_title: jobInfo?.title || (searchMode === 'freetext' ? "חיפוש טקסט חופשי" : null),
              free_text_query: searchMode === 'freetext' ? freeTextDescription : null,
              candidate_id: candidate.id,
              candidate_name: candidateName,
              user_id: currentUser.id,
              user_name: currentUser.full_name,
              user_app_role: currentUser.app_role || 'N/A',
              status: initialStatus.status_name,
              status_number: initialStatus.status_number,
              is_read: false
            });
          }
        }
      }

      if (duplicateMatches.length > 0) {
        const duplicateMessage = duplicateMatches.length === 1 
          ? `המועמד ${duplicateMatches[0]} כבר נשמר עם התאמה זו.`
          : `המועמדים הבאים כבר נשמרו: ${duplicateMatches.join(', ')}.`;
        
        if (matchesToCreate.length === 0) {
          setError(duplicateMessage);
          setSavingMatches(false);
          return;
        } else {
          setCleanupMessage(duplicateMessage + ` נשמרו ${matchesToCreate.length} התאמות חדשות.`);
        }
      }

      if (matchesToCreate.length > 0) {
        const createdMatches = await Match.bulkCreate(matchesToCreate);
        for (const newMatch of createdMatches) {
          await MatchNote.create({
            match_id: newMatch.id,
            user_id: currentUser.id,
            user_name: currentUser.full_name,
            note_text: `התאמה נוצרה על ידי ${currentUser.full_name}.`,
            is_system_note: true
          });
        }
        await notifyAdminsOfNewMatches(matchesToCreate, jobInfo);
        if (duplicateMatches.length === 0) {
          setCleanupMessage(`נשמרו ${matchesToCreate.length} התאמות חדשות בהצלחה!`);
        }
      }
      
      setTimeout(() => setCleanupMessage(""), 7000);
      setSelectedMatches(new Set());
      setResults([]);

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
    resetAllSearchResults();

    const controller = new AbortController();
    setAbortController(controller);
    setSearchProgressText("מפעיל סוכן AI (רמה 1)...");

    try {
      let jobInfo;
      if (searchMode === "existing") {
        jobInfo = jobs.find(j => j.id === selectedJob);
      } else {
        jobInfo = { title: "משרה לפי תיאור חופשי", description: freeTextDescription, requirements: freeTextDescription };
      }

      const enhancedQuery = await enhanceSearchText(freeTextDescription);
      setSearchProgressText("מתחבר לסוכן AI...");
      
      let conversation;
      try {
        const existingConversations = await base44.agents.listConversations({ agent_name: "level1_specialist" });
        if (existingConversations && existingConversations.length > 0) {
          conversation = await base44.agents.getConversation(existingConversations[0].id);
        } else {
          conversation = await base44.agents.createConversation({
            agent_name: "level1_specialist",
            metadata: { name: `חיפוש רמה 1: ${jobInfo.title}` }
          });
        }
      } catch (convError) {
        conversation = await base44.agents.createConversation({
          agent_name: "level1_specialist",
          metadata: { name: `חיפוש רמה 1: ${jobInfo.title}` }
        });
      }

      const agentPrompt = `אני זקוק לניתוח מתקדם של מועמדים בעלי סיווג בטחוני רמה 1 עבור המשרה:\n- כותרת: ${jobInfo.title}\n- תיאור: ${jobInfo.description}\n- דרישות: ${jobInfo.requirements}\n\nתיאור מורחב: ${enhancedQuery}`;

      setSearchProgressText("שולח בקשה לסוכן AI...");
      await base44.agents.addMessage(conversation, { role: "user", content: agentPrompt });

      setSearchProgressText("ממתין לתגובת סוכן AI...");
      const waitForResponse = new Promise((resolve, reject) => {
        let responseReceived = false;
        let unsubscribe = () => {};

        const timeout = setTimeout(() => {
          if (!responseReceived) { unsubscribe(); reject(new Error("Timeout")); }
        }, 300000);

        const checkAborted = setInterval(() => {
          if (controller.signal.aborted) {
            clearTimeout(timeout); unsubscribe(); clearInterval(checkAborted);
            reject(new Error("Agent stopped by user."));
          }
        }, 500);

        unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
          if (!responseReceived && data.messages && data.messages.length > 0) {
            const lastMessage = data.messages[data.messages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
              responseReceived = true;
              clearTimeout(timeout); clearInterval(checkAborted); unsubscribe();
              resolve(lastMessage.content);
            }
          }
        });
      });

      const finalResponse = await waitForResponse;
      if (controller.signal.aborted) return;

      if (finalResponse) {
        setAiAgentResults({ analysis: finalResponse, conversationId: conversation.id, jobTitle: jobInfo.title });
        setShowAiResults(true);
        setSearchProgressText("ניתוח סוכן AI הושלם.");
      } else {
        setError("הסוכן לא החזיר תגובה תקינה.");
      }
    } catch (error) {
      console.error("Error running Level 1 agent:", error);
      if (controller.signal.aborted) {
        setError("החיפוש בוטל על ידי המשתמש.");
      } else {
        setError(`שגיאה בהפעלת הסוכן: ${error.message}`);
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
      if (!candidateInfo) throw new Error("Candidate not found");

      setSearchProgressText("אוסף משרות פעילות...");
      const activeJobs = jobs.filter(job => job.status === "פעילה").slice(0, 40);

      if (activeJobs.length === 0) {
        setError("לא נמצאו משרות פעילות במערכת.");
        setFindingJobsForCandidate(false);
        return;
      }

      const jobsContext = activeJobs.map(job => `- ID: ${job.id}\n- Title: ${job.title}\n- Description: ${job.description?.substring(0, 250) || 'N/A'}`).join('\n');

      setSearchProgressText("שולח נתונים לניתוח AI...");
      const prompt = `מצא משרות מתאימות למועמד:\n- שם: ${candidateInfo.first_name} ${candidateInfo.last_name}\n- סיווג: ${candidateInfo.security_clearance || 'לא צוין'}\n- כישורים: ${candidateInfo.skills_summary || 'לא צוין'}\n\nמשרות זמינות:\n${jobsContext}`;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
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
                  recommendation: { type: "string" }
                }
              }
            }
          }
        },
        add_context_from_internet: false
      });
      
      if (controller.signal.aborted) return;

      if (result?.recommended_jobs) {
        setFoundJobsResults({ analysis: result.recommended_jobs, candidateName: `${candidateInfo.first_name} ${candidateInfo.last_name}` });
        setShowFoundJobsResults(true);
      } else {
        setError("החיפוש לא החזיר תוצאות.");
      }
    } catch (error) {
      console.error("Error finding jobs:", error);
      setError(`שגיאה באיתור משרות: ${error.message}`);
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
    resetAllSearchResults();

    const controller = new AbortController();
    setAbortController(controller);

    try {
      setSearchProgressText("מסנן מועמדים רלוונטיים...");

      let relevantCandidates = [...candidates];
      if (securityClearance && securityClearance !== 'all') {
        relevantCandidates = relevantCandidates.filter(c => c.security_clearance === securityClearance);
      }

      setSearchProgressText("מרחיב את החיפוש עם מילים נרדפות...");

      let jobInfoForPrompt, descriptionForPrompt, requirementsForPrompt;

      if (searchMode === "existing") {
        jobInfoForPrompt = jobs.find(j => j.id === selectedJob);
        descriptionForPrompt = await enhanceSearchText(jobInfoForPrompt?.description || '');
        requirementsForPrompt = await enhanceSearchText(jobInfoForPrompt?.requirements || '');
      } else {
        jobInfoForPrompt = { title: "משרה לפי תיאור חופשי", description: freeTextDescription, requirements: freeTextDescription };
        descriptionForPrompt = await enhanceSearchText(freeTextDescription);
        requirementsForPrompt = descriptionForPrompt;
      }

      const jobTextCombined = (descriptionForPrompt + " " + requirementsForPrompt).toLowerCase();
      const jobKeywords = jobTextCombined.match(/\b(\w{3,})\b/g) || [];
      const uniqueKeywords = [...new Set(jobKeywords)];

      if (uniqueKeywords.length > 0) {
        relevantCandidates = relevantCandidates.map(candidate => {
          const candidateText = (candidate.skills_summary || "") + " " + (candidate.full_text || "");
          let score = 0;
          uniqueKeywords.forEach(keyword => { if (candidateText.toLowerCase().includes(keyword)) score++; });
          return { ...candidate, relevanceScore: score };
        }).filter(c => c.relevanceScore > 0).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 30);
      } else {
        relevantCandidates = relevantCandidates.slice(0, 30);
      }

      if (relevantCandidates.length === 0) {
        setError("לא נמצאו מועמדים התואמים לסינון הראשוני.");
        setSearching(false);
        return;
      }

      setSearchProgressText(`שולח ${relevantCandidates.length} מועמדים לניתוח AI...`);

      const candidateContext = relevantCandidates.map((c, idx) => `${idx + 1}. ${c.first_name} ${c.last_name} - ${c.skills_summary || 'לא צוין'}`).join('\n');

      const analysisPrompt = `נתח מועמדים להתאמה למשרה:\n- כותרת: ${jobInfoForPrompt?.title}\n- תיאור: ${descriptionForPrompt}\n\nמועמדים:\n${candidateContext}`;

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
                  recommendation: { type: "string" }
                }
              }
            }
          }
        },
        add_context_from_internet: false
      });
      
      if (controller.signal.aborted) return;

      const wasSuccessful = result?.matches && result.matches.length > 0;

      await SearchLog.create({
        user_email: currentUser.email,
        search_mode: searchMode,
        job_id: searchMode === 'existing' ? selectedJob : null,
        free_text_query: searchMode === 'freetext' ? freeTextDescription.substring(0, 200) : null,
        results_count: wasSuccessful ? result.matches.length : 0,
        was_successful: wasSuccessful,
      });

      if (wasSuccessful) {
        const minScore = searchMode === "existing" ? 80 : 40;
        const sortedMatches = result.matches.filter(m => m.match_score >= minScore).sort((a, b) => b.match_score - a.match_score);
        setResults(sortedMatches);
        if (sortedMatches.length === 0) {
          setError("לא נמצאו מועמדים העונים על הקריטריונים.");
        }
      } else {
        setResults([]);
        setError("החיפוש לא הניב תוצאות מתאימות.");
      }
    } catch (error) {
      console.error("Error performing search:", error);
      setError("שגיאה בביצוע החיפוש.");
    } finally {
      setSearching(false);
      setSearchProgressText("");
      setAbortController(null);
    }
  };

  const filteredJobs = jobs.filter(job => jobStatusFilter === "all" || job.status === jobStatusFilter);
  const levelOneCandidates = candidates.filter(c => c.security_clearance === "רמה 1");

  // Expert Search handlers (simplified)
  const handleExpertFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowedTypes.includes(file.type)) {
      setError('יש להעלות קובץ PDF או Word בלבד');
      return;
    }

    setIsExpertUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setExpertUploadedFile({ name: file.name, url: file_url });
      
      setIsExpertUploading(false);
      setIsExpertExtracting(true);

      const extractionResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: { type: "object", properties: { full_text: { type: "string" } } }
      });

      if (extractionResult.status === "success" && extractionResult.output?.full_text) {
        setExpertResumeText(extractionResult.output.full_text);
        setExpertInputMode('file');
      } else {
        throw new Error('לא ניתן לחלץ טקסט מהקובץ');
      }
    } catch (error) {
      setError('שגיאה בעיבוד הקובץ');
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
  };

  const getExpertScoreColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const runExpertSearch = async () => {
    if (!expertResumeText.trim()) {
      setError('אנא הדבק קורות חיים או העלה קובץ.');
      return;
    }
    
    setExpertSearchLoading(true);
    setError('');
    setExpertResults(null);
    setExpertAgentProgress('מנתח קורות חיים...');

    try {
      let conversation;
      try {
        const existingConversations = await base44.agents.listConversations({ agent_name: 'recruitment_specialist' });
        if (existingConversations && existingConversations.length > 0) {
          conversation = await base44.agents.getConversation(existingConversations[0].id);
        } else {
          conversation = await base44.agents.createConversation({ agent_name: 'recruitment_specialist', metadata: { name: `ניתוח מועמד` } });
        }
      } catch (convError) {
        conversation = await base44.agents.createConversation({ agent_name: 'recruitment_specialist', metadata: { name: `ניתוח מועמד` } });
      }

      await base44.agents.addMessage(conversation, { role: 'user', content: `נתח את קורות החיים:\n\n${expertResumeText}` });

      const waitForResponse = new Promise((resolve, reject) => {
        const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
          const lastMessage = data.messages[data.messages.length - 1];
          if (lastMessage?.role === 'assistant' && lastMessage.content) {
            try {
              const jsonMatch = lastMessage.content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.matches) { unsubscribe(); resolve(jsonMatch[0]); }
              }
            } catch (e) {}
          }
        });
        setTimeout(() => { unsubscribe(); reject(new Error("Timeout")); }, 300000);
      });

      const response = await waitForResponse;
      const parsedResponse = JSON.parse(response);
      setExpertResults(parsedResponse);
    } catch (e) {
      setError(`שגיאה בהפעלת הסוכן: ${e.message}`);
    } finally {
      setExpertSearchLoading(false);
      setExpertAgentProgress('');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isAnySearchRunning && searchProgressText && (
        <Alert className="bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-700 font-medium">{searchProgressText}</AlertDescription>
          </div>
        </Alert>
      )}

      {cleanupMessage && <Alert><AlertDescription>{cleanupMessage}</AlertDescription></Alert>}

      {appliedSynonyms.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">מילים נרדפות שיושמו:</h3>
          <div className="flex flex-wrap gap-2">
            {appliedSynonyms.map((synonym, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-700">
                {synonym.original} → {synonym.synonym}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search Mode Selection */}
      <Card>
        <CardHeader><CardTitle>בחר סוג חיפוש</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {canUseExistingJob && (
              <Card 
                className={`cursor-pointer border-2 transition-colors ${searchMode === "existing" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
                onClick={() => !isAnySearchRunning && setSearchMode("existing")}
              >
                <CardContent className="p-3 text-center">
                  <Briefcase className="mx-auto h-6 w-6 text-blue-600 mb-1" />
                  <h3 className="font-semibold text-sm">משרה קיימת</h3>
                </CardContent>
              </Card>
            )}

            <Card 
              className={`cursor-pointer border-2 transition-colors ${searchMode === "freetext" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
              onClick={() => !isAnySearchRunning && setSearchMode("freetext")}
            >
              <CardContent className="p-3 text-center">
                <FileText className="mx-auto h-6 w-6 text-green-600 mb-1" />
                <h3 className="font-semibold text-sm">תיאור חופשי</h3>
              </CardContent>
            </Card>

            {canFindJobsForCandidate && (
              <Card 
                className={`cursor-pointer border-2 transition-colors ${searchMode === "jobs_for_candidate" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
                onClick={() => !isAnySearchRunning && setSearchMode("jobs_for_candidate")}
              >
                <CardContent className="p-3 text-center">
                  <UserSearch className="mx-auto h-6 w-6 text-purple-600 mb-1" />
                  <h3 className="font-semibold text-sm">משרות למועמד</h3>
                </CardContent>
              </Card>
            )}

            {canUseExpertSearch && (
              <Card 
                className={`cursor-pointer border-2 transition-colors ${searchMode === "expert" ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300"}`}
                onClick={() => !isAnySearchRunning && setSearchMode("expert")}
              >
                <CardContent className="p-3 text-center">
                  <BrainCircuit className="mx-auto h-6 w-6 text-purple-600 mb-1" />
                  <h3 className="font-semibold text-sm">חיפוש מומחה</h3>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Existing Job Search */}
      {searchMode === "existing" && canUseExistingJob && (
        <Card>
          <CardHeader><CardTitle>חיפוש למשרה קיימת</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">סנן משרות</Label>
                <Select value={jobStatusFilter} onValueChange={setJobStatusFilter} disabled={isAnySearchRunning}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="פעילה">פעילות</SelectItem>
                    <SelectItem value="all">הכל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">בחר משרה</Label>
                <Select value={selectedJob} onValueChange={setSelectedJob} disabled={isAnySearchRunning}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="בחר משרה..." /></SelectTrigger>
                  <SelectContent>
                    {filteredJobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>{job.title} - {job.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Free Text Search */}
      {searchMode === "freetext" && (
        <Card>
          <CardHeader><CardTitle>חיפוש לפי תיאור חופשי</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              placeholder="הדבק או כתב כאן את תיאור המשרה..."
              value={freeTextDescription}
              onChange={(e) => setFreeTextDescription(e.target.value)}
              rows={4}
              disabled={isAnySearchRunning}
            />
          </CardContent>
        </Card>
      )}

      {/* Jobs for Candidate */}
      {searchMode === "jobs_for_candidate" && canFindJobsForCandidate && (
        <Card>
          <CardHeader><CardTitle>איתור משרות למועמד</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedCandidate} onValueChange={setSelectedCandidate} disabled={isAnySearchRunning}>
              <SelectTrigger><SelectValue placeholder="בחר מועמד..." /></SelectTrigger>
              <SelectContent>
                {levelOneCandidates.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={findJobsForCandidate} disabled={isAnySearchRunning || !selectedCandidate} className="w-full bg-teal-600 hover:bg-teal-700">
              {findingJobsForCandidate ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מאתר...</> : <><UserSearch className="w-4 h-4 ml-2" />מצא משרות</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expert Search */}
      {searchMode === "expert" && canUseExpertSearch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-purple-600" />חיפוש מומחה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              {expertUploadedFile ? (
                <div className="flex items-center justify-between bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-green-600" />
                    <div><div className="font-medium">{expertUploadedFile.name}</div></div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearExpertFile}><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleExpertFileUpload} className="hidden" id="expert-file" disabled={isExpertUploading} />
                  <Button variant="outline" onClick={() => document.getElementById('expert-file').click()} disabled={isExpertUploading}>
                    {isExpertUploading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעלה...</> : "בחר קובץ"}
                  </Button>
                </div>
              )}
            </div>
            <Textarea value={expertResumeText} onChange={(e) => setExpertResumeText(e.target.value)} placeholder="הדבק טקסט קו״ח..." rows={8} disabled={expertSearchLoading} />
            <Button onClick={runExpertSearch} disabled={expertSearchLoading || !expertResumeText.trim()} className="w-full bg-purple-600 hover:bg-purple-700">
              {expertSearchLoading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />{expertAgentProgress}</> : <><BrainCircuit className="w-4 h-4 ml-2" />הפעל סוכן</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expert Results */}
      {searchMode === "expert" && expertResults && (
        <Card>
          <CardHeader><CardTitle>תוצאות ניתוח</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expertResults.matches?.sort((a, b) => b.match_score - a.match_score).map(match => (
                <div key={match.job_id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{match.job_title}</span>
                    <Badge className={getExpertScoreColor(match.match_score)}>{match.match_score}%</Badge>
                  </div>
                  {match.strengths?.length > 0 && <p className="text-sm text-green-700">{match.strengths.join(', ')}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Filters and Actions */}
      {(searchMode === "existing" || searchMode === "freetext") && (
        <Card>
          <CardHeader><CardTitle>מסננים ופעולות</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {canSeeAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs"><Shield className="w-3 h-3 inline ml-1" />סיווג בטחוני</Label>
                  <Select value={securityClearance} onValueChange={setSecurityClearance} disabled={isAnySearchRunning}>
                    <SelectTrigger><SelectValue placeholder="בחר סיווג" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {securityClearanceLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs"><MapPin className="w-3 h-3 inline ml-1" />מיקום</Label>
                  <Input value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} placeholder="תל אביב" disabled={isAnySearchRunning} />
                </div>
                <div>
                  <Label className="text-xs"><CircleDot className="w-3 h-3 inline ml-1" />רדיוס (ק"מ)</Label>
                  <Input type="number" value={searchRadius} onChange={(e) => setSearchRadius(Number(e.target.value))} disabled={isAnySearchRunning} />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={performSearch} disabled={isAnySearchRunning} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {searching ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מחפש...</> : <><SearchIcon className="w-4 h-4 ml-2" />חפש מועמדים</>}
              </Button>

              {canUseLevel1Agent && (
                <Button onClick={runLevel1Agent} disabled={isAnySearchRunning} variant="outline" className="flex-1 border-purple-600 text-purple-600">
                  {aiAgentRunning ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />פועל...</> : <><Star className="w-4 h-4 ml-2" />סוכן רמה 1</>}
                </Button>
              )}

              {isAnySearchRunning && (
                <Button onClick={handleStopSearch} variant="destructive" className="flex-1">
                  <Ban className="w-4 h-4 ml-2" />עצור
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Found Jobs Results */}
      {showFoundJobsResults && foundJobsResults && (
        <Card className="border-teal-200 bg-teal-50">
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle className="text-teal-800"><UserSearch className="w-5 h-5 inline ml-2" />הצעות משרה עבור {foundJobsResults.candidateName}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowFoundJobsResults(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {foundJobsResults.analysis.sort((a, b) => b.match_score - a.match_score).map(job => (
              <Card key={job.job_id} className="bg-white">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{job.job_title}</h4>
                    <Badge className={getExpertScoreColor(job.match_score)}>{job.match_score}%</Badge>
                  </div>
                  <p className="text-sm text-green-700">{job.strengths}</p>
                  {job.recommendation && <p className="text-sm text-blue-700 mt-2">{job.recommendation}</p>}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Agent Results */}
      {showAiResults && aiAgentResults && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle className="text-purple-800"><Star className="w-5 h-5 inline ml-2" />ניתוח סוכן AI - {aiAgentResults.jobTitle}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAiResults(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded-lg p-4 prose prose-sm max-w-none">
              <ReactMarkdown>{aiAgentResults.analysis}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>תוצאות החיפוש ({results.length} מועמדים)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {results.map((match, index) => {
                const candidate = candidates.find(c => `${c.first_name} ${c.last_name}`.trim() === match.candidate_name.trim());
                const isSelected = selectedMatches.has(candidate?.id);

                return (
                  <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className={`border-r-4 border-r-blue-500 ${isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''}`}>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={isSelected} onChange={() => handleMatchSelection(match.candidate_name, candidate?.id)} className="w-5 h-5" disabled={isAnySearchRunning} />
                            <CardTitle className="text-base">{match.candidate_name}</CardTitle>
                          </div>
                          <Badge className={match.match_score >= 80 ? 'bg-green-100 text-green-800' : match.match_score >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                            {match.match_score}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {match.strengths?.length > 0 && (
                          <div><span className="font-semibold text-green-700 text-sm">חוזקות:</span> <span className="text-sm text-green-600">{match.strengths.join(', ')}</span></div>
                        )}
                        {match.weaknesses?.length > 0 && (
                          <div><span className="font-semibold text-orange-700 text-sm">חולשות:</span> <span className="text-sm text-orange-600">{match.weaknesses.join(', ')}</span></div>
                        )}
                        {match.recommendation && (
                          <div className="bg-blue-50 p-2 rounded"><span className="font-semibold text-blue-700 text-sm">המלצה:</span> <span className="text-sm text-blue-600">{match.recommendation}</span></div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {results.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={saveMatches} disabled={selectedMatches.size === 0 || savingMatches || isAnySearchRunning}>
            {savingMatches ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />שומר...</> : <><UserCheck className="w-4 h-4 ml-2" />שמור נבחרים ({selectedMatches.size})</>}
          </Button>
        </div>
      )}

      {!searching && results.length === 0 && !showAiResults && !showFoundJobsResults && !expertResults && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">בצע חיפוש כדי למצוא מועמדים</p>
        </div>
      )}
    </div>
  );
}