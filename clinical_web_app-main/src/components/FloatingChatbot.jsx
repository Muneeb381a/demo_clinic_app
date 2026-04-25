import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import axios from "../utils/axiosClient";

const BASE_URL = "";

// ── Client-side keyword deduplication (same as MedicalChatbot) ─────────────
const STOP = new Set([
  "the","a","an","is","are","was","has","have","with","and","or","for",
  "of","in","on","at","to","patient","doctor","complaint","complaining",
  "presenting","came","old","year","years","male","female","he","she",
  "his","her","this","that","also","since","past","last","ago","no","not",
]);
const clientKeywords = (text) =>
  [...new Set(
    text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  )].sort().join("|");

const quickHash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
};

const confidenceColor = (c) =>
  c >= 0.75 ? "text-green-600" : c >= 0.5 ? "text-yellow-600" : "text-gray-400";

// ── AI response renderer inside a chat bubble ───────────────────────────────
const AiMessage = ({ data, cacheLevel, timestamp }) => (
  <div className="flex flex-col gap-2">
    {/* Cache badge */}
    {cacheLevel && (
      <span className={`self-start text-xs px-2 py-0.5 rounded-full font-medium ${
        cacheLevel === "session" ? "bg-purple-100 text-purple-700" :
        cacheLevel === "L1"     ? "bg-green-100  text-green-700"  :
        cacheLevel === "L2"     ? "bg-blue-100   text-blue-700"   :
        cacheLevel === "L3"     ? "bg-amber-100  text-amber-700"  : ""
      }`}>
        {cacheLevel === "session" ? "⚡ session" :
         cacheLevel === "L1"     ? "⚡ memory"  :
         cacheLevel === "L2"     ? "⚡ redis"   :
         cacheLevel === "L3"     ? "⚡ db"      : "🤖 fresh"}
      </span>
    )}

    {/* Diagnoses */}
    {data.diagnoses?.length > 0 && (
      <div className="bg-blue-50 rounded-xl px-3 py-2 space-y-1">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Diagnosis</p>
        {data.diagnoses.map((d, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-sm text-blue-900">{d.name}</span>
            <span className={`text-xs font-bold ${confidenceColor(d.confidence)}`}>
              {Math.round(d.confidence * 100)}%
            </span>
          </div>
        ))}
        {data.diagnosis_text && (
          <p className="text-xs text-blue-500 pt-1 border-t border-blue-100 leading-relaxed">
            {data.diagnosis_text}
          </p>
        )}
      </div>
    )}

    {/* Medicines */}
    {data.medicines?.length > 0 && (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicines</p>
        {data.medicines.map((m, i) => (
          <div key={i} className="bg-emerald-50 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-emerald-800">{m.name}</p>
            <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed font-urdu">
              {m.dosage_urdu} · {m.frequency_urdu} · {m.duration_urdu} · {m.instructions_urdu}
            </p>
          </div>
        ))}
      </div>
    )}

    {/* Tests */}
    {data.tests_recommended?.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tests</p>
        <div className="flex flex-wrap gap-1.5">
          {data.tests_recommended.map((t, i) => (
            <span key={i} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Precautions */}
    {data.precautions?.length > 0 && (
      <div className="bg-amber-50 rounded-xl px-3 py-2">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Precautions</p>
        <ul className="space-y-0.5">
          {data.precautions.map((p, i) => (
            <li key={i} className="text-xs text-amber-800 flex gap-1.5">
              <span>•</span><span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <p className="text-xs text-gray-300 self-end">{timestamp}</p>
  </div>
);

// ── Loading skeleton ────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex items-end gap-2">
    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-sm">
      🤖
    </div>
    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  </div>
);

// ── Main component ──────────────────────────────────────────────────────────
const FloatingChatbot = () => {
  const [open, setOpen]           = useState(false);
  const [input, setInput]         = useState("");
  const [messages, setMessages]   = useState([]);  // { role, text, data, cacheLevel, time }
  const [loading, setLoading]     = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [unread, setUnread]       = useState(0);

  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const debounceTimer   = useRef(null);
  const lastKwHash      = useRef("");
  const sessionCache    = useRef(new Map()); // kwHash → { data, cacheLevel }

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    setDebouncing(true);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncing(false), 1000);
  };

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  const now = () =>
    new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });

  const addMessage = (msg) => setMessages((prev) => [...prev, msg]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 5 || loading) return;

    // Add doctor's message
    addMessage({ role: "user", text: trimmed, time: now() });
    setInput("");
    setLoading(true);

    // Duplicate check — same keyword set already in session
    const kwHash = quickHash(clientKeywords(trimmed));
    if (sessionCache.current.has(kwHash)) {
      const { data, cacheLevel } = sessionCache.current.get(kwHash);
      setTimeout(() => {
        addMessage({ role: "ai", data, cacheLevel: "session", time: now() });
        setLoading(false);
        if (!open) setUnread((n) => n + 1);
      }, 300); // tiny delay so UI feels responsive
      return;
    }

    try {
      const { data: res } = await axios.post(
        `${BASE_URL}/api/chatbot/analyze`,
        { input: trimmed }
      );
      if (res.success) {
        sessionCache.current.set(kwHash, { data: res.data, cacheLevel: res.cacheLevel });
        lastKwHash.current = kwHash;
        addMessage({ role: "ai", data: res.data, cacheLevel: res.cacheLevel, time: now() });
        if (!open) setUnread((n) => n + 1);
      } else {
        addMessage({ role: "error", text: res.message || "Analysis failed", time: now() });
      }
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message;
      const display =
        status === 429 ? "⚠️ Gemini API quota exceeded. Please upgrade your Google AI plan or wait until midnight (PT) for quota reset." :
        status === 503 ? "⚠️ AI service not configured. Ask admin to set GOOGLE_API_KEY." :
        status === 401 ? "⚠️ Invalid API key. Check GOOGLE_API_KEY in Vercel settings." :
        msg || "Could not reach AI service. Check connection.";
      addMessage({ role: "error", text: display, time: now() });
    } finally {
      setLoading(false);
    }
  }, [input, loading, open]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    sessionCache.current.clear();
    lastKwHash.current = "";
  };

  const canSend = !loading && !debouncing && input.trim().length >= 5;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 w-[360px] max-h-[75vh] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden"
          style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-violet-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Clinical Assistant</p>
                <p className="text-xs text-violet-200 leading-tight">Pakistan Medical Context</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Clear chat"
                  className="text-violet-200 hover:text-white transition-colors text-xs px-2 py-1 rounded-lg hover:bg-violet-700"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-violet-200 hover:text-white transition-colors p-1 rounded-lg hover:bg-violet-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
                <span className="text-4xl mb-3">💬</span>
                <p className="text-sm font-medium text-gray-600">Describe patient symptoms</p>
                <p className="text-xs text-gray-400 mt-1">
                  Type in natural language — English or Urdu mix is fine.
                </p>
                <div className="mt-4 space-y-2 text-left w-full">
                  {[
                    "Fever 38.5°C, cough, sore throat for 3 days",
                    "Abdominal pain, nausea, loose stools since morning",
                    "Headache, dizziness, high BP 160/100",
                  ].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="w-full text-left text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 hover:border-violet-300 hover:bg-violet-50 transition-colors"
                    >
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-violet-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5">
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      <p className="text-xs text-violet-300 mt-1 text-right">{msg.time}</p>
                    </div>
                  </div>
                )}
                {msg.role === "ai" && (
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-sm mt-1">
                      🤖
                    </div>
                    <div className="flex-1 bg-white rounded-2xl rounded-bl-sm px-3 py-3 shadow-sm border border-gray-100">
                      <AiMessage data={msg.data} cacheLevel={msg.cacheLevel} timestamp={msg.time} />
                    </div>
                  </div>
                )}
                {msg.role === "error" && (
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-sm mt-1">
                      ⚠️
                    </div>
                    <div className="flex-1 bg-red-50 border border-red-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
                      <p className="text-sm text-red-700">{msg.text}</p>
                      <p className="text-xs text-red-400 mt-1">{msg.time}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={1000}
                placeholder="Describe symptoms… (Enter to send)"
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none transition-colors leading-snug"
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  canSend
                    ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            {debouncing && (
              <p className="text-xs text-violet-400 mt-1 animate-pulse">● typing…</p>
            )}
            <p className="text-xs text-gray-300 mt-1">
              AI suggestions are for clinical reference only.
            </p>
          </div>
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          open
            ? "bg-gray-700 hover:bg-gray-800 rotate-0"
            : "bg-violet-600 hover:bg-violet-700 hover:scale-110"
        }`}
        title="AI Clinical Assistant"
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-2xl">🤖</span>
        )}

        {/* Unread badge */}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </>
  );
};

export default FloatingChatbot;
