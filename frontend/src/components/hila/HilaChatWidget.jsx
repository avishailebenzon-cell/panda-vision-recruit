import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Send,
  Loader2,
  Bot,
  User as UserIcon,
  AlertCircle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { requestHilaHandoff } from '@/functions/requestHilaHandoff';
import { toast } from 'sonner';

export default function HilaChatWidget({ conversationId, candidateName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [handoffRequested, setHandoffRequested] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    }
  }, [conversationId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async () => {
    try {
      const conv = await base44.agents.getConversation(conversationId);
      setConversation(conv);
      setMessages(conv.messages || []);

      // Check if handoff was already requested
      const whatsappConvs = await base44.entities.WhatsappConversation.filter({ 
        agent_conversation_id: conversationId 
      });
      if (whatsappConvs.length > 0 && whatsappConvs[0].handoff_requested) {
        setHandoffRequested(true);
      }

      base44.agents.subscribeToConversation(conversationId, (data) => {
        setMessages(data.messages || []);
      });
    } catch (e) {
      console.error('Error loading conversation:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading || handoffRequested) return;

    setLoading(true);
    const messageText = input;
    setInput('');

    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: messageText
      });
    } catch (e) {
      console.error('Error sending message:', e);
      toast.error('שגיאה בשליחת ההודעה');
    }
    setLoading(false);
  };

  const handleRequestHandoff = async () => {
    try {
      const result = await requestHilaHandoff({ 
        conversationId: conversationId,
        reason: 'העובד ביקש העברה לסוכן אנושי'
      });
      
      if (result.data?.success) {
        setHandoffRequested(true);
        toast.success('השיחה הועברה לסוכן אנושי');
      } else {
        toast.error('שגיאה בהעברה לסוכן');
      }
    } catch (e) {
      console.error('Error requesting handoff:', e);
      toast.error('שגיאה בהעברה לסוכן אנושי');
    }
  };

  return (
    <div className="space-y-4">
      {handoffRequested && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertCircle className="w-4 h-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            השיחה הועברה לסוכן אנושי. הילה לא תענה יותר להודעות בשיחה זו.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face" 
                alt="הילה" 
                className="w-10 h-10 rounded-full object-cover border-2 border-pink-200"
              />
              <div>
                <CardTitle className="text-base">שיחה עם הילה</CardTitle>
                {candidateName && <p className="text-xs text-gray-600">{candidateName}</p>}
              </div>
            </div>
            {!handoffRequested && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRequestHandoff}
                className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <UserIcon className="w-4 h-4" />
                העבר לסוכן אנושי
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 text-pink-300" />
                <p className="text-sm">היי! אני הילה 👋</p>
                <p className="text-xs mt-1">אני כאן לעזור עם משרות והפניות "חבר מביא חבר"</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2 ${
                    msg.role === 'user' 
                      ? 'bg-pink-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <ReactMarkdown className="text-sm prose prose-sm max-w-none">
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-pink-600" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          {/* Input */}
          <div className="p-3 border-t bg-white flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={handoffRequested ? "השיחה הועברה לסוכן אנושי" : "כתוב הודעה..."}
              className="resize-none min-h-[44px] max-h-24"
              rows={1}
              disabled={handoffRequested}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={loading || !input.trim() || handoffRequested}
              className="bg-pink-600 hover:bg-pink-700 px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}