import {
  ArrowUpRight,
  BarChart3,
  Check,
  FileSearch,
  Newspaper,
  Scale,
} from 'lucide-react';
import { ResearchSearch } from './components/ResearchSearch';

interface LandingViewProps {
  ticker: string;
  onTickerChange: (ticker: string) => void;
  onAnalyze: (ticker?: string) => void;
  onStop: () => void;
  running: boolean;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

const FEATURED_TICKERS = [
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'QQQ', name: 'Nasdaq-100 ETF' },
];

const RESEARCH_LENSES = [
  {
    icon: FileSearch,
    number: '01',
    title: 'Company fundamentals',
    description: 'SEC filings, quarterly performance, and the details behind the numbers.',
  },
  {
    icon: Newspaper,
    number: '02',
    title: 'News sentiment',
    description: 'Recent coverage distilled into a score, narrative drivers, and cited articles.',
  },
  {
    icon: Scale,
    number: '03',
    title: 'Connected signals',
    description: 'See where fundamentals and headlines align—or tell different stories.',
  },
];

export function LandingView({
  ticker,
  onTickerChange,
  onAnalyze,
  onStop,
  running,
  timeframe,
  onTimeframeChange,
}: LandingViewProps) {
  return (
    <div className="mx-auto w-full max-w-[1380px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:px-10 lg:pt-20">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <section className="min-w-0 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dce0f2] bg-[#eef0fb] px-3 py-1.5 text-xs font-medium text-[#44538f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5669c4]" />
            Market research, without the noise
          </div>

          <h1 className="text-balance font-serif text-[3.4rem] leading-[0.98] tracking-[-0.035em] text-[#20222c] sm:text-[4.5rem] lg:text-[5.25rem]">
            Know the company.
            <span className="mt-1 block italic text-[#5669c4]">Read the market.</span>
          </h1>

          <p className="text-pretty mt-6 max-w-xl text-base leading-7 text-[#666873] sm:text-lg sm:leading-8">
            Company fundamentals and news sentiment, thoughtfully combined into one clear research brief.
          </p>

          <div className="mt-8">
            <ResearchSearch
              value={ticker}
              onChange={onTickerChange}
              onSubmit={() => onAnalyze()}
              onStop={onStop}
              running={running}
              timeframe={timeframe}
              onTimeframeChange={onTimeframeChange}
            />
            <p className="mt-3 flex items-center gap-1.5 pl-1 text-xs text-[#66616b]">
              <Check className="h-3.5 w-3.5 text-[#5669c4]" aria-hidden="true" />
              Grounded in public filings and recent financial news
            </p>
          </div>

          <div className="mt-8">
            <span className="eyebrow-label">Or explore a company</span>
            <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {FEATURED_TICKERS.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => onAnalyze(item.symbol)}
                  className="group flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#ddd9d3] bg-white/60 px-3.5 py-2 text-left transition-all hover:border-[#aab4df] hover:bg-white"
                >
                  <span className="font-mono text-xs font-semibold text-[#292d3a]">{item.symbol}</span>
                  <span className="text-xs text-[#69636d]">{item.name}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#69636d] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#5669c4]" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="relative mx-auto min-w-0 w-full max-w-[560px] lg:mx-0" aria-label="Example research brief layout">
          <div className="absolute -inset-5 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_70%_20%,rgba(106,123,211,0.26),transparent_58%)]" />
          <div className="overflow-hidden rounded-[28px] bg-[#252c4b] p-5 text-white shadow-[0_30px_80px_-35px_rgba(28,33,62,0.52)] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <BarChart3 className="h-4 w-4 text-[#dfe5ff]" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold">The Tickr brief</div>
                  <div className="text-[11px] text-white/55">Example layout · not live data</div>
                </div>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60">
                One view
              </span>
            </div>

            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-[#c7d0ef]">NVDA · NVIDIA</div>
                <div className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">The signal, connected.</div>
              </div>
              <span className="hidden rounded-full bg-[#dfe5ff] px-3 py-1 text-xs font-semibold text-[#36457f] sm:inline-flex">
                Constructive
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
                <div className="text-xs text-white/60">Company fundamentals</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-serif text-4xl sm:text-5xl">78</span>
                  <span className="font-mono text-[10px] text-white/65">/100</span>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[78%] rounded-full bg-[#93a1e8]" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
                <div className="text-xs text-white/60">News sentiment</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-serif text-4xl sm:text-5xl">64</span>
                  <span className="font-mono text-[10px] text-white/65">/100</span>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[64%] rounded-full bg-[#93a1e8]" />
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-[#dfe5ff] p-4 text-[#292d3a] sm:p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
                <Scale className="h-4 w-4" aria-hidden="true" />
                Signals aligned
              </div>
              <p className="mt-2 text-sm leading-6 text-[#566078]">
                Fundamentals and media consensus tell a similar story. The useful context stays together.
              </p>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="mb-3 flex items-center justify-between text-[11px] text-white/50">
                <span>4-month price trajectory</span>
                <span className="font-mono">USD</span>
              </div>
              <svg viewBox="0 0 480 90" className="h-20 w-full" role="img" aria-label="Illustrative upward price line">
                <defs>
                  <linearGradient id="preview-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#93a1e8" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#93a1e8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 75 C40 70 50 54 88 60 S142 68 176 46 S225 50 260 33 S320 48 350 27 S410 28 480 8 L480 90 L0 90 Z" fill="url(#preview-fill)" />
                <path d="M0 75 C40 70 50 54 88 60 S142 68 176 46 S225 50 260 33 S320 48 350 27 S410 28 480 8" fill="none" stroke="#93a1e8" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="480" cy="8" r="4" fill="#dfe5ff" />
              </svg>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-16 border-t border-[#ddd9d3] pt-8 sm:mt-20 sm:pt-10" aria-labelledby="research-lenses-title">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow-label">A complete picture</span>
            <h2 id="research-lenses-title" className="mt-1 font-serif text-2xl tracking-tight text-[#292d3a] sm:text-3xl">
              Three lenses. One considered view.
            </h2>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[#69636d] sm:block">
            Built for deeper reading
          </span>
        </div>
        <div className="grid grid-cols-1 gap-7 md:grid-cols-3 md:gap-0">
          {RESEARCH_LENSES.map((lens, index) => {
            const Icon = lens.icon;
            return (
              <article key={lens.title} className={`md:px-7 ${index === 0 ? 'md:pl-0' : 'md:border-l md:border-[#dfdcd6]'}`}>
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-[#5669c4]" aria-hidden="true" />
                  <span className="font-mono text-[10px] text-[#69636d]">{lens.number}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#292d3a]">{lens.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#706e78]">{lens.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
