import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Minus,
  Newspaper,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { MarketSentiment } from '../App';

interface SentimentPanelProps {
  ticker: string;
  sentiment: MarketSentiment | null;
  loading: boolean;
  error: string | null;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  onRefresh: () => void;
}

const TIMEFRAMES = [
  { label: '2W', value: '2 weeks' },
  { label: '3W', value: '3 weeks' },
  { label: '4W', value: '4 weeks' },
];

export function sentimentBadgeClass(sentiment?: string) {
  const normalized = (sentiment || '').toLowerCase();
  if (normalized.includes('bull') || normalized.includes('pos')) {
    return 'border-[#d5dcf4] bg-[#eef0fb] text-[#4053a5]';
  }
  if (normalized.includes('bear') || normalized.includes('neg')) {
    return 'border-[#ecd4cf] bg-[#f9eeeb] text-[#9a4c43]';
  }
  return 'border-[#e7dec7] bg-[#f8f4e9] text-[#88682f]';
}

export function sentimentScoreColor(score: number) {
  if (score >= 60) return 'text-[#4053a5]';
  if (score <= 40) return 'text-[#a24e44]';
  return 'text-[#8b6a2e]';
}

export function SentimentPanel({
  ticker,
  sentiment,
  loading,
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
}: SentimentPanelProps) {
  const score = sentiment?.sentiment_score ?? 50;
  const label =
    sentiment?.overall_sentiment ||
    (score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral');

  return (
    <section className="surface-card min-w-0 overflow-hidden rounded-[22px]" aria-labelledby="live-sentiment-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e2dc] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef0fb] text-[#5669c4]">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="live-sentiment-title" className="text-sm font-semibold text-[#292d3a]">News sentiment</h2>
            <p className="mt-0.5 text-xs text-[#66616b]">Recent financial press · {timeframe}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-[#f1f0f4] p-1" aria-label="Sentiment timeframe">
            {TIMEFRAMES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onTimeframeChange(item.value)}
                disabled={loading}
                aria-pressed={timeframe === item.value}
                className={`min-h-10 rounded-md px-2 font-mono text-[10px] transition-colors ${
                  timeframe === item.value
                    ? 'bg-white text-[#4053a5] shadow-sm'
                    : 'text-[#66616b] hover:text-[#292d3a]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || !ticker.trim()}
            title="Refresh news sentiment"
            aria-label="Refresh news sentiment"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#dfdcd6] text-[#716e77] transition-colors hover:bg-[#f1f0f6] hover:text-[#4053a5] disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#5669c4]' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading && !sentiment && (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef0fb]">
              <RefreshCw className="h-4 w-4 animate-spin text-[#5669c4]" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[#292d3a]">Reading the latest coverage</h3>
            <p className="mt-1.5 max-w-xs text-xs leading-5 text-[#66616b]">
              Evaluating articles about {ticker.toUpperCase()} from the last {timeframe}.
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-[#ecd4cf] bg-[#f9eeeb] px-4 py-3 text-sm leading-6 text-[#914a42]">
            {error}
          </div>
        )}

        {!loading && !sentiment && !error && (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
            <Newspaper className="h-6 w-6 text-[#66616b]" aria-hidden="true" />
            <p className="mt-3 text-sm text-[#716e77]">News sentiment will appear here.</p>
          </div>
        )}

        {sentiment && (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="eyebrow-label">Overall market tone</span>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className={`font-serif text-5xl tabular-nums ${sentimentScoreColor(score)}`}>{score}</span>
                    <span className="font-mono text-[10px] text-[#66616b]">/100</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sentimentBadgeClass(label)}`}>
                      {score >= 60 ? <TrendingUp className="h-3 w-3" /> : score <= 40 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#66616b]">Articles analyzed</div>
                  <div className="mt-1 font-mono text-xl font-medium text-[#292d3a]">{sentiment.recent_articles?.length || 0}</div>
                </div>
              </div>
              <div className="sentiment-track relative mt-5 h-1.5 rounded-full" aria-label={`Sentiment score ${score} out of 100`}>
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#252c4b] shadow-sm transition-[left] duration-500"
                  style={{ left: `${Math.max(1, Math.min(99, score))}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-wide text-[#66616b]">
                <span>Bearish</span><span>Neutral</span><span>Bullish</span>
              </div>
              <p className="mt-5 text-sm leading-6 text-[#585b66]">{sentiment.summary}</p>
            </div>

            {sentiment.key_drivers && sentiment.key_drivers.length > 0 && (
              <div className="border-t border-[#e6e2dc] pt-5">
                <h3 className="eyebrow-label">What is moving the conversation</h3>
                <div className="mt-3 space-y-2">
                  {sentiment.key_drivers.map((driver, index) => {
                    const normalized = driver.sentiment.toLowerCase();
                    const positive = normalized.includes('pos') || normalized.includes('bull');
                    const negative = normalized.includes('neg') || normalized.includes('bear');
                    return (
                      <div key={`${driver.factor}-${index}`} className="surface-subcard rounded-xl p-3.5">
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${sentimentBadgeClass(driver.sentiment)}`}>
                            {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : negative ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-[#292d3a]">{driver.factor}</h4>
                            <p className="mt-1 text-xs leading-5 text-[#66616b]">{driver.impact}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sentiment.recent_articles && sentiment.recent_articles.length > 0 && (
              <div className="border-t border-[#e6e2dc] pt-5">
                <h3 className="eyebrow-label">Latest coverage</h3>
                <div className="mt-1 divide-y divide-[#e6e2dc]">
                  {sentiment.recent_articles.map((article, index) => {
                    const safeUrl = article.url && /^https?:\/\//i.test(article.url.trim()) ? article.url.trim() : '';
                    return (
                      <article key={`${article.title}-${index}`} className="py-4 first:pt-3 last:pb-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#66616b]">
                          <span className="font-semibold text-[#575b66]">{article.source}</span>
                          {article.date && <><span aria-hidden="true">·</span><span>{article.date}</span></>}
                          <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium ${sentimentBadgeClass(article.sentiment)}`}>
                            {article.sentiment}{article.sentiment_score !== undefined ? ` · ${article.sentiment_score}` : ''}
                          </span>
                        </div>
                        {safeUrl ? (
                          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-start gap-1.5 text-sm font-semibold leading-5 text-[#292d3a] transition-colors hover:text-[#4053a5]">
                            <span>{article.title}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#66616b]" aria-hidden="true" />
                          </a>
                        ) : (
                          <h4 className="mt-2 text-sm font-semibold leading-5 text-[#292d3a]">{article.title}</h4>
                        )}
                        <p className="mt-1.5 text-xs leading-5 text-[#66616b]">{article.summary}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {sentiment.grounded_sources && sentiment.grounded_sources.length > 0 && (
              <div className="border-t border-[#e6e2dc] pt-4">
                <h3 className="eyebrow-label">Grounding sources</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sentiment.grounded_sources.map((source, index) => (
                    <a
                      key={`${source.uri}-${index}`}
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={source.title}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#e2ded8] px-2.5 py-1.5 text-[11px] text-[#706c75] hover:bg-[#f0f1f8] hover:text-[#4053a5]"
                    >
                      <span className="max-w-44 truncate">{source.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
