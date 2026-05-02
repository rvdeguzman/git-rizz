# rizzbot

A Botpress Agent built with the ADK.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start development server:

   ```bash
   adk dev
   ```

3. Deploy your agent:
   ```bash
   adk deploy
   ```

## Quick Test (Swipe-to-Chat MVP)

This project includes a `Rizzbot` conversation handler in `src/conversations/index.ts`.
It runs a small dating-practice game:

1. Swipe left/right on fake dating profiles.
2. A right swipe opens a match chat.
3. The user tries to build rapport without sending an ick.
4. The round ends in a loss on creepy, pushy, disrespectful, or repeated low-effort messages.
5. The round ends in a win when the user earns a specific date/social ask after enough rapport.

To test locally:

1. Start dev server:

   ```bash
   npm run dev
   ```

2. Open the Botpress local tester and send messages like:
   - "new card"
   - "left"
   - "right"
   - "Your museum-to-dumpling pipeline sounds dangerously efficient. What's the best accidental food crawl you've found?"
   - "Want to grab ramen after work this Friday?"

3. During chat, expect coaching fields like:
   - `NPC_REPLY`
   - `DATE_SCORE`
   - `READ`
   - `NEXT_MOVE`

4. Round-ending responses include:
   - `WIN`
   - `UNMATCHED`
   - `STREAK`

## Project Structure

- `src/actions/` - Define callable functions
- `src/workflows/` - Define long-running processes
- `src/conversations/` - Define conversation handlers
- `src/tables/` - Define data storage schemas
- `src/triggers/` - Define event subscriptions
- `src/knowledge/` - Add knowledge base files

## Learn More

- [ADK Documentation](https://botpress.com/docs/adk)
- [Botpress Platform](https://botpress.com)
