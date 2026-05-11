import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Loader2, 
  Bot, 
  User,
  RefreshCw
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

const AGENT_MAP = {
  'rotem': 'rotem_whatsapp',
  'hila': 'hila_distributor',
  'naama': 'naama_matcher',
  'roee': 'roee_job_finder',
  'shiri': 'shiri_hr'
};

const AGENT_IMAGES = {
  'rotem': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face',
  'hila': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face',
  'naama': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face',
  'roee': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face',
  'shiri': 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=60&h=60&fit=crop&crop=face'
};

export default function AgentChatTab({ agentId, agentName }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const chatEndRef = useRef(null);

  const agentSystemName = AGENT_MAP[agentId] || agentId;

  useEffect(() => {
    initChat();
    return () => {
      // Cleanup subscription if exists
    };
  }, [agentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async () => {
    try {
      const existingConversations = await base44.agents.listConversations({
        agent_name: agentSystemName
      });
      
      const myConversation = existingConversations?.find(c => 
        c.metadata?.type === 'admin_test_chat'
      );

      if (myConversation) {
        setConversation(myConversation);
        setMessages(myConversation.messages || []);
        
        base44.agents.subscribeToConversation(myConversation.id, (data) => {
          setMessages(data.messages || []);
        });
      }
    } catch (e) {
      console.log('Error initializing chat:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return;
    
    setLoading(true);
    const messageText = inputValue;
    setInputValue('');

    try {
      let conv = conversation;
      
      if (!conv) {
        conv = await base44.agents.createConversation({
          agent_name: agentSystemName,
          metadata: {
            name: `שיחת בדיקה - ${agentName}`,
            type: "admin_test_chat"
          }
        });
        setConversation(conv);
        
        base44.agents.subscribeToConversation(conv.id, (data) => {
          setMessages(data.messages || []);
        });
      }

      await base44.agents.addMessage(conv, {
        role: "user",
        content: messageText
      });

    } catch (e) {
      console.error('Error sending message:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'סליחה, משהו השתבש. נסה שוב.'
      }]);
    }
    setLoading(false);
  };

  const handleClearChat = async () => {
    if (!conversation) return;
    
    try {
      // Create a new conversation instead of clearing
      const conv = await base44.agents.createConversation({
        agent_name: agentSystemName,
        metadata: {
          name: `שיחת בדיקה - ${agentName}`,
          type: "admin_test_chat"
        }
      });
      setConversation(conv);
      setMessages([]);
      
      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
      });
    } catch (e) {
      console.error('Error clearing chat:', e);
    }
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={AGENT_IMAGES[agentId]} 
              alt={agentName} 
              className="w-10 h-10 rounded-full object-cover border-2 border-blue-200"
            />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                שיחת בדיקה עם {agentName}
                <Badge variant="outline" className="text-xs">מצב בדיקה</Badge>
              </CardTitle>
              <p className="text-xs text-gray-600">בדוק איך הסוכן מגיב להודעות שונות</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClearChat} className="gap-1">
            <RefreshCw className="w-4 h-4" />
            נקה שיחה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Chat Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Bot className="w-12 h-12 mx-auto mb-3 text-blue-300" />
              <p className="text-sm">שלח הודעה כדי לבדוק את תגובת הסוכן</p>
              <p className="text-xs mt-1 text-gray-400">הסוכן יגיב בדיוק כמו שהיה מגיב למועמד/עובד אמיתי</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className="flex items-start gap-2 max-w-[85%]">
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`rounded-xl px-4 py-2 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>p]:m-0">
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {msg.role === 'assistant' && (
                    <img 
                      src={AGENT_IMAGES[agentId]} 
                      alt={agentName} 
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                </div>
                <img 
                  src={AGENT_IMAGES[agentId]} 
                  alt={agentName} 
                  className="w-7 h-7 rounded-full object-cover"
                />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Chat Input */}
        <div className="p-3 border-t bg-white flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`כתוב הודעה ל${agentName}...`}
            className="resize-none min-h-[44px] max-h-24"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={loading || !inputValue.trim()}
            className="bg-blue-600 hover:bg-blue-700 px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}