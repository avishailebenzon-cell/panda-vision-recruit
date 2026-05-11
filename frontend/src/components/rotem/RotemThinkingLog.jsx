import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, RefreshCw, Loader2, MessageCircle, Briefcase, FileText, CheckCircle, XCircle, Search, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RotemThinkingLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const logsList = await base44.entities.RotemThinkingLog.list('-created_date', 5);
      setLogs(logsList);
    } catch (error) {
      console.error("Error loading thinking logs:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const stepLabels = {
    "understanding_needs": "הבנת צרכי המועמד",
    "finding_job": "חיפוש משרה מתאימה",
    "presenting_job": "הצגת המשרה למועמד",
    "sending_form": "שליחת טופס למועמד",
    "creating_task": "יצירת משימה פנימית",
    "no_suitable_job_found": "לא נמצאה משרה מתאימה",
    "error": "שגיאה"
  };

  const stepIcons = {
    "understanding_needs": MessageCircle,
    "finding_job": Search,
    "presenting_job": Briefcase,
    "sending_form": FileText,
    "creating_task": Clock,
    "no_suitable_job_found": XCircle,
    "error": XCircle
  };

  const stepColors = {
    "understanding_needs": "bg-blue-100 text-blue-800 border-blue-300",
    "finding_job": "bg-purple-100 text-purple-800 border-purple-300",
    "presenting_job": "bg-green-100 text-green-800 border-green-300",
    "sending_form": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "creating_task": "bg-orange-100 text-orange-800 border-orange-300",
    "no_suitable_job_found": "bg-gray-100 text-gray-800 border-gray-300",
    "error": "bg-red-100 text-red-800 border-red-300"
  };

  const statusColors = {
    "in_progress": "bg-blue-100 text-blue-800",
    "completed": "bg-green-100 text-green-800",
    "failed": "bg-red-100 text-red-800"
  };

  return (
    <Card className="border-2 border-green-300 bg-green-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-green-600" />
            המוח של טל - תהליך חשיבה בזמן אמת
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={autoRefresh ? "bg-green-600" : "bg-gray-400"}>
              {autoRefresh ? "⚡ רענון אוטומטי" : "מושהה"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="h-8"
            >
              {autoRefresh ? "עצור" : "הפעל"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
              className="h-8"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {logs.length === 0 ? (
          <Alert className="bg-white">
            <AlertDescription className="text-center text-gray-600">
              {loading ? "טוען נתונים..." : "אין פעילות אחרונה של טל"}
            </AlertDescription>
          </Alert>
        ) : (
          logs.map((log) => {
            const StepIcon = stepIcons[log.step] || MessageCircle;
            const stepColor = stepColors[log.step] || stepColors.understanding_needs;
            const statusColor = statusColors[log.status] || statusColors.in_progress;

            return (
              <div key={log.id} className="bg-white rounded-lg border-2 border-green-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${stepColor} border`}>
                      <StepIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{log.candidate_name}</div>
                      <div className="text-xs text-gray-500 font-mono" dir="ltr">{log.candidate_phone}</div>
                    </div>
                  </div>
                  <Badge className={statusColor}>
                    {log.status === 'in_progress' ? '⏳ בתהליך' : 
                     log.status === 'completed' ? '✅ הושלם' : '❌ נכשל'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${stepColor} border`}>
                      {stepLabels[log.step] || log.step}
                    </Badge>
                  </div>

                  {log.candidate_request && (
                    <div className="text-sm bg-blue-50 rounded-md p-2 border border-blue-200">
                      <span className="font-semibold text-blue-800">🗣️ בקשת המועמד:</span>
                      <p className="text-blue-700 mt-1">{log.candidate_request}</p>
                    </div>
                  )}

                  {log.job_id && (
                    <div className="text-sm bg-green-50 rounded-md p-2 border border-green-200">
                      <span className="font-semibold text-green-800">💼 משרה שנמצאה:</span>
                      <p className="text-green-700 mt-1">{log.job_title}</p>
                      {log.match_score && (
                        <Badge className="mt-1 bg-green-600 text-white">
                          התאמה: {log.match_score}%
                        </Badge>
                      )}
                    </div>
                  )}

                  {log.form_sent && (
                    <div className="text-sm bg-yellow-50 rounded-md p-2 border border-yellow-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-yellow-600" />
                      <span className="text-yellow-800">✅ טופס נשלח למועמד</span>
                      {log.form_sent_date && (
                        <span className="text-xs text-yellow-600">
                          ({new Date(log.form_sent_date).toLocaleString('he-IL')})
                        </span>
                      )}
                    </div>
                  )}

                  {log.task_created && (
                    <div className="text-sm bg-orange-50 rounded-md p-2 border border-orange-200 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-600" />
                      <span className="text-orange-800">📋 משימה נוצרה לטיפול פנימי</span>
                    </div>
                  )}

                  {log.error_message && (
                    <div className="text-sm bg-red-50 rounded-md p-2 border border-red-200">
                      <span className="font-semibold text-red-800">⚠️ שגיאה:</span>
                      <p className="text-red-700 mt-1">{log.error_message}</p>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 pt-1 border-t">
                    🕐 {new Date(log.created_date).toLocaleString('he-IL')}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}