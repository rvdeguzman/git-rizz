import { Conversation, z } from '@botpress/runtime'

const profiles = [
  {
    id: 'maya',
    name: 'Maya',
    age: 27,
    vibe: 'dry wit, book clubs, and late-night ramen',
    bio: 'Will judge your bookshelf, then ask where the best noodles are.',
    prompt: 'Dating me is like: a museum date that accidentally becomes a dumpling crawl.',
    personality:
      'Clever, teasing, allergic to try-hard lines. Likes specificity, curiosity, and playful disagreement.',
    boundary:
      'Unmatches fast on sexual openers, negging, pressure, or generic interview questions.',
  },
  {
    id: 'zoe',
    name: 'Zoe',
    age: 25,
    vibe: 'chaotic wholesome, gym playlists, and terrible puns',
    bio: 'Can deadlift more than your emotional baggage. Probably.',
    prompt: 'Two truths and a lie: I make elite pancakes, I hate dogs, I own too many hoodies.',
    personality:
      'Energetic and warm. Rewards confidence, light jokes, and clear plans. Gets bored by one-word replies.',
    boundary:
      'Unmatches on objectifying comments, arrogance, guilt-tripping, or asking for socials immediately.',
  },
  {
    id: 'rina',
    name: 'Rina',
    age: 29,
    vibe: 'calm creative, galleries, espresso, and voice notes',
    bio: 'Designer. Lover of quiet bars, clean typography, and people who can hold a thought.',
    prompt: 'Green flag: you can recommend one place without saying "vibes."',
    personality:
      'Observant, understated, and a little hard to impress. Likes thoughtful callbacks and low-pressure invites.',
    boundary:
      'Unmatches on spammy compliments, oversharing too early, pressure, or anything disrespectful.',
  },
] as const

const GameStateSchema = z.object({
  phase: z.enum(['swipe', 'chat', 'ended']).optional(),
  currentProfileIndex: z.number().int().min(0).optional(),
  activeProfileId: z.string().optional(),
  chatTurns: z.number().int().min(0).optional(),
  ickCount: z.number().int().min(0).optional(),
  streak: z.number().int().min(0).optional(),
  bestStreak: z.number().int().min(0).optional(),
  lastOutcome: z.string().optional(),
})

type GameState = z.infer<typeof GameStateSchema>
type Profile = (typeof profiles)[number]

const sendText = async (conversation: unknown, text: string) => {
  const sender = (conversation as { send: (message: { type: string; payload: { text: string } }) => Promise<void> })
    .send

  await sender({
    type: 'text',
    payload: { text },
  })
}

const getText = (message: unknown): string => {
  const payload = (message as { payload?: Record<string, unknown> } | undefined)?.payload
  const value = payload?.text ?? payload?.message ?? payload?.value
  return typeof value === 'string' ? value.trim() : ''
}

const normalizeState = (state: GameState) => {
  state.phase ??= 'swipe'
  state.currentProfileIndex ??= 0
  state.chatTurns ??= 0
  state.ickCount ??= 0
  state.streak ??= 0
  state.bestStreak ??= 0
}

const getCurrentProfile = (state: GameState): Profile => {
  const index = (state.currentProfileIndex ?? 0) % profiles.length
  return profiles[index]
}

const getActiveProfile = (state: GameState): Profile => {
  return profiles.find((profile) => profile.id === state.activeProfileId) ?? getCurrentProfile(state)
}

const advanceProfile = (state: GameState) => {
  state.currentProfileIndex = ((state.currentProfileIndex ?? 0) + 1) % profiles.length
  state.activeProfileId = undefined
  state.chatTurns = 0
  state.ickCount = 0
}

const resetRound = (state: GameState) => {
  state.phase = 'swipe'
  state.activeProfileId = undefined
  state.chatTurns = 0
  state.ickCount = 0
  state.lastOutcome = undefined
}

const renderProfileCard = (profile: Profile, state: GameState) => {
  return [
    `CARD ${profile.name}, ${profile.age}`,
    `VIBE: ${profile.vibe}`,
    `BIO: ${profile.bio}`,
    `PROMPT: ${profile.prompt}`,
    '',
    `Swipe with "left" or "right". Streak: ${state.streak ?? 0} | Best: ${state.bestStreak ?? 0}`,
  ].join('\n')
}

const isLeftSwipe = (text: string) => /\b(left|pass|skip|next|nope|nah)\b/i.test(text)
const isRightSwipe = (text: string) => /\b(right|like|yes|match|smash|swipe right)\b/i.test(text)
const isReset = (text: string) => /\b(reset|restart|new round|new card|start over)\b/i.test(text)
const getDirectMatchProfileId = (text: string) => text.match(/^match:([a-z0-9_-]+)$/i)?.[1]?.toLowerCase()

const detectUnmatch = (text: string): string | undefined => {
  const checks: Array<[RegExp, string]> = [
    [/\b(send|show).{0,12}(nudes?|pics?|body|feet)\b/i, 'asked for explicit photos'],
    [/\b(sex|horny|hook ?up|come over|sleep with|naked)\b/i, 'made it sexual too early'],
    [/\b(bitch|slut|whore|ugly|fat|stupid|dumb)\b/i, 'used disrespectful language'],
    [/\b(i know where you live|followed you|stalk|tracking you)\b/i, 'crossed a safety boundary'],
    [/\b(you owe me|dont reject me|give me your number now|why wont you)\b/i, 'got pushy after no consent'],
  ]

  return checks.find(([pattern]) => pattern.test(text))?.[1]
}

const detectIck = (text: string): string | undefined => {
  if (/^(hey|hi|yo|wyd|lol|haha|sup)\.?!?$/i.test(text)) {
    return 'too low-effort'
  }

  if (text.length < 8) {
    return 'too little to respond to'
  }

  if (/\b(ur hot|youre hot|you're hot|sexy|baddie)\b/i.test(text)) {
    return 'complimented looks without giving her anything to work with'
  }

  if (/\b(insta|instagram|ig|snap|snapchat|number|digits)\b/i.test(text)) {
    return 'asked for socials before building enough rapport'
  }

  return undefined
}

const detectWin = (text: string, state: GameState): string | undefined => {
  const asksForDate = /\b(coffee|drink|ramen|dinner|museum|walk|date|meet|go out)\b/i.test(text)
  const asksForSocial = /\b(insta|instagram|ig|number|text you|social)\b/i.test(text)
  const specificPlan = /\b(friday|saturday|sunday|tonight|tomorrow|this week|after work|at \d|around \d)\b/i.test(text)

  if ((state.chatTurns ?? 0) < 3) {
    return undefined
  }

  if (asksForSocial) {
    return 'got the social'
  }

  if (asksForDate && specificPlan) {
    return 'landed the date'
  }

  return undefined
}

const finishRound = async (conversation: unknown, state: GameState, outcome: 'win' | 'loss', reason: string) => {
  if (outcome === 'win') {
    state.streak = (state.streak ?? 0) + 1
    state.bestStreak = Math.max(state.bestStreak ?? 0, state.streak)
    state.lastOutcome = `WIN: ${reason}`
    state.phase = 'ended'

    await sendText(
      conversation,
      [
        `WIN: ${reason}.`,
        `STREAK: ${state.streak} | BEST: ${state.bestStreak}`,
        'Clean. You escalated after rapport instead of sprinting at the finish line.',
        'Send "next" or "new card" for the next profile.',
      ].join('\n')
    )
    return
  }

  state.streak = 0
  state.lastOutcome = `LOSS: ${reason}`
  state.phase = 'ended'

  await sendText(
    conversation,
    [
      `UNMATCHED: ${reason}.`,
      `STREAK RESET: 0 | BEST: ${state.bestStreak ?? 0}`,
      'Cleaner move: keep it specific, playful, and low-pressure.',
      'Send "next" or "new card" to try another profile.',
    ].join('\n')
  )
}

export default new Conversation({
  channel: '*',
  state: GameStateSchema,
  handler: async ({ type, message, state, conversation, execute }) => {
    normalizeState(state)

    const text = getText(message)

    if (type !== 'message') {
      return
    }

    if (state.phase === 'ended') {
      resetRound(state)
      advanceProfile(state)
      await sendText(conversation, renderProfileCard(getCurrentProfile(state), state))
      return
    }

    if (!text || isReset(text)) {
      resetRound(state)
      await sendText(conversation, renderProfileCard(getCurrentProfile(state), state))
      return
    }

    if (state.phase === 'swipe') {
      if (isLeftSwipe(text)) {
        advanceProfile(state)
        await sendText(conversation, renderProfileCard(getCurrentProfile(state), state))
        return
      }

      const directMatchProfileId = getDirectMatchProfileId(text)
      if (directMatchProfileId) {
        const profile = profiles.find((candidate) => candidate.id === directMatchProfileId)

        if (!profile) {
          await sendText(conversation, `Unknown profile: ${directMatchProfileId}`)
          return
        }

        state.phase = 'chat'
        state.activeProfileId = profile.id
        state.chatTurns = 0
        state.ickCount = 0

        await sendText(
          conversation,
          [
            `MATCHED WITH ${profile.name.toUpperCase()}`,
            `${profile.name}: okay, profile-reader. What made you swipe right?`,
            '',
            'Goal: build rapport, then earn a social or date. Pushy, gross, or low-effort messages can end the chat.',
          ].join('\n')
        )
        return
      }

      if (isRightSwipe(text)) {
        const profile = getCurrentProfile(state)
        state.phase = 'chat'
        state.activeProfileId = profile.id
        state.chatTurns = 0
        state.ickCount = 0

        await sendText(
          conversation,
          [
            `MATCHED WITH ${profile.name.toUpperCase()}`,
            `${profile.name}: okay, profile-reader. What made you swipe right?`,
            '',
            'Goal: build rapport, then earn a social or date. Pushy, gross, or low-effort messages can end the chat.',
          ].join('\n')
        )
        return
      }

      await sendText(conversation, renderProfileCard(getCurrentProfile(state), state))
      return
    }

    const profile = getActiveProfile(state)
    const unmatchReason = detectUnmatch(text)

    if (unmatchReason) {
      await finishRound(conversation, state, 'loss', unmatchReason)
      return
    }

    const winReason = detectWin(text, state)

    if (winReason) {
      await finishRound(conversation, state, 'win', winReason)
      return
    }

    const ickReason = detectIck(text)
    if (ickReason) {
      state.ickCount = (state.ickCount ?? 0) + 1

      if ((state.ickCount ?? 0) >= 2) {
        await finishRound(conversation, state, 'loss', `${ickReason} twice`)
        return
      }

      await sendText(
        conversation,
        [
          `${profile.name}: hmm. That gives me a tiny ick, but I will allow one recovery attempt.`,
          `ICK: ${ickReason}`,
          'RECOVER: send something specific about her profile, then ask an easy question.',
        ].join('\n')
      )
      return
    }

    state.chatTurns = (state.chatTurns ?? 0) + 1

    await execute({
      instructions: `
You are ${profile.name}, a fake dating-app match inside Rizzbot, a flirting practice game.

Profile:
- Age: ${profile.age}
- Vibe: ${profile.vibe}
- Bio: ${profile.bio}
- Prompt: ${profile.prompt}
- Personality: ${profile.personality}
- Boundaries: ${profile.boundary}

Game state:
- Phase: chat
- Successful chat turns this round: ${state.chatTurns}
- Current streak: ${state.streak ?? 0}
- Best streak: ${state.bestStreak ?? 0}
- Icks used this round: ${state.ickCount ?? 0}/2

Reply rules:
- Stay in character as ${profile.name}.
- Keep the NPC reply to 1-2 short chat lines.
- Reward specificity, callbacks to the profile, wit, and low-pressure confidence.
- Do not hand out socials or a date unless the user has built rapport and makes a specific, low-pressure plan.
- If the user's message is creepy, sexual, coercive, insulting, or unsafe, say "UNMATCHED:" and briefly explain.
- Keep everything PG-13 and consent-forward.

Response format:
NPC_REPLY: ...
DATE_SCORE: 0-100 plus a short label
READ: one sentence explaining what worked or missed
NEXT_MOVE: one concrete line the user could send next
`,
    })
  },
})
