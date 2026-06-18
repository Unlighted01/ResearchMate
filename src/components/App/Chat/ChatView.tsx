// ============================================
// ChatView.tsx - Extension AI Chat Interface
// ============================================

import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, AlertCircle, Trash2, ArrowRight, MessageSquare } from "lucide-react";
import { sendChatMessage, ChatMessage, getRelevantContext } from "../../../services/chatService";
import { getAllItems, StorageItem } from "../../../services/storageService";

interface ChatViewProps {
  onItemClick: (item: StorageItem) => void;
}

interface MessageWithCitations extends ChatMessage {
  citations?: StorageItem[];
}

export const ChatView: React.FC<ChatViewProps> = ({ onItemClick }) => {
  const [messages, setMessages] = useState<MessageWithCitations[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am ResearchMate, your academic research assistant. Ask me questions about your saved papers, methodologies, or concepts, and I will search your library for relevant context to ground my answers.",
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<StorageItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load all items to check titles later
  useEffect(() => {
    getAllItems().then(setAllItems).catch(console.error);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: MessageWithCitations = {
      id: `user_${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const relevant = getRelevantContext(userMessage.content, allItems);
      
      const result = await sendChatMessage(userMessage.content, messages);
      
      if (result.error) {
        setError(result.error);
      } else {
        // Find which items were cited (i.e. mentioned by title or text in the reply)
        const citations = relevant.filter(item => {
          const title = item.sourceTitle || "";
          return title.length > 3 && result.response.toLowerCase().includes(title.toLowerCase());
        });

        const assistantMessage: MessageWithCitations = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: result.response,
          timestamp: Date.now(),
          citations: citations.length > 0 ? citations : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat history cleared. How can I help you with your research today?",
        timestamp: Date.now(),
      },
    ]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          AI Library Chat
        </span>
        {messages.length > 1 && (
          <button
            onClick={clearChat}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                  isUser
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none"
                }`}
              >
                {/* Content */}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Citations / References */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Cited Context Items:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onItemClick(item)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all border border-blue-100 dark:border-blue-900/20 max-w-[200px] truncate"
                        >
                          <MessageSquare className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{item.sourceTitle || "Snipped Text"}</span>
                          <ArrowRight className="w-2.5 h-2.5 flex-shrink-0 opacity-65" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Searching library and generating answer</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-900/30 rounded-xl text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-2">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your research library..."
          rows={1}
          className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none max-h-24 dark:text-white"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
