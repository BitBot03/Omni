import { useState } from "react";
import { MessageSquare, Send, Bot, User } from "lucide-react";
import { useAiChat } from "@workspace/api-client-react";

export default function AiCoach() {
  const [messages, setMessages] = useState<{role: "user" | "assistant", content: string}[]>([
    { role: "assistant", content: "I'm OMNI, your AI performance coach. I have access to all your workout data, nutrition logs, and recovery metrics. What should we optimize today?" }
  ]);
  const [input, setInput] = useState("");
  
  // Basic mock mutation for UI
  const sendMsg = useAiChat();

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: "user", content: input }]);
    setInput("");
    
    // Fake response for now
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Based on your recent data, I suggest prioritizing sleep tonight and aiming for a light mobility session tomorrow. Your CNS is showing signs of fatigue." 
      }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-screen bg-background">
      <header className="p-4 border-b border-border glass-panel flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center glow-secondary">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg">OMNI Coach</h1>
          <p className="text-xs text-secondary">Online • Context Aware</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-[80%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
              msg.role === "assistant" ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
            }`}>
              {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={`p-4 rounded-2xl ${
              msg.role === "assistant" ? "glass-panel rounded-tl-none" : "bg-primary/10 border border-primary/20 text-foreground rounded-tr-none"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 shrink-0 glass-panel border-t border-border mb-safe">
        <div className="relative flex items-center max-w-4xl mx-auto">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your data, request a routine..." 
            className="w-full bg-black/50 border border-border rounded-full pl-6 pr-14 py-4 outline-none focus:ring-1 focus:ring-secondary focus:border-secondary transition-all"
          />
          <button 
            onClick={handleSend}
            className="absolute right-2 w-10 h-10 rounded-full bg-secondary text-black flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Send className="w-5 h-5 ml-[-2px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
