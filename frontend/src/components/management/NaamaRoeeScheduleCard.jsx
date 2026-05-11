import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Save, 
  Loader2, 
  Clock,
  Calendar,
  Play,
  Users,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';


const DAYS_OPTIONS = [
  { value: 'sunday', label: 'ראשון' },
  { value: 'monday', label: 'שני' },
  { value: 'tuesday', label: 'שלישי' },
  { value: 'wednesday', label: 'רביעי' },
  { value: 'thursday', label: 'חמישי' },
  { value: 'friday', label: 'שישי' },
  { value: 'saturday', label: 'שבת' }
];

const TIME_OPTIONS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00'
];

const AGENT_CONFIG = {
  naama: {
    displayName: 'נעמה',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face',
    color: 'orange',
    icon: Briefcase,
    description: 'מומחית תוכנה',
    runFunction: 'runNaamaAgent'
  },

  meni: {
    displayName: 'מני',
    image: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=60&h=60&fit=crop&crop=face',
    color: 'purple',
    icon: Users,
    description: 'מכירות אפקטיביות',
    runFunction: 'runMeniAgent'
  },
  lior: {
    displayName: 'ליאור',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face',
    color: 'amber',
    icon: Briefcase,
    description: 'מומחה הנדסת מערכת',
    runFunction: 'runLiorAgent'
  },
  alik: {
    displayName: 'אליק',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face',
    color: 'teal',
    icon: Briefcase,
    description: 'מומחה אלקטרוניקה',
    runFunction: 'runAlikAgent'
  },
  rami: {
    displayName: 'רמי',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=60&h=60&fit=crop&crop=face',
    color: 'red',
    icon: Briefcase,
    description: 'מומחה רמה 1',
    runFunction: 'runRamiAgent'
  },
  itay: {
    displayName: 'איתי',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&fit=crop&crop=face',
    color: 'indigo',
    icon: Briefcase,
    description: 'מומחה IT',
    runFunction: 'runItayAgent'
  },
  ofir: {
    displayName: 'אופיר',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face',
    color: 'emerald',
    icon: Briefcase,
    description: 'מומחה הנדסת מכונות',
    runFunction: 'runOfirAgent'
  }
};

export default function NaamaRoeeScheduleCard({ agentName }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [schedule, setSchedule] = useState({
    is_enabled: true,
    days: ['sunday', 'tuesday', 'thursday'],
    interval_hours: 4
  });
  const [scheduleId, setScheduleId] = useState(null);
  const [lastRunTime, setLastRunTime] = useState(null);

  const agentConfig = AGENT_CONFIG[agentName] || AGENT_CONFIG.naama;
  const agentDisplayName = agentConfig.displayName;
  const agentImage = agentConfig.image;
  const agentColor = agentConfig.color;
  const AgentIcon = agentConfig.icon;

  useEffect(() => {
    loadSchedule();
  }, [agentName]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const { AgentSchedule } = await import('@/entities/AgentSchedule');
      const schedules = await AgentSchedule.filter({ agent_name: agentName });
      if (schedules.length > 0) {
        setSchedule({
          is_enabled: schedules[0].is_enabled ?? true,
          days: schedules[0].days || ['sunday', 'tuesday', 'thursday'],
          interval_hours: schedules[0].interval_hours || 4
        });
        setScheduleId(schedules[0].id);
        setLastRunTime(schedules[0].last_run_time);
      }
    } catch (e) {
      console.log(`Could not load ${agentName} schedule`);
    }
    setLoading(false);
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const { AgentSchedule } = await import('@/entities/AgentSchedule');
      const { SystemActivityLog } = await import('@/entities/SystemActivityLog');
      
      // Check if is_enabled changed
      const previousSchedule = scheduleId ? await AgentSchedule.filter({ id: scheduleId }) : [];
      const wasEnabled = previousSchedule.length > 0 ? previousSchedule[0].is_enabled : null;
      const isToggle = wasEnabled !== null && wasEnabled !== schedule.is_enabled;
      
      const data = {
        agent_name: agentName,
        is_enabled: schedule.is_enabled,
        days: schedule.days,
        interval_hours: schedule.interval_hours
      };
      
      if (scheduleId) {
        await AgentSchedule.update(scheduleId, data);
      } else {
        const created = await AgentSchedule.create(data);
        setScheduleId(created.id);
      }
      
      // Log the enable/disable action
      if (isToggle) {
        await SystemActivityLog.create({
          actor_type: 'user',
          actor_name: 'רביב',
          action_type: 'schedule_run',
          action_description: `${schedule.is_enabled ? 'הפעיל' : 'כיבה'} את סוכן ${agentDisplayName}`,
          entity_type: 'AgentSchedule',
          entity_id: scheduleId,
          entity_name: agentDisplayName,
          status: 'success'
        });
      }
      
      toast.success(`הגדרות ${agentDisplayName} נשמרו`);
      
      // Reload schedule from DB to ensure UI shows saved values
      await loadSchedule();
    } catch (e) {
      console.error('Error saving schedule:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const handleRunAgent = async () => {
    setRunning(true);
    try {
      const functionName = agentConfig.runFunction;
      const agentFunction = await import(`@/functions/${functionName}`);
      await agentFunction[functionName]({});
      
      toast.success(`${agentDisplayName} התחיל/ה לרוץ`);
      // Reload to update last run time
      setTimeout(loadSchedule, 2000);
    } catch (error) {
      console.error(`Error running ${agentName}:`, error);
      toast.error(`שגיאה בהפעלת ${agentDisplayName}`);
    }
    setRunning(false);
  };

  const toggleDay = (day) => {
    setSchedule(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  if (loading) {
    return (
      <Card className={`border-${agentColor}-200`}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-${agentColor}-200 bg-${agentColor}-50/30`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={agentImage} 
              alt={agentDisplayName} 
              className={`w-12 h-12 rounded-full object-cover border-3 border-${agentColor}-200 shadow-md`}
            />
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AgentIcon className={`w-5 h-5 text-${agentColor}-600`} />
                {agentDisplayName}
              </CardTitle>
              <p className="text-xs text-gray-500">
                {agentConfig.description}
              </p>
            </div>
          </div>
          <Switch
            checked={schedule.is_enabled}
            onCheckedChange={(checked) => setSchedule({ ...schedule, is_enabled: checked })}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedule.is_enabled && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">ימים בשבוע</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OPTIONS.map(day => (
                  <div
                    key={day.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      schedule.days.includes(day.value)
                        ? `bg-${agentColor}-100 border-${agentColor}-300 text-${agentColor}-800`
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleDay(day.value)}
                  >
                    <Checkbox
                      checked={schedule.days.includes(day.value)}
                      onCheckedChange={() => toggleDay(day.value)}
                    />
                    <span className="text-sm">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 text-${agentColor}-600`} />
                <Label className="text-sm">מרווח שעות בין ריצות:</Label>
              </div>
              <Select
                value={schedule.interval_hours?.toString() || '4'}
                onValueChange={(value) => setSchedule({ ...schedule, interval_hours: parseFloat(value) })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">חצי שעה</SelectItem>
                  <SelectItem value="1">שעה</SelectItem>
                  {[2, 3, 4, 5, 6, 8, 12, 24].map(hours => (
                    <SelectItem key={hours} value={hours.toString()}>{hours} שעות</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {lastRunTime && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            ריצה אחרונה: {new Date(lastRunTime).toLocaleString('he-IL', { 
              day: '2-digit', 
              month: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            onClick={saveSchedule} 
            disabled={saving} 
            size="sm" 
            className="gap-2"
            variant="outline"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור
          </Button>
          <Button
            onClick={handleRunAgent}
            disabled={running}
            size="sm"
            className={`gap-2 bg-${agentColor}-600 hover:bg-${agentColor}-700`}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            הפעל עכשיו
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}