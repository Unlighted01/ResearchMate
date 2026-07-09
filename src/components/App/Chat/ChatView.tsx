// ============================================
// ChatView.tsx - Extension AI Chat Interface
// ============================================

import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, AlertCircle, Trash2, ArrowRight, MessageSquare, Globe } from "lucide-react";
import { sendChatMessage, ChatMessage, getRelevantContext } from "../../../services/chatService";
import { getAllItems, StorageItem } from "../../../services/storageService";
import { SegmentedControl } from "../../shared/ui/SegmentedControl";

interface ChatViewProps {
  onItemClick: (item: StorageItem) => void;
}

interface MessageWithCitations extends ChatMessage {
  citations?: StorageItem[];
}

export const ChatView: React.FC<ChatViewProps> = ({ onItemClick }) => {
  const [chatMode, setChatMode] = useState<"library" | "page">("library");
  const [pageTitle, setPageTitle] = useState<string>("");
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

  // Fetch page title when entering page mode
  useEffect(() => {
    if (chatMode === "page") {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.title) {
            setPageTitle(tabs[0].title);
          } else {
            setPageTitle("Active Webpage");
          }
        });
      } else {
        setPageTitle("Active Webpage");
      }
    }
  }, [chatMode]);

  // Check for queries sent from content script / context menus on load/mount
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["pendingChatQuery", "chatMode"], (result) => {
        if (result.chatMode === "page" || result.chatMode === "library") {
          setChatMode(result.chatMode);
        }
        if (result.pendingChatQuery) {
          const query = result.pendingChatQuery;
          setInputValue(query);
          chrome.storage.local.remove(["pendingChatQuery", "chatMode"]);

          // Auto-trigger send
          setTimeout(() => {
            handleSend(query, result.chatMode || "library");
          }, 200);
        }
      });
    }
  }, []);

  // Listen for navigations from background script
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.action === "navigateToChat") {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(["pendingChatQuery", "chatMode"], (result) => {
            if (result.chatMode) {
              setChatMode(result.chatMode);
            }
            if (result.pendingChatQuery) {
              const query = result.pendingChatQuery;
              setInputValue(query);
              chrome.storage.local.remove(["pendingChatQuery", "chatMode"]);
              
              setTimeout(() => {
                handleSend(query, result.chatMode || "library");
              }, 200);
            }
          });
        }
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
      };
    }
  }, []);

  // Helper to retrieve page context from active tab
  const getPageContext = (): Promise<{ text: string; title: string; url: string } | null> => {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tabId = tabs[0]?.id;
          if (tabId) {
            chrome.tabs.sendMessage(tabId, { action: "getPageText" }, (response) => {
              if (chrome.runtime.lastError) {
                console.warn("getPageText failed:", chrome.runtime.lastError);
                resolve(null);
              } else if (response && response.text) {
                resolve(response);
              } else {
                resolve(null);
              }
            });
          } else {
            resolve(null);
          }
        });
      } else {
        resolve(null);
      }
    });
  };

  const handleSend = async (overrideValue?: string, overrideMode?: "library" | "page") => {
    const valueToSend = overrideValue !== undefined ? overrideValue : inputValue;
    const modeToSend = overrideMode !== undefined ? overrideMode : chatMode;
    if (!valueToSend.trim() || isLoading) return;

    const userMessage: MessageWithCitations = {
      id: `user_${Date.now()}`,
      role: "user",
      content: valueToSend.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (overrideValue === undefined) {
      setInputValue("");
    }
    setIsLoading(true);
    setError(null);

    try {
      let customContext: string | undefined = undefined;
      let targetPageTitle = "";

      if (modeToSend === "page") {
        const pageData = await getPageContext();
        if (pageData && pageData.text) {
          targetPageTitle = pageData.title;
          customContext = `[Context from Webpage: "${pageData.title}" (${pageData.url})]\n\nPage Content:\n${pageData.text}`;
        } else {
          setError("Failed to extract content from the active tab. Please refresh the page and try again.");
          setIsLoading(false);
          return;
        }
      }

      const relevant = modeToSend === "library" ? getRelevantContext(userMessage.content, allItems) : [];
      const result = await sendChatMessage(userMessage.content, messages, customContext);
      
      if (result.error) {
        setError(result.error);
      } else {
        // Find which items were cited (only in library mode)
        const citations = modeToSend === "library"
          ? relevant.filter(item => {
              const title = item.sourceTitle || "";
              return title.length > 3 && result.response.toLowerCase().includes(title.toLowerCase());
            })
          : [];

        const assistantMessage: MessageWithCitations = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: result.response,
          timestamp: Date.now(),
          citations: citations.length > 0 ? citations : undefined,
        };

        // If in page mode, prepend a small grounded indicator to message content locally
        if (modeToSend === "page" && targetPageTitle) {
          assistantMessage.content = result.response;
        }

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
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
        content: chatMode === "page" 
          ? "Chat history cleared. How can I help you with this webpage today?" 
          : "Chat history cleared. How can I help you with your research today?",
        timestamp: Date.now(),
      },
    ]);
    setError(null);
  };

  const handleModeChange = (mode: "library" | "page") => {
    setChatMode(mode);
    setMessages([
      {
        id: "mode_change",
        role: "assistant",
        content: mode === "page"
          ? "Switched to Current Page Copilot. I can now answer questions based on the visible content of this webpage."
          : "Switched to Library Copilot. I will search your saved research papers and notes to ground my answers.",
        timestamp: Date.now(),
      }
    ]);
    setError(null);
  };

  return (
    <div className="theme-page theme-sidebar flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Segmented Mode Selector */}
      <div className="theme-headerbar theme-divider p-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-2">
        <SegmentedControl
          name="chatMode"
          value={chatMode}
          onChange={handleModeChange}
          options={[
            {
              value: "library",
              label: "Library Chat",
              icon: <Sparkles className="w-3.5 h-3.5" />,
            },
            {
              value: "page",
              label: "Page Copilot",
              icon: <Globe className="w-3.5 h-3.5" />,
            },
          ]}
        />
        {chatMode === "page" && pageTitle && (
          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate flex items-center gap-1 px-1">
            <Globe className="w-2.5 h-2.5 text-blue-500 flex-shrink-0 animate-pulse" />
            Grounded in: <span className="truncate italic text-gray-500 dark:text-gray-400">{pageTitle}</span>
          </div>
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
                          className="theme-btn-secondary flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all border border-blue-100 dark:border-blue-900/20 max-w-[200px] truncate"
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
              <span className="text-xs text-gray-500">
                {chatMode === "page" ? "Reading tab content and answering" : "Searching library and generating answer"}
              </span>
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

      <div className="theme-headerbar theme-divider p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-2 items-center">
        {messages.length > 1 && (
          <button
            onClick={clearChat}
            className="theme-icon-button w-9 h-9 bg-gray-50 hover:bg-red-50 hover:text-red-500 dark:bg-gray-900 dark:hover:bg-red-900/20 text-gray-400 dark:hover:text-red-400 rounded-xl flex items-center justify-center transition-all border border-gray-200 dark:border-gray-700 flex-shrink-0"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={chatMode === "page" ? "Ask about this page..." : "Ask about your research library..."}
          rows={1}
          className="theme-input flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none max-h-24 dark:text-white"
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputValue.trim() || isLoading}
          className="theme-btn-primary w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
