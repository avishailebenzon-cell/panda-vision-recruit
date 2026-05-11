import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, Sparkles, Info, UserCheck, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { runMeniAgent } from '@/functions/runMeniAgent';
import { toast } from 'sonner';

export default function MeniManagement() {
  const [agentStatus, setAgentStatus] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
    // Poll every 10 seconds to avoid rate limits
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const statuses = await base44.entities.AgentRunStatus.filter({ agent_name: 'meni' });
      if (statuses.length > 0) {
        setAgentStatus(statuses[0]);
        setIsRunning(statuses[0].is_running);
      }
    } catch (error) {
      console.error('Error loading Meni status:', error);
    }
    setLoading(false);
  };

  const handleRunMeni = async () => {
    setIsRunning(true);
    try {
      const response = await runMeniAgent({});
      if (response.data.success) {
        toast.success(`מני הושלם בהצלחה - ${response.data.recommendations?.length || 0} המלצות נוצרו`);
        await loadStatus();
      } else {
        toast.error('שגיאה בהרצת מני');
      }
    } catch (error) {
      console.error('Error running Meni:', error);
      toast.error('שגיאה בהרצת מני');
    }
    setIsRunning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-4">
            <img 
              src="https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop&crop=face" 
              alt="מני" 
              className="w-16 h-16 rounded-full object-cover border-4 border-purple-300 shadow-lg"
            />
            <div className="flex-1">
              <CardTitle className="text-2xl flex items-center gap-3">
                מני - מכירות אפקטיביות
                <Badge className="bg-purple-600 text-white">
                  <Sparkles className="w-4 h-4 ml-1" />
                  AI Creative Matcher
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                התאמות יצירתיות של מועמדי רמה 1 לאנשי קשר לפי תחום מקצועי
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Alert className="bg-purple-50 border-purple-200 mb-4">
            <Info className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-sm text-gray-700">
              <b>תפקיד מני:</b> מני מנתח מועמדי רמה 1 ומתאים אותם לאנשי קשר רלוונטיים 
              על פי התחום המקצועי בלבד. ההמלצות מבוססות על AI והבנה עמוקה של הצרכים המקצועיים.
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button 
              onClick={handleRunMeni}
              disabled={isRunning}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin ml-2" />
                  מני פועל...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 ml-2" />
                  הפעל את מני
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-600" />
            סטטוס הרצה
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentStatus ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">סטטוס</span>
                <Badge className={agentStatus.is_running ? "bg-blue-500" : "bg-green-500"}>
                  {agentStatus.is_running ? 'פועל כרגע' : 'לא פעיל'}
                </Badge>
              </div>

              {agentStatus.last_run_start && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">הרצה אחרונה</span>
                  <span className="text-sm text-gray-600">
                    {new Date(agentStatus.last_run_start).toLocaleString('he-IL', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              )}

              {agentStatus.matches_created !== undefined && (
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="text-sm font-medium text-gray-700">המלצות בהרצה האחרונה</span>
                  <Badge className="bg-purple-600 text-white text-lg px-4 py-1">
                    {agentStatus.matches_created}
                  </Badge>
                </div>
              )}

              {agentStatus.last_error && (
                <Alert variant="destructive">
                  <AlertDescription>{agentStatus.last_error}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">אין מידע על הרצות קודמות</p>
          )}
        </CardContent>
      </Card>

      {/* Activity Log Card */}
      {(agentStatus?.current_activity || agentStatus?.detailed_log) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              לוג פעילות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Current Activity - Prominent Display */}
            {agentStatus.current_activity && (
              <div className="mb-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <div className="flex items-center gap-2">
                  {agentStatus.is_running && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
                  <span className="font-semibold text-purple-900">{agentStatus.current_activity}</span>
                </div>
              </div>
            )}

            {/* Detailed Log */}
            {agentStatus.detailed_log && (
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap">{agentStatus.detailed_log}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            איך מני עובד
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <b>סינון מועמדים:</b> מני מחפש מועמדים בעלי סיווג רמה 1 בלבד
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <b>זיהוי תחום מקצועי:</b> מני מזהה את התחום המקצועי של כל מועמד
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <b>התאמה לאנשי קשר:</b> מני משווה בין תחום המועמד לתחום המקצועי של אנשי קשר במערכת
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold">4</div>
              <div>
                <b>יצירת המלצות:</b> מני מפיק עד 10 המלצות איכותיות לכל מועמד
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}