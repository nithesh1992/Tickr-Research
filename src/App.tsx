import { useEffect, useRef, useState } from 'react';
import { Activity, FileText, Key, Plus, Sparkles } from 'lucide-react';
import { LandingView } from './LandingView';
import ReportTemplate from './ReportTemplate';
import { AgentTimeline } from './components/AgentTimeline';
import type { TimelineEvent } from './components/AgentTimeline';
import { SentimentPanel } from './components/SentimentPanel';
import { ResearchSearch } from './components/ResearchSearch';
import { GeminiApiKeyModal } from './components/GeminiApiKeyModal';

export interface DocumentFinding {
  documentType?: string;
  document_type?: string;
  keyInsights?: string[];
  key_insights?: string[];
  date?: string;
  sourceUrl?: string;
  source_url?: string;
}

export interface DeepInsight {
  category: string;
  title: string;
  description: string;
  impact_score: number;
}

export interface SentimentDriver {
  factor: string;
  sentiment: 'positive' | 'negative' | 'neutral' | string;
  impact: string;
}

export interface SentimentArticle {
  title: string;
  source: string;
  date?: string;
  sentiment: 'Bullish' | 'Neutral' | 'Bearish' | string;
  sentiment_score?: number;
  summary: string;
  url?: string;
}

export interface MarketSentiment {
  overall_sentiment: 'Bullish' | 'Neutral' | 'Bearish' | string;
  sentiment_score: number;
  timeframe?: string;
  summary: string;
  key_drivers?: SentimentDriver[];
  recent_articles?: SentimentArticle[];
  grounded_sources?: { title: string; uri: string }[];
}

export interface ReportData {
  verdict?: {
    summary: string;
    conviction_score: number;
    key_takeaways: string[];
  };
  market_sentiment?: MarketSentiment;
  deep_insights?: DeepInsight[];
  findings?: DocumentFinding[];
  financial_charts?: {
    stock_price_4m: { date: string; price: number }[];
    financial_performance_4q: {
      quarter: string;
      revenue?: number;
      net_income?: number;
      distributions?: number;
    }[];
  };
}

const ENABLE_JSON_DOWNLOAD = false;
const API_KEY_STORAGE_KEY = 'tickr_gemini_api_key';

export default function App() {
  const [ticker, setTicker] = useState('');
  const [instruction, setInstruction] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [hasServerKey, setHasServerKey] = useState<boolean>(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  const [runningPerseus, setRunningPerseus] = useState(false);
  const [errorPerseus, setErrorPerseus] = useState<string | null>(null);
  const [reportDataPerseus, setReportDataPerseus] = useState<ReportData | null>(null);
  const [eventsPerseus, setEventsPerseus] = useState<TimelineEvent[]>([]);
  const abortRefPerseus = useRef<AbortController | null>(null);
  const eventIdRefPerseus = useRef(0);
  const [tokenCountPerseus, setTokenCountPerseus] = useState(0);
  const [toolRunsPerseus, setToolRunsPerseus] = useState(0);
  const [durationSecsPerseus, setDurationSecsPerseus] = useState(0);
  const [startTimePerseus, setStartTimePerseus] = useState<number | null>(null);

  const [sentimentData, setSentimentData] = useState<MarketSentiment | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);
  const [sentimentTimeframe, setSentimentTimeframe] = useState('2 weeks');
  const sentimentAbortRef = useRef<AbortController | null>(null);

  const [isReportOpen, setIsReportOpen] = useState(false);

  const isConfigured = hasServerKey || Boolean(geminiApiKey.trim());
  const activeReport = reportDataPerseus;
  const hasStarted =
    runningPerseus ||
    sentimentLoading ||
    Boolean(reportDataPerseus) ||
    Boolean(sentimentData) ||
    eventsPerseus.length > 0;

  useEffect(() => {
    fetch('/api/providers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.hasGeminiKey) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveApiKey = async (newKey: string) => {
    setGeminiApiKey(newKey);
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, newKey);
    } catch {}

    if (newKey) {
      try {
        const res = await fetch('/api/config/gemini-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: newKey }),
        });
        if (res.ok) setHasServerKey(true);
      } catch {}
    }
  };

  useEffect(() => {
    if (reportDataPerseus && !runningPerseus) {
      setIsReportOpen(true);
    }
  }, [reportDataPerseus, runningPerseus]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (runningPerseus && startTimePerseus) {
      interval = setInterval(() => {
        setDurationSecsPerseus(Math.round((Date.now() - startTimePerseus) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runningPerseus, startTimePerseus]);

  const stopAgent = () => {
    abortRefPerseus.current?.abort();
    sentimentAbortRef.current?.abort();
    setRunningPerseus(false);
    setSentimentLoading(false);
  };

  const resetToHome = () => {
    stopAgent();
    setIsReportOpen(false);
    setReportDataPerseus(null);
    setEventsPerseus([]);
    setSentimentData(null);
    setErrorPerseus(null);
    setSentimentError(null);
    setInstruction('');
  };

  const fetchSentiment = async (targetTicker: string, timeframe: string) => {
    const cleanTicker = targetTicker.trim();
    if (!cleanTicker) return;

    sentimentAbortRef.current?.abort();
    const controller = new AbortController();
    sentimentAbortRef.current = controller;
    setSentimentLoading(true);
    setSentimentError(null);

    const providerConfig = {
      provider: 'gemini-agent' as const,
      model: 'gemini-3.8-flash',
      apiKey: geminiApiKey.trim() || undefined,
    };

    try {
      const response = await fetch('/api/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: cleanTicker,
          timeframe,
          providerConfig,
        }),
        signal: controller.signal,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Sentiment error (${response.status})`);
      if (!controller.signal.aborted) setSentimentData(json);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setSentimentError(error.message || 'Failed to analyze recent sentiment');
      }
    } finally {
      if (sentimentAbortRef.current === controller) {
        setSentimentLoading(false);
        sentimentAbortRef.current = null;
      }
    }
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    setSentimentTimeframe(newTimeframe);
    if (hasStarted && ticker.trim()) {
      fetchSentiment(ticker, newTimeframe);
    }
  };

  const pushEventPerseus = (
    kind: TimelineEvent['kind'],
    label: string,
    detail?: string,
    toolName?: string,
    callId?: string
  ) => {
    const now = Date.now();
    setEventsPerseus((previous) => {
      const next = [...previous];
      if (next.length > 0) {
        const lastIndex = next.length - 1;
        if (!next[lastIndex].endTime) next[lastIndex] = { ...next[lastIndex], endTime: now };
      }
      next.push({
        id: eventIdRefPerseus.current++,
        kind,
        label,
        detail,
        toolName,
        startTime: now,
        callId,
      });
      return next;
    });
  };

  const parseFinalText = (text: string) => {
    if (!text) return null;
    try {
      let foundData = null;
      const matches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)];
      for (let index = matches.length - 1; index >= 0; index--) {
        try {
          const parsed = JSON.parse(matches[index][1]);
          if (parsed && (parsed.verdict || parsed.findings || parsed.deep_insights || parsed.market_sentiment)) {
            foundData = parsed;
            break;
          }
        } catch {}
      }

      if (!foundData) {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));
            if (parsed && (parsed.verdict || parsed.findings || parsed.deep_insights || parsed.market_sentiment)) {
              foundData = parsed;
            }
          } catch {
            const match = text.match(/\{\s*"verdict"[\s\S]*?\}\s*\}/);
            if (match) {
              try {
                const parsed = JSON.parse(match[0]);
                if (parsed?.verdict) foundData = parsed;
              } catch {}
            }
          }
        }
      }
      return foundData;
    } catch {
      return null;
    }
  };

  const startStream = async (targetTicker: string, model: string) => {
    setRunningPerseus(true);
    setErrorPerseus(null);
    setReportDataPerseus(null);
    setEventsPerseus([]);
    setTokenCountPerseus(0);
    setToolRunsPerseus(0);
    setDurationSecsPerseus(0);
    setStartTimePerseus(Date.now());
    eventIdRefPerseus.current = 0;

    const controller = new AbortController();
    abortRefPerseus.current = controller;
    const startTimestamp = Date.now();
    let currentToolRuns = 0;

    const providerConfig = {
      provider: 'gemini-agent' as const,
      model: 'gemini-3.8-flash',
      apiKey: geminiApiKey.trim() || undefined,
    };

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: targetTicker.trim(),
          instruction: instruction.trim() || undefined,
          origin: window.location.origin,
          model,
          timeframe: sentimentTimeframe,
          providerConfig,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error(`Server responded ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        if (controller.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataString = line.slice(6);
          if (dataString === '[DONE]') continue;
          try {
            const event = JSON.parse(dataString);
            if (event.type === 'text' && event.text) {
              accumulatedText += event.text;
            } else if (event.type === 'tool_call') {
              currentToolRuns += 1;
              setToolRunsPerseus(currentToolRuns);
              let label = 'Searching for documents…';
              if (event.name === 'google_search') {
                label = `Searching web: ${event.arguments?.query || ''}`;
              } else if (event.name === 'sec_edgar_search') {
                label = `Reading SEC filings for ${targetTicker}`;
              } else if (event.name === 'market_chart_fetch') {
                label = 'Fetching price history and quarterly performance';
              } else if (event.name === 'news_sentiment_rss') {
                label = `Scanning financial press from the last ${sentimentTimeframe}`;
              } else if (event.name) {
                label = `Running ${event.name}`;
              }
              pushEventPerseus('tool_call', label, JSON.stringify(event.arguments, null, 2), event.name, event.callId);
            } else if (event.type === 'tool_result') {
              pushEventPerseus('tool_result', 'Source data verified', event.result, undefined, event.callId);
            } else if (event.type === 'thinking') {
              pushEventPerseus('thinking', event.text || 'Synthesizing findings…');
            } else if (event.type === 'error') {
              setErrorPerseus(event.message || 'Execution error');
              pushEventPerseus('error', 'Execution error', event.message);
            } else if (event.type === 'complete' && event.interaction) {
              const interaction = event.interaction;
              const usage = interaction.usage || interaction.usage_metadata || interaction.metadata?.usage;
              if (usage) {
                const tokens = usage.total_token_count || usage.totalTokenCount || usage.total_tokens || 0;
                if (tokens > 0) setTokenCountPerseus(tokens);
              }
            } else if (event.type === 'final_stats') {
              if (event.tokens > 0) setTokenCountPerseus(event.tokens);
              if (event.duration > 0) setDurationSecsPerseus(Math.round(event.duration));
              if (ENABLE_JSON_DOWNLOAD && event.jsonlLogUrl) {
                fetch(event.jsonlLogUrl)
                  .then((result) => result.blob())
                  .then((blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = event.jsonlLogUrl.split('/').pop() || 'run_log.jsonl';
                    document.body.appendChild(anchor);
                    anchor.click();
                    document.body.removeChild(anchor);
                    window.URL.revokeObjectURL(url);
                  })
                  .catch((error) => console.error('Failed to download log:', error));
              }
            }
          } catch {}
        }

        if (accumulatedText) {
          const foundData = parseFinalText(accumulatedText);
          if (foundData) setReportDataPerseus(foundData);
        }
      }

      if (buffer) {
        try {
          for (const line of buffer.split('\n\n')) {
            if (!line.startsWith('data: ')) continue;
            const dataString = line.slice(6);
            if (dataString === '[DONE]') continue;
            const event = JSON.parse(dataString);
            if (event.type === 'text' && event.text) accumulatedText += event.text;
          }
        } catch {}
      }

      if (accumulatedText) {
        const finalData = parseFinalText(accumulatedText);
        if (finalData) setReportDataPerseus(finalData);
      }
      setDurationSecsPerseus(Math.round((Date.now() - startTimestamp) / 1000));
    } catch (error: any) {
      if (error.name !== 'AbortError') setErrorPerseus(error.message || 'Unknown error');
      setDurationSecsPerseus(Math.round((Date.now() - startTimestamp) / 1000));
    } finally {
      setRunningPerseus(false);
    }
  };

  const runAnalysis = (overrideTicker?: string) => {
    const activeTicker = (overrideTicker ?? ticker).trim().toUpperCase();
    if (!activeTicker || runningPerseus) return;

    if (!isConfigured) {
      setIsKeyModalOpen(true);
      return;
    }

    if (overrideTicker) setTicker(activeTicker);
    setIsReportOpen(false);
    setSentimentData(null);
    setSentimentError(null);
    fetchSentiment(activeTicker, sentimentTimeframe);
    startStream(activeTicker, 'perseus');
  };

  return (
    <div className="min-h-screen bg-[#f5f3ee] font-sans text-[#20222c]">
      <GeminiApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        apiKey={geminiApiKey}
        onSave={handleSaveApiKey}
        hasServerKey={hasServerKey}
      />

      <header className="sticky top-0 z-40 border-b border-[#dfdcd6]/90 bg-[#f5f3ee]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={resetToHome}
            className="group flex items-center gap-2.5 rounded-lg text-left"
            title="Back to Tickr home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#252c4b] text-[#dfe5ff] transition-transform group-hover:-rotate-3">
              <Activity className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="text-[23px] font-semibold tracking-[-0.055em] text-[#292d3a]">tickr</span>
            <span className="ml-1 hidden border-l border-[#d8d4ce] pl-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#69636d] sm:inline">
              Research
            </span>
          </button>

          <div className="flex items-center gap-2.5">
            {isConfigured ? (
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dbe0f2] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#3f4b82] shadow-xs transition-colors hover:bg-white hover:border-[#aab6ea]"
                title="Gemini 3.8 Flash (Click to update API key)"
                aria-label="Gemini 3.8 Flash active. Click to update API key."
              >
                <Sparkles className="h-3.5 w-3.5 text-[#5669c4]" aria-hidden="true" />
                <span className="font-medium tracking-tight">Gemini 3.8 Flash</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#5669c4]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#ecd4cf] bg-[#f9eeeb] px-3 py-1.5 text-xs font-semibold text-[#914a42] shadow-xs transition-colors hover:bg-[#f3dcda]"
                title="Connect Gemini API key"
                aria-label="Connect Gemini API key"
              >
                <Key className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Enter Gemini Key</span>
              </button>
            )}

            {hasStarted && (
              <button
                type="button"
                onClick={resetToHome}
                aria-label="New research"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#252c4b] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#1c2342]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">New research</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {!hasStarted ? (
          <LandingView
            ticker={ticker}
            onTickerChange={setTicker}
            onAnalyze={runAnalysis}
            onStop={stopAgent}
            running={runningPerseus}
            timeframe={sentimentTimeframe}
            onTimeframeChange={handleTimeframeChange}
          />
        ) : (
          <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {!(isReportOpen && activeReport) && (
              <ResearchSearch
                value={ticker}
                onChange={setTicker}
                onSubmit={() => runAnalysis()}
                onStop={stopAgent}
                running={runningPerseus}
                timeframe={sentimentTimeframe}
                onTimeframeChange={handleTimeframeChange}
                variant="compact"
              />
            )}

            {errorPerseus && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-[#ecd4cf] bg-[#f9eeeb] px-4 py-3 text-sm leading-6 text-[#914a42]"
              >
                {errorPerseus}
              </div>
            )}

            {!(isReportOpen && activeReport) && (
              <div className="mb-5 mt-6 flex flex-col justify-between gap-4 sm:mt-7 sm:flex-row sm:items-end">
                <div>
                  <span className="eyebrow-label">Research workspace</span>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="font-serif text-3xl tracking-[-0.02em] text-[#292d3a] sm:text-4xl">
                      {ticker.toUpperCase()}
                    </h1>
                    <p className="text-sm text-[#66616b]">
                      {runningPerseus
                        ? `Building your brief · ${durationSecsPerseus}s`
                        : activeReport
                        ? 'Your connected research brief'
                        : 'Gathering the latest sources'}
                    </p>
                  </div>
                </div>
                <div
                  className="grid w-full grid-cols-2 rounded-xl bg-[#eaebf3] p-1 sm:w-auto sm:flex"
                  aria-label="Workspace view"
                >
                  <button
                    type="button"
                    onClick={() => setIsReportOpen(false)}
                    aria-pressed={!isReportOpen}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all ${
                      !isReportOpen
                        ? 'bg-white text-[#4053a5] shadow-sm'
                        : 'text-[#66616b] hover:text-[#343746]'
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    Activity
                  </button>
                  <button
                    type="button"
                    onClick={() => activeReport && setIsReportOpen(true)}
                    disabled={!activeReport}
                    aria-pressed={isReportOpen}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all ${
                      isReportOpen
                        ? 'bg-white text-[#4053a5] shadow-sm'
                        : activeReport
                        ? 'text-[#666571] hover:text-[#4053a5]'
                        : 'cursor-not-allowed text-[#a39ea6]'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Brief
                  </button>
                </div>
              </div>
            )}

            {isReportOpen && activeReport ? (
              <ReportTemplate
                data={activeReport}
                ticker={ticker}
                onClose={() => setIsReportOpen(false)}
                durationSecs={durationSecsPerseus}
                toolRuns={toolRunsPerseus}
                tokenCount={tokenCountPerseus}
                documentCount={activeReport.findings?.length || 0}
                liveSentiment={sentimentData}
                sentimentLoading={sentimentLoading}
                sentimentTimeframe={sentimentTimeframe}
                onTimeframeChange={handleTimeframeChange}
                onRefreshSentiment={() => fetchSentiment(ticker, sentimentTimeframe)}
              />
            ) : (
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.04fr_0.96fr]">
                <AgentTimeline
                  events={eventsPerseus}
                  running={runningPerseus}
                  hasReport={Boolean(activeReport)}
                  onViewReport={() => setIsReportOpen(true)}
                  metrics={
                    activeReport
                      ? {
                          durationSecs: durationSecsPerseus,
                          tokenCount: tokenCountPerseus,
                          documentCount: activeReport.findings?.length || 0,
                        }
                      : undefined
                  }
                />
                <SentimentPanel
                  ticker={ticker}
                  sentiment={sentimentData || activeReport?.market_sentiment || null}
                  loading={sentimentLoading}
                  error={sentimentError}
                  timeframe={sentimentTimeframe}
                  onTimeframeChange={handleTimeframeChange}
                  onRefresh={() => fetchSentiment(ticker, sentimentTimeframe)}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {!hasStarted && (
        <footer className="border-t border-[#dfdcd6] px-5 py-5 sm:px-8">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-1 text-[11px] text-[#66616b] sm:flex-row sm:items-center sm:justify-between">
            <span>Tickr · Research with context</span>
            <span>Public market data · Not investment advice</span>
          </div>
        </footer>
      )}
    </div>
  );
}
