import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Clan } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useGetUsername } from "../hooks/useUsername";

type Tab = "clans" | "global" | "clan";

interface SocialsHubProps {
  onBack: () => void;
  initialTab?: Tab;
}

// ── Shared sub-styles ──────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.65)",
  border: "1px solid rgba(255,255,255,0.1)",
  padding: "16px 20px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: "0.65rem",
  letterSpacing: "0.28em",
  color: "rgba(255,180,80,0.7)",
  textTransform: "uppercase" as const,
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "rgba(255,255,255,0.9)",
  fontFamily: "'Oswald', sans-serif",
  fontSize: "0.95rem",
  padding: "8px 12px",
  outline: "none",
  letterSpacing: "0.04em",
};

const btnStyle = (
  variant: "primary" | "danger" | "ghost" = "primary",
): React.CSSProperties => ({
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  fontSize: "0.78rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  padding: "8px 18px",
  border:
    variant === "primary"
      ? "1px solid rgba(255,122,0,0.6)"
      : variant === "danger"
        ? "1px solid rgba(220,50,50,0.5)"
        : "1px solid rgba(255,255,255,0.2)",
  background:
    variant === "primary"
      ? "rgba(255,122,0,0.15)"
      : variant === "danger"
        ? "rgba(200,40,40,0.12)"
        : "rgba(255,255,255,0.05)",
  color:
    variant === "primary"
      ? "#FF7A00"
      : variant === "danger"
        ? "rgba(255,100,100,0.9)"
        : "rgba(255,255,255,0.7)",
  cursor: "pointer",
});

function formatTime(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── GLOBAL CHAT PANEL ─────────────────────────────────────────────────────
function GlobalChatPanel() {
  const { actor } = useActor();
  const { data: username } = useGetUsername();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!actor) return;
    try {
      const msgs = await actor.getGlobalMessages();
      setMessages(msgs);
    } catch {
      // silent poll failure
    }
  }, [actor]);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 5000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages only
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !actor || sending) return;
    setSending(true);
    setStatusMsg("");
    try {
      const res = await actor.sendGlobalMessage(text.trim());
      if (res.__kind__ === "ok") {
        setText("");
        await fetchMessages();
      } else {
        setStatusMsg(res.err);
      }
    } catch (e: unknown) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const canChat = !!actor && !!username;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          ...panelStyle,
          maxHeight: "300px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
        data-ocid="socials.global_chat.list"
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "'Oswald', sans-serif",
              fontSize: "0.85rem",
            }}
          >
            No messages yet. Be the first!
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{ display: "flex", gap: "8px", alignItems: "baseline" }}
          >
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 600,
                fontSize: "0.88rem",
                color: "#FF7A00",
                flexShrink: 0,
              }}
            >
              {m.authorUsername}:
            </span>
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.85)",
                flex: 1,
                wordBreak: "break-word",
              }}
            >
              {m.content}
            </span>
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.3)",
                flexShrink: 0,
              }}
            >
              {formatTime(m.timestamp)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {!canChat ? (
        <div
          style={{
            ...panelStyle,
            color: "rgba(255,255,255,0.45)",
            fontFamily: "'Oswald', sans-serif",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          {!actor ? "Sign in to chat" : "Set a username in Profile to chat"}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            maxLength={300}
            data-ocid="socials.global_chat.input"
          />
          <button
            type="button"
            style={btnStyle("primary")}
            onClick={handleSend}
            disabled={sending || !text.trim()}
            data-ocid="socials.global_chat.send_button"
          >
            {sending ? "..." : "SEND"}
          </button>
        </div>
      )}
      {statusMsg && (
        <div
          style={{
            color: "rgba(255,100,100,0.8)",
            fontFamily: "'Oswald', sans-serif",
            fontSize: "0.8rem",
          }}
        >
          {statusMsg}
        </div>
      )}
    </div>
  );
}

// ── CLAN CHAT PANEL ────────────────────────────────────────────────────────
function ClanChatPanel({ inClan }: { inClan: boolean }) {
  const { actor } = useActor();
  const { data: username } = useGetUsername();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!actor || !inClan) return;
    try {
      const res = await actor.getClanMessages();
      if (res.__kind__ === "ok") {
        setMessages(res.ok);
      }
    } catch {
      // silent
    }
  }, [actor, inClan]);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 5000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages only
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!inClan) {
    return (
      <div
        style={{
          ...panelStyle,
          color: "rgba(255,255,255,0.45)",
          fontFamily: "'Oswald', sans-serif",
          fontSize: "0.9rem",
          textAlign: "center",
          padding: "32px 20px",
        }}
      >
        Join a clan to access clan chat
      </div>
    );
  }

  const handleSend = async () => {
    if (!text.trim() || !actor || sending) return;
    setSending(true);
    setStatusMsg("");
    try {
      const res = await actor.sendClanMessage(text.trim());
      if (res.__kind__ === "ok") {
        setText("");
        await fetchMessages();
      } else {
        setStatusMsg(res.err);
      }
    } catch (e: unknown) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const canChat = !!actor && !!username;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          ...panelStyle,
          maxHeight: "300px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
        data-ocid="socials.clan_chat.list"
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "'Oswald', sans-serif",
              fontSize: "0.85rem",
            }}
          >
            No clan messages yet.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{ display: "flex", gap: "8px", alignItems: "baseline" }}
          >
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 600,
                fontSize: "0.88rem",
                color: "#FF7A00",
                flexShrink: 0,
              }}
            >
              {m.authorUsername}:
            </span>
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.85)",
                flex: 1,
                wordBreak: "break-word",
              }}
            >
              {m.content}
            </span>
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.3)",
                flexShrink: 0,
              }}
            >
              {formatTime(m.timestamp)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {!canChat ? (
        <div
          style={{
            ...panelStyle,
            color: "rgba(255,255,255,0.45)",
            fontFamily: "'Oswald', sans-serif",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          Set a username in Profile to chat
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Type to your clan..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            maxLength={300}
            data-ocid="socials.clan_chat.input"
          />
          <button
            type="button"
            style={btnStyle("primary")}
            onClick={handleSend}
            disabled={sending || !text.trim()}
            data-ocid="socials.clan_chat.send_button"
          >
            {sending ? "..." : "SEND"}
          </button>
        </div>
      )}
      {statusMsg && (
        <div
          style={{
            color: "rgba(255,100,100,0.8)",
            fontFamily: "'Oswald', sans-serif",
            fontSize: "0.8rem",
          }}
        >
          {statusMsg}
        </div>
      )}
    </div>
  );
}

// ── CLANS PANEL ────────────────────────────────────────────────────────────
function ClansPanel({ onClanChange }: { onClanChange: () => void }) {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [allClans, setAllClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Create form
  const [createName, setCreateName] = useState("");
  const [createTag, setCreateTag] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Join form
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    if (!actor || !isAuthenticated) return;
    setLoading(true);
    try {
      const [mine, all] = await Promise.all([
        actor.getMyClan(),
        actor.getAllClans(),
      ]);
      setMyClan(mine);
      setAllClans(all);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [actor, isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showStatus = (msg: string, success = false) => {
    setStatusMsg(msg);
    setIsSuccess(success);
    setTimeout(() => setStatusMsg(""), 4000);
  };

  const handleCreate = async () => {
    if (!actor || !createName.trim() || !createTag.trim()) return;
    setCreating(true);
    try {
      const res = await actor.createClan(
        createName.trim(),
        createTag.trim(),
        createDesc.trim(),
      );
      if (res.__kind__ === "ok") {
        setCreateName("");
        setCreateTag("");
        setCreateDesc("");
        showStatus("Clan created!", true);
        await fetchData();
        onClanChange();
      } else {
        showStatus(res.err);
      }
    } catch (e: unknown) {
      showStatus(e instanceof Error ? e.message : "Failed to create clan");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (code: string) => {
    if (!actor || !code.trim()) return;
    setJoining(true);
    try {
      const res = await actor.joinClanByCode(code.trim());
      if (res.__kind__ === "ok") {
        setJoinCode("");
        showStatus("Joined clan!", true);
        await fetchData();
        onClanChange();
      } else {
        showStatus(res.err);
      }
    } catch (e: unknown) {
      showStatus(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!actor) return;
    try {
      const res = await actor.leaveClan();
      if (res.__kind__ === "ok") {
        showStatus("Left clan", true);
        await fetchData();
        onClanChange();
      } else {
        showStatus(res.err);
      }
    } catch (e: unknown) {
      showStatus(e instanceof Error ? e.message : "Failed to leave");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          ...panelStyle,
          textAlign: "center",
          padding: "40px 20px",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "'Oswald', sans-serif",
          fontSize: "1rem",
          letterSpacing: "0.1em",
        }}
      >
        Sign in to access Socials
      </div>
    );
  }

  if (loading && !myClan && allClans.length === 0) {
    return (
      <div
        style={{
          ...panelStyle,
          textAlign: "center",
          color: "rgba(255,255,255,0.4)",
          fontFamily: "'Oswald', sans-serif",
          letterSpacing: "0.2em",
        }}
      >
        LOADING...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {statusMsg && (
        <div
          style={{
            ...panelStyle,
            padding: "10px 16px",
            color: isSuccess ? "#4caf50" : "rgba(255,100,100,0.9)",
            fontFamily: "'Oswald', sans-serif",
            fontSize: "0.85rem",
            letterSpacing: "0.06em",
            borderColor: isSuccess
              ? "rgba(76,175,80,0.4)"
              : "rgba(220,50,50,0.4)",
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* My Clan */}
      {myClan ? (
        <div style={panelStyle} data-ocid="socials.my_clan.card">
          <div style={labelStyle}>MY CLAN</div>
          <div
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: "0.06em",
              marginBottom: "4px",
            }}
          >
            {myClan.name}{" "}
            <span style={{ color: "#FF7A00", fontSize: "1rem" }}>
              [{myClan.tag}]
            </span>
          </div>
          {myClan.description && (
            <div
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.5)",
                marginBottom: "8px",
                letterSpacing: "0.04em",
              }}
            >
              {myClan.description}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "0.78rem",
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.12em",
              }}
            >
              {myClan.members.length} MEMBER
              {myClan.members.length !== 1 ? "S" : ""}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: "0.78rem",
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.1em",
                }}
              >
                INVITE:
              </span>
              <code
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  color: "rgba(255,180,80,0.9)",
                  background: "rgba(255,180,80,0.08)",
                  border: "1px solid rgba(255,180,80,0.2)",
                  padding: "2px 8px",
                }}
              >
                {myClan.inviteCode}
              </code>
              <button
                type="button"
                style={btnStyle("ghost")}
                onClick={() => handleCopy(myClan.inviteCode)}
                data-ocid="socials.clan_invite.copy_button"
              >
                {copied ? "COPIED!" : "COPY"}
              </button>
            </div>
            <button
              type="button"
              style={btnStyle("danger")}
              onClick={handleLeave}
              data-ocid="socials.clan.leave_button"
            >
              LEAVE CLAN
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Create Clan */}
          <div style={panelStyle}>
            <div style={labelStyle}>CREATE A CLAN</div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  style={{ ...inputStyle, flex: 2 }}
                  placeholder="Clan Name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={40}
                  data-ocid="socials.create_clan.name_input"
                />
                <input
                  style={{ ...inputStyle, flex: 1, maxWidth: "100px" }}
                  placeholder="[TAG]"
                  value={createTag}
                  onChange={(e) => setCreateTag(e.target.value.toUpperCase())}
                  maxLength={5}
                  data-ocid="socials.create_clan.tag_input"
                />
              </div>
              <textarea
                style={{
                  ...inputStyle,
                  resize: "none",
                  height: "56px",
                  fontFamily: "'Oswald', sans-serif",
                }}
                placeholder="Description (optional)"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                maxLength={200}
                data-ocid="socials.create_clan.desc_textarea"
              />
              <div>
                <button
                  type="button"
                  style={btnStyle("primary")}
                  onClick={handleCreate}
                  disabled={creating || !createName.trim() || !createTag.trim()}
                  data-ocid="socials.create_clan.submit_button"
                >
                  {creating ? "CREATING..." : "CREATE CLAN"}
                </button>
              </div>
            </div>
          </div>
          {/* Join Clan */}
          <div style={panelStyle}>
            <div style={labelStyle}>JOIN WITH INVITE CODE</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Enter invite code..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                data-ocid="socials.join_clan.code_input"
              />
              <button
                type="button"
                style={btnStyle("primary")}
                onClick={() => handleJoin(joinCode)}
                disabled={joining || !joinCode.trim()}
                data-ocid="socials.join_clan.submit_button"
              >
                {joining ? "JOINING..." : "JOIN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Clans */}
      <div>
        <div style={labelStyle}>ALL CLANS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {allClans.length === 0 && (
            <div
              style={{
                ...panelStyle,
                color: "rgba(255,255,255,0.35)",
                fontFamily: "'Oswald', sans-serif",
                fontSize: "0.85rem",
                textAlign: "center",
              }}
              data-ocid="socials.clans.empty_state"
            >
              No clans yet. Create one!
            </div>
          )}
          {allClans.map((clan) => (
            <div
              key={clan.id}
              style={{
                ...panelStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 16px",
              }}
              data-ocid="socials.clan.item"
            >
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: "1rem",
                    color: "rgba(255,255,255,0.9)",
                    letterSpacing: "0.04em",
                    marginRight: "6px",
                  }}
                >
                  {clan.name}
                </span>
                <span
                  style={{
                    color: "#FF7A00",
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: "0.82rem",
                  }}
                >
                  [{clan.tag}]
                </span>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.35)",
                    marginLeft: "10px",
                    letterSpacing: "0.1em",
                  }}
                >
                  {clan.members.length} member
                  {clan.members.length !== 1 ? "s" : ""}
                </span>
              </div>
              {myClan?.id !== clan.id && (
                <button
                  type="button"
                  style={btnStyle("ghost")}
                  onClick={() => handleJoin(clan.inviteCode)}
                  disabled={joining}
                  data-ocid="socials.clan.join_button"
                >
                  JOIN
                </button>
              )}
              {myClan?.id === clan.id && (
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: "0.7rem",
                    color: "#FF7A00",
                    letterSpacing: "0.15em",
                  }}
                >
                  ★ YOURS
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN EXPORT ────────────────────────────────────────────────────────────
export function SocialsHub({ onBack, initialTab = "clans" }: SocialsHubProps) {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [inClan, setInClan] = useState(false);

  // Check if user is in a clan on mount
  useEffect(() => {
    if (!actor || !isAuthenticated) return;
    actor
      .getMyClan()
      .then((clan) => {
        setInClan(!!clan);
      })
      .catch(() => {});
  }, [actor, isAuthenticated]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "clans", label: "CLANS" },
    { id: "global", label: "GLOBAL CHAT" },
    { id: "clan", label: "CLAN CHAT" },
  ];

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(80,15,5,0.18) 0%, #050505 60%)",
        fontFamily: "'Oswald', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(5,3,2,0.97)",
          borderBottom: "1px solid rgba(255,122,0,0.18)",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          data-ocid="socials.back.button"
          style={{
            ...btnStyle("ghost"),
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.8rem",
            padding: "7px 14px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,122,0,0.4)";
            e.currentTarget.style.color = "#FF7A00";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            e.currentTarget.style.color = "rgba(255,255,255,0.7)";
          }}
        >
          <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>‹</span>
          BACK
        </button>

        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "1.6rem",
            letterSpacing: "0.35em",
            color: "rgba(255,255,255,0.95)",
            textShadow: "0 0 20px rgba(255,122,0,0.3)",
          }}
        >
          SOCIALS
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 32px",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            data-ocid={`socials.tab.${tab.id}`}
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              fontSize: "0.8rem",
              letterSpacing: "0.2em",
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid #FF7A00"
                  : "2px solid transparent",
              color:
                activeTab === tab.id ? "#FF7A00" : "rgba(255,255,255,0.55)",
              cursor: "pointer",
              transition: "color 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding: "24px 32px 48px",
        }}
      >
        {activeTab === "clans" && (
          <ClansPanel
            onClanChange={() => {
              actor
                ?.getMyClan()
                .then((clan) => setInClan(!!clan))
                .catch(() => {});
            }}
          />
        )}
        {activeTab === "global" && <GlobalChatPanel />}
        {activeTab === "clan" && <ClanChatPanel inClan={inClan} />}
      </div>
    </div>
  );
}
