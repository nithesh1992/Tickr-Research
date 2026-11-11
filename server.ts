import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

import { createInteraction, streamInteraction } from "./server/lib/agentClient.ts";
import { createInteraction as createInteractionPerseus, streamInteraction as streamInteractionPerseus } from "./server/lib/agentClientPerseus.ts";
import {
  ProviderConfig,
  generateProviderAgnosticSentiment,
  streamProviderAgnosticAnalysis,
} from "./server/lib/providerAgnosticAgent.ts";

function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    ) continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}


function loadAgentFiles(dir: string, basePath: string): Array<{type: string, content: string, target: string}> {
  let files: Array<{type: string, content: string, target: string}> = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const targetPath = path.posix.join(basePath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(loadAgentFiles(fullPath, targetPath));
    } else {
      files.push({
        type: "inline",
        content: fs.readFileSync(fullPath, "utf-8"),
        target: targetPath
      });
    }
  }
  return files;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing text." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'x-goog-api-client': 'applet-tickr/1.0.0'
          }
        }
      });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.1-flash-tts-preview',
        input: text,
        response_modalities: ['audio'],
        generation_config: {
          speech_config: [
            {
              speaker: "Speaker 1",
              language: "en-us",
              voice: "kore"
            },
            {
              speaker: "Speaker 2",
              language: "en-us",
              voice: "aoede"
            }
          ]
        }
      });

      let audioBuffer = null;
      let mimeType = "audio/wav";

      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const audioContent = step.content?.find(c => c.type === 'audio');
          if (audioContent && audioContent.data) {
            const pcmBuffer = Buffer.from(audioContent.data, 'base64');
            
            // If it's raw PCM, wrap it in a WAV header so browsers can play it
            if (audioContent.mime_type === 'audio/l16' || !audioContent.mime_type) {
              const sampleRate = 24000;
              const numChannels = 1;
              const wavHeader = Buffer.alloc(44);
              wavHeader.write("RIFF", 0);
              wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
              wavHeader.write("WAVE", 8);
              wavHeader.write("fmt ", 12);
              wavHeader.writeUInt32LE(16, 16);
              wavHeader.writeUInt16LE(1, 20);
              wavHeader.writeUInt16LE(numChannels, 22);
              wavHeader.writeUInt32LE(sampleRate, 24);
              wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28);
              wavHeader.writeUInt16LE(numChannels * 2, 32);
              wavHeader.writeUInt16LE(16, 34);
              wavHeader.write("data", 36);
              wavHeader.writeUInt32LE(pcmBuffer.length, 40);
              
              audioBuffer = Buffer.concat([wavHeader, pcmBuffer]);
              mimeType = "audio/wav";
            } else {
              audioBuffer = pcmBuffer;
              mimeType = audioContent.mime_type;
            }
          }
        }
      }

      if (audioBuffer) {
        res.setHeader("Content-Type", mimeType);
        res.send(audioBuffer);
      } else {
        res.status(500).json({ error: "Failed to generate audio content" });
      }
    } catch (error: any) {
      console.error("[TTS] Error:", error);
      res.status(500).json({ error: error.message || "TTS Generation failed" });
    }
  });


  app.get("/api/providers", (_req, res) => {
    res.json({
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
      hasOllamaKey: Boolean(process.env.OLLAMA_API_KEY),
      defaultOllamaBaseUrl:
        process.env.OLLAMA_BASE_URL ||
        (process.env.OLLAMA_API_KEY ? "https://ollama.com/v1" : "http://localhost:11434/v1"),
      defaultOpenRouterModel:
        process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      defaultOllamaModel: process.env.OLLAMA_MODEL || "llama3.3",
    });
  });

  app.post("/api/config/gemini-key", (req, res) => {
    try {
      const { apiKey } = req.body || {};
      const key = typeof apiKey === "string" ? apiKey.trim() : "";
      if (!key) {
        return res.status(400).json({ error: "API key is required." });
      }
      process.env.GEMINI_API_KEY = key;
      try {
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, "utf-8");
          if (/^GEMINI_API_KEY=.*$/m.test(envContent)) {
            envContent = envContent.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${key}`);
          } else {
            envContent += `\nGEMINI_API_KEY=${key}\n`;
          }
        } else {
          envContent = `GEMINI_API_KEY=${key}\n`;
        }
        fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
      } catch (err) {
        console.warn("[config] Failed to write .env file:", err);
      }
      return res.json({ success: true, hasGeminiKey: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Failed to save key" });
    }
  });

  app.post("/api/sentiment", async (req, res) => {
    try {
      const { ticker: rawTicker, timeframe: rawTimeframe, providerConfig } = req.body || {};
      const ticker = typeof rawTicker === "string" ? rawTicker.trim().toUpperCase() : "";
      if (!ticker || !/^[A-Za-z0-9._^-]{1,20}$/.test(ticker)) {
        return res.status(400).json({ error: "Invalid or missing ticker." });
      }

      const timeframe =
        typeof rawTimeframe === "string" && rawTimeframe.trim()
          ? rawTimeframe.trim()
          : "2 to 4 weeks";

      const cfg: ProviderConfig =
        providerConfig && typeof providerConfig === "object"
          ? providerConfig
          : { provider: "gemini-agent", model: "gemini-3.8-flash" };

      const parsedSentiment = await generateProviderAgnosticSentiment(ticker, timeframe, cfg);
      return res.json(parsedSentiment);
    } catch (error: any) {
      console.error("[sentiment] Error:", error);
      return res.status(500).json({ error: error.message || "Sentiment analysis failed" });
    }
  });

  // SECURITY: /api/upload_artifact and /api/download_jsonl were removed: they were
  // unauthenticated, shared across all users, and unused by the UI and agent.
  app.post("/api/analyze", async (req, res) => {
    try {
      const { ticker: rawTicker, instruction, model, timeframe, providerConfig } = req.body || {};
      const ticker = typeof rawTicker === 'string' ? rawTicker.trim() : '';
      if (!ticker || !/^[A-Za-z0-9._^-]{1,20}$/.test(ticker)) {
        return res.status(400).json({ error: "Invalid or missing ticker." });
      }

      const cfg: ProviderConfig =
        providerConfig && typeof providerConfig === "object"
          ? providerConfig
          : { provider: "gemini-agent", model: "gemini-3.8-flash" };

      console.log(`[analyze] Starting analysis for ${ticker} using provider=${cfg.provider} model=${cfg.model || model || 'default'}`);

      // If provider is NOT gemini-agent (e.g. openrouter, ollama, gemini standard/free tier, custom),
      // stream using the provider-agnostic research pipeline!
      if (cfg.provider && cfg.provider !== "gemini-agent") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const startTime = Date.now();
        let totalTokens = 0;

        try {
          const stream = streamProviderAgnosticAnalysis({
            ticker,
            instruction,
            timeframe: timeframe || "2 to 4 weeks",
            providerConfig: cfg,
          });

          for await (const event of stream) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
            if (event.type === "complete" && event.interaction) {
              const usage = (event.interaction.usage || event.interaction.usage_metadata) as any;
              if (usage) {
                totalTokens = usage.total_tokens || usage.totalTokenCount || 0;
              }
            }
          }
        } catch (streamErr: any) {
          console.error("[analyze] Provider-agnostic stream error:", streamErr);
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              message: streamErr.message || "Provider execution failed",
            })}\n\n`
          );
        }

        const totalDurationSecs = (Date.now() - startTime) / 1000;
        res.write(
          `data: ${JSON.stringify({
            type: "final_stats",
            duration: totalDurationSecs,
            tokens: totalTokens,
          })}\n\n`
        );
        return res.end();
      }
      
      const agentFiles = loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents");
      
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';

      let finalInstruction = instruction ? `${instruction}` : `Find and analyze recent SEC filings and public stock documents for ${ticker}. Make sure that you are looking for the most up to date documents of the existing quarter or the quarter before (if documents have not been out yet for the existing quarter, look for the last quarter). Also search for online news articles from the last 2 to 4 weeks to analyze recent market sentiment.`;

      const dynamicSchema = `{
  "verdict": {
    "summary": "...",
    "conviction_score": 85,
    "key_takeaways": ["...", "..."]
  },
  "market_sentiment": {
    "overall_sentiment": "Bullish",
    "sentiment_score": 74,
    "timeframe": "Last 2-4 Weeks",
    "summary": "...",
    "key_drivers": [
      {
        "factor": "...",
        "sentiment": "positive",
        "impact": "..."
      }
    ],
    "recent_articles": [
      {
        "title": "...",
        "source": "...",
        "date": "2026-11-01",
        "sentiment": "Bullish",
        "sentiment_score": 80,
        "summary": "...",
        "url": "..."
      }
    ]
  },
  "deep_insights": [
    {
      "category": "Risk Assessment",
      "title": "...",
      "description": "...",
      "impact_score": 8
    }
  ],
  "findings": [
    {
      "documentType": "Form 10-K",
      "keyInsights": ["...", "..."],
      "date": "2023-12-31",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_4m": [
      { "date": "Oct '24", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q1 2025", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;

      const prompt = `Perform a comprehensive document and market sentiment analysis on ${ticker}. ${finalInstruction}\n\nCRITICAL INSTRUCTIONS FOR QUANTITATIVE DATA (CHARTS):\nFor stock_price_4m and financial_performance_4q, you MUST use standard open web searches (e.g. Yahoo Finance, Google Finance, MarketWatch) WITHOUT the filetype:pdf restriction to get accurate historical prices, distributions, revenue, and net income. Do NOT rely solely on SEC PDFs for this quantitative data.\nFor stock_price_4m, provide exactly 4 data points representing the past 4 months of stock prices. For each month, give the closing price on the last trading day of the month. Order the array chronologically from the oldest month to the newest month (left to right).\nFor financial_performance_4q, if the ticker is a regular stock, provide net income and revenue for the past four completed quarters. If it is an ETF, provide quarterly distributions (dividends/yield per share) for the past four completed quarters. Ensure the array is chronologically ordered from oldest quarter to newest (left to right).\n\nCRITICAL INSTRUCTIONS FOR MARKET SENTIMENT (LAST 2 TO 4 WEEKS):\nUse standard open web searches WITHOUT the filetype:pdf restriction to search for recent online news articles, analyst coverage, and market commentary published in the last 2 to 4 weeks for ${ticker}. Populate the "market_sentiment" object with an overall_sentiment ("Bullish", "Neutral", or "Bearish"), sentiment_score (0 to 100), timeframe ("Last 2-4 Weeks"), summary, key_drivers, and recent_articles.\n\nCRITICAL INSTRUCTIONS FOR QUALITATIVE DATA (INSIGHTS & SUMMARIES):\nFor the Executive Summary, Key Takeaways, and Deep Insights, you MUST leverage BOTH the findings extracted from the PDF SEC filings AND insights from broader open web searches to create a comprehensive analysis.\n\nCRITICAL: You MUST output the final synthesis report as a raw JSON object wrapped in \`\`\`json ... \`\`\` markdown block in your final text response. The JSON must match the following schema EXACTLY. **HEAVILY PENALIZED:** Do NOT rename keys. Do NOT add extra root-level keys like "macro_risk_analysis". Make sure to populate the "findings" array with exactly the keys "documentType", "keyInsights", "date", and "sourceUrl". For stock_price_4m, use exactly the keys "date" and "price". The "deep_insights" array MUST use exactly the keys "category", "title", "description", and "impact_score":\n${dynamicSchema}\nDo not include multiple sub-agents, just do the analysis yourself based on the retrieved documents and searches.`;

      const apiKey = cfg.apiKey?.trim() || process.env.GEMINI_API_KEY || "";
      if (apiKey && !process.env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = apiKey;
      }

      let response;
      if (model === 'perseus') {
        response = await createInteractionPerseus({
          prompt,
          apiKey,
          inlineSources: agentFiles,
          tools: [{ type: "google_search" }]
        });
      } else {
        response = await createInteraction({
          prompt,
          apiKey,
          inlineSources: agentFiles,
          tools: [{ type: "google_search" }]
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[analyze] Managed Agent createInteraction failed (${response.status}), falling back to Gemini Standard + Server SEC/News Pipeline...`);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const startTime = Date.now();
        let totalTokens = 0;
        try {
          const fallbackStream = streamProviderAgnosticAnalysis({
            ticker,
            instruction,
            timeframe: timeframe || "2 to 4 weeks",
            providerConfig: { ...cfg, provider: "gemini", apiKey },
          });
          for await (const event of fallbackStream) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
            if (event.type === "complete" && event.interaction) {
              const usage = (event.interaction.usage || event.interaction.usage_metadata) as any;
              if (usage) totalTokens = usage.total_tokens || usage.totalTokenCount || 0;
            }
          }
        } catch (fbErr: any) {
          res.write(`data: ${JSON.stringify({ type: "error", message: fbErr.message || errorText })}\n\n`);
        }
        const totalDurationSecs = (Date.now() - startTime) / 1000;
        res.write(`data: ${JSON.stringify({ type: "final_stats", duration: totalDurationSecs, tokens: totalTokens })}\n\n`);
        return res.end();
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      
      const startTime = Date.now();
      const safeTickerSlug = String(ticker || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'unknown';
      const runLogsDir = '/tmp/run_logs';
      const pruneRunLogs = () => {
        try {
          if (!fs.existsSync(runLogsDir)) return;
          const entries = fs
            .readdirSync(runLogsDir)
            .map((name) => {
              const fullPath = path.join(runLogsDir, name);
              try {
                const stat = fs.statSync(fullPath);
                return stat.isFile() ? { fullPath, mtimeMs: stat.mtimeMs } : null;
              } catch {
                return null;
              }
            })
            .filter((e): e is { fullPath: string; mtimeMs: number } => Boolean(e))
            .sort((a, b) => a.mtimeMs - b.mtimeMs);
          while (entries.length > 20) {
            const oldest = entries.shift();
            if (oldest) {
              try {
                fs.unlinkSync(oldest.fullPath);
              } catch {}
            }
          }
        } catch {}
      };
      try {
        if (!fs.existsSync(runLogsDir)) {
          fs.mkdirSync(runLogsDir, { recursive: true });
        }
        pruneRunLogs();
      } catch {}

      const runId = Date.now();
      const jsonlLogPath = path.join(runLogsDir, `run_log_${safeTickerSlug}_${runId}.jsonl`);
      pruneRunLogs();
      
      let debugLog = `--- Analysis Run for ${ticker} at ${new Date().toISOString()} ---\n\n`;
      const toolExecutions = {};
      let totalTokens = 0;
          
      const stream = model === 'perseus' ? streamInteractionPerseus(response) : streamInteraction(response);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        
        if (event.type === 'complete' && event.interaction) {
            const usage = (event.interaction.usage || event.interaction.usage_metadata) as any;
            if (usage) {
                totalTokens = usage.total_tokens || usage.totalTokenCount || usage.total_token_count || 0;
            }
        }
        
        try {
          fs.appendFileSync(jsonlLogPath, JSON.stringify(event) + '\n', 'utf-8');
        } catch (e) {
          console.error("Failed to write to JSONL log", e);
        }
            
        if (event.type === 'tool_call') {
          const callId = event.callId || `unknown_${Math.random()}`;
          toolExecutions[callId] = {
            name: event.name || 'code_execution_call',
            args: event.arguments,
            startTime: Date.now()
          };
          debugLog += `[${new Date().toISOString()}] [TOOL CALL START] ${event.name || 'code_execution_call'}\n`;
          debugLog += `Call ID: ${callId}\n`;
          debugLog += `Arguments: ${JSON.stringify(event.arguments, null, 2)}\n\n`;
        } else if (event.type === 'tool_result') {
          const callId = event.callId || 'unknown';
          const execution = toolExecutions[callId];
          const duration = execution ? ((Date.now() - execution.startTime) / 1000).toFixed(2) + 's' : 'unknown';
          if (execution) {
            execution.duration = duration;
            execution.result = event.result;
          }
          debugLog += `[${new Date().toISOString()}] [TOOL RESULT END] ${event.name || 'command'}\n`;
          debugLog += `Call ID: ${callId}\n`;
          debugLog += `Duration: ${duration}\n`;
          debugLog += `Result: ${event.result ? String(event.result).substring(0, 500) : ''}...\n\n`;
        } else if (event.type === 'text') {
          debugLog += `[TEXT OUTPUT]\n${event.text}\n\n`;
        } else if (event.type === 'error') {
          debugLog += `[ERROR]\n${event.message}\n\n`;
        }

        if (event.type === 'done' || event.type === 'complete' || event.type === 'error') {
            break;
        }
      }
          
      const totalDurationSecs = ((Date.now() - startTime) / 1000);
      const totalDuration = totalDurationSecs.toFixed(2) + 's';
      
      // Send final reliable stats to client
      res.write(`data: ${JSON.stringify({ type: 'final_stats', duration: totalDurationSecs, tokens: totalTokens })}\n\n`);

      let summaryLog = `========================================================\n`;
      summaryLog += `                 RUN SUMMARY FOR ${ticker.toUpperCase()}\n`;
      summaryLog += `                 Total Duration: ${totalDuration}\n`;
      summaryLog += `========================================================\n\n`;
      summaryLog += `1. SUB-AGENT EXECUTIONS:\n`;
      summaryLog += `--------------------------------------------------------\n`;
      
      let allWorked = true;
      Object.values(toolExecutions).forEach((exec: any, idx) => {
          const status = exec.result ? 'Completed' : 'Failed/Timeout';
          if (!exec.result || String(exec.result).includes('error') || String(exec.result).includes('traceback')) allWorked = false;
          summaryLog += `Agent Step ${idx + 1}: ${exec.name}\n`;
          summaryLog += `Status: ${status}\n`;
          summaryLog += `Duration: ${exec.duration || 'unknown'}\n`;
          summaryLog += `Arguments: ${JSON.stringify(exec.args)}\n`;
          const resultStr = exec.result ? String(exec.result) : '';
          summaryLog += `Output Preview: ${resultStr ? resultStr.substring(0, 200).replace(/\n/g, ' ') + '...' : 'None'}\n`;
          summaryLog += `--------------------------------------------------------\n`;
      });
      
      summaryLog += `\n2. OVERALL AGENT STATUS: ${allWorked ? 'SUCCESS' : 'WITH ERRORS'}\n`;
      summaryLog += `\n3. GENERATED MEDIA ARTIFACTS:\n`;
      summaryLog += `Audio Briefing Link: /artifacts/podcast_briefing.wav\n`;
      summaryLog += `\n========================================================\n\n`;
      summaryLog += `RAW EXECUTION LOGS:\n\n`;

      try {
        const logFileName = `run_log_${safeTickerSlug}_${Date.now()}.txt`;
        const finalLog = summaryLog + debugLog;
        fs.writeFileSync(path.join(runLogsDir, logFileName), finalLog, 'utf-8');
        pruneRunLogs();
      } catch (e) {
        console.error("Failed to write debug log", e);
      }
          
      res.end();
    } catch (err: any) {
      console.error("[analyze] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Analyze failed" });
      }
    }
  });

  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));
  app.use(
    '/artifacts',
    express.static(path.join(process.cwd(), 'workspace', 'artifacts'), {
      setHeaders: (res) => {
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );
  // SECURITY: per-run log downloads (/run_logs/:file, /latest_log/:file) were
  // removed: logs are shared across users and the UI does not fetch them.
  app.use('/run_logs', (_req, res) => {
    res.status(403).send('Forbidden');
  });
  app.use('/latest_log', (_req, res) => {
    res.status(403).send('Forbidden');
  });

  if (process.env.NODE_ENV !== "production" || !indexHtmlExists) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(["/server.cjs", "/server.cjs.map"], (_req: any, res: any) => res.status(404).end());
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
