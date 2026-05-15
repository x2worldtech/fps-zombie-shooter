import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useGetUsername } from "../hooks/useUsername";

interface GlobalChatWidgetProps {
  onOpenFullscreen: () => void;
}

function formatTimeShort(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}

export function GlobalChatWidget({ onOpenFullscreen }: GlobalChatWidgetProps) {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const { data: username } = useGetUsername();
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!actor) return;
    try {
      const msgs = await actor.getGlobalMessages();
      // Only keep last 10
      setMessages(msgs.slice(-10));
    } catch {
      // silent
    }
  }, [actor]);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 8000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll-on-new-messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !actor || sending) return;
    setSending(true);
    try {
      const res = await actor.sendGlobalMessage(text.trim());
      if (res.__kind__ === "ok") {
        setText("");
        await fetchMessages();
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const canChat = isAuthenticated && !!username;

  return (
    <div
      data-ocid="global_chat_widget.panel"
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        width: "300px",
        zIndex: 50,
        background: "rgba(10,10,10,0.93)",
        border: "1px solid rgba(255,122,0,0.3)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.6), 0 0 12px rgba(255,122,0,0.06)",
        fontFamily: "'Oswald', sans-serif",
      }}
    >
      {/* Header */}
      <button
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,122,0,0.06)",
          cursor: "pointer",
          userSelect: "none",
          width: "100%",
          border: "none",
          textAlign: "left",
        }}
        onClick={() => setMinimized((v) => !v)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              background: "#FF7A00",
              borderRadius: "50%",
              boxShadow: "0 0 6px #FF7A00",
            }}
          />
          <span
            style={{
              color: "#FF7A00",
              fontSize: "0.72rem",
              letterSpacing: "0.22em",
              fontWeight: 700,
            }}
          >
            GLOBAL CHAT
          </span>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullscreen();
            }}
            data-ocid="global_chat_widget.fullscreen_button"
            title="Open fullscreen"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.45)",
              cursor: "pointer",
              fontSize: "0.85rem",
              lineHeight: 1,
              padding: "2px 5px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#FF7A00";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            ⛶
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((v) => !v);
            }}
            data-ocid="global_chat_widget.minimize_button"
            title={minimized ? "Expand" : "Minimize"}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.45)",
              cursor: "pointer",
              fontSize: "0.85rem",
              lineHeight: 1,
              padding: "2px 5px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }}
          >
            {minimized ? "▲" : "▼"}
          </button>
        </div>
      </button>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          {/* Messages */}
          <div
            style={{
              maxHeight: "180px",
              overflowY: "auto",
              padding: "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
            }}
            data-ocid="global_chat_widget.message_list"
          >
            {messages.length === 0 && (
              <div
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.06em",
                }}
              >
                No messages yet.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  gap: "5px",
                  alignItems: "baseline",
                  fontSize: "0.78rem",
                }}
              >
                <span
                  style={{
                    color: "#FF7A00",
                    fontWeight: 600,
                    flexShrink: 0,
                    fontSize: "0.78rem",
                  }}
                >
                  {m.authorUsername}:
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    flex: 1,
                    wordBreak: "break-word",
                    lineHeight: 1.3,
                  }}
                >
                  {m.content}
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.25)",
                    fontSize: "0.62rem",
                    flexShrink: 0,
                  }}
                >
                  {formatTimeShort(m.timestamp)}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              padding: "7px 10px",
            }}
          >
            {!canChat ? (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.04em",
                  textAlign: "center",
                  padding: "2px 0",
                }}
              >
                {!isAuthenticated
                  ? "Sign in and set a username to chat"
                  : "Set a username in Profile to chat"}
              </div>
            ) : (
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.9)",
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: "0.8rem",
                    padding: "5px 9px",
                    outline: "none",
                    minWidth: 0,
                  }}
                  placeholder="Message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  maxLength={300}
                  data-ocid="global_chat_widget.input"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  data-ocid="global_chat_widget.send_button"
                  style={{
                    background: "rgba(255,122,0,0.2)",
                    border: "1px solid rgba(255,122,0,0.5)",
                    color: "#FF7A00",
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.72rem",
                    letterSpacing: "0.15em",
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  {sending ? "..." : "SEND"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
