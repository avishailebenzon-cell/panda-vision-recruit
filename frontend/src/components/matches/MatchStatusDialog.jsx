import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { User } from '@/entities/User';
import { MatchNote } from '@/entities/MatchNote';
import StatusUpdateComponent from './StatusUpdateComponent';
import { base44 } from '@/api/base44Client';

export default function MatchStatusDialog({ 
  match, 
  isOpen, 
  onClose, 
  onStatusUpdate 
}) {
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async () => {
    if (!newStatus) {
      alert('אנא בחר מצב חדש');
      return;
    }

    setUpdating(true);
    try {
      const user = await User.me();
      const newStatusNum = parseInt(newStatus);
      
      // Determine feedback type based on status
      // Status 2 = אושר/המלצה, Status that includes "נדחה/דחייה" = rejected
      const rejectedStatuses = [6, 7, 8, 9]; // Adjust based on your status numbers for rejection
      const approvedStatuses = [2, 3, 4, 5]; // Adjust based on your status numbers for approval
      
      // Save agent feedback if this is an automatic match
      if (match?.is_automatic_recommendation) {
        try {
          let feedbackType = null;
          if (rejectedStatuses.includes(newStatusNum)) feedbackType = 'rejected';
          else if (approvedStatuses.includes(newStatusNum)) feedbackType = 'approved';
          
          if (feedbackType) {
            await base44.functions.invoke('saveMatchFeedback', {
              match_id: match.id,
              feedback_type: feedbackType,
              rejection_reason: feedbackType === 'rejected' ? note : null,
              notes: note || null
            });
          }
        } catch (feedbackErr) {
          console.error('Failed to save feedback:', feedbackErr);
          // Don't block the status update
        }
      }

      // Update match status
      await onStatusUpdate(match, newStatusNum, note);

      // Add system note about status change
      if (note.trim()) {
        await MatchNote.create({
          match_id: match.id,
          user_id: user.id,
          user_name: user.full_name,
          note_text: `עדכון מצב: ${note}`,
          is_system_note: false
        });
      }

      onClose();
      setNewStatus('');
      setNote('');
    } catch (error) {
      console.error('Error updating match status:', error);
      alert('שגיאה בעדכון המצב');
    }
    setUpdating(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>עדכון מצב התאמה</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>מועמד: <strong>{match?.candidate_name}</strong></Label>
            <Label>משרה: <strong>{match?.job_title}</strong></Label>
          </div>

          <div>
            <Label htmlFor="status-update">מצב חדש</Label>
            <StatusUpdateComponent
              currentStatusNumber={match?.status_number}
              onStatusChange={setNewStatus}
              disabled={updating}
            />
          </div>

          <div>
            <Label htmlFor="note">הערה (אופציונלי)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="הוסף הערה על עדכון המצב..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updating}>
            ביטול
          </Button>
          <Button onClick={handleStatusChange} disabled={updating || !newStatus}>
            {updating ? 'מעדכן...' : 'עדכן מצב'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}