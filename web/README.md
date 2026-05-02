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
