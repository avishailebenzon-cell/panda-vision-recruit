import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, PlusSquare } from 'lucide-react';

/**
 * Dialog shown after marking a task as complete
 * Offers two quick actions to continue workflow
 */
export default function TaskCompletedActionDialog({ open, onClose, onAddNote, onCreateTask, candidateName }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">
            ✅ המשימה הושלמה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-center text-gray-600 mb-6">
            מה תרצה לעשות עכשיו עם {candidateName}?
          </p>

          <Button
            onClick={() => {
              onClose();
              onAddNote();
            }}
            variant="outline"
            className="w-full h-auto py-4 justify-start text-base hover:bg-blue-50 hover:border-blue-300"
          >
            <MessageSquare className="w-5 h-5 ml-3 text-blue-600" />
            <div className="text-right">
              <div className="font-semibold">הוסף הערה</div>
              <div className="text-xs text-gray-500">תיעוד מידע או החלטה על המועמד</div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onClose();
              onCreateTask();
            }}
            variant="outline"
            className="w-full h-auto py-4 justify-start text-base hover:bg-green-50 hover:border-green-300"
          >
            <PlusSquare className="w-5 h-5 ml-3 text-green-600" />
            <div className="text-right">
              <div className="font-semibold">צור משימה חדשה</div>
              <div className="text-xs text-gray-500">המשך טיפול במועמד</div>
            </div>
          </Button>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full mt-4 text-gray-500"
          >
            לא עכשיו
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}