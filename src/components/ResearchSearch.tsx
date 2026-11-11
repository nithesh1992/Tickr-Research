import { ArrowRight, Search, Square } from 'lucide-react';

const TIMEFRAMES = [
  { label: '2W', value: '2 weeks' },
  { label: '3W', value: '3 weeks' },
  { label: '4W', value: '4 weeks' },
];

interface ResearchSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  running: boolean;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  variant?: 'hero' | 'compact';
}

export function ResearchSearch({
  value,
  onChange,
  onSubmit,
  onStop,
  running,
  timeframe,
  onTimeframeChange,
  variant = 'hero',
}: ResearchSearchProps) {
  const isHero = variant === 'hero';

  return (
    <form
      className={`surface-card w-full ${isHero ? 'rounded-[22px] p-2.5 shadow-[0_18px_55px_-30px_rgba(32,34,44,0.45)]' : 'rounded-2xl p-2'}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className={`flex ${isHero ? 'flex-col sm:flex-row' : 'flex-col lg:flex-row'} gap-2`}>
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 focus-within:bg-[#f3f3fa]">
          <Search className="h-[18px] w-[18px] shrink-0 text-[#70707a]" aria-hidden="true" />
          <span className="sr-only">Company or ticker symbol</span>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Company or ticker (e.g. NVDA)"
            disabled={running}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            className={`w-full min-w-0 bg-transparent font-medium uppercase tracking-[-0.01em] text-[#20222c] outline-none placeholder:font-normal placeholder:normal-case placeholder:text-[#69636d] ${isHero ? 'h-14 text-base' : 'h-12 text-sm'}`}
          />
        </label>

        {running ? (
          <button
            type="button"
            onClick={onStop}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f7e9e6] px-5 text-sm font-semibold text-[#9e453c] transition-colors hover:bg-[#f1dcd7] ${isHero ? 'h-12 sm:h-14' : 'h-11 lg:h-12'}`}
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Stop research
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className={`group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#252c4b] px-5 text-sm font-semibold text-white transition-all hover:bg-[#1c2342] disabled:cursor-not-allowed disabled:bg-[#e5e2dc] disabled:text-[#69636d] ${isHero ? 'h-12 sm:h-14' : 'h-11 lg:h-12'}`}
          >
            <span>{isHero ? 'Research company' : 'Run research'}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2 border-t border-[#e7e3dd] px-2 pb-1 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="pl-1 text-xs font-medium text-[#66616b]">News sentiment window</span>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#f1f0f4] p-1" aria-label="News sentiment window">
          {TIMEFRAMES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onTimeframeChange(item.value)}
              className={`min-h-10 rounded-md px-2.5 font-mono text-[11px] font-medium transition-colors ${
                timeframe === item.value
                  ? 'bg-white text-[#4053a5] shadow-sm'
                  : 'text-[#69636d] hover:text-[#20222c]'
              }`}
              aria-pressed={timeframe === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
