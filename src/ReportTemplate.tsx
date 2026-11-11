import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Layers,
  Newspaper,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ReportData, MarketSentiment } from './App';
import { sentimentBadgeClass, sentimentScoreColor } from './components/SentimentPanel';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  data: ReportData;
  ticker: string;
  onClose: () => void;
  durationSecs?: number;
  toolRuns?: number;
  tokenCount?: number;
  documentCount?: number;
  liveSentiment?: MarketSentiment | null;
  sentimentLoading?: boolean;
  sentimentTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  onRefreshSentiment?: () => void;
}

const TIMEFRAMES = [
  { label: '2W', value: '2 weeks' },
  { label: '3W', value: '3 weeks' },
  { label: '4W', value: '4 weeks' },
];

const NAV_ITEMS = [
  { href: '#overview', label: 'Overview' },
  { href: '#financials', label: 'Financials' },
  { href: '#news', label: 'News & sentiment' },
  { href: '#insights', label: 'Insights' },
  { href: '#filings', label: 'SEC filings' },
];

function TimeframeControl({
  value,
  loading,
  onChange,
  onRefresh,
}: {
  value: string;
  loading: boolean;
  onChange?: (timeframe: string) => void;
  onRefresh?: () => void;
}) {
  if (!onChange) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-[#f0eff4] p-1" aria-label="News sentiment timeframe">
        {TIMEFRAMES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            disabled={loading}
            aria-pressed={value === item.value}
            className={`min-h-10 rounded-md px-2.5 font-mono text-[10px] transition-colors ${
              value === item.value ? 'bg-white text-[#4053a5] shadow-sm' : 'text-[#66616b] hover:text-[#292d3a]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh news sentiment"
          title="Refresh news sentiment"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#dfdcd6] text-[#716e77] hover:bg-[#f1f0f6] hover:text-[#4053a5] disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#5669c4]' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function ReportSection({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="surface-card mt-5 scroll-mt-40 rounded-[22px] p-5 sm:p-7 lg:p-8" aria-labelledby={`${id}-title`}>
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#e5e1db] pb-5 sm:flex-row sm:items-start">
        <div>
          <span className="eyebrow-label">{eyebrow}</span>
          <h2 id={`${id}-title`} className="mt-1.5 font-serif text-[1.8rem] leading-tight tracking-[-0.02em] text-[#292d3a] sm:text-4xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66616b]">{description}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function ScoreCard({ label, score, note }: { label: string; score?: number; note: string }) {
  const safeScore = score ?? 0;
  return (
    <div className="rounded-2xl border border-[#e2ded8] bg-[#f8f7f3] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[#60636d]">{label}</div>
          <p className="mt-1 text-[11px] leading-4 text-[#66616b]">{note}</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`font-serif text-4xl tabular-nums ${score === undefined ? 'text-[#69636d]' : sentimentScoreColor(score)}`}>{score ?? '—'}</span>
          <span className="font-mono text-[9px] text-[#66616b]">/100</span>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e5e1db]">
        <div
          className={`h-full rounded-full ${safeScore >= 60 ? 'bg-[#5669c4]' : safeScore <= 40 && score !== undefined ? 'bg-[#b26a5f]' : 'bg-[#b49a5e]'}`}
          style={{ width: `${Math.max(0, Math.min(100, safeScore))}%` }}
        />
      </div>
    </div>
  );
}

export default function ReportTemplate({
  data,
  ticker,
  onClose,
  durationSecs = 0,
  toolRuns = 0,
  tokenCount = 0,
  documentCount = 0,
  liveSentiment,
  sentimentLoading = false,
  sentimentTimeframe = '2 weeks',
  onTimeframeChange,
  onRefreshSentiment,
}: Props) {
  const findings = data.findings || [];
  const activeSentiment = liveSentiment || data.market_sentiment;
  const convictionScore = data.verdict?.conviction_score;
  const sentimentScore = activeSentiment?.sentiment_score;
  const articles = activeSentiment?.recent_articles || [];
  const takeaways = data.verdict?.key_takeaways;
  const takeawayList = Array.isArray(takeaways) ? takeaways : takeaways ? [String(takeaways)] : [];

  const getAlignment = () => {
    if (convictionScore === undefined || sentimentScore === undefined) return null;
    const difference = convictionScore - sentimentScore;
    if (Math.abs(difference) <= 12) {
      return {
        title: 'Fundamentals and headlines are aligned',
        description: `Company conviction (${convictionScore}) and news sentiment (${sentimentScore}) are pointing in the same direction for this ${sentimentTimeframe} window.`,
        tone: 'border-[#d5dcf4] bg-[#eef0fb] text-[#4053a5]',
      };
    }
    if (difference > 12) {
      return {
        title: 'Fundamentals look stronger than the headlines',
        description: `Company conviction (${convictionScore}) is ahead of news sentiment (${sentimentScore}). Recent coverage may be more cautious than the underlying disclosures.`,
        tone: 'border-[#d9ddef] bg-[#f2f3fa] text-[#4c5683]',
      };
    }
    return {
      title: 'Headlines are running ahead of fundamentals',
      description: `News sentiment (${sentimentScore}) is above company conviction (${convictionScore}). Pay close attention to the risks and caveats in the source filings.`,
      tone: 'border-[#e8dec9] bg-[#f8f3e7] text-[#785f32]',
    };
  };

  const alignment = getAlignment();
  const stockPrices = data.financial_charts?.stock_price_4m || [];
  const quarterlyPerformance = data.financial_charts?.financial_performance_4q || [];
  const hasDistributions = quarterlyPerformance[0]?.distributions !== undefined;

  return (
    <div className="min-w-0 pb-12">
      <nav className="no-scrollbar sticky top-[72px] z-20 -mx-1 mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#dfdcd6] bg-[#f5f3ee]/95 p-1.5 backdrop-blur-xl" aria-label="Research brief sections">
        {NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href} className="min-h-10 shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-[#6d6a74] transition-colors hover:bg-white hover:text-[#4053a5]">
            {item.label}
          </a>
        ))}
      </nav>

      <section id="overview" className="surface-card scroll-mt-40 overflow-hidden rounded-[24px]" aria-labelledby="overview-title">
        <div className="p-5 sm:p-7 lg:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-[#6d6a74] transition-colors hover:bg-[#f0eff6] hover:text-[#4053a5]">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Research activity
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d5dcf4] bg-[#eef0fb] px-3 py-1 text-[11px] font-semibold text-[#4053a5]">
              <Check className="h-3 w-3" aria-hidden="true" />
              Research complete
            </span>
          </div>

          <div className="mt-6 border-b border-[#e5e1db] pb-7">
            <div className="eyebrow-label">{ticker.toUpperCase()} · Connected research brief</div>
            <h1 id="overview-title" className="mt-2 font-serif text-4xl tracking-[-0.025em] text-[#20222c] sm:text-5xl">The company and the conversation.</h1>
            <p className="text-pretty mt-5 max-w-4xl text-base leading-7 text-[#555964] sm:text-lg sm:leading-8">
              {data.verdict?.summary || 'No executive summary was returned for this report.'}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScoreCard label="Company conviction" score={convictionScore} note="Fundamentals, filings, and risk factors" />
            <ScoreCard label="News sentiment" score={sentimentScore} note={`Financial press · ${activeSentiment?.timeframe || sentimentTimeframe}`} />
          </div>

          {alignment && (
            <div className={`mt-3 flex items-start gap-3 rounded-2xl border p-4 sm:p-5 ${alignment.tone}`}>
              <Scale className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold">{alignment.title}</h2>
                <p className="mt-1 text-sm leading-6 opacity-80">{alignment.description}</p>
              </div>
            </div>
          )}

          {takeawayList.length > 0 && (
            <div className="mt-7">
              <h2 className="eyebrow-label">What matters most</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {takeawayList.map((takeaway, index) => (
                  <div key={`${takeaway}-${index}`} className="flex gap-3 rounded-xl border border-[#e6e2dc] p-4">
                    <span className="font-mono text-[10px] font-medium text-[#5669c4]">{String(index + 1).padStart(2, '0')}</span>
                    <p className="text-sm leading-6 text-[#585b66]">{takeaway}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-[#e5e1db] bg-[#f8f7f3] px-5 py-4 sm:grid-cols-4 sm:px-7 lg:px-9">
          {[
            ['Filings reviewed', String(documentCount)],
            ['News sources', String(articles.length)],
            ['Research time', `${durationSecs}s`],
            ['Tool runs', String(toolRuns)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] uppercase tracking-wider text-[#66616b]">{label}</dt>
              <dd className="mt-1 font-mono text-sm font-medium text-[#454b5c]">{value}</dd>
            </div>
          ))}
          {tokenCount > 0 && <span className="sr-only">{tokenCount} tokens used</span>}
        </dl>
      </section>

      {data.financial_charts && (
        <ReportSection
          id="financials"
          eyebrow="Market & company data"
          title="The numbers in context"
          description="A four-month price view alongside four completed quarters of company performance."
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-[#e5e1db] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#292d3a]">Closing price</h3>
                  <p className="mt-1 text-xs leading-5 text-[#66616b]">Last trading day of each month · USD</p>
                </div>
                <BarChart3 className="h-4 w-4 text-[#5669c4]" aria-hidden="true" />
              </div>
              {stockPrices.length > 0 ? (
                <div className="mt-6 h-56 w-full min-w-0 sm:h-64" aria-label="Four month closing price chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...stockPrices]} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e4de" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#66616b', fontFamily: 'Instrument Sans' }} dy={8} minTickGap={18} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={48} tick={{ fontSize: 10, fill: '#66616b', fontFamily: 'JetBrains Mono' }} tickFormatter={(value) => `$${value}`} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #dfdcd6', color: '#292d3a', fontFamily: 'Instrument Sans', fontSize: '12px', boxShadow: '0 10px 30px rgba(32,34,44,.12)' }}
                        formatter={(value: number) => [`$${value}`, 'Price']}
                      />
                      <Line type="monotone" dataKey="price" stroke="#5669c4" strokeWidth={2.5} dot={{ r: 3, fill: '#5669c4', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#252c4b' }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-8 rounded-xl bg-[#f7f5f1] p-5 text-sm text-[#66616b]">No price history was returned.</p>}
            </div>

            <div className="min-w-0 rounded-2xl border border-[#e5e1db] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#292d3a]">Quarterly performance</h3>
                  <p className="mt-1 text-xs leading-5 text-[#66616b]">{hasDistributions ? 'Cash distributions per share · USD' : 'Revenue and net income · USD billions'}</p>
                </div>
                <Layers className="h-4 w-4 text-[#5669c4]" aria-hidden="true" />
              </div>
              {quarterlyPerformance.length > 0 ? (
                <div className="mt-6 h-56 w-full min-w-0 sm:h-64" aria-label="Four quarter financial performance chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...quarterlyPerformance]} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e4de" />
                      <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#66616b', fontFamily: 'Instrument Sans' }} dy={8} minTickGap={14} />
                      <YAxis axisLine={false} tickLine={false} width={48} tick={{ fontSize: 10, fill: '#66616b', fontFamily: 'JetBrains Mono' }} tickFormatter={(value) => hasDistributions ? `$${value}` : `$${value}B`} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #dfdcd6', color: '#292d3a', fontFamily: 'Instrument Sans', fontSize: '12px', boxShadow: '0 10px 30px rgba(32,34,44,.12)' }}
                        formatter={(value: number, name: string) => name === 'Distributions' ? [`$${value}`, name] : [`$${value}B`, name]}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '12px', fontFamily: 'Instrument Sans', color: '#696771' }} />
                      {hasDistributions ? (
                        <Bar dataKey="distributions" name="Distributions" fill="#5669c4" radius={[5, 5, 0, 0]} barSize={36} isAnimationActive={false} />
                      ) : (
                        <>
                          <Bar dataKey="revenue" name="Revenue" fill="#5669c4" radius={[5, 5, 0, 0]} barSize={24} isAnimationActive={false} />
                          <Bar dataKey="net_income" name="Net income" fill="#aab4df" radius={[5, 5, 0, 0]} barSize={24} isAnimationActive={false} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="mt-8 rounded-xl bg-[#f7f5f1] p-5 text-sm text-[#66616b]">No quarterly performance data was returned.</p>}
            </div>
          </div>
        </ReportSection>
      )}

      {(activeSentiment || sentimentLoading) && (
        <ReportSection
          id="news"
          eyebrow="News sentiment"
          title="What the market is talking about"
          description="Recent financial journalism and analyst commentary, scored and connected back to the source articles."
          action={<TimeframeControl value={sentimentTimeframe} loading={sentimentLoading} onChange={onTimeframeChange} onRefresh={onRefreshSentiment} />}
        >
          {sentimentLoading && !activeSentiment ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <RefreshCw className="h-5 w-5 animate-spin text-[#5669c4]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-[#454b5c]">Reading the last {sentimentTimeframe} of coverage…</p>
            </div>
          ) : activeSentiment ? (
            <div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-10">
                <div className="rounded-2xl bg-[#f5f6fc] p-5">
                  <span className="eyebrow-label">Overall market tone</span>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className={`font-serif text-6xl tabular-nums ${sentimentScoreColor(activeSentiment.sentiment_score ?? 50)}`}>{activeSentiment.sentiment_score ?? 50}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${sentimentBadgeClass(activeSentiment.overall_sentiment)}`}>
                      {(activeSentiment.sentiment_score ?? 50) >= 60 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {activeSentiment.overall_sentiment || 'Neutral'}
                    </span>
                  </div>
                  <div className="sentiment-track relative mt-6 h-1.5 rounded-full">
                    <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#252c4b]" style={{ left: `${Math.max(1, Math.min(99, activeSentiment.sentiment_score ?? 50))}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[9px] uppercase text-[#66616b]"><span>Bearish</span><span>Bullish</span></div>
                  <p className="mt-5 text-xs leading-5 text-[#66616b]">{articles.length} articles · {activeSentiment.timeframe || sentimentTimeframe}</p>
                </div>
                <div className="flex flex-col justify-center">
                  <span className="eyebrow-label">The narrative</span>
                  <p className="text-pretty mt-3 text-base leading-7 text-[#555964]">{activeSentiment.summary}</p>
                </div>
              </div>

              {activeSentiment.key_drivers && activeSentiment.key_drivers.length > 0 && (
                <div className="mt-8 border-t border-[#e5e1db] pt-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#343746]"><Sparkles className="h-4 w-4 text-[#5669c4]" />Key sentiment drivers</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {activeSentiment.key_drivers.map((driver, index) => (
                      <article key={`${driver.factor}-${index}`} className="rounded-xl border border-[#e5e1db] p-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${sentimentBadgeClass(driver.sentiment)}`}>{driver.sentiment}</span>
                        <h4 className="mt-3 text-sm font-semibold text-[#343746]">{driver.factor}</h4>
                        <p className="mt-2 text-xs leading-5 text-[#66616b]">{driver.impact}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {articles.length > 0 && (
                <div className="mt-8 border-t border-[#e5e1db] pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#343746]"><Newspaper className="h-4 w-4 text-[#5669c4]" />Source articles</h3>
                    <span className="font-mono text-[10px] text-[#66616b]">{articles.length} analyzed</span>
                  </div>
                  <div className="mt-3 divide-y divide-[#e6e2dc]">
                    {articles.map((article, index) => {
                      const safeUrl = article.url && /^https?:\/\//i.test(article.url.trim()) ? article.url.trim() : '';
                      return (
                        <article key={`${article.title}-${index}`} className="py-5 first:pt-2">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#66616b]">
                                <span className="font-semibold text-[#555964]">{article.source}</span>
                                {article.date && <><span>·</span><span>{article.date}</span></>}
                              </div>
                              {safeUrl ? (
                                <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="group mt-2 inline-flex items-start gap-2 text-base font-semibold leading-6 text-[#292d3a] hover:text-[#4053a5]">
                                  <span>{article.title}</span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#66616b] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                </a>
                              ) : <h4 className="mt-2 text-base font-semibold leading-6 text-[#292d3a]">{article.title}</h4>}
                            </div>
                            <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold ${sentimentBadgeClass(article.sentiment)}`}>
                              {article.sentiment}{article.sentiment_score !== undefined ? ` · ${article.sentiment_score}` : ''}
                            </span>
                          </div>
                          <p className="mt-2 max-w-4xl text-sm leading-6 text-[#66616b]">{article.summary}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeSentiment.grounded_sources && activeSentiment.grounded_sources.length > 0 && (
                <div className="mt-6 rounded-xl bg-[#f7f5f1] p-4">
                  <h3 className="eyebrow-label">Additional grounding</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeSentiment.grounded_sources.map((source, index) => (
                      <a key={`${source.uri}-${index}`} href={source.uri} target="_blank" rel="noopener noreferrer" title={source.title} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#dfdcd6] bg-white px-2.5 py-1.5 text-[11px] text-[#666571] hover:text-[#4053a5]">
                        <span className="max-w-52 truncate">{source.title}</span><ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </ReportSection>
      )}

      {data.deep_insights && data.deep_insights.length > 0 && (
        <ReportSection
          id="insights"
          eyebrow="Deeper analysis"
          title="Signals worth your attention"
          description="Structural drivers, competitive context, and risks ordered by potential material impact."
        >
          <div className="divide-y divide-[#e5e1db]">
            {data.deep_insights.map((insight, index) => (
              <article key={`${insight.title}-${index}`} className="grid grid-cols-1 gap-3 py-5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
                <div>
                  <span className="eyebrow-label text-[#5669c4]">{insight.category}</span>
                  <h3 className="mt-2 font-serif text-2xl tracking-tight text-[#292d3a]">{insight.title}</h3>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-[#716e77]">{insight.description}</p>
                </div>
                <div className="flex items-center gap-3 sm:w-28 sm:flex-col sm:items-end sm:justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-[#66616b]">Impact</span>
                  <span className={`font-mono text-sm font-semibold ${insight.impact_score >= 8 ? 'text-[#a24e44]' : insight.impact_score >= 5 ? 'text-[#8b6a2e]' : 'text-[#5669c4]'}`}>{insight.impact_score}/10</span>
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-[#e5e1db] sm:w-full"><div className={`h-full rounded-full ${insight.impact_score >= 8 ? 'bg-[#b26a5f]' : insight.impact_score >= 5 ? 'bg-[#b49a5e]' : 'bg-[#5669c4]'}`} style={{ width: `${Math.min(100, insight.impact_score * 10)}%` }} /></div>
                </div>
              </article>
            ))}
          </div>
        </ReportSection>
      )}

      <ReportSection
        id="filings"
        eyebrow="Primary sources"
        title={`SEC filings reviewed${findings.length ? ` (${findings.length})` : ''}`}
        description="Open a filing to read the extracted insights, then follow the source link to verify it directly."
      >
        {findings.length === 0 ? (
          <div className="rounded-xl bg-[#f7f5f1] p-6 text-center text-sm text-[#66616b]">No filing findings were returned in this report.</div>
        ) : (
          <div className="space-y-3">
            {findings.map((finding, index) => {
              const rawUrl = String(finding.sourceUrl || finding.source_url || '').trim();
              const safeUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
              const rawInsights = finding.keyInsights || finding.key_insights;
              const insightList = Array.isArray(rawInsights) ? rawInsights : rawInsights ? [String(rawInsights)] : [];
              return (
                <details key={`${finding.documentType || finding.document_type}-${index}`} className="report-details rounded-xl border border-[#e2ded8] bg-white" open={index === 0}>
                  <summary className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl p-4 transition-colors hover:bg-[#f8f7f3]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef0fb] text-[#5669c4]"><FileText className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#292d3a]">{finding.documentType || finding.document_type || 'Regulatory filing'}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#66616b]">
                        <span>Document {String(index + 1).padStart(2, '0')}</span>
                        {finding.date && <><span>·</span><span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{finding.date}</span></>}
                        <span>·</span><span>{insightList.length} insights</span>
                      </span>
                    </span>
                    <ChevronDown className="details-chevron h-4 w-4 shrink-0 text-[#79747e] transition-transform" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-[#e6e2dc] px-4 py-4 sm:px-5">
                    {safeUrl && (
                      <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#d5dcf4] bg-[#eef0fb] px-3 py-1.5 text-xs font-semibold text-[#4053a5] hover:bg-[#dfe5ff]">
                        Open source filing <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <ul className="space-y-3">
                      {insightList.map((insight, insightIndex) => (
                        <li key={insightIndex} className="flex gap-3 text-sm leading-6 text-[#61636d]"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#5669c4]" /><span>{insight}</span></li>
                      ))}
                    </ul>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </ReportSection>

      <footer className="px-2 pt-6 text-center text-xs leading-5 text-[#66616b]">
        Research generated from public sources. Verify material information before making decisions. Not investment advice.
      </footer>
    </div>
  );
}
