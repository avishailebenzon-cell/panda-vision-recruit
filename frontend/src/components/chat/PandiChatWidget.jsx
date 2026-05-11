import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Loader2, Maximize2, Minimize2, RotateCcw, History, ChevronRight, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

// Panda icon as SVG
const PandaIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Face */}
    <circle cx="50" cy="50" r="40" fill="white" stroke="#1a1a1a" strokeWidth="2"/>
    {/* Left ear */}
    <circle cx="20" cy="20" r="15" fill="#1a1a1a"/>
    {/* Right ear */}
    <circle cx="80" cy="20" r="15" fill="#1a1a1a"/>
    {/* Left eye patch */}
    <ellipse cx="35" cy="45" rx="12" ry="14" fill="#1a1a1a"/>
    {/* Right eye patch */}
    <ellipse cx="65" cy="45" rx="12" ry="14" fill="#1a1a1a"/>
    {/* Left eye */}
    <circle cx="35" cy="45" r="5" fill="white"/>
    <circle cx="36" cy="44" r="2" fill="#1a1a1a"/>
    {/* Right eye */}
    <circle cx="65" cy="45" r="5" fill="white"/>
    <circle cx="66" cy="44" r="2" fill="#1a1a1a"/>
    {/* Nose */}
    <ellipse cx="50" cy="60" rx="6" ry="4" fill="#1a1a1a"/>
    {/* Mouth */}
    <path d="M 44 68 Q 50 74 56 68" stroke="#1a1a1a" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

// Notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Could not play notification sound');
  }
};

// Typing sound effect
let typingInterval = null;
const startTypingSound = () => {
  try {
    const playClick = () => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Soft click sound
      oscillator.frequency.setValueAtTime(1200 + Math.random() * 400, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.03, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    };
    
    // Play clicks at random intervals to simulate typing
    typingInterval = setInterval(() => {
      if (Math.random() > 0.3) { // 70% chance to play
        playClick();
      }
    }, 80 + Math.random() * 60);
  } catch (e) {
    console.log('Could not play typing sound');
  }
};

const stopTypingSound = () => {
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
};

export default function PandiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationsList, setConversationsList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize conversation
  useEffect(() => {
    if (isOpen && !conversation) {
      initConversation();
    }
  }, [isOpen]);

  // Subscribe to conversation updates
  useEffect(() => {
    if (!conversation?.id) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      if (data.messages) {
        const newMessages = data.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.tool_calls
        }));
        
        // Check if last message is complete (assistant message without pending tool calls)
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg?.content && !isLoading) {
          // Message complete, sound was already played when loading finished
        }
        
        setMessages(newMessages);
      }
    });

    return () => unsubscribe();
  }, [conversation?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadConversationsList = async () => {
    try {
      const conversations = await base44.agents.listConversations({
        agent_name: "pandi_assistant"
      });
      setConversationsList(conversations || []);
    } catch (error) {
      console.error('Error loading conversations list:', error);
    }
  };

  const initConversation = async () => {
    try {
      const existingConversations = await base44.agents.listConversations({
        agent_name: "pandi_assistant"
      });
      setConversationsList(existingConversations || []);

      let conv;
      if (existingConversations && existingConversations.length > 0) {
        conv = await base44.agents.getConversation(existingConversations[0].id);
        setConversation(conv);
        
        if (conv.messages && conv.messages.length > 0) {
          setMessages(conv.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            tool_calls: msg.tool_calls
          })));
        } else {
          setMessages([{
            role: 'assistant',
            content: 'שלום! 🐼 אני פנדי, סוכנת AI מתקדמת של צוות הגיוס.\n\nאני יכולה לעזור לך עם:\n🔍 חיפוש מועמדים מתקדם (לפי כישורים, תגיות, סיווג)\n🔐 מציאת מועמדי רמה 1 (סיווג בטחוני)\n📊 ניתוח התאמות שנעמה ורועי יצרו\n\nמה תרצה/י לחפש?'
          }]);
        }
      } else {
        conv = await base44.agents.createConversation({
          agent_name: "pandi_assistant",
          metadata: {
            name: "שיחה חדשה",
          }
        });
        setConversation(conv);
        setMessages([{
          role: 'assistant',
          content: 'שלום! 🐼 אני פנדי, סוכנת AI מתקדמת של צוות הגיוס.\n\nאני יכולה לעזור לך עם:\n🔍 חיפוש מועמדים מתקדם (לפי כישורים, תגיות, סיווג)\n🔐 מציאת מועמדי רמה 1 (סיווג בטחוני)\n📊 ניתוח התאמות שנעמה ורועי יצרו\n\nמה תרצה/י לחפש?'
        }]);
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
      setMessages([{
        role: 'assistant',
        content: 'מצטערת, נתקלתי בבעיה. נסה לרענן את הדף. 😔'
      }]);
    }
  };

  const startNewConversation = async () => {
    setIsLoading(true);
    try {
      const conv = await base44.agents.createConversation({
        agent_name: "pandi_assistant",
        metadata: {
          name: "שיחה חדשה",
        }
      });
      setConversation(conv);
      setMessages([{
        role: 'assistant',
        content: 'שלום! 🐼 התחלנו שיחה חדשה.\n\nאיך אוכל לעזור לך?'
      }]);
      await loadConversationsList();
      setShowHistory(false);
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
    setIsLoading(false);
  };

  const loadConversation = async (convId) => {
    setIsLoading(true);
    try {
      const conv = await base44.agents.getConversation(convId);
      setConversation(conv);
      if (conv.messages && conv.messages.length > 0) {
        setMessages(conv.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.tool_calls
        })));
      } else {
        setMessages([{
          role: 'assistant',
          content: 'שיחה זו ריקה. מה תרצה לשאול?'
        }]);
      }
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
    setIsLoading(false);
  };

  const getConversationTitle = (conv) => {
    if (conv.metadata?.name && conv.metadata.name !== 'שיחה חדשה' && conv.metadata.name !== 'שיחה עם פנדי') {
      return conv.metadata.name;
    }
    // Try to get title from first user message
    if (conv.messages && conv.messages.length > 0) {
      const firstUserMsg = conv.messages.find(m => m.role === 'user');
      if (firstUserMsg?.content) {
        return firstUserMsg.content.substring(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '');
      }
    }
    return 'שיחה מ-' + new Date(conv.created_date).toLocaleDateString('he-IL');
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !conversation) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Start typing sound
    startTypingSound();

    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: userMessage
      });
      
      // Stop typing and play completion sound
      stopTypingSound();
      playNotificationSound();
    } catch (error) {
      stopTypingSound();
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'מצטערת, נתקלתי בבעיה בעיבוד הבקשה. נסה שוב. 😔'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-14 right-6 h-14 w-14 rounded-full shadow-lg z-50 p-0 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0 transition-all hover:scale-110 animate-pulse ${isOpen ? 'hidden' : ''}`}
        title="פנדי - העוזרת האישית"
      >
        <PandaIcon className="w-10 h-10" />
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card 
          className={`fixed shadow-2xl z-50 flex flex-col overflow-hidden border-2 border-gray-200 transition-all duration-300 ${
            isExpanded 
              ? 'bottom-4 right-4 left-4 top-4 w-auto h-auto md:left-auto md:w-[600px] md:h-[80vh]' 
              : 'bottom-14 right-6 w-[380px] h-[500px]'
          }`} 
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-gradient-to-l from-purple-600 to-blue-600 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-white rounded-full p-1">
                <PandaIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-sm">פנדי</h3>
                <p className="text-xs text-purple-100">העוזרת האישית שלך</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(!showHistory)}
                className="text-white hover:bg-white/20 h-8 w-8"
                title="היסטוריית שיחות"
              >
                <History className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={startNewConversation}
                className="text-white hover:bg-white/20 h-8 w-8"
                title="שיחה חדשה"
                disabled={isLoading}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-white hover:bg-white/20 h-8 w-8"
                title={isExpanded ? "הקטן חלון" : "הגדל חלון"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* History Sidebar */}
          {showHistory && (
            <div className="absolute top-14 right-0 bottom-0 w-64 bg-white border-l shadow-lg z-10 flex flex-col">
              <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                <h4 className="font-semibold text-sm">היסטוריית שיחות</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHistory(false)}
                  className="h-6 w-6"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={startNewConversation}
                  className="w-full p-3 text-right hover:bg-blue-50 border-b flex items-center gap-2 text-blue-600"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-sm font-medium">התחל שיחה חדשה</span>
                </button>
                {conversationsList.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full p-3 text-right hover:bg-gray-50 border-b flex items-start gap-2 ${
                      conversation?.id === conv.id ? 'bg-purple-50' : ''
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {getConversationTitle(conv)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(conv.created_date).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </button>
                ))}
                {conversationsList.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    אין שיחות קודמות
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-3">
            <div className="space-y-3">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tl-none'
                        : 'bg-gray-100 text-gray-800 rounded-tr-none'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown 
                        className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc mr-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal mr-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                    
                    {/* Show tool calls if any */}
                    {msg.tool_calls?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        {msg.tool_calls.map((tool, idx) => (
                          <div key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                            {tool.status === 'running' || tool.status === 'in_progress' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            <span>{tool.name?.replace('_', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-end">
                  <div className="bg-gray-100 rounded-lg rounded-tr-none p-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-sm text-gray-600">פנדי מחפשת...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t bg-gray-50">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="שאל את פנדי..."
                className="flex-1 text-sm"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}