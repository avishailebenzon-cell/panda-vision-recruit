import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Send, 
  Loader2,
  User,
  Building,
  Info,
  Calendar,
  Hash
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function ApproveTaskDialog({ 
  isOpen, 
  onClose, 
  task,
  onSuccess
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (isOpen && task) {
      loadSettingsAndBuildMessage();
    }
  }, [isOpen, task]);

  const loadSettingsAndBuildMessage = async () => {
    try {
      // Load Eitan settings
      const allSettings = await base44.entities.EitanSettings.list();
      const eitanSettings = allSettings.length > 0 ? allSettings[0] : null;
      setSettings(eitanSettings);

      // Build message from template
      if (eitanSettings?.questions_template) {
        const template = eitanSettings.questions_template;
        const checkDate = new Date().toLocaleDateString('he-IL');
        
        const filledMessage = template
          .replace(/\{\{employee_name\}\}/g, task.employee_name || '')
          .replace(/\{\{check_number\}\}/g, task.check_number || '')
          .replace(/\{\{check_date\}\}/g, checkDate)
          .replace(/\{\{manager_name\}\}/g, task.manager_name || task.client_contact_name || '')
          .replace(/\{\{client_name\}\}/g, task.client_name || '');
        
        setMessage(filledMessage);
      } else {
        // Default message if no settings
        setMessage(`שלום,

אני איתן ממחלקת בקרת האיכות של פנדה-טק.

אני מבצע מבדק איכות שירות מספר ${task.check_number || 'N/A'} עבור העובד ${task.employee_name} שעובד אצלכם.

תאריך המבדק: ${new Date().toLocaleDateString('he-IL')}

ברצוני לשאול מספר שאלות קצרות על איכות השירות.

האם יש לך כמה דקות?`);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
      // Use default message
      setMessage(`שלום,

אני איתן ממחלקת בקרת האיכות של פנדה-טק.

אני מבצע מבדק איכות שירות מספר ${task.check_number || 'N/A'} עבור העובד ${task.employee_name}.

תאריך המבדק: ${new Date().toLocaleDateString('he-IL')}

ברצוני לשאול מספר שאלות קצרות על איכות השירות.`);
    }
  };

  const handleApproveAndSend = async () => {
    setSending(true);
    try {
      // Update task to approved status
      await base44.entities.EitanTask.update(task.id, {
        status: 'מאושר לשיחה'
      });

      toast.success('המשימה אושרה - ניתן כעת להתחיל שיחה');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error('Error approving task:', e);
      toast.error('שגיאה באישור המשימה');
    }
    setSending(false);
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span>אישור משימת בדיקת איכות</span>
              <p className="text-sm font-normal text-gray-500">צפייה ועריכת ההודעה שתישלח ללקוח</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-600" />
              <span className="font-medium">מספר מבדק: {task.check_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <span>עובד: {task.employee_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <span>לקוח: {task.client_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-green-600" />
              <span>איש קשר: {task.client_contact_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>תאריך: {new Date().toLocaleDateString('he-IL')}</span>
            </div>
          </div>

          {/* Message Template */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              נוסח ההודעה (ניתן לעריכה)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              dir="rtl"
            />
          </div>

          {/* Info Alert */}
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              לחיצה על "אשר ושמור" תעביר את המשימה לסטטוס "מאושר לשיחה". 
              לאחר מכן תוכל להתחיל את השיחה בפועל עם איתן.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button 
            onClick={handleApproveAndSend}
            disabled={sending || !message.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-2" />
            )}
            אשר ושמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}