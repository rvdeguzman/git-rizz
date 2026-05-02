import type { ChatMessage, ChatReply, ChatStatus, RizzProfile } from "./types";

type RizzSession = {
  profile: RizzProfile;
  messages: ChatMessage[];
  turns: number;
  icks: number;
  status: ChatStatus;
};

type BotpressPayload = {
  matchId: string;
  profile: RizzProfile;
  message: string;
  history: ChatMessage[];
};

type BotpressResult = {
  text: string;
  status?: ChatStatus;
  engine?: ChatReply["engine"];
  completion?: ChatReply["completion"];
  coaching?: ChatReply["coaching"];
};

const globalForSessions = globalThis as typeof globalThis & {
  __rizzSessions?: Map<string, RizzSession>;
};

const sessions = globalForSessions.__rizzSessions ?? new Map<string, RizzSession>();
globalForSessions.__rizzSessions = sessions;

const now = () => new Date().toISOString();

const message = (role: ChatMessage["role"], content: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: now(),
});

const getSession = (matchId: string, profile: RizzProfile) => {
  const existing = sessions.get(matchId);

  if (existing) {
    return existing;
  }

  const created: RizzSession = {
    profile,
    messages: [message("match", profile.openingLine)],
    turns: 0,
    icks: 0,
    status: "chatting",
  };

  sessions.set(matchId, created);
  return created;
};

const isChatStatus = (value: unknown): value is ChatStatus =>
  value === "chatting" || value === "unmatched" || value === "won";

const isCoaching = (value: unknown): value is ChatReply["coaching"] => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.dateScore === "number" && typeof record.read === "string" && typeof record.nextMove === "string";
};

const isEngine = (value: unknown): value is ChatReply["engine"] =>
  value === "botpress-completion" || value === "botpress-action-fallback" || value === "local";

const isCompletion = (value: unknown): value is ChatReply["completion"] => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.llmCalls === "number" && typeof record.durationMs === "number";
};

const extractBotpressReply = (payload: unknown): BotpressResult | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const output = record.output;

  if (output && typeof output === "object") {
    const nested = extractBotpressReply(output);
    if (nested) {
      return nested;
    }
  }

  const direct = record.reply ?? record.text ?? record.message;

  if (typeof direct === "string") {
    return {
      text: direct,
      status: isChatStatus(record.status) ? record.status : undefined,
      engine: isEngine(record.engine) ? record.engine : undefined,
      completion: isCompletion(record.completion) ? record.completion : undefined,
      coaching: isCoaching(record.coaching) ? record.coaching : undefined,
    };
  }

  const messages = record.messages;
  if (Array.isArray(messages)) {
    const texts = messages
      .map((item) => {
        if (!item || typeof item !== "object") {
          return undefined;
        }

        const candidate = item as Record<string, unknown>;
        const payloadValue = candidate.payload;
        if (payloadValue && typeof payloadValue === "object") {
          const text = (payloadValue as Record<string, unknown>).text;
          return typeof text === "string" ? text : undefined;
        }

        return typeof candidate.text === "string" ? candidate.text : undefined;
      })
      .filter(Boolean);

    if (texts.length) {
      return { text: texts.join("\n") };
    }
  }

  return undefined;
};

const getAdkConfigurationHeader = () =>
  Buffer.from(JSON.stringify({ payload: {} })).toString("base64");

const tryBotpress = async (payload: BotpressPayload): Promise<BotpressResult | undefined> => {
  const endpoint = process.env.BOTPRESS_RIZZBOT_ENDPOINT;

  if (!endpoint) {
    return undefined;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const botId = process.env.BOTPRESS_RIZZBOT_BOT_ID;
  const actionName = process.env.BOTPRESS_RIZZBOT_ACTION || "rizzbotReply";
  const body = botId
    ? {
        type: actionName,
        input: payload,
      }
    : payload;

  if (botId) {
    headers["x-bot-id"] = botId;
    headers["x-bp-operation"] = "action_triggered";
    headers["x-bp-type"] = "actionTriggered";
    headers["x-bp-configuration"] = getAdkConfigurationHeader();
  }

  if (process.env.BOTPRESS_RIZZBOT_TOKEN) {
    headers.Authorization = `Bearer ${process.env.BOTPRESS_RIZZBOT_TOKEN}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Botpress rizzbot request failed: ${response.status} ${await response.text()}`);
  }

  return extractBotpressReply(await response.json());
};

const unmatchReason = (text: string) => {
  const checks: Array<[RegExp, string]> = [
    [/\b(send|show).{0,16}(nudes?|pics?|body|feet)\b/i, "asked for explicit photos"],
    [/\b(sex|horny|hook ?up|come over|sleep with|naked)\b/i, "made it sexual too early"],
    [/\b(bitch|slut|whore|ugly|fat|stupid|dumb)\b/i, "used disrespectful language"],
    [/\b(i know where you live|followed you|stalk|tracking you)\b/i, "crossed a safety boundary"],
    [/\b(you owe me|dont reject me|give me your number now|why wont you)\b/i, "got pushy after no consent"],
  ];

  return checks.find(([pattern]) => pattern.test(text))?.[1];
};

const detectIck = (text: string) => {
  if (/^(hey|hi|yo|wyd|lol|haha|sup)\.?!?$/i.test(text)) {
    return "too low-effort";
  }

  if (text.length < 8) {
    return "too little to respond to";
  }

  if (/\b(ur hot|youre hot|you're hot|sexy|baddie)\b/i.test(text)) {
    return "complimented looks without giving her anything to work with";
  }

  if (/\b(insta|instagram|ig|snap|snapchat|number|digits)\b/i.test(text)) {
    return "asked for socials before building enough rapport";
  }

  return undefined;
};

const isDateAsk = (text: string) => /\b(coffee|drink|ramen|dinner|museum|walk|date|meet|go out)\b/i.test(text);
const isSpecific = (text: string) => /\b(friday|saturday|sunday|tonight|tomorrow|this week|after work|at \d|around \d)\b/i.test(text);

const scoreMessage = (text: string, profile: RizzProfile, turns: number) => {
  let score = 34 + turns * 9;

  if (text.includes("?")) {
    score += 8;
  }

  if (text.length > 55) {
    score += 9;
  }

  if (profile.interests.some((interest) => text.toLowerCase().includes(interest.split(" ")[0].toLowerCase()))) {
    score += 12;
  }

  if (isDateAsk(text) && isSpecific(text)) {
    score += 14;
  }

  return Math.max(0, Math.min(100, score));
};

const localReply = (session: RizzSession, userText: string): ChatReply => {
  const profile = session.profile;
  const lowered = userText.toLowerCase();
  const hardStop = unmatchReason(userText);

  session.turns += 1;

  if (hardStop) {
    session.status = "unmatched";
    return {
      message: message("match", `UNMATCHED: ${hardStop}.`),
      status: session.status,
      source: "local",
      engine: "local",
      coaching: {
        dateScore: 0,
        read: "That crossed a boundary instead of building comfort.",
        nextMove: "Reset with a profile-specific, low-pressure question.",
      },
    };
  }

  const ick = detectIck(userText);

  if (ick) {
    session.icks += 1;
    if (session.icks >= 2) {
      session.status = "unmatched";
      return {
        message: message("match", `UNMATCHED: ${ick} twice.`),
        status: session.status,
        source: "local",
        engine: "local",
        coaching: {
          dateScore: 12,
          read: "The chat needs a real hook, not another empty ping.",
          nextMove: `Mention ${profile.interests[0]} and ask one easy question.`,
        },
      };
    }

    return {
      message: message("match", `${profile.name}: Hmm. Tiny ick, but I will allow one recovery attempt.`),
      status: session.status,
      source: "local",
      engine: "local",
      coaching: {
        dateScore: 24,
        read: `This was ${ick}.`,
        nextMove: `Use one detail from her profile and ask about ${profile.interests[0]}.`,
      },
    };
  }

  const dateAsk = isDateAsk(lowered) && isSpecific(lowered);

  if (dateAsk && session.turns >= 3) {
    session.status = "won";
    return {
      message: message("match", `${profile.name}: That is actually a good plan. I would say yes to that.`),
      status: session.status,
      source: "local",
      engine: "local",
      coaching: {
        dateScore: 92,
        read: "Specific, low-pressure, and timed after some rapport.",
        nextMove: "Lock the plan without overexplaining.",
      },
    };
  }

  const interest = profile.interests.find((item) => lowered.includes(item.split(" ")[0].toLowerCase())) ?? profile.interests[0];
  const score = scoreMessage(userText, profile, session.turns);
  const replies = [
    `${profile.name}: Okay, that is more specific than the usual app noise. Tell me more about the ${interest} angle.`,
    `${profile.name}: I respect that answer. Slightly suspicious confidence, but continue.`,
    `${profile.name}: That is a decent read. I am listening, which is dangerous for both of us.`,
    `${profile.name}: You did find the right detail. Now make it less interview and more conversation.`,
  ];

  return {
    message: message("match", replies[session.turns % replies.length]),
    status: session.status,
    source: "local",
    engine: "local",
    coaching: {
      dateScore: score,
      read: score > 70 ? "Good profile callback with enough momentum." : "Decent start, but it needs a sharper hook.",
      nextMove: `Make one playful callback to ${interest}, then ask a simple follow-up.`,
    },
  };
};

export const getRizzbotReply = async (input: {
  matchId: string;
  profile: RizzProfile;
  text: string;
}): Promise<ChatReply> => {
  const session = getSession(input.matchId, input.profile);
  const userMessage = message("user", input.text);
  session.messages.push(userMessage);

  try {
    const botpress = await tryBotpress({
      matchId: input.matchId,
      profile: session.profile,
      message: input.text,
      history: session.messages,
    });

    if (botpress) {
      const botpressReply = message("match", botpress.text);
      session.messages.push(botpressReply);
      const status =
        botpress.status ??
        (botpress.text.startsWith("UNMATCHED:")
          ? "unmatched"
          : botpress.text.startsWith("WIN:")
            ? "won"
            : "chatting");
      session.status = status;

      return {
        message: botpressReply,
        status,
        source: "botpress",
        engine: botpress.engine,
        completion: botpress.completion,
        coaching: botpress.coaching,
      };
    }
  } catch (error) {
    console.error(error);
  }

  const reply = localReply(session, input.text);
  session.messages.push(reply.message);
  session.status = reply.status;

  return reply;
};
