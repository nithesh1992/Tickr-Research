# Tickr Research

A company and market research application that combines SEC filing discovery, recent news sentiment analysis, and quarterly financial data into an interactive research brief. Built with React, Tailwind CSS, Vite, and Node.js, powered by Google Gemini.

---

## Features

- **SEC Filing Inspection**: Retrieves public regulatory filings (10-K, 10-Q, 8-K) and extracts document-level takeaways with source links.
- **News Sentiment Analysis**: Samples recent financial press coverage across configurable windows (2, 3, or 4 weeks) to score market tone, identify conversation drivers, and provide source citations.
- **Financial & Price Charts**: Displays closing price trajectories and quarterly revenue/earnings or distribution charts using Recharts.
- **Transparent Agent Activity**: Streams research progress in real time via Server-Sent Events (SSE), detailing search queries, tool execution, and source verification.
- **API Key Management**: Enter your Gemini API key directly in the web UI (stored in your browser and synced to `.env`) or provide it via environment variables.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nithesh1992/Tickr-Research.git
   cd Tickr-Research
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Set your API key in a `.env` file:
   ```bash
   echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
   ```
   *Note: If omitted, you can enter the key in the UI when prompted.*

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser at [http://localhost:3000](http://localhost:3000).

---

## Scripts

- `npm run dev` — Starts the Express backend and Vite development server.
- `npm run build` — Builds the production bundle and bundles the server script.
- `npm run lint` — Runs TypeScript type-checking without emitting files.

---

## Project Structure

```text
├── agent/                    # Model instructions and agent definitions
├── server/                   # Backend logic
│   └── lib/                  # SEC search, sentiment parser, and agent clients
├── src/                      # Frontend application
│   ├── components/           # AgentTimeline, SentimentPanel, ResearchSearch, etc.
│   ├── App.tsx               # Primary application state and view routing
│   ├── LandingView.tsx       # Landing page and search hero
│   ├── ReportTemplate.tsx    # Research brief rendering
│   └── index.css             # Design tokens and Tailwind configuration
├── server.ts                 # Express API server & Vite integration
└── package.json
```

---

## Disclaimer

This project is for educational and research purposes only. The information generated is derived from public market sources and should not be considered investment or financial advice.
