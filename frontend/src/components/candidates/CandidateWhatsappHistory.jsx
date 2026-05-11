import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  Loader2, 
  Phone,
  Bot,
  ExternalLink
} from 'lucide-react';

const STATUS_CONFIG = {
  active: { label: 'פעיל', color: 'bg-green-100 text-green-800' },
  waiting_response: { label: 'ממתין לתגובה', color: 'bg-yellow-100 text-yellow-800' },
  form_sent: { label: 'נשלח טופס', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'הושלם', color: 'bg-purple-100 text-purple-800' },
  not_relevant: { label: 'לא רלוונטי', color: 'bg-gray-100 text-gray-800' }
};

export default function CandidateWhatsappHistory({ 
  isOpen, 
  onClose, 
  candidate 
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);

  useEffect(() => {
    if (isOpen && candidate) {
      loadConversations();
    }
  }, [isOpen, candidate]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { WhatsappConversation } = await import('@/entities/WhatsappConversation');
      const allConversations = await WhatsappConversation.list('-last_message_date', 500);
      
      // Filter by candidate
      const candidateConversations = allConversations.filter(c => 
        c.candidate_id === candidate.id || 
        c.candidate_phone === candidate.phone_primary ||
        c.candidate_name === `${candidate.first_name} ${candidate.last_name}`
      );
      
      setConversations(candidateConversations);
      if (candidateConversations.length > 0) {
        setSelectedConversation(candidateConversations[0]);
      }
    } catch (e) {
      console.error('Error loading conversations:', e);
    }
    setLoading(false);
  };

  if (!candidate) return null;

  const candidateName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <span>שיחות וואטסאפ - {candidateName}</span>
              {candidate.phone_primary && (
                <p className="text-sm font-normal text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {candidate.phone_primary}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">אין שיחות וואטסאפ עם מועמד זה</p>
            <p className="text-sm mt-1">שיחות עם רותם יופיעו כאן</p>
          </div>
        ) : (
          <div className="flex gap-4 h-[50vh]">
            {/* Conversations List */}
            <div className="w-1/3 border-l pl-4">
              <p className="text-xs font-medium text-gray-500 mb-2">{conversations.length} שיחות</p>
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {conversations.map((conv) => {
                    const statusConfig = STATUS_CONFIG[conv.status] || STATUS_CONFIG.active;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedConversation?.id === conv.id 
                            ? 'bg-green-100 border border-green-300' 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={`${statusConfig.color} text-xs`}>
                            {statusConfig.label}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {conv.messages_count || 0} הודעות
                          </span>
                        </div>
                        {conv.job_title && (
                          <p className="text-xs text-gray-600 truncate">{conv.job_title}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {conv.last_message_date 
                            ? new Date(conv.last_message_date).toLocaleDateString('he-IL')
                            : new Date(conv.created_date).toLocaleDateString('he-IL')
                          }
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Conversation Detail */}
            <div className="flex-1">
              {selectedConversation ? (
                <div className="h-full flex flex-col">
                  {/* Conversation Header */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        {selectedConversation.job_title && (
                          <p className="font-medium text-sm">{selectedConversation.job_title}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          נוצר: {new Date(selectedConversation.created_date).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a 
                          href={`https://wa.me/${candidate.phone_primary?.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3 ml-1" />
                          פתח וואטסאפ
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 bg-gray-100 rounded-lg p-3">
                    {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                      <div className="space-y-3">
                        {selectedConversation.messages.map((msg, idx) => (
                          <div 
                            key={idx} 
                            className={`flex ${msg.direction === 'outgoing' || msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                              msg.direction === 'outgoing' || msg.role === 'assistant'
                                ? 'bg-green-500 text-white' 
                                : 'bg-white border text-gray-800'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content || msg.text}</p>
                              <p className={`text-xs mt-1 ${
                                msg.direction === 'outgoing' || msg.role === 'assistant' 
                                  ? 'text-green-100' 
                                  : 'text-gray-400'
                              }`}>
                                {msg.timestamp 
                                  ? new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                  : ''
                                }
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Bot className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">השיחה נוהלה על ידי רותם</p>
                        <p className="text-xs mt-1">
                          {selectedConversation.last_message_preview || 'אין תצוגה מקדימה'}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>בחר שיחה מהרשימה</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}