import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Play, 
  Loader2, 
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Mail,
  Database,
  Users,
  Building,
  Clock,
  Wrench,
  Save,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { runRavivAgent } from '@/functions/runRavivAgent';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CHECK_TYPE_LABELS = {
  email_scan: { label: 'סריקת מיילים', icon: Mail, color: 'text-blue-600' },
  pipedrive_sync: { label: 'סנכרון Pipedrive', icon: Building, color: 'text-purple-600' },
  naama_agent: { label: 'סוכנת נעמה', icon: Users, color: 'text-orange-600' },
  roee_agent: { label: 'סוכן רועי', icon: Users, color: 'text-blue-600' },
  data_cleanup: { label: 'ניקוי נתונים', icon: Database, color: 'text-green-600' },
  duplicate_statuses: { label: 'מצבים כפולים', icon: Database, color: 'text-amber-600' },
  duplicate_candidates: { label: 'מועמדים כפולים', icon: Users, color: 'text-red-600' },
  system_health: { label: 'בריאות מערכת', icon: Settings, color: 'text-gray-600' }
};

const STATUS_CONFIG = {
  success: { label: 'תקין', icon: CheckCircle, bgColor: 'bg-green-100', textColor: 'text-green-800' },
  warning: { label: 'אזהרה', icon: AlertTriangle, bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  error: { label: 'שגיאה', icon: XCircle, bgColor: 'bg-red-100', textColor: 'text-red-800' },
  fixed: { label: 'תוקן', icon: Wrench, bgColor: 'bg-blue-100', textColor: 'text-blue-800' }
};

const INTERVAL_OPTIONS = [
  { value: 1, label: 'כל שעה' },
  { value: 2, label: 'כל 2 שעות' },
  { value: 3, label: 'כל 3 שעות' },
  { value: 4, label: 'כל 4 שעות' },
  { value: 5, label: 'כל 5 שעות (ברירת מחדל)' },
  { value: 6, label: 'כל 6 שעות' },
  { value: 8, label: 'כל 8 שעות' },
  { value: 12, label: 'כל 12 שעות' },
  { value: 24, label: 'פעם ביום' }
];

export default function RavivManagement() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [masterSwitch, setMasterSwitch] = useState(true);
  const [savingMaster, setSavingMaster] = useState(false);
  const [allSchedules, setAllSchedules] = useState([]);
  const [schedule, setSchedule] = useState({
    is_enabled: true,
    interval_hours: 5
  });
  const [scheduleId, setScheduleId] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    warnings: 0,
    errors: 0,
    lastRun: null
  });
  const [agentToggles, setAgentToggles] = useState({});
  const [savingAgentToggle, setSavingAgentToggle] = useState({});

  useEffect(() => {
    const loadData = async () => {
      await loadSchedule();
      await new Promise(resolve => setTimeout(resolve, 600));
      await loadMasterSwitch();
      await new Promise(resolve => setTimeout(resolve, 600));
      await loadAgentToggles();
      await new Promise(resolve => setTimeout(resolve, 600));
      await loadLogs();
    };
    loadData();
  }, []);

  const loadMasterSwitch = async () => {
    try {
      const { AgentSchedule } = await import('@/entities/AgentSchedule');
      const schedules = await AgentSchedule.list();
      setAllSchedules(schedules);
      
      // Check if master switch exists
      const master = schedules.find(s => s.agent_name === 'master');
      if (master) {
        setMasterSwitch(master.is_enabled ?? true);
      }
    } catch (e) {
      console.log('Could not load master switch');
    }
  };

  const loadAgentToggles = async () => {
    try {
      const { base44 } = await import('@/api/base44Client');
      const toggles = await base44.entities.AgentToggleConfig.list();
      
      const togglesMap = {};
      toggles.forEach(t => {
        togglesMap[t.agent_name] = t.is_enabled ?? true;
      });
      
      // Set defaults for agents without config
      const allAgents = ['naama', 'alik', 'itay', 'lior', 'ofir', 'gc', 'rami', 'meni', 'shiri', 'shacahr', 'rotem', 'hila', 'elad', 'eitan', 'inbar'];
      allAgents.forEach(agent => {
        if (!(agent in togglesMap)) {
          togglesMap[agent] = true;
        }
      });
      
      setAgentToggles(togglesMap);
    } catch (e) {
      console.log('Could not load agent toggles');
      // Set defaults
      const defaultToggles = {};
      ['naama', 'alik', 'itay', 'lior', 'ofir', 'gc', 'rami', 'meni', 'shiri', 'shacahr', 'rotem', 'hila', 'elad', 'eitan', 'inbar'].forEach(agent => {
        defaultToggles[agent] = true;
      });
      setAgentToggles(defaultToggles);
    }
  };

  const toggleAgent = async (agentName, enabled) => {
    setSavingAgentToggle(prev => ({ ...prev, [agentName]: true }));
    try {
      const { base44 } = await import('@/api/base44Client');
      const { User } = await import('@/entities/User');
      
      const currentUser = await User.me();
      
      // Find existing toggle config
      const toggles = await base44.entities.AgentToggleConfig.filter({ agent_name: agentName });
      
      const data = {
        agent_name: agentName,
        is_enabled: enabled,
        disabled_by_user: enabled ? null : currentUser.full_name,
        disabled_date: enabled ? null : new Date().toISOString()
      };
      
      if (toggles.length > 0) {
        await base44.entities.AgentToggleConfig.update(toggles[0].id, data);
      } else {
        await base44.entities.AgentToggleConfig.create(data);
      }
      
      setAgentToggles(prev => ({ ...prev, [agentName]: enabled }));
      toast.success(`${getAgentDisplayName(agentName)} ${enabled ? 'הופעל' : 'כובה'}`);
    } catch (e) {
      console.error('Error toggling agent:', e);
      toast.error('שגיאה בעדכון סוכן');
    }
    setSavingAgentToggle(prev => ({ ...prev, [agentName]: false }));
  };

  const getAgentDisplayName = (agentName) => {
    const names = {
      naama: 'נעמה',
      alik: 'אליק',
      itay: 'איתי',
      lior: 'ליאור',
      ofir: 'אופיר',
      gc: 'GC',
      rami: 'רמי',
      meni: 'מני',
      shiri: 'שירי',
      shacahr: 'שחר',
      rotem: 'טל',
      hila: 'הילה',
      elad: 'אלעד',
      eitan: 'איתן',
      inbar: 'ענבר'
    };
    return names[agentName] || agentName;
  };

  const toggleMasterSwitch = async (enabled) => {
    setSavingMaster(true);
    try {
      const { AgentSchedule } = await import('@/entities/AgentSchedule');
      const { HilaSchedule } = await import('@/entities/HilaSchedule');
      const { ShiriSchedule } = await import('@/entities/ShiriSchedule');
      const { EladSchedule } = await import('@/entities/EladSchedule');
      const { EitanSchedule } = await import('@/entities/EitanSchedule');
      const { base44 } = await import('@/api/base44Client');
      
      // Update or create master switch record
      const master = allSchedules.find(s => s.agent_name === 'master');
      if (master) {
        await AgentSchedule.update(master.id, { is_enabled: enabled });
      } else {
        await AgentSchedule.create({ agent_name: 'master', is_enabled: enabled });
      }
      
      // Update all agent schedules (naama, roee, rami, yotam, meni, alik, itay, lior, carmit, raviv)
      const agents = allSchedules.filter(s => s.agent_name !== 'master');
      for (const agent of agents) {
        await AgentSchedule.update(agent.id, { is_enabled: enabled });
      }
      
      // Update Hila schedule
      const hilaSchedules = await HilaSchedule.list('-updated_date', 1);
      if (hilaSchedules.length > 0) {
        await HilaSchedule.update(hilaSchedules[0].id, { is_enabled: enabled });
      }
      
      // Update Shiri schedule
      const shiriSchedules = await ShiriSchedule.list('-updated_date', 1);
      if (shiriSchedules.length > 0) {
        await ShiriSchedule.update(shiriSchedules[0].id, { is_enabled: enabled });
      }
      
      // Update Elad schedule
      const eladSchedules = await EladSchedule.list('-updated_date', 1);
      if (eladSchedules.length > 0) {
        await EladSchedule.update(eladSchedules[0].id, { is_enabled: enabled });
      }
      
      // Update Eitan schedule
      const eitanSchedules = await EitanSchedule.list('-updated_date', 1);
      if (eitanSchedules.length > 0) {
        await EitanSchedule.update(eitanSchedules[0].id, { is_enabled: enabled });
      }
      
      // If enabled - actually trigger all agents to start working
      if (enabled) {
        toast.info('מפעיל את כל הסוכנים...');
        
        try {
          // Trigger all recruitment agents
          await Promise.allSettled([
            base44.functions.invoke('runNaamaAgent', {}),
            base44.functions.invoke('runAlikAgent', {}),
            base44.functions.invoke('runItayAgent', {}),
            base44.functions.invoke('runLiorAgent', {}),
            base44.functions.invoke('runCarmitAgent', {})
          ]);
          
          toast.success('כל סוכני הגיוס הופעלו וכרמית מנהלת אותם!');
        } catch (activationError) {
          console.error('Error activating agents:', activationError);
          toast.warning('הגדרות נשמרו, הסוכנים יופעלו בתזמון הבא');
        }
      }
      
      setMasterSwitch(enabled);
      toast.success(enabled ? 'כל האוטומציות הופעלו!' : 'כל האוטומציות כובו');
      loadMasterSwitch();
    } catch (e) {
      console.error('Error toggling master switch:', e);
      toast.error('שגיאה בעדכון המפסק הראשי');
    }
    setSavingMaster(false);
  };

  const loadSchedule = async () => {
    try {
      const { AgentSchedule } = await import('@/entities/AgentSchedule');
      const schedules = await AgentSchedule.filter({ agent_name: 'raviv' });
      if (schedules.length > 0) {
        setSchedule({
          is_enabled: schedules[0].is_enabled ?? true,
          interval_hours: schedules[0].interval_hours ?? 5
        });
        setScheduleId(schedules[0].id);
      }
    } catch (e) {
      console.log('Could not load Raviv schedule');
    }
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const { AgentSchedule } = await import('@/entities/AgentSchedule');
      const data = {
        agent_name: 'raviv',
        is_enabled: schedule.is_enabled,
        interval_hours: schedule.interval_hours
      };
      
      if (scheduleId) {
        await AgentSchedule.update(scheduleId, data);
      } else {
        const created = await AgentSchedule.create(data);
        setScheduleId(created.id);
      }
      toast.success('הגדרות התזמון נשמרו');
    } catch (e) {
      console.error('Error saving schedule:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { RavivLog } = await import('@/entities/RavivLog');
      const allLogs = await RavivLog.list('-created_date', 100);
      setLogs(allLogs);

      // Calculate stats
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLogs = allLogs.filter(l => new Date(l.created_date) > last24h);
      
      setStats({
        total: recentLogs.length,
        success: recentLogs.filter(l => l.status === 'success').length,
        warnings: recentLogs.filter(l => l.status === 'warning').length,
        errors: recentLogs.filter(l => l.status === 'error').length,
        lastRun: allLogs.length > 0 ? allLogs[0].created_date : null
      });
    } catch (e) {
      console.log('Could not load Raviv logs');
    }
    setLoading(false);
  };

  const runManually = async () => {
    setRunning(true);
    try {
      const response = await runRavivAgent({});
      if (response.data?.success) {
        toast.success(`בדיקת מערכת הושלמה - ${response.data.checksRun} בדיקות, ${response.data.issuesFound} בעיות`);
        loadLogs();
      } else {
        toast.error(response.data?.error || 'שגיאה בהפעלת רביב');
      }
    } catch (e) {
      console.error('Error running Raviv:', e);
      toast.error('שגיאה בהפעלת רביב');
    }
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face" 
                alt="רביב" 
                className="w-14 h-14 rounded-full object-cover border-4 border-gray-200 shadow-lg"
              />
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-600" />
                  רביב - ניטור מערכת
                </CardTitle>
                <p className="text-sm text-gray-600">
                  מנהל המערכת, אחראי על בדיקת תקינות כל הרכיבים
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadLogs}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                onClick={runManually} 
                disabled={running}
                className="gap-2"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                הפעל בדיקה עכשיו
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Switch */}
          <Card className={`border-2 ${masterSwitch ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${masterSwitch ? 'bg-green-500' : 'bg-red-500'}`}>
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <Label className="text-lg font-bold">מפסק ראשי - כל האוטומציות</Label>
                    <p className="text-sm text-gray-600">
                      {masterSwitch 
                        ? 'כל הסוכנים פעילים: נעמה, אליק, איתי, ליאור, אופיר, כרמית, רמי, מני, רביב, הילה, אלעד, שירי, איתן, GC' 
                        : 'כל הסוכנים מושבתים'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {savingMaster && <Loader2 className="w-5 h-5 animate-spin text-gray-500" />}
                  <Switch
                    checked={masterSwitch}
                    onCheckedChange={toggleMasterSwitch}
                    disabled={savingMaster}
                    className="scale-125"
                  />
                  <span className={`font-bold text-lg ${masterSwitch ? 'text-green-700' : 'text-red-700'}`}>
                    {masterSwitch ? 'פועל' : 'כבוי'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Agent Toggles */}
          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                מתגי סוכנים בודדים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'naama', label: 'נעמה - מומחית תוכנה', color: 'text-orange-600', section: 'גיוס' },
                  { name: 'alik', label: 'אליק - מומחה אלקטרוניקה', color: 'text-teal-600', section: 'גיוס' },
                  { name: 'itay', label: 'איתי - מומחה IT', color: 'text-indigo-600', section: 'גיוס' },
                  { name: 'lior', label: 'ליאור - מומחה הנדסת מערכת', color: 'text-amber-600', section: 'גיוס' },
                  { name: 'ofir', label: 'אופיר - מומחה הנדסת מכונות', color: 'text-emerald-600', section: 'גיוס' },
                  { name: 'gc', label: 'GC - סוכן כללי', color: 'text-gray-600', section: 'גיוס' },
                  { name: 'rami', label: 'רמי - מומחה רמה 1', color: 'text-red-600', section: 'גיוס' },
                  { name: 'meni', label: 'מני - מכירות אפקטיביות', color: 'text-purple-600', section: 'לקוחות' },
                  { name: 'shacahr', label: 'שחר - גיוס WhatsApp', color: 'text-teal-600', section: 'מועמדים' },
                  { name: 'rotem', label: 'טל - קשרי מועמדים', color: 'text-green-600', section: 'מועמדים' },
                  { name: 'hila', label: 'הילה - הפצת משרות', color: 'text-pink-600', section: 'משרות' },
                  { name: 'elad', label: 'אלעד - שליחת מועמדים', color: 'text-indigo-600', section: 'לקוחות' },
                  { name: 'eitan', label: 'איתן - בדיקות איכות', color: 'text-blue-600', section: 'איכות' },
                  { name: 'shiri', label: 'שירי - קשרי עובדים', color: 'text-rose-600', section: 'משא"ן' },
                  { name: 'inbar', label: 'ענבר - תוכנית משא"ן', color: 'text-purple-600', section: 'משא"ן' }
                ].map(agent => (
                  <div 
                    key={agent.name} 
                    className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                      agentToggles[agent.name] ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${agentToggles[agent.name] ? 'bg-green-500' : 'bg-red-500'}`} />
                      <Label className={`text-sm ${agent.color}`}>{agent.label}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      {savingAgentToggle[agent.name] && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                      <Switch
                        checked={agentToggles[agent.name] ?? true}
                        onCheckedChange={(checked) => toggleAgent(agent.name, checked)}
                        disabled={savingAgentToggle[agent.name]}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Alert className="mt-4 bg-white border-purple-200">
                <AlertTriangle className="w-4 h-4 text-purple-600" />
                <AlertDescription className="text-sm">
                  שימו לב: המתגים האישיים פועלים במקביל למפסק הראשי. כדי שסוכן יפעל, גם המפסק הראשי וגם המתג האישי שלו חייבים להיות דלוקים.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Schedule Settings */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label className="text-base font-medium">תזמון אוטומטי</Label>
                    <p className="text-sm text-gray-600">רביב ירוץ אוטומטית לפי ההגדרות</p>
                  </div>
                </div>
                <Switch
                  checked={schedule.is_enabled}
                  onCheckedChange={(checked) => setSchedule({ ...schedule, is_enabled: checked })}
                />
              </div>

              {schedule.is_enabled && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>תדירות ריצה:</Label>
                    <Select
                      value={String(schedule.interval_hours)}
                      onValueChange={(value) => setSchedule({ ...schedule, interval_hours: parseInt(value) })}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={saveSchedule} disabled={saving} size="sm" className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    שמור הגדרות
                  </Button>
                </div>
              )}

              <Alert className="bg-white border-blue-200">
                <Settings className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-sm">
                  רביב בודק: סריקת מיילים, סנכרון Pipedrive, פעילות כל סוכני הגיוס, ומועמדים/מצבים כפולים.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-gray-500">בדיקות ב-24ש'</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{stats.success}</div>
                <div className="text-xs text-green-600">תקין</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{stats.warnings}</div>
                <div className="text-xs text-amber-600">אזהרות</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-700">{stats.errors}</div>
                <div className="text-xs text-red-600">שגיאות</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <div className="text-xs text-gray-500">
                  {stats.lastRun ? new Date(stats.lastRun).toLocaleString('he-IL', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) : 'לא רץ'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Logs Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">זמן</TableHead>
                  <TableHead className="w-40">סוג בדיקה</TableHead>
                  <TableHead className="w-24">סטטוס</TableHead>
                  <TableHead>הודעה</TableHead>
                  <TableHead className="w-32">פעולה</TableHead>
                  <TableHead className="w-24">התראה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      אין לוגים עדיין. הפעל בדיקה כדי להתחיל.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const typeConfig = CHECK_TYPE_LABELS[log.check_type] || { label: log.check_type, icon: Settings, color: 'text-gray-600' };
                    const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
                    const TypeIcon = typeConfig.icon;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={log.id} className={log.status === 'error' ? 'bg-red-50' : log.status === 'warning' ? 'bg-amber-50' : ''}>
                        <TableCell className="text-xs">
                          {new Date(log.created_date).toLocaleString('he-IL', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                            <span className="text-sm">{typeConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.message}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {log.action_taken || '-'}
                        </TableCell>
                        <TableCell>
                          {log.notified_carmit ? (
                            <Badge variant="outline" className="text-xs">נשלח לכרמית</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}