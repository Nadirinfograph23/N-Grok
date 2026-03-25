import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { sendChat } from "../lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

const CHAT_MODELS: Record<string, string> = {
  "Grok 3": "grok-3",
  "Grok 3 Fast": "grok-3-fast",
  "Grok 4": "grok-4",
  "Grok 4 Mini": "grok-4-mini-thinking-tahoe",
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("grok-3");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [responseId, setResponseId] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setErrorMsg("");

    try {
      const resp = await sendChat({
        message: text,
        model,
        conversationId,
        parentResponseId: responseId,
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: resp.message,
        images: resp.images,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (resp.conversationId) setConversationId(resp.conversationId);
      if (resp.responseId) setResponseId(resp.responseId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setResponseId(undefined);
    setErrorMsg("");
  };

  const hasMessages = messages.length > 0;

  return (
    <div style={{ height: "calc(100vh - 56px)" }} className="relative flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-app-bg">
        {!hasMessages ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-6">
            <div className="flex flex-col items-center mb-10 md:mb-20 animate-fade-in-up transition-all duration-700">
              <div className="mb-10 relative group">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-1000" />
                <div className="relative w-24 h-24 md:w-32 md:h-32 bg-teal-900/40 rounded-3xl flex items-center justify-center border border-white/5 overflow-hidden">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-20 absolute -right-4 -bottom-4">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-glow relative z-10">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div className="absolute top-4 right-4 text-primary animate-pulse">+</div>
                </div>
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-7xl font-black text-white tracking-widest uppercase mb-4 text-center px-4">
                CHAT STUDIO
              </h1>
              <p className="text-secondary text-sm font-medium tracking-wide opacity-60">
                Chat with Grok AI — ask questions, get answers, generate ideas
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                  msg.role === "user"
                    ? "bg-primary/15 border border-primary/20 text-white"
                    : "bg-white/5 border border-white/10 text-white"
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {msg.images.map((url, j) => (
                        <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Generated ${j + 1}`} className="rounded-xl max-w-full" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex justify-center">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3 text-center">
                  <p className="text-red-400 text-sm">{errorMsg}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="w-full bg-app-bg border-t border-white/5 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl">
            <div className="flex items-start gap-5 px-2">
              {hasMessages && (
                <button
                  type="button"
                  title="New chat"
                  onClick={handleNewChat}
                  className="w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center mt-1.5 bg-white/5 hover:bg-white/10 group border-white/10 hover:border-primary/40"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted group-hover:text-primary transition-colors">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Grok anything..."
                rows={1}
                className="flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2 pt-4 border-t border-white/5 relative">
              <div className="flex items-center gap-1.5 md:gap-2.5 relative flex-wrap pb-1 md:pb-0">
                {/* Model Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
                  >
                    <div className="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
                      <span className="text-[10px] font-black text-black">G</span>
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      {Object.entries(CHAT_MODELS).find(([, v]) => v === model)?.[0] || model}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showModelMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-xl z-50">
                      {Object.entries(CHAT_MODELS).map(([label, value]) => (
                        <button key={value} onClick={() => { setModel(value); setShowModelMenu(false); }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${model === value ? "text-primary bg-white/5" : "text-white hover:bg-white/5"}`}
                        >{label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="flex items-center gap-2.5 px-6 py-2.5 bg-primary text-black font-extrabold text-xs rounded-2xl hover:shadow-glow transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none whitespace-nowrap self-end sm:self-auto"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
