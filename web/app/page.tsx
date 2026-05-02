"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle, RotateCcw, Send, Sparkles, X } from "lucide-react";
import type { ChatMessage, ChatReply, ChatStatus, RizzProfile } from "@/lib/types";

type MatchState = {
  id: string;
  profile: RizzProfile;
  messages: ChatMessage[];
  status: ChatStatus;
  coaching?: ChatReply["coaching"];
  source: ChatReply["source"];
};

type DragState = {
  active: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

const createMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
});

const emptyDrag: DragState = {
  active: false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
};

export default function Home() {
  const [deck, setDeck] = useState<RizzProfile[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [activeMatch, setActiveMatch] = useState<MatchState | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [drag, setDrag] = useState<DragState>(emptyDrag);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const pendingBatch = useRef(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const topProfile = deck[0];

  const requestBatch = useCallback(async () => {
    if (pendingBatch.current) {
      return;
    }

    pendingBatch.current = true;
    setLoadingBatch(true);

    try {
      const response = await fetch("/api/profiles/batch", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Profile batch failed: ${response.status}`);
      }

      const payload = (await response.json()) as { profiles: RizzProfile[] };
      setDeck((current) => [...current, ...payload.profiles]);
    } finally {
      pendingBatch.current = false;
      setLoadingBatch(false);
    }
  }, []);

  useEffect(() => {
    void requestBatch();
  }, [requestBatch]);

  useEffect(() => {
    if (deck.length <= 2) {
      void requestBatch();
    }
  }, [deck.length, requestBatch]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) {
      return;
    }

    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: "smooth",
    });
  }, [activeMatch?.id, activeMatch?.messages.length, sending]);

  const startMatch = (profile: RizzProfile) => {
    setActiveMatch({
      id: `${profile.id}-${Date.now()}`,
      profile,
      messages: [createMessage("match", profile.openingLine)],
      status: "chatting",
      source: "local",
    });
  };

  const swipe = (direction: "left" | "right") => {
    const profile = deck[0];

    if (!profile) {
      return;
    }

    setDeck((current) => current.slice(1));
    setDrag(emptyDrag);

    if (direction === "right") {
      startMatch(profile);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!topProfile) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      x: 0,
      y: 0,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag.active) {
      return;
    }

    setDrag((current) => ({
      ...current,
      x: event.clientX - current.startX,
      y: event.clientY - current.startY,
    }));
  };

  const onPointerUp = () => {
    if (!drag.active) {
      return;
    }

    if (drag.x > 120) {
      swipe("right");
      return;
    }

    if (drag.x < -120) {
      swipe("left");
      return;
    }

    setDrag(emptyDrag);
  };

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();

    if (!activeMatch || !draft.trim() || sending || activeMatch.status !== "chatting") {
      return;
    }

    const userMessage = createMessage("user", draft.trim());
    const nextMessages = [...activeMatch.messages, userMessage];
    setActiveMatch({ ...activeMatch, messages: nextMessages });
    setDraft("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: activeMatch.id,
          profile: activeMatch.profile,
          message: userMessage.content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.status}`);
      }

      const reply = (await response.json()) as ChatReply;
      const statusMessage =
        reply.status === "won"
          ? createMessage("system", "Date secured")
          : reply.status === "unmatched"
            ? createMessage("system", "Unmatched")
            : undefined;

      setActiveMatch((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          messages: statusMessage ? [...current.messages, reply.message, statusMessage] : [...current.messages, reply.message],
          status: reply.status,
          coaching: reply.coaching,
          source: reply.source,
        };
      });

      if (reply.status === "won") {
        setStreak((current) => {
          const next = current + 1;
          setBestStreak((best) => Math.max(best, next));
          return next;
        });
      }

      if (reply.status === "unmatched") {
        setStreak(0);
      }
    } finally {
      setSending(false);
    }
  };

  const resetMatch = () => {
    setActiveMatch(null);
    setDraft("");
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Botpress Rizzbot</p>
          <h1>Swipe Stack</h1>
        </div>
        <div className="top-metrics" aria-label="scoreboard">
          <span>Streak {streak}</span>
          <span>Best {bestStreak}</span>
        </div>
      </header>

      <section className="workspace" aria-label="Rizzbot swipe and chat">
        <aside className="side-rail">
          <div className="rail-block">
            <span className="metric-label">Batch</span>
            <strong>{loadingBatch ? "loading" : `${deck.length} live`}</strong>
          </div>
          <div className="rail-block">
            <span className="metric-label">Images</span>
            <strong>{topProfile?.imageStatus ?? "pending"}</strong>
          </div>
          <div className="rail-block rail-interests">
            <span className="metric-label">Signals</span>
            <div>
              {(topProfile?.interests ?? ["fresh", "specific", "playful"]).map((interest) => (
                <span key={interest}>{interest}</span>
              ))}
            </div>
          </div>
        </aside>

        <section className="deck-stage" aria-label="profile deck">
          <div className="deck-frame">
            {deck.slice(0, 3).map((profile, index) => {
              const isTop = index === 0;
              const dragStyle = isTop
                ? {
                    transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${drag.x / 18}deg)`,
                  }
                : undefined;

              return (
                <article
                  className="profile-card"
                  key={profile.id}
                  style={{
                    zIndex: 10 - index,
                    translate: `0 ${index * 14}px`,
                    scale: `${1 - index * 0.045}`,
                    ...dragStyle,
                  }}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? onPointerUp : undefined}
                >
                  <Image
                    className="profile-image"
                    src={profile.imageUrl}
                    alt={`${profile.name} profile`}
                    fill
                    sizes="(max-width: 760px) 100vw, 480px"
                    priority={index === 0}
                    draggable={false}
                    unoptimized={profile.imageUrl.startsWith("data:")}
                  />
                  <div className="decision left">Nope</div>
                  <div className="decision right">Match</div>
                  <div className="card-copy">
                    <div className="name-row">
                      <h2>
                        {profile.name}, {profile.age}
                      </h2>
                      <Sparkles aria-hidden="true" size={22} />
                    </div>
                    <p className="headline">{profile.headline}</p>
                    <p className="bio">{profile.bio}</p>
                    <div className="prompt">
                      <span>{profile.promptLabel}</span>
                      <strong>{profile.promptAnswer}</strong>
                    </div>
                  </div>
                </article>
              );
            })}

            {!deck.length && (
              <div className="empty-deck">
                <Sparkles aria-hidden="true" size={34} />
                <span>{loadingBatch ? "Generating batch" : "No profiles"}</span>
              </div>
            )}
          </div>

          <div className="swipe-controls" aria-label="swipe actions">
            <button className="icon-button pass" type="button" title="Pass" onClick={() => swipe("left")} disabled={!topProfile}>
              <X aria-hidden="true" size={30} />
            </button>
            <button className="icon-button rewind" type="button" title="Clear match" onClick={resetMatch}>
              <RotateCcw aria-hidden="true" size={24} />
            </button>
            <button className="icon-button like" type="button" title="Match" onClick={() => swipe("right")} disabled={!topProfile}>
              <Heart aria-hidden="true" size={30} />
            </button>
          </div>
        </section>

        <section className={`chat-panel ${activeMatch ? "active" : ""}`} aria-label="match chat">
          <div className="chat-header">
            {activeMatch ? (
              <>
                <Image
                  className="avatar-image"
                  src={activeMatch.profile.imageUrl}
                  alt=""
                  width={46}
                  height={46}
                  unoptimized={activeMatch.profile.imageUrl.startsWith("data:")}
                />
                <div>
                  <h2>{activeMatch.profile.name}</h2>
                  <p>{activeMatch.profile.voice}</p>
                </div>
                <span className={`status-pill ${activeMatch.status}`}>{activeMatch.status}</span>
              </>
            ) : (
              <>
                <div className="chat-placeholder-icon">
                  <MessageCircle aria-hidden="true" size={22} />
                </div>
                <div>
                  <h2>No match active</h2>
                  <p>Right swipes open here</p>
                </div>
              </>
            )}
          </div>

          <div className="message-list" ref={messageListRef}>
            {(activeMatch?.messages ?? []).map((chatMessage) => (
              <div className={`message ${chatMessage.role}`} key={chatMessage.id}>
                {chatMessage.content}
              </div>
            ))}
            {activeMatch && sending && (
              <div className="message match typing-message" aria-label={`${activeMatch.profile.name} is typing`}>
                <span className="typing-dot" aria-hidden="true" />
                <span className="typing-dot" aria-hidden="true" />
                <span className="typing-dot" aria-hidden="true" />
              </div>
            )}
          </div>

          {activeMatch?.coaching && (
            <div className="coach-strip">
              <span>{activeMatch.coaching.dateScore}</span>
              <p>{activeMatch.coaching.read}</p>
            </div>
          )}

          <form className="chat-input" onSubmit={sendChat}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!activeMatch || activeMatch.status !== "chatting" || sending}
              placeholder={activeMatch ? "Type a line" : "Match first"}
            />
            <button
              className="send-button"
              type="submit"
              title="Send"
              disabled={!activeMatch || !draft.trim() || activeMatch.status !== "chatting" || sending}
            >
              <Send aria-hidden="true" size={20} />
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
