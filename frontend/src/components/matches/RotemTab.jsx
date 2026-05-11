import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  MessageCircle, 
  Phone, 
  User, 
  Briefcase,
  Clock,
  CheckCircle,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  FileText,
  AlertCircle,
  Send,
  Bot
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

const STATUS_CONFIG = {
  active: { label: 'פעיל', color: 'bg-green-100 text-green-800', icon: MessageCircle },
  waiting_response: { label: 'ממתין לתגובה', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  form_sent: { label: 'נשלח טופס', color: 'bg-blue-100 text-blue-800', icon: FileText },
  completed: { label: 'הושלם', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  not_relevant: { label: 'לא רלוונטי', color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
};

export default function RotemTab() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mainTab, setMainTab] = useState('chat');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversation, setChatConversation] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
    initChat();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const initChat = async () => {
    try {
      const existingConversations = await base44.agents.listConversations({
        agent_name: "rotem_whatsapp"
      });
      
      const myConversation = existingConversations?.find(c => 
        c.metadata?.type === 'admin_chat'
      );

      if (myConversation) {
        setChatConversation(myConversation);
        setChatMessages(myConversation.messages || []);
        
        base44.agents.subscribeToConversation(myConversation.id, (data) => {
          setChatMessages(data.messages || []);
        });
      }
    } catch (e) {
      console.log('Error initializing chat:', e);
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
          agent_name: "rotem_whatsapp",
          metadata: {
            name: "שיחה עם מנהל",
            type: "admin_chat"
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

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { WhatsappConversation } = await import('@/entities/WhatsappConversation');
      const data = await WhatsappConversation.list('-last_message_date', 100);
      setConversations(data);
    } catch (e) {
      console.error('Error loading conversations:', e);
    }
    setLoading(false);
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchTerm || 
      conv.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.candidate_phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusCounts = () => {
    return {
      all: conversations.length,
      active: conversations.filter(c => c.status === 'active').length,
      waiting_response: conversations.filter(c => c.status === 'waiting_response').length,
      form_sent: conversations.filter(c => c.status === 'form_sent').length,
      completed: conversations.filter(c => c.status === 'completed').length,
      not_relevant: conversations.filter(c => c.status === 'not_relevant').length
    };
  };

  const counts = getStatusCounts();
  const whatsappConnectUrl = base44.agents.getWhatsAppConnectURL('rotem_whatsapp');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face" 
            alt="רותם" 
            className="w-12 h-12 rounded-full object-cover border-2 border-teal-200 shadow"
          />
          <div>
            <h2 className="text-xl font-bold text-gray-900">רותם - תקשורת מועמדים</h2>
            <p className="text-sm text-gray-600">שיחות וואטסאפ עם מועמדים</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadConversations} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button asChild size="sm" className="bg-green-600 hover:bg-green-700">
            <a href={whatsappConnectUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 ml-2" />
              חבר וואטסאפ
            </a>
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="chat" className="gap-2">
            <Bot className="w-4 h-4" />
            שיחה עם רותם
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            שיחות מועמדים ({counts.all})
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="m-0 space-y-4">
          <Card className="border-teal-200">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100 pb-3">
              <div className="flex items-center gap-3">
                <img 
                  src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face" 
                  alt="רותם" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-teal-200"
                />
                <div>
                  <CardTitle className="text-base">דברי עם רותם</CardTitle>
                  <p className="text-xs text-gray-600">עדכני אותה על שינויים בהתנהגות, הנחיות חדשות או שאלות</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Chat Messages */}
              <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Bot className="w-12 h-12 mx-auto mb-3 text-teal-300" />
                    <p className="text-sm">היי! אני רותם 👋</p>
                    <p className="text-xs mt-1">תוכלי לעדכן אותי על שינויים או לשאול שאלות</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2 ${
                        msg.role === 'user' 
                          ? 'bg-teal-600 text-white' 
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
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
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
                  placeholder="כתבי הודעה לרותם..."
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
                  className="bg-teal-600 hover:bg-teal-700 px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => setChatInput('רותם, מעכשיו כשמועמד לא מתאים, תודיעי לו בצורה יותר רכה')}
            >
              🎯 שני טון התקשורת
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => setChatInput('רותם, מה הסטטוס של השיחות שלך היום?')}
            >
              📊 סטטוס יומי
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => setChatInput('רותם, תזכירי למועמדים למלא את טופס הפרטים')}
            >
              📝 תזכורת טפסים
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => setChatInput('רותם, איך את מתנהגת כשמועמד לא עונה?')}
            >
              ❓ שאלה על התנהגות
            </Button>
          </div>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="m-0 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-teal-700">פעילות</p>
                    <p className="text-xl font-bold text-teal-800">{counts.active}</p>
                  </div>
                  <MessageCircle className="w-6 h-6 text-teal-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-yellow-700">ממתינים</p>
                    <p className="text-xl font-bold text-yellow-800">{counts.waiting_response}</p>
                  </div>
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700">טופס נשלח</p>
                    <p className="text-xl font-bold text-blue-800">{counts.form_sent}</p>
                  </div>
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-700">הושלמו</p>
                    <p className="text-xl font-bold text-purple-800">{counts.completed}</p>
                  </div>
                  <CheckCircle className="w-6 h-6 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-700">סה"כ</p>
                    <p className="text-xl font-bold text-gray-800">{counts.all}</p>
                  </div>
                  <User className="w-6 h-6 text-gray-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי שם או טלפון..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'active', 'waiting_response', 'form_sent'].map(status => (
                <Badge 
                  key={status}
                  className={`cursor-pointer ${statusFilter === status ? 'bg-teal-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'הכל' : STATUS_CONFIG[status]?.label} ({status === 'all' ? counts.all : counts[status]})
                </Badge>
              ))}
            </div>
          </div>

          {/* Conversations Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>אין שיחות להצגה</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-48">מועמד</TableHead>
                        <TableHead>טלפון</TableHead>
                        <TableHead>משרה</TableHead>
                        <TableHead>סטטוס</TableHead>
                        <TableHead>הודעה אחרונה</TableHead>
                        <TableHead className="w-24">הודעות</TableHead>
                        <TableHead className="w-32">תאריך</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConversations.map((conv) => {
                        const statusConfig = STATUS_CONFIG[conv.status] || STATUS_CONFIG.active;
                        const StatusIcon = statusConfig.icon;
                        return (
                          <TableRow key={conv.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                  <User className="w-4 h-4 text-teal-600" />
                                </div>
                                <span className="font-medium">{conv.candidate_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <a 
                                href={`https://wa.me/${conv.candidate_phone?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-green-600 hover:underline"
                              >
                                <Phone className="w-3 h-3" />
                                {conv.candidate_phone}
                              </a>
                            </TableCell>
                            <TableCell>
                              {conv.job_title ? (
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-3 h-3 text-gray-400" />
                                  <span className="text-sm">{conv.job_title}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusConfig.color} gap-1`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate text-sm text-gray-600">
                                {conv.last_message_direction === 'incoming' && '← '}
                                {conv.last_message_direction === 'outgoing' && '→ '}
                                {conv.last_message_preview || '-'}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{conv.messages_count || 0}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {conv.last_message_date ? 
                                new Date(conv.last_message_date).toLocaleDateString('he-IL') : 
                                new Date(conv.created_date).toLocaleDateString('he-IL')
                              }
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Link Info */}
          <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-teal-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-teal-800">טופס מועמד</h4>
                  <p className="text-sm text-teal-700 mt-1">
                    כאשר מועמד מתאים למשרה, רותם שולחת לו את הקישור לטופס:
                  </p>
                  <a 
                    href="https://forms.gle/66fv2p6rdYEibLR76" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    https://forms.gle/66fv2p6rdYEibLR76
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}