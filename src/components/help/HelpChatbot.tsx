import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle,
  X,
  Send,
  Sparkles,
  MessageSquare,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  feedback?: 'up' | 'down' | null;
}

// ---------------------------------------------------------------------------
// Knowledge base: keyword-based FAQ engine
// Each entry has keywords (lowercased) matched against the user's question.
// ---------------------------------------------------------------------------
interface KnowledgeEntry {
  id: string;
  keywords: string[];
  answer: string;
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'welcome',
    keywords: ['hi', 'hello', 'hey', 'help', 'start', 'begin'],
    answer:
      "Hi there! 👋 I'm your Help assistant. I can guide you around IntervViewForge. Try asking things like:\n\n• How do I start an interview?\n• What is the Dashboard?\n• How do I view my reports?\n• How do I change interview settings?\n• What is the Candidates page?",
  },
  {
    id: 'start-interview',
    keywords: ['start', 'interview', 'begin', 'launch', 'practice', 'new', 'beginner'],
    answer:
      "To start an interview:\n\n1. Go to the **Dashboard** (click the logo or 'Dashboard' in the sidebar).\n2. Click the **'Start Interview'** button in the hero section.\n3. You can also launch an interview directly from the **Candidates** page by clicking the **'Interview'** button on any candidate card.\n4. The adaptive AI interviewer will ask questions based on the candidate's curriculum profile.",
  },
  {
    id: 'dashboard',
    keywords: ['dashboard', 'home', 'main', 'overview', 'metrics', 'score'],
    answer:
      "The **Dashboard** is your home screen. It shows:\n\n• An AI Technical Interview hero section with **Start Interview** and **View Reports** buttons.\n• **Session Metrics** — your average score, missions tracked, adaptive depth, and completed sessions.\n• A history of your **Completed Practice Interviews**.\n• An overview of the active candidate and the interview setup.",
  },
  {
    id: 'interviews',
    keywords: ['interview', 'session', 'live', 'chat', 'answer', 'question', 'pause', 'resume', 'exit'],
    answer:
      "The **Interviews** page is the live adaptive interview workspace. Here you can:\n\n• Read the AI interviewer's questions in the chat conversation.\n• Type your answers in the input box at the bottom.\n• View your **focus topic**, difficulty, covered topics, and learning signals in the context panel.\n• Use the header controls to **Pause/Resume** or **Exit** the interview.\n• The AI adapts question depth based on your responses.",
  },
  {
    id: 'candidates',
    keywords: ['candidate', 'candidates', 'profile', 'mission', 'search', 'filter'],
    answer:
      "The **Candidates** page lets you review candidate learning journeys:\n\n• **Search** by name, ID, role, or education.\n• **Filter** by role, experience, and mission progress.\n• **Sort** by missions completed, first-try rate, commit days, or experience.\n• Click **View Profile** to see mission history, curriculum coverage, skipped topics, and the candidate's professional profile.\n• Click **Interview** to launch a session for that candidate.",
  },
  {
    id: 'feedback',
    keywords: ['feedback', 'report', 'result', 'score', 'strength', 'progress', 'assessment', 'reviews'],
    answer:
      "The **Feedback** page shows your structured interview assessment after completing a session. It includes:\n\n• An **Overall Score**, questions answered correctly, assessment confidence, and technical accuracy.\n• An **Executive Summary** of the session.\n• **Key Strengths** and **Actionable Growth Areas**.\n• **Areas of Uncertainty** and **Strongest Responses**.\n• **Recommended Next Steps** and curriculum topics to review.\n• You can start a **New Practice Session** or **Delete** the interview.",
  },
  {
    id: 'settings',
    keywords: ['settings', 'configure', 'configuration', 'persona', 'difficulty', 'question count', 'follow-up', 'followup', 'coverage', 'preference'],
    answer:
      "In **Settings**, you can customize the AI interviewer:\n\n• **Interviewer Persona** — choose between Senior AI Systems Architect, Principal Staff Engineer, or Engineering Mentor & Guide.\n• **Execution Mode** — Adaptive Probing, Balanced Assessment, or Deep Technical Probing.\n• **Adaptive Parameters** — question count (8/10/12), difficulty calibration, follow-up probing intensity, coverage strategy, and auto-probing skipped topics.\n• Click **Save Changes** to apply your preferences.",
  },
  {
    id: 'scores',
    keywords: ['score', 'average', 'percentage', 'percent', 'rated', 'grade', 'pass'],
    answer:
      "Scores across the platform reflect technical interview performance:\n\n• **Overall Score** is shown out of 100, weighted across accuracy, system design depth, and communication clarity.\n• **Technical Accuracy** measures accuracy in vector retrieval and system formulas.\n• The **Dashboard** shows your average/aggregate score across completed sessions.\n• Detailed per-topic scores appear in the **Feedback** report.",
  },
  {
    id: 'theme',
    keywords: ['theme', 'dark', 'light', 'mode', 'appearance', 'color', 'colour'],
    answer:
      "To switch between **dark** and **light** mode:\n\n1. Look at the bottom of the **left sidebar** on desktop.\n2. In the **Appearance** section, click **Light** or **Dark**.\n\nYour preference is applied instantly across the whole app.",
  },
  {
    id: 'delete',
    keywords: ['delete', 'remove', 'clear', 'erase'],
    answer:
      "To delete an interview session:\n\n1. Go to the **Feedback** page.\n2. Click the **Delete Interview** button.\n3. Confirm in the dialog.\n\nThis permanently removes the session's conversation, answers, and scores — but the candidate's profile and curriculum progress are preserved.",
  },
  {
    id: 'signout',
    keywords: ['sign out', 'logout', 'log out', 'signout', 'exit account'],
    answer:
      "You can **Sign Out** using the button at the bottom of the left sidebar on desktop, or in the mobile top-right menu. This returns you to the login screen.",
  },
];

const suggestedQuestions = [
  'How do I start an interview?',
  'What is on the Dashboard?',
  'How do I view my reports?',
  'How do I change interview settings?',
];

// ---------------------------------------------------------------------------
// Helper to find the best matching knowledge entry
// ---------------------------------------------------------------------------
const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const matchAnswer = (question: string): string => {
  const tokens = new Set(tokenize(question));
  let bestEntry: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of entry.keywords) {
      const kwTokens = tokenize(kw);
      if (kwTokens.length === 0) continue;
      // Whole phrase match
      if (question.toLowerCase().includes(kw)) {
        score += kwTokens.length * 3;
        continue;
      }
      // Partial token match
      for (const t of kwTokens) {
        if (tokens.has(t)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= 2) {
    return bestEntry.answer;
  }

  return (
    "I'm not sure about that one yet. 🤔 Try asking about:\n\n" +
    "• Starting an interview\n• The Dashboard\n• Interviews\n• Candidates\n• Feedback & reports\n• Settings"
  );
};

// Simple converter for basic markdown-ish formatting (bold & newlines)
const formatAnswer = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.trim() === '') return <div key={i} className="h-2" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <div key={i} className="leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} className="font-bold text-[#F4F4F5]">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </div>
    );
  });
};

let msgCounter = 0;
const nextId = () => `msg-${Date.now()}-${msgCounter++}`;

export const HelpChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      sender: 'bot',
      text: "Hi! 👋 I'm here to help you use this website. Ask me how to start an interview, view reports, change settings, and more!",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  const sendQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { id: nextId(), sender: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate small delay for a natural feel
    setTimeout(() => {
      const answer = matchAnswer(trimmed);
      const botMsg: ChatMessage = { id: nextId(), sender: 'bot', text: answer };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

const handleReset = () => {
    setMessages([
      {
        id: nextId(),
        sender: 'bot',
        text: "Hi! 👋 I'm here to help you use this website. Ask me how to start an interview, view reports, change settings, and more!",
      },
    ]);
  };

  const handleFeedback = (msgId: string, value: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        // Toggle off if same rating clicked again
        return { ...m, feedback: m.feedback === value ? null : value };
      })
    );
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((cur) => (cur === msg.id ? null : cur)), 1500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <>
      {/* Floating launcher button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-bold shadow-2xl shadow-[#8B5CF6]/30 transition-all duration-200 hover:scale-105 cursor-pointer"
        aria-label="Open help chatbot"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <>
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Close Help</span>
          </>
        ) : (
          <>
            <HelpCircle className="w-5 h-5" />
            <span className="hidden sm:inline">Help</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#22C55E] ring-2 ring-[#09090B]" />
          </>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-[380px] h-[520px] max-h-[calc(100vh-7rem)] flex flex-col rounded-2xl overflow-hidden bg-[#111113] border border-[#27272A] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#151518] border-b border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-1.5">
                  Help Assistant
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#22C55E]/15 text-[#86EFAC] rounded border border-[#22C55E]/30">
                    Bot
                  </span>
                </h3>
                <p className="text-[11px] text-[#A1A1AA] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  Online — answers site questions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-2 rounded-lg text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1A1A1F] transition-colors cursor-pointer"
                aria-label="Reset conversation"
                title="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1A1A1F] transition-colors cursor-pointer"
                aria-label="Close help chatbot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#09090B]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs ${
                    msg.sender === 'user'
                      ? 'bg-[#8B5CF6] text-white rounded-br-md'
                      : 'bg-[#151518] border border-[#27272A] text-[#D4D4D8] rounded-bl-md'
                  }`}
                >
<div className="flex items-center gap-1.5 mb-1">
                    {msg.sender === 'bot' && (
                      <MessageSquare className="w-3 h-3 text-[#8B5CF6]" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {msg.sender === 'bot' ? 'Help Bot' : 'You'}
                    </span>
                  </div>
                  {msg.sender === 'bot' ? formatAnswer(msg.text) : msg.text}

                  {/* Action buttons for bot messages (thumbs up / down / copy) like ChatGPT */}
                  {msg.sender === 'bot' && (
                    <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-[#27272A]/60">
                      <button
                        onClick={() => handleFeedback(msg.id, 'up')}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          msg.feedback === 'up'
                            ? 'text-[#22C55E] bg-[#22C55E]/10'
                            : 'text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1A1A1F]'
                        }`}
                        aria-label="Good response"
                        title="Good response"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'down')}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          msg.feedback === 'down'
                            ? 'text-[#EF4444] bg-[#EF4444]/10'
                            : 'text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1A1A1F]'
                        }`}
                        aria-label="Poor response"
                        title="Poor response"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopy(msg)}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                          copiedId === msg.id
                            ? 'text-[#22C55E] bg-[#22C55E]/10'
                            : 'text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#1A1A1F]'
                        }`}
                        aria-label="Copy response"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[10px] font-semibold">
                          {copiedId === msg.id ? 'Copied' : 'Copy'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#151518] border border-[#27272A] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            )}
          </div>

          {/* Suggested questions */}
          <div className="px-4 py-2 bg-[#111113] border-t border-[#27272A] flex gap-2 overflow-x-auto">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => sendQuestion(q)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#1A1A1F] border border-[#27272A] text-[#A1A1AA] hover:text-white hover:border-[#8B5CF6]/50 transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 bg-[#151518] border-t border-[#27272A] flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me a question..."
              className="flex-1 bg-[#111113] border border-[#27272A] text-xs text-[#F4F4F5] placeholder-[#71717A] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#8B5CF6] transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
