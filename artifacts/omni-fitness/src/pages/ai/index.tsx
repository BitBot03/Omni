import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { useAiChat } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

const TEAL = "#00D4FF";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "What's my optimal training volume today?",
  "Analyze my sleep and bench press correlation",
  "Suggest a deload week plan",
  "What should I eat before today's session?",
];

export default function AiCoach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm OMNI — your AI performance coach. I have full context of your workouts, nutrition, recovery metrics, and habits. What should we optimize today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useAiChat();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Based on your data: your CNS readiness is at 94% — excellent for a heavy push session. Sleep quality last night was +14% above your average. I recommend hitting a new bench press PR today. Protein is tracking well but increase intra-workout carbs by ~30g for this session.",
        },
      ]);
    }, 1800);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] md:h-screen">

      {/* Header */}
      <div className="p-4 md:p-5 border-b border-border/50 bg-[#080808] shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.25)" }}
          >
            <Sparkles className="w-5 h-5" style={{ color: TEAL }} />
          </div>
          <div>
            <p className="stat-label">AI SUPER-COACH</p>
            <h1 className="font-display text-2xl text-white uppercase italic tracking-wide leading-none">OMNI Coach</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="stat-label text-green-400/80">ONLINE</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""} max-w-[85%] ${
                msg.role === "user" ? "ml-auto" : ""
              }`}
            >
              <div
                className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
                style={
                  msg.role === "assistant"
                    ? { background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }
                    : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }
                }
              >
                {msg.role === "assistant" ? (
                  <Bot className="w-4 h-4" style={{ color: TEAL }} />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "omni-card-teal text-white/90 rounded-tl-sm"
                    : "omni-card text-white rounded-tr-sm"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}
            >
              <Bot className="w-4 h-4" style={{ color: TEAL }} />
            </div>
            <div className="omni-card px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: TEAL }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick suggestions (only when just intro message) */}
        {messages.length === 1 && (
          <div className="space-y-2 pt-2">
            <p className="stat-label mb-2">SUGGESTED QUERIES</p>
            {suggestions.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => handleSend(s)}
                className="w-full text-left text-xs text-white/70 p-3 rounded-xl transition-all hover:text-white"
                style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.12)" }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50 bg-[#080808] shrink-0">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask OMNI anything about your performance..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)" }}
          >
            <Send className="w-4 h-4" style={{ color: TEAL }} />
          </button>
        </div>
      </div>
    </div>
  );
}
