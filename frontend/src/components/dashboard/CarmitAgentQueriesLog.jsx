import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AGENT_COLORS = {
  'naama': 'bg-orange-100 text-orange-800 border-orange-300',
  'dganit': 'bg-violet-100 text-violet-800 border-violet-300',
  'roee': 'bg-blue-100 text-blue-800 border-blue-300',
  'alik': 'bg-teal-100 text-teal-800 border-teal-300',
  'itay': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'lior': 'bg-amber-100 text-amber-800 border-amber-300',
  'ofir': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'rami': 'bg-red-100 text-red-800 border-red-300',
  'gc': 'bg-gray-100 text-gray-800 border-gray-300',
  'etgar': 'bg-orange-100 text-orange-800 border-orange-300'
};

export default function CarmitAgentQueriesLog() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadQueries = async () => {
    try {
      const [allQueries, allMatches, allRotemTasks] = await Promise.all([
        base44.entities.CarmitAgentQuery.list('-query_time', 200),
        base44.entities.Match.list('-created_date', 1000),
        base44.entities.RotemTask.list('-created_date', 500)
      ]);
      
      // Enrich queries with processing data
      const enrichedQueries = allQueries.map(query => {
        // Find matches from this query that were reviewed by Carmit
        const reviewedMatches = allMatches.filter(m => 
          m.user_name === query.agent_display_name &&
          m.carmit_reviewed_date &&
          new Date(m.carmit_reviewed_date) > new Date(query.query_time) &&
          new Date(m.carmit_reviewed_date) < new Date(new Date(query.query_time).getTime() + 60 * 60 * 1000) // within 1 hour
        );
        
        // Find Rotem tasks created from these matches
        const createdTasks = allRotemTasks.filter(task =>
          task.source === 'carmit' &&
          reviewedMatches.some(m => m.id === task.match_id)
        );
        
        // Count rejection reasons
        const rejectionReasons = {
          created_task: reviewedMatches.filter(m => m.carmit_decision === 'created_task').length,
          skipped_pipedrive: reviewedMatches.filter(m => m.carmit_decision === 'skipped_pipedrive').length,
          skipped_status: reviewedMatches.filter(m => m.carmit_decision === 'skipped_status').length,
          skipped_duplicate: reviewedMatches.filter(m => m.carmit_decision === 'skipped_duplicate').length
        };
        
        return {
          ...query,
          reviewedCount: reviewedMatches.length,
          tasksCreated: createdTasks.length,
          wasProcessed: reviewedMatches.length > 0,
          rejectionReasons
        };
      });
      
      setQueries(enrichedQueries);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading queries:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadQueries();
    // Refresh every 30 seconds
    const interval = setInterval(loadQueries, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setLoading(true);
    await loadQueries();
  };

  const handleClearLog = async () => {
    if (!confirm('למחוק את כל לוג השאילתות של כרמית?')) return;
    setLoading(true);
    try {
      for (const query of queries) {
        await base44.entities.CarmitAgentQuery.delete(query.id);
      }
      await loadQueries();
    } catch (error) {
      console.error('Error clearing queries:', error);
    }
  };

  const groupedByRun = queries.reduce((acc, query) => {
    if (!acc[query.carmit_run_id]) {
      acc[query.carmit_run_id] = [];
    }
    acc[query.carmit_run_id].push(query);
    return acc;
  }, {});

  const runs = Object.keys(groupedByRun).sort().reverse();

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between text-right">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            לוג שאילתות כרמית לסוכנים
          </h3>
          <p className="text-sm text-gray-600">
            מעקב אחר כל השאילתות שכרמית עושה לסוכנים הגיוס
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              עדכון: {lastUpdate.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' })}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearLog}
            disabled={loading || queries.length === 0}
            className="text-red-600 hover:text-red-700"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            נקה לוג
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManualRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {queries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">סה"כ ריצות</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{runs.length}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">סה"כ התאמות</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {queries.reduce((sum, q) => sum + (q.matches_count || 0), 0)}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">שאילתות אחרונות</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{queries.slice(0, 8).length}</p>
          </div>
        </div>
      )}

      {/* Queries by Run */}
      {loading && queries.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : queries.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">אין לוג שאילתות עדיין</p>
          <p className="text-sm text-gray-400 mt-2">כרמית תתחיל לשמור לוג מהריצה הבאה</p>
        </div>
      ) : (
        <div className="space-y-6">
          {runs.slice(0, 10).map((runId) => {
            const runQueries = groupedByRun[runId].sort((a, b) => 
              new Date(a.query_time) - new Date(b.query_time)
            );
            const runDate = new Date(runId);
            const totalMatches = runQueries.reduce((sum, q) => sum + (q.matches_count || 0), 0);
            const hasErrors = runQueries.some(q => !q.success);

            return (
              <div key={runId} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Run Header */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        ריצה מתאריך {runDate.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })} בשעה{' '}
                        {runDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {runQueries.length} סוכנים נשאלו • {totalMatches} התאמות נמצאו
                      </p>
                    </div>
                    {hasErrors && (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 ml-1" />
                        שגיאות
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Run Queries Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">זמן</TableHead>
                      <TableHead className="text-right">סוכן</TableHead>
                      <TableHead className="text-right">התאמות</TableHead>
                      <TableHead className="text-right">טופלו</TableHead>
                      <TableHead className="text-right">משימות</TableHead>
                      <TableHead className="text-right">החלטת כרמית</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">פרטים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runQueries.map((query) => (
                      <TableRow key={query.id}>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(query.query_time).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZone: 'Asia/Jerusalem'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={AGENT_COLORS[query.agent_name] || 'bg-gray-100 text-gray-800'}
                          >
                            {query.agent_display_name || query.agent_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${
                            query.matches_count > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {query.matches_count || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          {query.matches_count > 0 ? (
                            query.wasProcessed ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                                <CheckCircle className="w-3 h-3 ml-1" />
                                {query.reviewedCount}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                <Clock className="w-3 h-3 ml-1" />
                                ממתין
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {query.tasksCreated > 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 font-semibold">
                              {query.tasksCreated}
                            </Badge>
                          ) : query.matches_count > 0 && query.wasProcessed ? (
                            <span className="text-xs text-gray-500">0</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {query.rejectionReasons && query.wasProcessed ? (
                            <div className="flex flex-col gap-1 text-xs">
                              {query.rejectionReasons.created_task > 0 && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 justify-start">
                                  ✓ {query.rejectionReasons.created_task} נוצרו
                                </Badge>
                              )}
                              {query.rejectionReasons.skipped_pipedrive > 0 && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 justify-start">
                                  ⚠ {query.rejectionReasons.skipped_pipedrive} Pipedrive
                                </Badge>
                              )}
                              {query.rejectionReasons.skipped_status > 0 && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 justify-start">
                                  ✕ {query.rejectionReasons.skipped_status} סטטוס
                                </Badge>
                              )}
                              {query.rejectionReasons.skipped_duplicate > 0 && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300 justify-start">
                                  ⊕ {query.rejectionReasons.skipped_duplicate} כפילות
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {query.success ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              <CheckCircle className="w-3 h-3 ml-1" />
                              הצליח
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 ml-1" />
                              נכשל
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {query.matches_summary ? (
                            <div className="text-xs text-gray-600 max-w-md truncate" title={query.matches_summary}>
                              {query.matches_summary}
                            </div>
                          ) : query.error_message ? (
                            <div className="text-xs text-red-600">{query.error_message}</div>
                          ) : (
                            <span className="text-xs text-gray-400">אין התאמות</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}