import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Loader2, 
  Bot,
  RefreshCw,
  Maximize2,
  Minimize2,
  MessageSquarePlus,
  Paperclip,
  X,
  History,
  MessageSquare
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { UploadFile } from '@/integrations/Core';

export default function DanaChatDialog({ isOpen, onClose, onSuccess }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversation, setChatConversation] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [allConversations, setAllConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      initChat();
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const initChat = async () => {
    try {
      const existingConversations = await base44.agents.listConversations({
        agent_name: "dana_pipedrive"
      });
      
      setAllConversations(existingConversations || []);
      
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
      
      setAllConversations(prev => [conversation, ...prev]);
      
      base44.agents.subscribeToConversation(conversation.id, (data) => {
        setChatMessages(data.messages || []);
      });

      await base44.agents.addMessage(conversation, {
        role: "user",
        content: "היי דנה, אני רוצה להוסיף משרה חדשה למערכת"
      });
    } catch (e) {
      console.error('Error starting conversation:', e);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await UploadFile({ file });
      setUploadedFiles(prev => [...prev, { name: file.name, url: file_url }]);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('שגיאה בהעלאת הקובץ');
    }
    setUploadingFile(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!chatInput.trim() && uploadedFiles.length === 0) || chatLoading) return;
    
    setChatLoading(true);
    const messageText = chatInput;
    const filesToSend = [...uploadedFiles];
    
    setChatInput('');
    setUploadedFiles([]);

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

      const messageData = {
        role: 'user',
        content: messageText || 'הנה הקובץ:'
      };
      
      if (filesToSend.length > 0) {
        messageData.file_urls = filesToSend.map(f => f.url);
      }

      await base44.agents.addMessage(conversation, messageData);
      
      // Update conversations list if this is new
      if (!allConversations.find(c => c.id === conversation.id)) {
        setAllConversations(prev => [conversation, ...prev]);
      }

    } catch (e) {
      console.error('Error sending message:', e);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'סליחה, משהו השתבש. נסי שוב.'
      }]);
    }
    setChatLoading(false);
  };

  const handleClose = () => {
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${isMaximized ? 'max-w-[98vw] h-[98vh]' : 'max-w-[95vw] md:max-w-2xl max-h-[90vh]'} overflow-hidden mx-4 transition-all`}>
        <DialogHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=60&h=60&fit=crop&crop=face" 
                alt="דנה" 
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-200"
              />
              <div>
                <DialogTitle className="text-lg">דנה - הוספת משרה למערכת</DialogTitle>
                <p className="text-xs text-gray-600">עדכן אותי על משרה חדשה או איש קשר חדש. במשרה עדכן אותי באיזה פייפליין היא תהיה</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowHistory(!showHistory)}
                title="היסטוריית שיחות"
              >
                <History className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={startNewConversation}
                title="התחל שיחה חדשה"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "הקטן מסך" : "הגדל מסך"}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* History Panel */}
        {showHistory && (
          <div className="bg-white border-b border-gray-200 -mx-6 px-6 py-4 max-h-64 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" />
              שיחות קודמות ({allConversations.length})
            </h3>
            {allConversations.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">אין שיחות קודמות</p>
            ) : (
              <div className="space-y-2">
                {allConversations.map((conv) => (
                  <div 
                    key={conv.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-400 hover:bg-blue-50 ${
                      chatConversation?.id === conv.id ? 'bg-blue-100 border-blue-400' : 'bg-gray-50'
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
                            {conv.messages[conv.messages.length - 1]?.content?.substring(0, 50)}...
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {conv.messages?.length || 0} הודעות
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Messages */}
        <div className={`${isMaximized ? 'h-[calc(98vh-220px)]' : 'h-80'} overflow-y-auto p-4 space-y-3 bg-gray-50 -mx-6`}>
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Bot className="w-12 h-12 mx-auto mb-3 text-blue-300" />
              <p className="text-sm">היי! אני דנה 👋</p>
              <p className="text-xs mt-1">העתק הנה טקסט של משרה או העלה תמונה/PDF ואני אנתח ואוסיף למערכת</p>
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
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} px-4`}>
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
            <div className="flex justify-end px-4">
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Chat Input */}
        <div className="pt-3 border-t -mx-6 px-6">
          {uploadedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  <span className="text-sm text-blue-800">{file.name}</span>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={chatLoading || uploadingFile}
              className="flex-shrink-0"
              title="צרף תמונה או PDF"
            >
              {uploadingFile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </Button>
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="כתוב הודעה או צרף תמונה/PDF..."
              className="resize-none min-h-[80px]"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={chatLoading || (!chatInput.trim() && uploadedFiles.length === 0)}
              className="bg-blue-600 hover:bg-blue-700 px-3 flex-shrink-0"
            >
              {chatLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}