import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Loader2, MessageCircle, Eye, Trash2 } from 'lucide-react';
import BlurredText from '@/components/ui/BlurredText';
import { toast } from 'sonner';
import WhatsappConversationDialog from './WhatsappConversationDialog';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function DirectOutreachTab() {
  const [outreachData, setOutreachData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [conversationDialog, setConversationDialog] = useState({ isOpen: false, task: null });
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState({ isOpen: false });

  const createTask = async (conv) => {
    if (!conv.candidate_id || !conv.job_id) {
      toast.error('חסרים נתוני מועמד או משרה');
      return;
    }

    try {
      // Get next task number
      const taskNumber = await base44.functions.invoke('getNextTaskNumber', {});

      // Create the task
      await base44.entities.RotemTask.create({
        task_number: taskNumber,
        job_id: conv.job_id,
        job_title: conv.job_title,
        candidate_id: conv.candidate_id,
        candidate_name: conv.candidate_name,
        candidate_phone: conv.phone_number,
        match_id: conv.match_id || '',
        source: 'direct_outreach',
        status: 'לא החל',
        priority: 'בינונית',
        last_outgoing_message_date: conv.first_sent
      });

      toast.success(`משימה ${taskNumber} נוצרה בהצלחה`);
      
      // Reload data to show the new task
      await loadOutreachData();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('שגיאה ביצירת משימה');
    }
  };

  const loadOutreachData = async () => {
    setLoading(true);
    try {
      // Get all WhatsApp messages sent from agents to candidates
      const allMessages = await base44.entities.WhatsappMessage.list('-created_date', 5000);
      
      // Get all RotemTasks to match with messages
      const allTasks = await base44.entities.RotemTask.list('-created_date', 5000);
      
      console.log(`Loaded ${allMessages.length} WhatsApp messages`);
      
      // Group by match_id (or phone_number if no match)
      const grouped = {};
      
      allMessages.forEach(msg => {
        // CRITICAL: Support both old and new message formats
        const messageText = msg.message_text || msg.content || '';
        const candidateName = msg.candidate_name || msg.sender_name || 'מועמד';
        
        // CRITICAL: Group by match_id if available, otherwise by phone number
        const key = msg.match_id || msg.phone_number || msg.candidate_phone;
        
        if (!grouped[key]) {
          grouped[key] = {
            match_id: msg.match_id,
            candidate_id: msg.candidate_id,
            candidate_name: candidateName,
            job_id: msg.job_id,
            job_title: msg.job_title,
            phone_number: msg.phone_number || msg.candidate_phone,
            outgoing_messages: [],
            incoming_messages: [],
            first_sent: null,
            latest_response: null
          };
        } else {
          // Update metadata if missing
          if (!grouped[key].candidate_name && candidateName) {
            grouped[key].candidate_name = candidateName;
          }
          if (!grouped[key].job_title && msg.job_title) {
            grouped[key].job_title = msg.job_title;
          }
          if (!grouped[key].phone_number && (msg.phone_number || msg.candidate_phone)) {
            grouped[key].phone_number = msg.phone_number || msg.candidate_phone;
          }
        }
        
        if (msg.direction === 'outgoing') {
          grouped[key].outgoing_messages.push({...msg, text: messageText});
          if (!grouped[key].first_sent || new Date(msg.created_date) < new Date(grouped[key].first_sent)) {
            grouped[key].first_sent = msg.created_date;
          }
        } else {
          grouped[key].incoming_messages.push({...msg, text: messageText});
        }
      });
      
      // Create a map of tasks by match_id for quick lookup
      const tasksByMatchId = {};
      allTasks.forEach(task => {
        if (task.match_id) {
          tasksByMatchId[task.match_id] = task;
        }
      });
      
      // Determine response status for each conversation
      const conversations = Object.values(grouped)
        .filter(conv => conv.outgoing_messages.length > 0) // Only show conversations where we sent messages
        .map(conv => {
          // Look for existing task for this match
          const existingTask = conv.match_id ? tasksByMatchId[conv.match_id] : null;
          // Sort incoming messages by date (newest first)
          const sortedIncoming = conv.incoming_messages.sort(
            (a, b) => new Date(b.created_date) - new Date(a.created_date)
          );
          
          let responseStatus = null;
          let responseColor = 'gray';
          let responseText = 'לא ענה';
          
          if (sortedIncoming.length > 0) {
            const lastResponse = (sortedIncoming[0].message_text || sortedIncoming[0].content || sortedIncoming[0].text || '').trim();
            conv.latest_response = lastResponse;
            
            if (lastResponse === '1') {
              responseStatus = 'interested';
              responseColor = 'green';
              responseText = 'מעוניין (1)';
            } else if (lastResponse === '0') {
              responseStatus = 'not_interested';
              responseColor = 'red';
              responseText = 'לא מעוניין (0)';
            } else {
              responseStatus = 'other';
              responseColor = 'orange';
              responseText = `ענה: ${lastResponse.substring(0, 30)}${lastResponse.length > 30 ? '...' : ''}`;
            }
          }
          
          return {
            ...conv,
            responseStatus,
            responseColor,
            responseText,
            messageCount: conv.outgoing_messages.length + conv.incoming_messages.length,
            existingTask
          };
        })
        .sort((a, b) => new Date(b.first_sent) - new Date(a.first_sent)); // Sort by most recent first
      
      setOutreachData(conversations);
    } catch (error) {
      console.error('Error loading outreach data:', error);
      toast.error('שגיאה בטעינת נתוני דואר יוצא');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOutreachData();
    
    // Subscribe to WhatsApp message updates for real-time display
    const unsubscribeMessages = base44.entities.WhatsappMessage.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        // Reload data on any new message
        loadOutreachData();
      }
    });
    
    // Subscribe to RotemTask updates for real-time display
    const unsubscribeTasks = base44.entities.RotemTask.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        // Reload data if a task was created
        loadOutreachData();
      }
    });
    
    return () => {
      unsubscribeMessages();
      unsubscribeTasks();
    };
  }, []);

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = outreachData
        .map(conv => conv.outgoing_messages.map(msg => msg.id))
        .flat();
      setSelectedMessages(new Set(allIds));
    } else {
      setSelectedMessages(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) {
      toast.error('לא נבחרו הודעות למחיקה');
      return;
    }

    try {
      const messageIds = Array.from(selectedMessages);
      
      // Delete all selected messages
      await Promise.all(
        messageIds.map(id => base44.entities.WhatsappMessage.delete(id))
      );

      toast.success(`${messageIds.length} הודעות נמחקו בהצלחה`);
      setSelectedMessages(new Set());
      setConfirmDeleteDialog({ isOpen: false });
      await loadOutreachData();
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('שגיאה במחיקת הודעות');
    }
  };

  const handleViewConversation = (conv) => {
    // Create a task-like object for the dialog
    const taskObj = {
      candidate_name: conv.candidate_name,
      candidate_phone: conv.phone_number,
      candidate_id: conv.candidate_id,
      job_title: conv.job_title,
      job_id: conv.job_id
    };
    setConversationDialog({ isOpen: true, task: taskObj });
  };

  const getResponseBadge = (conv) => {
    if (conv.responseStatus === 'interested') {
      return (
        <Badge className="bg-green-500 text-white">
          <CheckCircle className="w-3 h-3 ml-1" />
          {conv.responseText}
        </Badge>
      );
    } else if (conv.responseStatus === 'not_interested') {
      return (
        <Badge className="bg-red-500 text-white">
          <XCircle className="w-3 h-3 ml-1" />
          {conv.responseText}
        </Badge>
      );
    } else if (conv.responseStatus === 'other') {
      return (
        <Badge className="bg-orange-500 text-white">
          <AlertCircle className="w-3 h-3 ml-1" />
          {conv.responseText}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-400 text-white">
          <MessageCircle className="w-3 h-3 ml-1" />
          {conv.responseText}
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            פניות ישירות מהגייסות למועמדים
          </CardTitle>
          <div className="flex gap-2">
            {selectedMessages.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setConfirmDeleteDialog({ isOpen: true })}
              >
                <Trash2 className="w-4 h-4 ml-2" />
                מחק נבחרות ({selectedMessages.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadOutreachData}>
              <RefreshCw className="w-4 h-4 ml-2" />
              רענן
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          הודעות WhatsApp שנשלחו ישירות למועמדים על ידי הגייסות (נעמה, רמי, אליק, איתי, ליאור, אופיר, GC)
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedMessages.size > 0 && selectedMessages.size === outreachData.reduce((sum, conv) => sum + conv.outgoing_messages.length, 0)}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>מספר משימה</TableHead>
                <TableHead>מועמד</TableHead>
                <TableHead>משרה</TableHead>
                <TableHead>טלפון</TableHead>
                <TableHead>תשובת מועמד</TableHead>
                <TableHead>מספר הודעות</TableHead>
                <TableHead>תאריך שליחה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outreachData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    טרם נשלחו הודעות ישירות למועמדים
                  </TableCell>
                </TableRow>
              ) : (
                outreachData.map((conv, idx) => {
                  // Check if all messages in this conversation are selected
                  const allMessagesSelected = conv.outgoing_messages.every(msg => selectedMessages.has(msg.id));
                  const someMessagesSelected = conv.outgoing_messages.some(msg => selectedMessages.has(msg.id));

                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox
                          checked={allMessagesSelected}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedMessages);
                            conv.outgoing_messages.forEach(msg => {
                              if (checked) {
                                newSelected.add(msg.id);
                              } else {
                                newSelected.delete(msg.id);
                              }
                            });
                            setSelectedMessages(newSelected);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                         {conv.existingTask ? (
                           <Badge variant="outline" className="font-mono text-xs">
                             {conv.existingTask.task_number}
                           </Badge>
                         ) : (
                           <Button 
                             size="sm" 
                             variant="outline" 
                             onClick={() => createTask(conv)}
                             disabled={!conv.candidate_id || !conv.job_id}
                             title={!conv.candidate_id ? 'חסר מזהה מועמד' : !conv.job_id ? 'חסר מזהה משרה' : ''}
                           >
                             צור משימה
                           </Button>
                         )}
                       </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <BlurredText>{conv.candidate_name}</BlurredText>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{conv.job_title || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono text-gray-600" dir="ltr">
                          {conv.phone_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getResponseBadge(conv)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {conv.messageCount} הודעות
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(conv.first_sent).toLocaleDateString('he-IL')}
                        <div className="text-xs text-gray-400">
                          {new Date(conv.first_sent).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewConversation(conv)}
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="צפה בשיחה"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* WhatsApp Conversation Dialog */}
      <WhatsappConversationDialog
        isOpen={conversationDialog.isOpen}
        onClose={() => setConversationDialog({ isOpen: false, task: null })}
        task={conversationDialog.task}
        onMessageSent={loadOutreachData}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteDialog.isOpen}
        onClose={() => setConfirmDeleteDialog({ isOpen: false })}
        onConfirm={handleDeleteSelected}
        title="מחיקת הודעות נבחרות"
        message={`האם אתה בטוח שברצונך למחוק ${selectedMessages.size} הודעות?`}
        confirmText="מחק"
        cancelText="ביטול"
        variant="destructive"
      />
    </Card>
  );
}