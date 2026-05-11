import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Loader2, 
  Bot,
  Briefcase,
  Building,
  ExternalLink,
  RefreshCw,
  History,
  MessageSquare
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

export default function DanaManagement() {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversation, setChatConversation] = useState(null);
  const [recentDeals, setRecentDeals] = useState([]);
  const [allConversations, setAllConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    initChat();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const initChat = async () => {
    try {
      const existingConversations = await base44.agents.listConversations({
        agent_name: "dana_pipedrive"
      });
      
      setAllConversations(existingConversations || []);
      
      // Find most recent conversation or create new
      if (existingConversations?.length > 0) {
        const recent = existingConversations[0];
        setChatConversation(recent);
        setChatMessages(recent.messages || []);
        
        base44.agents.subscribeToConversation(recent.id, (data) => {
          setChatMessages(data.messages || []);
        });
      }
    } catch (e) {
      console.log('Error initializing chat:', e);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const conversation = await base44.agents.getConversation(conversationId);
      setChatConversation(conversation);
      setChatMessages(conversation.messages || []);
      setShowHistory(false);
      
      base44.agents.subscribeToConversation(conversation.id, (data) => {
        setChatMessages(data.messages || []);
      });
    } catch (e) {
      console.error('Error loading conversation:', e);
    }
  };

  const startNewConversation = async () => {
    try {
      const conversation = await base44.agents.createConversation({
        agent_name: "dana_pipedrive",
        metadata: {
          name: `משרה חדשה - ${new Date().toLocaleDateString('he-IL')}`,
          type: "job_creation"
        }
      });
      setChatConversation(conversation);
      setChatMessages([]);
      setShowHistory(false);
      
      // Update conversations list
      setAllConversations(prev => [conversation, ...prev]);
      
      base44.agents.subscribeToConversation(conversation.id, (data) => {
        setChatMessages(data.messages || []);
      });

      // Send initial greeting
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: "היי דנה, אני רוצה להוסיף משרה חדשה לפייפדרייב"
      });
    } catch (e) {
      console.error('Error starting conversation:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    setChatLoading(true);
    const messageText = chatInput;
    setChatInput('');

    try {
      let conversation = chatConversation;
      
      if (!conversation) {
        conversation = await base44.agents.createConversation({
          agent_name: "dana_pipedrive",
          metadata: {
            name: `משרה חדשה - ${new Date().toLocaleDateString('he-IL')}`,
            type: "job_creation"
          }
        });
        setChatConversation(conversation);
        
        base44.agents.subscribeToConversation(conversation.id, (data) => {
          setChatMessages(data.messages || []);
        });
      }

      await base44.agents.addMessage(conversation, {
        role: "user",
        content: messageText
      });

    } catch (e) {
      console.error('Error sending message:', e);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'סליחה, משהו השתבש. נסי שוב.'
      }]);
    }
    setChatLoading(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&h=100&fit=crop&crop=face" 
            alt="דנה" 
            className="w-16 h-16 rounded-full object-cover border-4 border-blue-200 shadow-lg"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">דנה - הוספת משרות לפייפדרייב</h1>
            <p className="text-gray-600">ספר לי על המשרה החדשה ואני אוסיף אותה לפייפדרייב</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowHistory(!showHistory)} variant="outline">
            <History className="w-4 h-4 ml-2" />
            היסטוריית שיחות ({allConversations.length})
          </Button>
          <Button onClick={startNewConversation} className="bg-blue-600 hover:bg-blue-700">
            <Briefcase className="w-4 h-4 ml-2" />
            משרה חדשה
          </Button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              שיחות קודמות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allConversations.length === 0 ? (
              <p className="text-center text-gray-500 py-4">אין שיחות קודמות</p>
            ) : (
              <div className="space-y-2">
                {allConversations.map((conv) => (
                  <div 
                    key={conv.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-400 hover:bg-blue-50 ${
                      chatConversation?.id === conv.id ? 'bg-blue-100 border-blue-400' : 'bg-white'
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-sm">{conv.metadata?.name || 'שיחה ללא כותרת'}</h4>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(conv.created_date).toLocaleDateString('he-IL')} בשעה{' '}
                          {new Date(conv.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {conv.messages?.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                            {conv.messages[conv.messages.length - 1]?.content?.substring(0, 60)}...
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {conv.messages?.length || 0} הודעות
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=60&h=60&fit=crop&crop=face" 
                    alt="דנה" 
                    className="w-10 h-10 rounded-full object-cover border-2 border-blue-200"
                  />
                  <div>
                    <CardTitle className="text-base">שיחה עם דנה</CardTitle>
                    <p className="text-xs text-gray-600">ספר לי על המשרה ואני אוסיף אותה לפייפדרייב</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={startNewConversation}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Chat Messages */}
              <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Bot className="w-12 h-12 mx-auto mb-3 text-blue-300" />
                    <p className="text-sm">היי! אני דנה 👋</p>
                    <p className="text-xs mt-1">ספר לי על המשרה החדשה שתרצה להוסיף לפייפדרייב</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={startNewConversation}
                    >
                      התחל שיחה חדשה
                    </Button>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2 ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white' 
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
                {chatLoading && (
                  <div className="flex justify-end">
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              {/* Chat Input */}
              <div className="p-3 border-t bg-white flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="כתוב הודעה לדנה..."
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
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                מה דנה יכולה לעשות?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700 space-y-2">
              <p>✅ ליצור דיל חדש בפייפדרייב</p>
              <p>✅ להוסיף ארגון חדש אם לא קיים</p>
              <p>✅ להוסיף איש קשר חדש</p>
              <p>✅ למלא את כל שדות המשרה</p>
              <p>✅ להוסיף הערה עם כל הפרטים</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-600" />
                שדות נדרשים למשרה
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-600 space-y-1">
              <p>• שם הדיל</p>
              <p>• Pipeline (לוח משרות)</p>
              <p>• שם הלקוח/איש קשר</p>
              <p>• שם הארגון</p>
              <p>• שם המשרה (Job Title)</p>
              <p>• תיאור המשרה</p>
              <p>• דרישות התפקיד</p>
              <p>• מיקום המשרה</p>
              <p>• סיווג ביטחוני</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ExternalLink className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800 text-sm">קישור לפייפדרייב</h4>
                  <a 
                    href="https://pandatech.pipedrive.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-green-600 hover:underline"
                  >
                    פתח את Pipedrive
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}