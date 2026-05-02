# Rizzbot Web

Next.js Tinder-style UI for the Botpress `rizzbot` agent.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` to generate profile photos with `gpt-image-2`. Photos are generated in batches of 3 and saved to `public/generated-profiles/` with profile metadata sidecars. Each batch serves saved generated profiles first, then cached images, then fresh `gpt-image-2` generations.

`OPENAI_IMAGE_TIMEOUT_MS` defaults to `120000`. If image generation times out or fails, the API returns cached/local fallback images instead of blocking the swipe deck.

To proxy chat turns into local Botpress ADK dev, start `rizzbot` with `npm run dev`, then set:

```bash
BOTPRESS_RIZZBOT_ENDPOINT=http://localhost:3000
BOTPRESS_RIZZBOT_BOT_ID=<bot id shown by adk dev>
BOTPRESS_RIZZBOT_ACTION=rizzbotReply
```

With `BOTPRESS_RIZZBOT_BOT_ID` set, `/api/chat` calls the ADK `rizzbotReply` action with Botpress action headers.

Without `BOTPRESS_RIZZBOT_BOT_ID`, `BOTPRESS_RIZZBOT_ENDPOINT` is treated as a custom HTTP endpoint that receives:

```json
{
  "matchId": "match id",
  "profile": {},
  "message": "user text",
  "history": []
}
```

That custom endpoint may return `{ "reply": "..." }`, `{ "text": "..." }`, `{ "message": "..." }`, or Botpress-style message payloads.

If the endpoint is not configured or fails, `/api/chat` uses an in-memory local rizzbot fallback so the UI stays usable during development. Check the `/api/chat` response fields:

- `source: "botpress"` means Botpress handled the turn.
- `engine: "botpress-completion"` means Botpress made an autonomous LLM call.
- `completion.llmCalls`, `completion.model`, and `completion.tokens` provide proof of the model call.
- `engine: "botpress-action-fallback"` means Botpress was reached, but the action fell back to deterministic logic.
- `source: "local"` means the web fallback handled the turn.
