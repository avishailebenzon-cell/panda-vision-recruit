import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { runAlikAgent } from '@/functions/runAlikAgent';
import { base44 } from '@/api/base44Client';

const DAYS_OPTIONS = [
  { value: 'sunday', label: 'ראשון' },
  { value: 'monday', label: 'שני' },
  { value: 'tuesday', label: 'שלישי' },
  { value: 'wednesday', label: 'רביעי' },
  { value: 'thursday', label: 'חמישי' },
  { value: 'friday', label: 'שישי' },
  { value: 'saturday', label: 'שבת' }
];

export default function AlikScheduleCard() {
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

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const schedules = await base44.entities.AgentSchedule.filter({ agent_name: 'alik' });
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
      console.log('Could not load alik schedule');
    }
    setLoading(false);
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const data = {
        agent_name: 'alik',
        is_enabled: schedule.is_enabled,
        days: schedule.days,
        interval_hours: schedule.interval_hours
      };
      
      if (scheduleId) {
        await base44.entities.AgentSchedule.update(scheduleId, data);
      } else {
        const created = await base44.entities.AgentSchedule.create(data);
        setScheduleId(created.id);
      }
      toast.success('הגדרות אליק נשמרו');
    } catch (e) {
      console.error('Error saving schedule:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const handleRunAgent = async () => {
    setRunning(true);
    try {
      await runAlikAgent({});
      toast.success('אליק התחיל לרוץ');
      // Reload to update last run time
      setTimeout(loadSchedule, 2000);
    } catch (error) {
      console.error('Error running alik:', error);
      toast.error('שגיאה בהפעלת אליק');
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
      <Card className="border-teal-200">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-teal-200 bg-teal-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face" 
              alt="אליק" 
              className="w-12 h-12 rounded-full object-cover border-3 border-teal-200 shadow-md"
            />
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="w-5 h-5 text-teal-600" />
                אליק
              </CardTitle>
              <p className="text-xs text-gray-500">
                מומחה אלקטרוניקה - מועמדים למשרות
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
                        ? 'bg-teal-100 border-teal-300 text-teal-800'
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
                <Clock className="w-4 h-4 text-teal-600" />
                <Label className="text-sm">מרווח שעות בין ריצות:</Label>
              </div>
              <Select
                value={schedule.interval_hours?.toString() || '4'}
                onValueChange={(value) => setSchedule({ ...schedule, interval_hours: parseInt(value) })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            className="gap-2 bg-teal-600 hover:bg-teal-700"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            הפעל עכשיו
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}