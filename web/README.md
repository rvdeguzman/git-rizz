# Rizzbot Web

Next.js Tinder-style UI for the Botpress `rizzbot` agent.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` to generate profile photos with `gpt-image-2`. Photos are generated in batches of 3 and saved to `public/generated-profiles/`; if no key is present, the app reuses any cached images in that folder and then falls back to local placeholders.

To proxy chat turns into Botpress, set `BOTPRESS_RIZZBOT_ENDPOINT`. The endpoint receives:

```json
{
  "matchId": "match id",
  "profile": {},
  "message": "user text",
  "history": []
}
```

If the endpoint is not configured or fails, `/api/chat` uses an in-memory local rizzbot fallback so the UI stays usable during development.
