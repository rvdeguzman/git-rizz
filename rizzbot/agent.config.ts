import { z, defineConfig } from '@botpress/runtime'

export default defineConfig({
    name: 'rizzbot',
    description: 'An AI agent built with Botpress ADK',

    // defaultModels: {
    //   autonomous: "openai:gpt-4.1-mini-2025-04-14", // Model used by execute() in conversations/workflows
    //   zai: "openai:gpt-4.1-2025-04-14",             // Model used by Zai (extract, check, summarize, etc.)
    //   // Supports arrays for fallback: autonomous: ["openai:gpt-4.1", "anthropic:claude-3-5-sonnet"]
    // },

    // Per-bot persistent state — add fields here to store data across conversations.
    bot: {
        state: z.object({}),
    },

    // Per-user persistent state — add fields here to remember things about each user.
    user: {
        state: z.object({}),
    },

    // Static bot-level config — import { configuration } from '@botpress/runtime' to read it anywhere.
    // Great for feature flags, API endpoints, and other deploy-time settings.
    // configuration: {
    //   schema: z.object({
    //     apiEndpoint: z.string().default("https://api.example.com"),
    //     featureFlags: z.object({
    //       enableBeta: z.boolean().default(false),
    //     }).default({}),
    //   }),
    // },

    // Custom events your agent can emit and subscribe to via triggers.
    // events: {
    //   myEvent: {
    //     schema: z.object({ userId: z.string(), message: z.string() }),
    //     description: 'Emitted when something noteworthy happens',
    //   },
    // },

    // Integrations extend your agent with actions, channels, and events.
    // Browse available integrations:  adk search <name>  |  adk list --available
    // Install one:                    adk add <integration>  (e.g. adk add browser)
    // See actions/events/channels:    adk info <integration>
    dependencies: {
        "integrations": {
            "webchat": "webchat@0.3.0",
            "chat": "chat@1.0.0"
        }
    },
})
