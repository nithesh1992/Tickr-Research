import { GoogleGenAI } from "@google/genai";
import { AgentEvent } from "./agentClient.ts";
import {
  fetchSecFilings,
  fetchStockPriceAndDistributions,
  fetchRecentNewsArticles,
} from "./financialDataFetcher.ts";

export type ProviderType = "gemini-agent" | "gemini" | "openrouter" | "ollama" | "custom";

export interface ProviderConfig {
  provider: ProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export function resolveProviderCredentials(cfg: ProviderConfig): {
  provider: ProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
} {
  const provider = cfg.provider || "gemini-agent";

  if (provider === "openrouter") {
    return {
      provider,
      model: cfg.model?.trim() || process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      apiKey: cfg.apiKey?.trim() || process.env.OPENROUTER_API_KEY || "",
      baseUrl: (cfg.baseUrl?.trim() || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
    };
  }

  if (provider === "ollama") {
    const rawBase =
      cfg.baseUrl?.trim() ||
      process.env.OLLAMA_BASE_URL ||
      (cfg.apiKey?.trim() || process.env.OLLAMA_API_KEY
        ? "https://ollama.com/v1"
        : "http://localhost:11434/v1");
    return {
      provider,
      model: cfg.model?.trim() || process.env.OLLAMA_MODEL || "llama3.3",
      apiKey: cfg.apiKey?.trim() || process.env.OLLAMA_API_KEY || "ollama",
      baseUrl: rawBase.replace(/\/+$/, ""),
    };
  }

  if (provider === "custom") {
    return {
      provider,
      model: cfg.model?.trim() || process.env.OPENAI_COMPATIBLE_MODEL || "gpt-4o-mini",
      apiKey: cfg.apiKey?.trim() || process.env.OPENAI_COMPATIBLE_API_KEY || "",
      baseUrl: (cfg.baseUrl?.trim() || process.env.OPENAI_COMPATIBLE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    };
  }

  // Gemini ("gemini" standard or "gemini-agent" managed agent)
  return {
    provider,
    model: cfg.model?.trim() || "gemini-3.8-flash",
    apiKey: cfg.apiKey?.trim() || process.env.GEMINI_API_KEY || "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  };
}

export async function callChatCompletion(
  cfg: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; totalTokens: number }> {
  const resolved = resolveProviderCredentials(cfg);

  if (resolved.provider === "gemini" || resolved.provider === "gemini-agent") {
    if (!resolved.apiKey) {
      throw new Error("Missing Gemini API Key. Configure GEMINI_API_KEY or enter a key in Provider Settings.");
    }
    const ai = new GoogleGenAI({
      apiKey: resolved.apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: resolved.model || "gemini-3.8-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const usage = response.usageMetadata as any;
    const totalTokens = usage?.totalTokenCount || usage?.total_tokens || 0;
    return {
      text: response.text || "",
      totalTokens,
    };
  }

  // OpenAI-Compatible Endpoint (OpenRouter, Ollama Cloud/Local, Custom)
  if (resolved.provider === "openrouter" && !resolved.apiKey) {
    throw new Error("Missing OpenRouter API Key. Set OPENROUTER_API_KEY in .env or enter it in Provider Settings.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (resolved.apiKey) {
    headers["Authorization"] = `Bearer ${resolved.apiKey}`;
  }
  if (resolved.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://tickr.local";
    headers["X-Title"] = "Tickr Financial Research Agent";
  }

  const endpoint = resolved.baseUrl.endsWith("/chat/completions")
    ? resolved.baseUrl
    : `${resolved.baseUrl}/chat/completions`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: resolved.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`${resolved.provider.toUpperCase()} API Error (${resp.status}): ${errText.slice(0, 300)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const totalTokens = data?.usage?.total_tokens || 0;

  return { text, totalTokens };
}

export async function generateProviderAgnosticSentiment(
  ticker: string,
  timeframe: string,
  cfg: ProviderConfig
): Promise<any> {
  const resolved = resolveProviderCredentials(cfg);

  // Fetch recent online articles via Google News RSS so ALL providers have grounded real articles
  const articles = await fetchRecentNewsArticles(ticker, timeframe);

  // If using Gemini and key is present, we can also use googleSearch grounding or enrich with RSS
  if (resolved.provider === "gemini" || resolved.provider === "gemini-agent") {
    if (!resolved.apiKey) {
      throw new Error("Missing Gemini API Key.");
    }
    const ai = new GoogleGenAI({
      apiKey: resolved.apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const rssContext =
      articles.length > 0
        ? `\nHere are recent verified news articles retrieved for ${ticker} (${timeframe}):\n` +
          articles
            .map(
              (a, i) =>
                `${i + 1}. [${a.source}] "${a.title}" (${a.pubDate}) - ${a.snippet} | URL: ${a.link}`
            )
            .join("\n")
        : "";

    const sentimentPrompt = `Search online news articles, financial press coverage, analyst commentary, and market reactions for ${ticker} published within the last ${timeframe}.${rssContext}
Analyze the overall market sentiment, key narrative drivers, and recent articles.

Return your response as a valid JSON object wrapped in \`\`\`json ... \`\`\` matching this exact structure:
{
  "overall_sentiment": "Bullish" | "Neutral" | "Bearish",
  "sentiment_score": 72,
  "timeframe": "Last ${timeframe}",
  "summary": "2-3 sentence synthesis of how financial media, analysts, and investors view ${ticker} over the past ${timeframe}.",
  "key_drivers": [
    {
      "factor": "Short title of catalyst or headwind",
      "sentiment": "positive" | "negative" | "neutral",
      "impact": "1 sentence explanation of how this is driving sentiment."
    }
  ],
  "recent_articles": [
    {
      "title": "Article headline",
      "source": "Publisher name",
      "date": "YYYY-MM-DD",
      "sentiment": "Bullish" | "Neutral" | "Bearish",
      "sentiment_score": 78,
      "summary": "1-2 sentence summary of the article's takeaway and tone.",
      "url": "https://..."
    }
  ]
}
Provide 3 to 4 key_drivers and 4 to 6 recent_articles from the last ${timeframe}. Note: sentiment_score is 0 (extreme bearish) to 100 (extreme bullish), with 50 as neutral.`;

    const response = await ai.models.generateContent({
      model: resolved.model || "gemini-3.8-flash",
      contents: sentimentPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response.text || "";
    const parsed = extractJsonObject(rawText);

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundedSources = chunks
      .map((c: any) => c.web)
      .filter((w: any) => w && w.uri && w.title)
      .map((w: any) => ({
        title: String(w.title),
        uri: String(w.uri),
      }));

    // Merge RSS sources into groundedSources if needed
    const rssSources = articles.slice(0, 6).map((a) => ({
      title: `${a.source}: ${a.title}`,
      uri: a.link,
    }));

    const finalSentiment = parsed || {
      overall_sentiment: "Neutral",
      sentiment_score: 50,
      timeframe: `Last ${timeframe}`,
      summary: rawText.slice(0, 400) || `Recent market sentiment analysis for ${ticker}.`,
      key_drivers: [],
      recent_articles: [],
    };

    const allSources = [...groundedSources, ...rssSources];
    if (Array.isArray(finalSentiment.recent_articles) && allSources.length > 0) {
      finalSentiment.recent_articles = finalSentiment.recent_articles.map((art: any, idx: number) => {
        const hasValidUrl = typeof art.url === "string" && /^https?:\/\//i.test(art.url);
        return {
          ...art,
          url: hasValidUrl ? art.url : allSources[idx % allSources.length]?.uri || "",
        };
      });
    }
    finalSentiment.grounded_sources = allSources.slice(0, 8);
    return finalSentiment;
  }

  // OpenRouter / Ollama / Custom OpenAI-compatible sentiment synthesis
  const rssListText =
    articles.length > 0
      ? articles
          .map(
            (a, i) =>
              `${i + 1}. Title: "${a.title}" | Source: ${a.source} | Date: ${a.pubDate} | Snippet: ${a.snippet} | URL: ${a.link}`
          )
          .join("\n")
      : `No RSS articles returned; synthesize recent market sentiment knowledge for ${ticker}.`;

  const sysPrompt = `You are an institutional market sentiment analyst. You analyze recent financial news articles from the past ${timeframe} and output ONLY valid JSON wrapped in \`\`\`json ... \`\`\`.`;
  const usrPrompt = `Analyze the market sentiment for ${ticker} over the last ${timeframe} based on these live news articles:

${rssListText}

Output ONLY a JSON object wrapped in \`\`\`json ... \`\`\` matching this exact schema:
{
  "overall_sentiment": "Bullish" | "Neutral" | "Bearish",
  "sentiment_score": 72,
  "timeframe": "Last ${timeframe}",
  "summary": "2-3 sentence synthesis of how financial media, analysts, and investors view ${ticker} over the past ${timeframe}.",
  "key_drivers": [
    {
      "factor": "Short title of catalyst or headwind",
      "sentiment": "positive" | "negative" | "neutral",
      "impact": "1 sentence explanation of how this is driving sentiment."
    }
  ],
  "recent_articles": [
    {
      "title": "Article headline",
      "source": "Publisher name",
      "date": "YYYY-MM-DD",
      "sentiment": "Bullish" | "Neutral" | "Bearish",
      "sentiment_score": 78,
      "summary": "1-2 sentence summary of the article's takeaway and tone.",
      "url": "https://..."
    }
  ]
}`;

  const { text } = await callChatCompletion(cfg, sysPrompt, usrPrompt);
  const parsed = extractJsonObject(text) || {
    overall_sentiment: "Neutral",
    sentiment_score: 50,
    timeframe: `Last ${timeframe}`,
    summary: `Market sentiment synthesis for ${ticker} via ${resolved.provider} (${resolved.model}).`,
    key_drivers: [],
    recent_articles: articles.slice(0, 5).map((a) => ({
      title: a.title,
      source: a.source,
      date: a.pubDate,
      sentiment: "Neutral",
      sentiment_score: 50,
      summary: a.snippet || a.title,
      url: a.link,
    })),
  };

  parsed.grounded_sources = articles.slice(0, 6).map((a) => ({
    title: `${a.source}: ${a.title}`,
    uri: a.link,
  }));

  return parsed;
}

function extractJsonObject(rawText: string): any {
  if (!rawText) return null;
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {}
  }
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

export async function* streamProviderAgnosticAnalysis(opts: {
  ticker: string;
  instruction?: string;
  timeframe?: string;
  providerConfig: ProviderConfig;
}): AsyncGenerator<AgentEvent> {
  const { ticker, instruction, timeframe = "2 to 4 weeks", providerConfig } = opts;
  const resolved = resolveProviderCredentials(providerConfig);

  yield {
    type: "thinking",
    text: `Initializing provider-agnostic research pipeline using ${resolved.provider.toUpperCase()} (${resolved.model})...`,
  };

  // Step 1: SEC EDGAR Filings & XBRL Financials
  const secCallId = `sec_${Date.now()}`;
  yield {
    type: "tool_call",
    name: "sec_edgar_search",
    arguments: { ticker, forms: ["10-K", "10-Q", "8-K", "DEF 14A", "4", "N-CSR"] },
    callId: secCallId,
  };

  const secData = await fetchSecFilings(ticker);
  yield {
    type: "tool_result",
    name: "sec_edgar_search",
    callId: secCallId,
    result: JSON.stringify(
      {
        companyName: secData.companyName,
        cik: secData.cik,
        filingsFound: secData.filings.length,
        recentFilings: secData.filings.slice(0, 6).map((f) => ({
          form: f.form,
          filingDate: f.filingDate,
          url: f.url,
        })),
        xbrlQuartersFound: secData.quarterlyFinancials.length,
      },
      null,
      2
    ),
  };

  // Step 2: Yahoo Finance Historical Prices & Distributions
  const mktCallId = `mkt_${Date.now()}`;
  yield {
    type: "tool_call",
    name: "market_chart_fetch",
    arguments: { ticker, range: "4m_monthly_close_and_4q_dividends" },
    callId: mktCallId,
  };

  const mktData = await fetchStockPriceAndDistributions(ticker);
  yield {
    type: "tool_result",
    name: "market_chart_fetch",
    callId: mktCallId,
    result: JSON.stringify(
      {
        regularMarketPrice: mktData.regularMarketPrice,
        stock_price_4m: mktData.stockPrice4m,
        distributions_4q: mktData.distributions4q,
      },
      null,
      2
    ),
  };

  // Step 3: Recent 2-4 Week News Articles
  const newsCallId = `news_${Date.now()}`;
  yield {
    type: "tool_call",
    name: "news_sentiment_rss",
    arguments: { ticker, window: timeframe },
    callId: newsCallId,
  };

  const newsArticles = await fetchRecentNewsArticles(ticker, timeframe);
  yield {
    type: "tool_result",
    name: "news_sentiment_rss",
    callId: newsCallId,
    result: JSON.stringify(
      {
        articlesFound: newsArticles.length,
        headlines: newsArticles.slice(0, 6).map((a) => `${a.pubDate} [${a.source}] ${a.title}`),
      },
      null,
      2
    ),
  };

  // Step 4: LLM Synthesis
  yield {
    type: "thinking",
    text: `Auditing ${secData.filings.length} SEC filings, quantitative metrics, and ${newsArticles.length} recent news articles with ${resolved.model}...`,
  };

  const systemPrompt = `You are an elite institutional financial research analyst.
Synthesize the provided SEC EDGAR filings, XBRL quarterly financials, 4-month closing prices, and recent ${timeframe} news articles into a comprehensive JSON intelligence report.
Output ONLY a raw JSON object wrapped in \`\`\`json ... \`\`\` matching the exact requested schema.`;

  const dynamicSchema = `{
  "verdict": {
    "summary": "2-3 sentence high-level qualitative executive thesis...",
    "conviction_score": 82,
    "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"]
  },
  "market_sentiment": {
    "overall_sentiment": "Bullish",
    "sentiment_score": 74,
    "timeframe": "Last ${timeframe}",
    "summary": "2-3 sentence synthesis of recent media and investor sentiment...",
    "key_drivers": [
      {
        "factor": "Catalyst or headwind title",
        "sentiment": "positive",
        "impact": "1 sentence impact explanation"
      }
    ],
    "recent_articles": [
      {
        "title": "Headline",
        "source": "Publisher",
        "date": "YYYY-MM-DD",
        "sentiment": "Bullish",
        "sentiment_score": 78,
        "summary": "1-2 sentence article takeaway",
        "url": "https://..."
      }
    ]
  },
  "deep_insights": [
    {
      "category": "Growth & Competitive Moat",
      "title": "Insight title",
      "description": "Detailed paragraph analyzing findings...",
      "impact_score": 8
    }
  ],
  "findings": [
    {
      "documentType": "Form 10-K",
      "keyInsights": ["Specific insight 1", "Specific insight 2", "Specific insight 3"],
      "date": "YYYY-MM-DD",
      "sourceUrl": "https://www.sec.gov/Archives/..."
    }
  ],
  "financial_charts": {
    "stock_price_4m": [
      { "date": "Aug '26", "price": 140.2 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q1 2026", "revenue": 25.4, "net_income": 6.2 }
    ]
  }
}`;

  const userPrompt = `Ticker: ${ticker.toUpperCase()} (${secData.companyName})
${instruction ? `Additional User Instruction: ${instruction}\n` : ""}

1. OFFICIAL SEC EDGAR FILINGS RETRIEVED:
${JSON.stringify(secData.filings.slice(0, 10), null, 2)}

2. XBRL QUARTERLY FINANCIALS (Revenue & Net Income in $ Billions):
${JSON.stringify(secData.quarterlyFinancials, null, 2)}

3. YAHOO FINANCE 4-MONTH CLOSING PRICES & QUARTERLY DISTRIBUTIONS:
4M Stock Prices: ${JSON.stringify(mktData.stockPrice4m)}
4Q Distributions (if ETF): ${JSON.stringify(mktData.distributions4q)}

4. RECENT ONLINE NEWS ARTICLES (LAST ${timeframe.toUpperCase()}):
${JSON.stringify(newsArticles.slice(0, 8), null, 2)}

INSTRUCTIONS:
- Populate "findings" using the official SEC EDGAR filings above (keep their exact "url" as "sourceUrl" and "filingDate" as "date"), providing 2-3 detailed "keyInsights" per filing.
- Populate "deep_insights" with 3 high-impact structural, competitive, and risk insights (impact_score 1-10).
- Populate "market_sentiment" using the recent news articles above (keep their exact "link" as "url").
- For "financial_charts.stock_price_4m", use the exact 4M Stock Prices provided above (or estimate 4 recent monthly points if empty).
- For "financial_charts.financial_performance_4q", use the XBRL Quarterly Financials above (or if ${ticker} is an ETF without revenue, use the 4Q Distributions above with the "distributions" key).
- Output the final synthesis as a JSON block wrapped in \`\`\`json ... \`\`\` matching this schema:
${dynamicSchema}`;

  const { text, totalTokens } = await callChatCompletion(providerConfig, systemPrompt, userPrompt);

  // Ensure retrieved quantitative charts aren't accidentally dropped by smaller local/free models
  const parsed = extractJsonObject(text);
  let finalJsonText = text;
  if (parsed && typeof parsed === "object") {
    if (!parsed.financial_charts) {
      parsed.financial_charts = {};
    }
    if (
      (!Array.isArray(parsed.financial_charts.stock_price_4m) ||
        parsed.financial_charts.stock_price_4m.length === 0) &&
      mktData.stockPrice4m.length > 0
    ) {
      parsed.financial_charts.stock_price_4m = mktData.stockPrice4m;
    }
    if (
      (!Array.isArray(parsed.financial_charts.financial_performance_4q) ||
        parsed.financial_charts.financial_performance_4q.length === 0) &&
      secData.quarterlyFinancials.length > 0
    ) {
      parsed.financial_charts.financial_performance_4q = secData.quarterlyFinancials;
    }
    finalJsonText = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
  }

  yield {
    type: "text",
    text: finalJsonText,
  };

  yield {
    type: "complete",
    interaction: {
      usage: {
        total_tokens: totalTokens,
      },
    },
  };

  yield {
    type: "done",
  };
}
