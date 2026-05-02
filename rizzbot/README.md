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

## Quick Test (Comedy MVP)

This project now includes a simple `Rizzbot` conversation handler in `src/conversations/index.ts`.

To test locally:

1. Start dev server:

   ```bash
   npm run dev
   ```

2. Open the Botpress local tester and send messages like:
   - "Give me a scene"
   - "DM opener for someone who likes books"
   - "She replied only 'lol', now what?"

3. Expect each response to include:
   - `NPC_REPLY`
   - `RIZZ_METER`
   - `ROAST`
   - `REWRITE`
   - `NEXT_MOVE`

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
