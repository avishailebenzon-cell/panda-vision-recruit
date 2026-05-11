import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { enhanceCandidateCv } from '@/functions/enhanceCandidateCv';
import { enhanceCandidatesBatch } from '@/functions/enhanceCandidatesBatch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  TrendingUp,
  AlertCircle,
  FileText,
  Zap,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

export default function CvEnhancementManager() {
  const [candidates, setCandidates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentBatch, setCurrentBatch] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sessionId, setSessionId] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [candidateList, logList] = await Promise.all([
        base44.entities.Candidate.list('-created_date', 500),
        base44.entities.CvEnhancementLog.list('-created_date', 100)
      ]);
      setCandidates(candidateList);
      setLogs(logList);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('שגיאה בטעינת נתונים');
    }
    setLoading(false);
  };

  // Check for ongoing background processing and restore state
  const checkBackgroundProcessing = async () => {
    try {
      const recentLogs = await base44.entities.CvEnhancementLog.filter(
        { status: 'processing' },
        '-created_date',
        50
      );
      
      if (recentLogs.length > 0) {
        // Find active session
        const activeSessions = {};
        recentLogs.forEach(log => {
          if (log.session_id) {
            activeSessions[log.session_id] = (activeSessions[log.session_id] || 0) + 1;
          }
        });
        
        // Get the most recent session with processing items
        const activeSessionId = Object.keys(activeSessions)[0];
        if (activeSessionId) {
          // Count total and processed in this session
          const sessionLogs = await base44.entities.CvEnhancementLog.filter({
            session_id: activeSessionId
          });
          
          const total = sessionLogs.length;
          const processed = sessionLogs.filter(l => l.status === 'success').length;
          
          setSessionId(activeSessionId);
          setProcessing(true);
          setProgress({ current: processed, total });
          
          toast.info(`שחזור תהליך פעיל - ${processed}/${total} מועמדים עובדו`);
        }
      }
    } catch (error) {
      console.error('Error checking background processing:', error);
    }
  };

  useEffect(() => {
    loadData();
    checkBackgroundProcessing();
    
    // Poll for updates every 10 seconds when processing
    const interval = setInterval(() => {
      if (processing && sessionId) {
        checkSessionProgress();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const checkSessionProgress = async () => {
    if (!sessionId) return;
    
    try {
      const sessionLogs = await base44.entities.CvEnhancementLog.filter({
        session_id: sessionId
      });
      
      const total = sessionLogs.length;
      const processed = sessionLogs.filter(l => l.status === 'success' || l.status === 'failed').length;
      
      setProgress({ current: processed, total });
      
      // If all done, stop processing
      if (processed >= total) {
        setProcessing(false);
        setSessionId(null);
        toast.success(`תהליך הושלם! ${processed} מועמדים עובדו`);
        await loadData();
      }
    } catch (error) {
      console.error('Error checking session progress:', error);
    }
  };

  const getLogForCandidate = (candidateId) => {
    return logs.find(l => l.candidate_id === candidateId && l.status !== 'failed');
  };

  const handleEnhanceSingle = async (candidateId, forceReprocess = false) => {
    setProcessing(true);
    try {
      const result = await enhanceCandidateCv({ 
        candidate_id: candidateId,
        force_reprocess: forceReprocess
      });
      
      if (result.data?.success) {
        if (result.data?.skipped) {
          toast.info('המועמד כבר הושבח קודם לכן');
        } else {
          toast.success('קורות החיים הושבחו בהצלחה');
        }
        await loadData();
      } else {
        toast.error(result.data?.error || 'שגיאה בהשבחה');
      }
    } catch (error) {
      console.error('Error enhancing CV:', error);
      toast.error('שגיאה בהשבחת קורות החיים');
    }
    setProcessing(false);
  };

  const handleEnhanceBatch = async (candidateIds) => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setProcessing(true);
    setProgress({ current: 0, total: candidateIds.length });

    // Start background processing loop
    const processInBackground = async () => {
      let remainingIds = [...candidateIds];
      let totalProcessed = 0;
      let iterationCount = 0;
      const maxIterations = 100;

      while (remainingIds.length > 0 && iterationCount < maxIterations) {
        iterationCount++;
        
        try {
          const result = await enhanceCandidatesBatch({
            candidate_ids: remainingIds,
            session_id: newSessionId
          });

          if (result.data?.results) {
            totalProcessed += result.data.results.processed;
            setProgress({ current: totalProcessed, total: candidateIds.length });

            if (result.data.hasMore && remainingIds.length > result.data.results.processed) {
              remainingIds = remainingIds.slice(result.data.results.processed);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              remainingIds = [];
            }
          } else {
            break;
          }
        } catch (error) {
          console.error('Batch error:', error);
          break;
        }
      }

      setProcessing(false);
      setSelectedCandidates(new Set());
      toast.success(`הושלם! ${totalProcessed} מועמדים עובדו ב-${iterationCount} ריצות`);
      await loadData();
    };

    // Run in background
    processInBackground();
  };

  const handleEnhanceAll = async () => {
    const candidatesToEnhance = candidates
      .filter(c => !getLogForCandidate(c.id) || c.cv_enhancement_version === 0)
      .map(c => c.id);

    if (candidatesToEnhance.length === 0) {
      toast.info('כל המועמדים כבר הושבחו');
      return;
    }

    await handleEnhanceBatch(candidatesToEnhance);
  };

  const handleEnhanceSelected = async () => {
    if (selectedCandidates.size === 0) {
      toast.info('לא נבחרו מועמדים');
      return;
    }

    await handleEnhanceBatch(Array.from(selectedCandidates));
  };

  const toggleCandidateSelection = (candidateId) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };

  const filteredCandidates = candidates.filter(c => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(searchLower) ||
      c.first_name?.toLowerCase().includes(searchLower) ||
      c.last_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: candidates.length,
    enhanced: candidates.filter(c => c.cv_enhancement_version > 0).length,
    notEnhanced: candidates.filter(c => !c.cv_enhancement_version || c.cv_enhancement_version === 0).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <span>מודול השבחת קורות חיים</span>
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            השבחה אוטומטית של קורות חיים קיימים להפקת מידע מובנה ועמוק לשיפור דיוק חיפוש הסוכנים
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">סה"כ מועמדים</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">הושבחו</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.enhanced}</div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <span className="text-sm text-gray-600">ממתינים</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{stats.notEnhanced}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">פעולות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleEnhanceAll}
              disabled={processing || stats.notEnhanced === 0}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              השבח את כל המועמדים שטרם עובדו ({stats.notEnhanced})
            </Button>
            <Button
              onClick={handleEnhanceSelected}
              disabled={processing || selectedCandidates.size === 0}
              variant="outline"
              className="gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              השבח מועמדים נבחרים ({selectedCandidates.size})
            </Button>
            <Button
              onClick={loadData}
              disabled={processing}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              רענן
            </Button>
          </div>

          {processing && (
            <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>תהליך השבחה פעיל ברקע - מריץ רצף אוטומטי</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>התקדמות:</span>
                <span className="font-bold">{progress.current} / {progress.total}</span>
              </div>
              <Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} className="h-2" />
              <p className="text-xs text-gray-600">
                התהליך ממשיך ברקע עד סיום כל המועמדים. ניתן לצאת מהמסך - התהליך ימשיך ברקע.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="חיפוש מועמד..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Candidates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>רשימת מועמדים</span>
            <Badge variant="outline">{filteredCandidates.length} מועמדים</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredCandidates.map(candidate => {
                const log = getLogForCandidate(candidate.id);
                const isEnhanced = candidate.cv_enhancement_version > 0;
                const isSelected = selectedCandidates.has(candidate.id);

                return (
                  <div
                    key={candidate.id}
                    className={`p-3 border rounded-lg transition-all ${
                      isSelected ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCandidateSelection(candidate.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {candidate.full_name || `${candidate.first_name} ${candidate.last_name}`}
                            </span>
                            {isEnhanced ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <CheckCircle className="w-3 h-3 ml-1" />
                                הושבח (v{candidate.cv_enhancement_version})
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">
                                <AlertCircle className="w-3 h-3 ml-1" />
                                ממתין
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {candidate.main_discipline && (
                              <span className="ml-3">📋 {candidate.main_discipline}</span>
                            )}
                            {candidate.overall_seniority_level && (
                              <span className="ml-3">⭐ {candidate.overall_seniority_level}</span>
                            )}
                            {candidate.overall_years_of_experience && (
                              <span className="ml-3">🕐 {candidate.overall_years_of_experience} שנים</span>
                            )}
                          </div>
                          {candidate.ui_summary && (() => {
                            try {
                              const summary = JSON.parse(candidate.ui_summary);
                              return (
                                <div className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                                  <div className="font-medium">{summary.short_title}</div>
                                </div>
                              );
                            } catch {
                              return null;
                            }
                          })()}
                          {log?.error_message && (
                            <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
                              ⚠️ {log.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {candidate.resume_file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(candidate.resume_file_url, '_blank')}
                            title="צפה בקורות חיים"
                          >
                            <FileText className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnhanceSingle(candidate.id, isEnhanced)}
                          disabled={processing}
                          className="gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          {isEnhanced ? 'רענן' : 'השבח'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            לוג פעולות אחרונות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {logs.slice(0, 20).map(log => (
                <div
                  key={log.id}
                  className={`p-2 rounded border text-sm ${
                    log.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : log.status === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : log.status === 'processing'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{log.candidate_name || log.candidate_id}</span>
                    <div className="flex items-center gap-2">
                      {log.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                      {log.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                      {log.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_date).toLocaleString('he-IL')}
                      </span>
                    </div>
                  </div>
                  {log.error_message && (
                    <div className="text-xs text-red-600 mt-1">{log.error_message}</div>
                  )}
                  {log.enhanced_fields_count > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      {log.enhanced_fields_count} שדות עודכנו
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}