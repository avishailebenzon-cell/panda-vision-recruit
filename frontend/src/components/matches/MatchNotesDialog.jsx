import React, { useState, useEffect, useCallback } from "react";
import { MatchNote } from "@/entities/MatchNote";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Plus, Clock, User as UserIcon, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MatchNotesDialog({ match, isOpen, onClose }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, noteId: null, noteText: "" });
  const [deleting, setDeleting] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!match) return;
    
    setLoading(true);
    try {
      const matchNotes = await MatchNote.filter({ match_id: match.id }, '-created_date');
      setNotes(matchNotes);
    } catch (error) {
      console.error("Error loading notes:", error);
    }
    setLoading(false);
  }, [match]);

  const loadUser = useCallback(async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen && match) {
      loadNotes();
      loadUser();
    }
  }, [isOpen, match, loadNotes, loadUser]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !currentUser) return;

    setSaving(true);
    try {
      const noteData = {
        match_id: match.id,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        note_text: newNote.trim(),
        is_system_note: false
      };

      await MatchNote.create(noteData);
      setNewNote("");
      loadNotes(); // Reload notes
    } catch (error) {
      console.error("Error saving note:", error);
      alert("שגיאה בשמירת ההערה");
    }
    setSaving(false);
  };

  const canDeleteNote = (note) => {
    if (!currentUser) return false;
    
    // Admin can delete any note
    if (currentUser.role === 'admin') return true;
    
    // User can delete only their own notes
    return note.user_id === currentUser.id;
  };

  const handleDeleteNote = async (noteId) => {
    setDeleting(true);
    try {
      await MatchNote.delete(noteId);
      loadNotes(); // Reload notes
      setDeleteDialog({ isOpen: false, noteId: null, noteText: "" });
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("שגיאה במחיקת ההערה");
    }
    setDeleting(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              הערות להתאמה: {match?.candidate_name}
              <Badge variant="outline" className="mr-2">
                {notes.length} הערות
              </Badge>
            </DialogTitle>
            <p className="text-sm text-gray-600">
              {match?.job_title || match?.free_text_query?.substring(0, 50) + '...'}
            </p>
          </DialogHeader>

          <div className="flex flex-col h-[50vh]">
            {/* Notes List */}
            <ScrollArea className="flex-1 mb-4">
              {loading ? (
                <div className="text-center py-8 text-gray-500">טוען הערות...</div>
              ) : notes.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence>
                    {notes.map((note) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="border rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-sm">{note.user_name}</span>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {formatDate(note.created_date)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {note.is_system_note && (
                              <Badge variant="secondary" className="text-xs">
                                הערת מערכת
                              </Badge>
                            )}
                            {canDeleteNote(note) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteDialog({
                                  isOpen: true,
                                  noteId: note.id,
                                  noteText: note.note_text
                                })}
                                className="text-red-500 hover:text-red-700 h-6 w-6"
                                title="מחק הערה"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mr-10">
                          {note.note_text}
                        </p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>אין הערות להתאמה זו</p>
                </div>
              )}
            </ScrollArea>

            {/* Add Note Form */}
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <Textarea
                    placeholder="הוסף הערה חדשה..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                      סגור
                    </Button>
                    <Button 
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || saving}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {saving ? (
                        <>
                          <Clock className="w-4 h-4 ml-2 animate-spin" />
                          שומר...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 ml-2" />
                          הוסף הערה
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => 
        !deleting && setDeleteDialog({ isOpen: open, noteId: null, noteText: "" })
      }>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת הערה</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              האם אתה בטוח שברצונך למחוק את ההערה הבאה?
              <br />
              <br />
              <span className="font-medium bg-gray-100 p-2 rounded block">
                "{deleteDialog.noteText?.substring(0, 100)}{deleteDialog.noteText?.length > 100 ? '...' : ''}"
              </span>
              <br />
              פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel 
              onClick={() => setDeleteDialog({ isOpen: false, noteId: null, noteText: "" })}
              disabled={deleting}
              className="mr-0 ml-2"
            >
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleDeleteNote(deleteDialog.noteId)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Clock className="w-4 h-4 ml-2 animate-spin" />
                  מוחק...
                </>
              ) : (
                "מחק הערה"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}