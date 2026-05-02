import { Action, Autonomous, adk, z } from '@botpress/runtime'

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'match', 'system']),
  content: z.string(),
})

const ProfileSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  headline: z.string().optional(),
  bio: z.string().optional(),
  promptLabel: z.string().optional(),
  promptAnswer: z.string().optional(),
  interests: z.array(z.string()).optional(),
  voice: z.string().optional(),
  personality: z.string().optional(),
  boundary: z.string().optional(),
  openingLine: z.string().optional(),
})

type Profile = z.infer<typeof ProfileSchema>

const CoachingSchema = z.object({
  dateScore: z.number(),
  read: z.string(),
  nextMove: z.string(),
})

const CompletionSchema = z.object({
  llmCalls: z.number(),
  model: z.string().optional(),
  tokens: z.number().optional(),
  durationMs: z.number(),
})

type Coaching = z.infer<typeof CoachingSchema>

const detectUnmatch = (text: string): string | undefined => {
  const checks: Array<[RegExp, string]> = [
    [/\b(send|show).{0,16}(nudes?|pics?|body|feet)\b/i, 'asked for explicit photos'],
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

const isDateAsk = (text: string) => /\b(coffee|drink|ramen|dinner|museum|walk|date|meet|go out)\b/i.test(text)
const isSpecific = (text: string) => /\b(friday|saturday|sunday|tonight|tomorrow|this week|after work|at \d|around \d)\b/i.test(text)

const getInterest = (profile: Profile, text: string) => {
  const interests = profile.interests?.length ? profile.interests : ['profile']
  return interests.find((item) => text.toLowerCase().includes(item.split(' ')[0].toLowerCase())) ?? interests[0]
}

const scoreMessage = (text: string, profile: Profile, turns: number) => {
  let score = 34 + turns * 9

  if (text.includes('?')) {
    score += 8
  }

  if (text.length > 55) {
    score += 9
  }

  if ((profile.interests ?? []).some((interest) => text.toLowerCase().includes(interest.split(' ')[0].toLowerCase()))) {
    score += 12
  }

  if (isDateAsk(text) && isSpecific(text)) {
    score += 14
  }

  return Math.max(0, Math.min(100, score))
}

const fallbackReply = (input: {
  profile: Profile
  message: string
  history?: Array<z.infer<typeof ChatMessageSchema>>
}): { reply: string; status: 'chatting' | 'unmatched' | 'won'; coaching: Coaching } => {
  const text = input.message.trim()
  const lowered = text.toLowerCase()
  const userTurns = Math.max(1, input.history?.filter((message) => message.role === 'user').length ?? 1)
  const priorIcks = input.history?.filter((message) => /\bICK:|tiny ick/i.test(message.content)).length ?? 0
  const unmatchReason = detectUnmatch(text)

  if (unmatchReason) {
    return {
      reply: `UNMATCHED: ${unmatchReason}.`,
      status: 'unmatched',
      coaching: {
        dateScore: 0,
        read: 'That crossed a boundary instead of building comfort.',
        nextMove: 'Reset with a profile-specific, low-pressure question.',
      },
    }
  }

  const ick = detectIck(text)
  if (ick) {
    if (priorIcks >= 1) {
      return {
        reply: `UNMATCHED: ${ick} twice.`,
        status: 'unmatched',
        coaching: {
          dateScore: 12,
          read: 'The chat needs a real hook, not another empty ping.',
          nextMove: `Mention ${getInterest(input.profile, text)} and ask one easy question.`,
        },
      }
    }

    return {
      reply: `${input.profile.name}: Hmm. Tiny ick, but I will allow one recovery attempt.\nICK: ${ick}`,
      status: 'chatting',
      coaching: {
        dateScore: 24,
        read: `This was ${ick}.`,
        nextMove: `Use one detail from her profile and ask about ${getInterest(input.profile, text)}.`,
      },
    }
  }

  if (isDateAsk(lowered) && isSpecific(lowered) && userTurns >= 3) {
    return {
      reply: `WIN: ${input.profile.name}: That is actually a good plan. I would say yes to that.`,
      status: 'won',
      coaching: {
        dateScore: 92,
        read: 'Specific, low-pressure, and timed after some rapport.',
        nextMove: 'Lock the plan without overexplaining.',
      },
    }
  }

  const interest = getInterest(input.profile, lowered)
  const score = scoreMessage(text, input.profile, userTurns)

  return {
    reply: `${input.profile.name}: You found the ${interest} detail. Now make it less interview and more conversation.`,
    status: 'chatting',
    coaching: {
      dateScore: score,
      read: score > 70 ? 'Good profile callback with enough momentum.' : 'Decent start, but it needs a sharper hook.',
      nextMove: `Make one playful callback to ${interest}, then ask a simple follow-up.`,
    },
  }
}

const formatHistory = (history: Array<z.infer<typeof ChatMessageSchema>> = []) =>
  history
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n')

export default new Action({
  name: 'rizzbotReply',
  description: 'Returns the next Rizzbot dating-practice reply for the web app.',
  input: z.object({
    matchId: z.string(),
    profile: ProfileSchema,
    message: z.string(),
    history: z.array(ChatMessageSchema).optional(),
  }),
  output: z.object({
    reply: z.string(),
    status: z.enum(['chatting', 'unmatched', 'won']),
    coaching: CoachingSchema.optional(),
    engine: z.enum(['botpress-completion', 'botpress-action-fallback']),
    completion: CompletionSchema.optional(),
  }),
  handler: async ({ input }) => {
    const startedAt = Date.now()
    let llmCalls = 0
    let model: string | undefined
    let tokens: number | undefined

    const replyExit = new Autonomous.Exit({
      name: 'reply',
      description: 'Return the next Rizzbot web reply and coaching.',
      schema: z.object({
        reply: z.string(),
        status: z.enum(['chatting', 'unmatched', 'won']),
        coaching: CoachingSchema,
      }),
    })

    try {
      const result = await adk.execute({
        iterations: 2,
        temperature: 0.8,
        exits: [replyExit],
        hooks: {
          onTrace: ({ trace }) => {
            if (trace.type === 'llm_call_started') {
              llmCalls += 1
              model = trace.model
            }
          },
          onIterationEnd: (iteration) => {
            if (iteration.llm?.model) {
              model = Array.isArray(iteration.llm.model) ? iteration.llm.model[0] : iteration.llm.model
            }

            if (iteration.llm?.tokens) {
              tokens = iteration.llm.tokens
            }
          },
        },
        instructions: `
You are ${input.profile.name}, a fake dating-app match inside Rizzbot, a flirting practice game.

Profile:
- Age: ${input.profile.age ?? 'unknown'}
- Headline: ${input.profile.headline ?? ''}
- Bio: ${input.profile.bio ?? ''}
- Prompt: ${input.profile.promptLabel ?? ''}: ${input.profile.promptAnswer ?? ''}
- Interests: ${(input.profile.interests ?? []).join(', ')}
- Voice: ${input.profile.voice ?? ''}
- Personality: ${input.profile.personality ?? ''}
- Boundaries: ${input.profile.boundary ?? ''}

Recent chat:
${formatHistory(input.history)}

Latest user message:
${input.message}

Reply rules:
- Stay in character as ${input.profile.name}.
- Keep the match reply to 1-2 short chat lines.
- Reward specificity, callbacks to the profile, wit, and low-pressure confidence.
- Do not hand out socials or a date unless the user has built rapport and makes a specific, low-pressure plan.
- If the user's message is creepy, sexual, coercive, insulting, or unsafe, set status to "unmatched" and make the reply start with "UNMATCHED:".
- If the user earns a specific date or social after rapport, set status to "won" and make the reply start with "WIN:".
- Keep everything PG-13 and consent-forward.
- Coaching must include dateScore from 0-100, a one-sentence read, and a concrete nextMove.

Return by using the reply exit exactly once:
return {
  action: "reply",
  reply: "...",
  status: "chatting",
  coaching: {
    dateScore: 0,
    read: "...",
    nextMove: "..."
  }
}
`,
      })

      if (!result.isSuccess() || !result.is(replyExit)) {
        throw new Error(result.isError() ? result.error.message : 'Botpress completion did not return the reply exit')
      }

      return {
        ...result.output,
        engine: 'botpress-completion' as const,
        completion: {
          llmCalls,
          model,
          tokens,
          durationMs: Date.now() - startedAt,
        },
      }
    } catch (error) {
      console.error(error)
      return {
        ...fallbackReply(input),
        engine: 'botpress-action-fallback' as const,
      }
    }
  },
})
