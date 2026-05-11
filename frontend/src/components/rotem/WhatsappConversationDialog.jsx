import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Send, 
  Loader2,
  User,
  RefreshCw,
  Phone,
  ExternalLink,
  Image,
  FileText,
  Mic
} from "lucide-react";
import { WhatsappMessage } from "@/entities/WhatsappMessage";
import { WhatsappConversation } from "@/entities/WhatsappConversation";
import { Candidate } from "@/entities/Candidate";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function WhatsappConversationDialog({ 
  isOpen, 
  onClose, 
  task,
  onMessageSent
}) {
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isSimulation, setIsSimulation] = useState(false);
  const messagesEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && task) {
      loadConversation();
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [isOpen, task]);

  useEffect(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    if (isOpen && autoRefresh) {
      let pollCounter = 0;
      refreshIntervalRef.current = setInterval(() => {
        pollCounter++;
        loadMessages(false, pollCounter % 5 === 0);
      }, 5000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [isOpen, autoRefresh, task?.candidate_phone]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversation = async () => {
    setLoading(true);
    try {
      let convs = [];
      if (task.candidate_phone) {
        convs = await WhatsappConversation.filter({ candidate_phone: task.candidate_phone }, '-created_date', 10);
      }
      if (convs.length === 0 && task.candidate_id) {
        convs = await WhatsappConversation.filter({ candidate_id: task.candidate_id }, '-created_date', 10);
      }
      setConversation(convs.length > 0 ? convs[0] : null);
      await loadMessages(true);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
    setLoading(false);
  };

  const loadMessages = async (showLoading = true, triggerPoll = false) => {
    if (showLoading) setLoading(true);
    try {
      if (triggerPoll) {
        base44.functions.invoke('pollGreenApiMessages', {}).catch(() => {});
      }

      let msgs = [];
      let phoneToSearch = task.candidate_phone;
      if (!phoneToSearch && task.candidate_id) {
        try {
          const candidateData = await Candidate.get(task.candidate_id);
          phoneToSearch = candidateData?.phone_primary;
        } catch (e) {}
      }

      if (phoneToSearch) {
        const phone = phoneToSearch.replace(/\D/g, '');
        const formats = new Set([phone]);
        if (phone.startsWith('0')) formats.add('972' + phone.slice(1));
        else if (!phone.startsWith('972')) formats.add('972' + phone);
        if (phone.startsWith('972')) formats.add('0' + phone.slice(3));
        else if (!phone.startsWith('0')) formats.add('0' + phone);
        if (phone.startsWith('972')) formats.add(phone.slice(3));
        if (phone.startsWith('0')) formats.add(phone.slice(1));

        const results = await Promise.all(
          Array.from(formats).map(p => WhatsappMessage.filter({ candidate_phone: p }, '-created_date', 100).catch(() => []))
        );

        const uniqueMsgs = new Map();
        results.flat().forEach(msg => { if (!uniqueMsgs.has(msg.id)) uniqueMsgs.set(msg.id, msg); });
        msgs = Array.from(uniqueMsgs.values());
      }

      msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

      setMessages(prev => {
        if (prev.length !== msgs.length || msgs.some((m, i) => !prev[i] || prev[i].id !== m.id)) return msgs;
        return prev;
      });
    } catch (error) {
      console.error("Error loading messages:", error);
    }
    if (showLoading) setLoading(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !task.candidate_phone) return;
    setSending(true);
    try {
      const phone = task.candidate_phone.replace(/\D/g, '');
      const direction = isSimulation ? 'incoming' : 'outgoing';
      const senderName = isSimulation ? (task.candidate_name || 'מועמד') : 'טל';

      await WhatsappMessage.create({
        conversation_id: conversation?.id || '',
        candidate_phone: phone,
        direction,
        content: newMessage,
        sender_name: senderName,
        status: isSimulation ? 'delivered' : 'sent'
      });

      if (conversation) {
        await WhatsappConversation.update(conversation.id, {
          last_message_date: new Date().toISOString(),
          last_message_direction: direction,
          last_message_preview: newMessage.substring(0, 100),
          messages_count: (conversation.messages_count || 0) + 1
        });
      }

      setNewMessage('');
      await loadMessages(false);
      if (onMessageSent) onMessageSent();
      toast.success(isSimulation ? "הודעת מועמד סומולצה בהצלחה" : "ההודעה נשמרה בהצלחה");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("שגיאה בשמירת ההודעה");
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('he-IL', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem'
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const todayStr = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const dateStr2 = date.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    if (dateStr2 === todayStr) return 'היום';
    if (dateStr2 === yesterdayStr) return 'אתמול';
    return dateStr2;
  };

  const getMediaIcon = (type) => {
    if (type === 'image') return <Image className="w-4 h-4" />;
    if (type === 'document') return <FileText className="w-4 h-4" />;
    if (type === 'audio') return <Mic className="w-4 h-4" />;
    return null;
  };

  // Group by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_date);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col" style={{ height: '85vh', maxHeight: '700px' }} dir="rtl">
        
        {/* WhatsApp-style header */}
        <div className="flex items-center gap-3 p-3 bg-[#075E54] text-white flex-shrink-0">
          <div className="w-10 h-10 bg-green-300 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-green-900" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{task?.candidate_name}</div>
            {task?.candidate_phone && (
              <div className="text-xs text-green-200 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {task.candidate_phone}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadMessages(true, true)}
            className="h-8 w-8 text-white hover:bg-green-700"
            title="רענן"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages area with WhatsApp background */}
        <div 
          className="flex-1 overflow-y-auto p-3 space-y-1"
          style={{ 
            background: '#e5ddd5',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5b8ac' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-green-700" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="w-12 h-12 mb-3 text-gray-400" />
              <p className="text-sm bg-white/70 px-4 py-2 rounded-lg">אין הודעות עדיין</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex justify-center my-3">
                  <span className="bg-[#e1f3fb] text-[#54656f] text-xs px-3 py-1 rounded-full shadow-sm">
                    {date}
                  </span>
                </div>

                {dateMessages.map((message) => {
                  const isOutgoing = message.direction === 'outgoing';
                  return (
                    <div
                      key={message.id}
                      className={`flex mb-1 ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`relative max-w-[75%] rounded-lg px-3 pt-2 pb-1 shadow-sm ${
                          isOutgoing
                            ? 'bg-[#dcf8c6] text-gray-900 rounded-br-none'
                            : 'bg-white text-gray-900 rounded-bl-none'
                        }`}
                      >
                        {/* Sender name */}
                        {!isOutgoing && (
                          <div className="text-xs font-semibold text-[#075E54] mb-1">
                            {message.sender_name || task?.candidate_name || 'מועמד'}
                          </div>
                        )}
                        {isOutgoing && (
                          <div className="text-xs font-semibold text-[#128c7e] mb-1 text-left">
                            {message.sender_name || 'טל'}
                          </div>
                        )}

                        {/* Media */}
                        {message.media_type && (
                          <div className="flex items-center gap-1 mb-1 text-xs text-gray-500">
                            {getMediaIcon(message.media_type)}
                            {message.media_url && (
                              <a href={message.media_url} target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1">
                                פתח קובץ <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Message text */}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

                        {/* Timestamp + checkmarks */}
                        <div className={`flex items-center gap-1 mt-0.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] text-gray-400">{formatTime(message.created_date)}</span>
                          {isOutgoing && (
                            <span className={`text-[11px] ${message.status === 'read' ? 'text-blue-500' : 'text-gray-400'}`}>
                              {message.status === 'read' || message.status === 'delivered' ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 bg-[#f0f0f0] border-t">
          {/* Options row */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
              רענון אוטומטי
              {autoRefresh && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-blue-600 cursor-pointer bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              <input type="checkbox" checked={isSimulation} onChange={(e) => setIsSimulation(e.target.checked)} className="rounded" />
              סמלץ הודעת מועמד
            </label>
          </div>

          {/* Message input row */}
          <div className="flex items-end gap-2 px-3 pb-3">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isSimulation ? "הקלד הודעה כאילו מהמועמד..." : "הקלד הודעה..."}
              disabled={sending || !task?.candidate_phone}
              rows={1}
              className="flex-1 resize-none rounded-2xl bg-white border-0 shadow-sm text-sm min-h-[40px] max-h-[120px] overflow-y-auto py-2.5 px-3 focus:ring-1 focus:ring-green-400"
              style={{ lineHeight: '1.4' }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={sending || !newMessage.trim() || !task?.candidate_phone}
              className={`h-10 w-10 rounded-full p-0 flex-shrink-0 ${isSimulation ? 'bg-blue-500 hover:bg-blue-600' : 'bg-[#075E54] hover:bg-[#054c43]'}`}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}