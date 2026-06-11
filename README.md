# Tarot Fate WebApp

An immersive AI-powered tarot reading experience built as a graduation design project.

The application guides users through a complete ritual flow: asking a question, shuffling a 78-card deck, drawing cards for the past, present, and future, revealing interpretations, and saving readings locally.

## Features

- Immersive old-witch-table visual style
- Mouse-driven card shuffling interaction
- Curved 78-card draw deck
- Drag-and-drop three-card spread
- 3D card reveal animations
- AI tarot interpretations through the DeepSeek API
- Local reading history using `localStorage`

## Tech Stack

- Next.js 14 and React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- DeepSeek API

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To enable live AI interpretations, create `.env.local`:

```env
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Without an API key, the application uses built-in mock readings.

## Project Documentation

Detailed Chinese documentation and the current development handoff are available in [`ProjectDocument`](./ProjectDocument/).
