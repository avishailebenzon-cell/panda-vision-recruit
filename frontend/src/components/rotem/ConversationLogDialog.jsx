import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, MessageCircle, User, Bot } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ConversationLogDialog({ isOpen, onClose, task }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (isOpen && task) {
      loadMessages();
      
      // Auto-refresh every 3 seconds if enabled
      if (autoRefresh) {
        const interval = setInterval(() => {
          loadMessages();
        }, 3000);
        
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, task, autoRefresh]);

  const loadMessages = async () => {
    if (!task?.conversation_id) {
      // Try to find conversation by candidate phone
      if (!task?.candidate_phone) return;
      
      setLoading(true);
      try {
        const conversations = await base44.entities.WhatsappConversation.filter({
          candidate_phone: task.candidate_phone
        }, '-created_date', 1);
        
        if (conversations && conversations.length > 0) {
          const conversationId = conversations[0].id;
          const msgs = await base44.entities.WhatsappMessage.filter({
            conversation_id: conversationId
          }, 'created_date', 100);
          
          setMessages(Array.isArray(msgs) ? msgs : []);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const msgs = await base44.entities.WhatsappMessage.filter({
        conversation_id: task.conversation_id
      }, 'created_date', 100);
      
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
    setLoading(false);
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              לוג שיחה - {task.candidate_name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                {messages.length} הודעות
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setAutoRefresh(!autoRefresh);
                }}
                className={autoRefresh ? 'text-green-600' : 'text-gray-400'}
                title={autoRefresh ? 'רענון אוטומטי פעיל' : 'רענון אוטומטי כבוי'}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            משרה: {task.job_title}
          </p>
        </DialogHeader>

        {/* Messages Log - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 rounded-lg border">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>אין הודעות בשיחה זו</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.direction === 'incoming' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                )}
                
                <div className={`max-w-[70%] ${msg.direction === 'outgoing' ? 'bg-green-100 border-green-200' : 'bg-white border-gray-200'} border rounded-lg p-3 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.direction === 'outgoing' ? (
                      <Bot className="w-3 h-3 text-green-600" />
                    ) : (
                      <User className="w-3 h-3 text-blue-600" />
                    )}
                    <span className="text-xs font-medium text-gray-700">
                      {msg.direction === 'outgoing' ? 'טל' : (msg.sender_name || 'מועמד')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.created_date).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                  {msg.status && (
                    <div className="text-xs text-gray-500 mt-1">
                      {msg.status === 'sent' ? '✓ נשלח' : msg.status === 'delivered' ? '✓✓ נמסר' : msg.status === 'read' ? '✓✓ נקרא' : msg.status}
                    </div>
                  )}
                </div>

                {msg.direction === 'outgoing' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Auto Refresh Indicator */}
        {autoRefresh && (
          <div className="flex-shrink-0 bg-green-50 border-t border-green-200 p-2 text-center">
            <p className="text-xs text-green-700 flex items-center justify-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              מתעדכן אוטומטית כל 3 שניות
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}