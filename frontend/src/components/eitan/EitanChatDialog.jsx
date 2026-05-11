import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function EitanChatDialog({ isOpen, onClose }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      initializeConversation();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeConversation = async () => {
    setLoading(true);
    try {
      // Try to find existing conversation
      const conversations = await base44.agents.listConversations({ agent_name: 'eitan_quality' });
      
      let conv;
      if (conversations && conversations.length > 0) {
        // Use the most recent conversation
        conv = conversations[0];
      } else {
        // Create a new conversation
        conv = await base44.agents.createConversation({
          agent_name: 'eitan_quality',
          metadata: {
            name: 'שיחה עם איתן',
            description: 'שיחת בדיקה עם הסוכן איתן'
          }
        });
      }

      setConversation(conv);
      setMessages(conv.messages || []);
    } catch (error) {
      console.error("Error initializing conversation:", error);
      toast.error("שגיאה ביצירת שיחה עם איתן");
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || !conversation) return;

    setSending(true);
    try {
      const updatedConversation = await base44.agents.addMessage(conversation, {
        role: "user",
        content: inputMessage
      });

      setMessages(updatedConversation.messages || []);
      setInputMessage("");
      setConversation(updatedConversation);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("שגיאה בשליחת ההודעה");
    }
    setSending(false);
  };

  useEffect(() => {
    if (!conversation?.id) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });

    return () => {
      unsubscribe();
    };
  }, [conversation?.id]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-600" />
            שיחה עם איתן
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <MessageCircle className="w-12 h-12 mb-2 text-gray-300" />
                  <p>התחל שיחה עם איתן</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-900 border'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex gap-2 mt-4">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="הקלד הודעה לאיתן..."
                className="flex-1 min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={!inputMessage.trim() || sending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}