import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock, Save, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function CarmitScheduleCard() {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadSchedule();
    };
    loadData();
  }, []);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const schedules = await base44.entities.AgentSchedule.filter({ agent_name: 'carmit' });
      
      if (schedules.length > 0) {
        setSchedule(schedules[0]);
      } else {
        setSchedule({
          agent_name: 'carmit',
          is_enabled: true,
          interval_hours: 6
        });
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast.error('שגיאה בטעינת הגדרות התזמון');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (schedule.id) {
        await base44.entities.AgentSchedule.update(schedule.id, schedule);
      } else {
        const newSchedule = await base44.entities.AgentSchedule.create(schedule);
        setSchedule(newSchedule);
      }
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const response = await base44.functions.invoke('runCarmitAgent', {});
      toast.success(response.data.message || 'כרמית רצה בהצלחה');
      
      // Update last run time
      if (schedule.id) {
        await base44.entities.AgentSchedule.update(schedule.id, {
          last_run_time: new Date().toISOString()
        });
        loadSchedule();
      }
    } catch (error) {
      console.error('Error running Carmit:', error);
      toast.error('שגיאה בהרצת כרמית: ' + error.message);
    }
    setRunning(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img 
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face" 
            alt="כרמית" 
            className="w-8 h-8 rounded-full object-cover border-2 border-purple-200"
          />
          תזמון כרמית
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-800">
            כרמית בודקת התאמות מעל 90% מנעמה ורועי ויוצרת משימות אוטומטיות לרותם עם חישוב עדיפות
          </p>
        </div>

        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <Label>הפעל תזמון אוטומטי</Label>
            <p className="text-xs text-gray-500 mt-1">כרמית תרוץ אוטומטית לפי המרווח שהוגדר</p>
          </div>
          <Switch
            checked={schedule.is_enabled}
            onCheckedChange={(checked) => setSchedule({ ...schedule, is_enabled: checked })}
          />
        </div>

        {/* Interval */}
        <div>
          <Label>מרווח זמן בין ריצות (שעות)</Label>
          <Input
            type="number"
            min="1"
            max="24"
            value={schedule.interval_hours || 6}
            onChange={(e) => setSchedule({ ...schedule, interval_hours: parseInt(e.target.value) || 6 })}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            כרמית תבדוק התאמות חדשות כל {schedule.interval_hours || 6} שעות
          </p>
        </div>

        {/* Last Run */}
        {schedule.last_run_time && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>ריצה אחרונה: {new Date(schedule.last_run_time).toLocaleString('he-IL')}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            שמור הגדרות
          </Button>
          <Button 
            onClick={handleRunNow} 
            disabled={running}
            variant="outline"
            className="flex-1"
          >
            {running ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Play className="w-4 h-4 ml-2" />}
            הרץ עכשיו
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}