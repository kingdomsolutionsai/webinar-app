import { useEffect, useRef, useState } from "react";

export function webinarFallbackReply(question: string, context?: string): string {
  const normalized = question.trim().toLowerCase();
  const schedule = context?.match(/Next live workshop: (.*?)(?:\\. Duration:|\\. Registration)/)?.[1];

  if (/\\b(when|date|day|time|start)\\b/.test(normalized)) {
    return schedule
      ? `The next live webinar is ${schedule}. It is a 45-minute session on Zoom.`
      : "The next live webinar date will be announced on this page.";
  }
  if (/\\b(cost|price|free|pay|investment)\\b/.test(normalized)) {
    return "The webinar is free. Register on this page, then confirm your email to receive the private Zoom details.";
  }
  if (/\\b(who|for me|audience|beginner|entrepreneur)\\b/.test(normalized)) {
    return "This webinar is for experienced entrepreneurs and professionals building a business from their expertise.";
  }
  if (/\\b(learn|cover|topic|about|gap|system)\\b/.test(normalized)) {
    return "You will learn how to recognize Direction, Offer, Audience, and Structure gaps, identify what needs attention first, and choose one practical next action.";
  }
  if (/\\b(register|sign up|seat|zoom|join|link|confirm)\\b/.test(normalized)) {
    return "Use the registration form on this page. After you confirm your email, we will send your private Zoom details and the registration clarity exercise.";
  }
  if (/\\b(gift|exercise|checklist|receive|download)\\b/.test(normalized)) {
    return "Confirmed November 17 registrants receive the Finding Your Business Gap clarity exercise. People who attend live also receive the separate First-Sale Readiness Checklist.";
  }
  return "I can help with the webinar date, who it is for, what you will learn, registration, Zoom access, and the participant gifts. What would you like to know?";
}

/**
 * Floating chat widget for the webinar sign-up page. Answers visitor
 * questions about the "What Entrepreneurs Need to Know" webinar, and nudges
 * toward a discovery call when it senses buying interest in Clarity Pro™ or
 * Constance™.
 *
 * The page passes in `context`: a briefing built from the live dashboard
 * settings (date, time, duration) and the page content. It is sent ahead of
 * the conversation on every request, so the chatbot always has the current
 * webinar details without anyone editing the Cloudflare Worker.
 *
 * This is a React port of chatbot-worker.js's companion widget — same
 * behavior, same look, dropped in as a component instead of a pasted
 * <script> tag so it lives inside the real app.
 *
 * Conversation history is kept in React state only (in memory, per page
 * visit). Nothing is written to localStorage/sessionStorage, and nothing is
 * lost by design if the visitor refreshes.
 *
 * The widget never sees the Anthropic API key — it only talks to the
 * Cloudflare Worker below, which holds the key server-side.
 */

// The Cloudflare Worker running chatbot-worker.js.
const WORKER_URL = "https://ksai-webinar-chatbot.tabitha-6d0.workers.dev/chat";

// Tabitha's "KS AI Intelligence Systems Strategy Call" — free 45-minute call
// with a complimentary needs/interests assessment. Closest match to a
// Clarity Pro™ / Constance™ discovery conversation, of her current Calendly
// event types.
const BOOK_CALL_URL =
  "https://calendly.com/tabitha-kingdomsolutionsai/ks-ai-intelligence-systems-strategy-call";

const GREETING =
  "Hi! I can answer questions about the webinar: when it is, who it is for, what you will learn, and what you will receive when you attend.";

const CONTEXT_ACK =
  "Understood. I will answer from these webinar facts, including the date and time.";
type ChatMessage = { role: "user" | "assistant"; content: string };
type DisplayMessage = { id: number; role: "user" | "assistant"; content: string; typing?: boolean };

const BOOK_CALL_RE = /book(ing)? a (discovery )?call|schedule a call/i;

export function ChatWidget({ context }: { context?: string }) {
  const [open, setOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const nextId = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (role: "user" | "assistant", content: string, typing = false) => {
    const id = nextId.current++;
    setMessages(prev => [...prev, { id, role, content, typing }]);
    return id;
  };

  const openChat = () => {
    setOpen(true);
    if (!hasGreeted) {
      setHasGreeted(true);
      addMessage("assistant", GREETING);
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const closeChat = () => setOpen(false);

  const resetChat = () => {
    historyRef.current = [];
    nextId.current = 1;
    setMessages([{ id: 0, role: "assistant", content: GREETING }]);
    setInput("");
    setSending(false);
    setHasGreeted(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    addMessage("user", text);
    historyRef.current = [...historyRef.current, { role: "user", content: text }];
    setInput("");
    setSending(true);

    const typingId = addMessage("assistant", "Typing…", true);

    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The briefing goes first as a user/assistant pair so the roles
          // still alternate correctly for the Anthropic API.
          messages: context
            ? [
                { role: "user", content: context },
                { role: "assistant", content: CONTEXT_ACK },
                ...historyRef.current,
              ]
            : historyRef.current,
        }),
      });
      if (!res.ok) throw new Error(`Bad response: ${res.status}`);
      const data = (await res.json()) as { reply?: string };
      const reply = data.reply || "Sorry, I didn't catch that — could you rephrase?";

      setMessages(prev => prev.filter(m => m.id !== typingId));
      addMessage("assistant", reply);
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];

      // Simple nudge: if the reply mentions booking, add the real link.
      if (BOOK_CALL_RE.test(reply)) {
        addMessage("assistant", `👉 Book a discovery call: ${BOOK_CALL_URL}`);
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== typingId));
      const reply = webinarFallbackReply(text, context);
      addMessage("assistant", reply);
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
      console.error("KSAI chat widget error:", err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      <style>{`
        #ksai-chat-launcher {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(145deg, #d4af37, #a8842a);
          border: 2px solid #1a1a1a;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          cursor: pointer;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease;
        }
        #ksai-chat-launcher:hover { transform: scale(1.06); }
        #ksai-chat-launcher svg { width: 28px; height: 28px; fill: #1a1a1a; }

        #ksai-chat-window {
          position: fixed;
          bottom: 96px;
          right: 24px;
          width: 360px;
          max-width: calc(100vw - 32px);
          height: 480px;
          max-height: calc(100vh - 140px);
          background: #141414;
          border: 1px solid #d4af37;
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 999999;
          font-family: Georgia, 'Times New Roman', serif;
        }

        #ksai-chat-header {
          background: #1a1a1a;
          color: #d4af37;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #d4af37;
        }
        #ksai-chat-header .ksai-title {
          font-size: 14px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        #ksai-chat-header .ksai-sub {
          font-size: 11px;
          color: #c9b37a;
          font-family: Arial, sans-serif;
          margin-top: 2px;
        }
        #ksai-chat-close {
          cursor: pointer;
          color: #d4af37;
          font-size: 20px;
          line-height: 1;
          background: none;
          border: none;
        }
        .ksai-header-actions { display: flex; align-items: center; gap: 12px; }
        #ksai-chat-reset {
          cursor: pointer;
          color: #c9b37a;
          font: 10px Arial, sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: none;
          border: none;
          padding: 4px;
        }
        #ksai-chat-reset:hover { color: #d4af37; }

        #ksai-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          background: #0f0f0f;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ksai-msg {
          max-width: 85%;
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 13.5px;
          line-height: 1.45;
          font-family: Arial, sans-serif;
          white-space: pre-wrap;
        }
        .ksai-msg.bot {
          background: #1f1f1f;
          color: #f1e9d2;
          border: 1px solid #3a3120;
          align-self: flex-start;
          border-bottom-left-radius: 2px;
        }
        .ksai-msg.user {
          background: #d4af37;
          color: #1a1a1a;
          align-self: flex-end;
          border-bottom-right-radius: 2px;
        }
        .ksai-msg.typing { color: #a89968; font-style: italic; }

        #ksai-chat-form {
          display: flex;
          border-top: 1px solid #2a2a2a;
          background: #141414;
        }
        #ksai-chat-input {
          flex: 1;
          border: none;
          background: transparent;
          color: #fff;
          padding: 12px;
          font-size: 13.5px;
          font-family: Arial, sans-serif;
          outline: none;
        }
        #ksai-chat-input::placeholder { color: #666; }
        #ksai-chat-send {
          background: none;
          border: none;
          color: #d4af37;
          font-weight: bold;
          padding: 0 16px;
          cursor: pointer;
          font-family: Arial, sans-serif;
        }
        #ksai-chat-send:disabled { color: #555; cursor: default; }

        #ksai-chat-footer {
          font-size: 10px;
          color: #555;
          text-align: center;
          padding: 4px 0 8px;
          font-family: Arial, sans-serif;
        }
      `}</style>

<button
  id="ksai-chat-launcher"
  aria-label="Not sure where to start?"
  onClick={openChat}
  type="button"
>
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.03 2 11c0 2.42 1.09 4.61 2.86 6.24-.13 1.28-.5 2.6-1.36 3.76 1.66-.13 3.14-.71 4.29-1.6 1.28.4 2.68.6 4.21.6 5.52 0 10-4.03 10-9S17.52 2 12 2z" />
        </svg>
      </button>

      {open ? (
        <div id="ksai-chat-window">
          <div id="ksai-chat-header">
            <div>
              <div className="ksai-title">Ask about the Webinar</div>
              <div className="ksai-sub">Kingdom Solutions AI</div>
            </div>
            <div className="ksai-header-actions">
              <button id="ksai-chat-reset" aria-label="Reset conversation" onClick={resetChat} type="button">
                Reset
              </button>
              <button id="ksai-chat-close" aria-label="Close chat" onClick={closeChat} type="button">
                &times;
              </button>
            </div>
          </div>
          <div id="ksai-chat-messages" ref={messagesRef}>
            {messages.map(m => (
              <div
                key={m.id}
                className={`ksai-msg ${m.role === "user" ? "user" : "bot"}${m.typing ? " typing" : ""}`}>
                {m.content}
              </div>
            ))}
          </div>
          <form id="ksai-chat-form" onSubmit={handleSubmit}>
            <input
              id="ksai-chat-input"
              ref={inputRef}
              type="text"
              autoComplete="off"
              placeholder="Type your question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={sending}
            />
            <button id="ksai-chat-send" type="submit" disabled={sending}>
              Send
            </button>
          </form>
          <div id="ksai-chat-footer">Powered by Kingdom Solutions AI</div>
        </div>
      ) : null}
    </>
  );
}
