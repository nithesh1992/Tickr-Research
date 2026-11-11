import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  ArrowUpRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Code,
  FileSearch,
  Info,
  MessageSquare,
  Terminal,
} from 'lucide-react';

export interface TimelineEvent {
  id: number;
  kind: 'info' | 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'error';
  label: string;
  detail?: string;
  toolName?: string;
  startTime?: number;
  endTime?: number;
  callId?: string;
}

const ICONS = {
  info: Info,
  thinking: Brain,
  tool_call: Terminal,
  tool_result: CheckCircle2,
  text: MessageSquare,
  error: AlertCircle,
} as const;

const KIND_STYLES: Record<TimelineEvent['kind'], { label: string; icon: string }> = {
  info: { label: 'Update', icon: 'bg-[#eef0fb] text-[#5669c4]' },
  thinking: { label: 'Reasoning', icon: 'bg-[#f6f1e5] text-[#8c6d35]' },
  tool_call: { label: 'Research', icon: 'bg-[#eef0fb] text-[#5669c4]' },
  tool_result: { label: 'Verified', icon: 'bg-[#dfe5ff] text-[#4053a5]' },
  text: { label: 'Output', icon: 'bg-[#f1f0f4] text-[#666571]' },
  error: { label: 'Error', icon: 'bg-[#f9eeeb] text-[#9a4c43]' },
};

const RESEARCH_STEPS = ['Find filings', 'Read financials', 'Scan the news', 'Build your brief'];

export function AgentTimeline({
  events,
  running,
  hasReport,
  onViewReport,
  metrics,
}: {
  events: TimelineEvent[];
  running: boolean;
  paused?: boolean;
  hasReport?: boolean;
  onViewReport?: () => void;
  onDecisionClick?: () => void;
  metrics?: { durationSecs: number; tokenCount: number; documentCount: number };
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleEvents = showAll ? events : events.slice(-6);
  const completedSteps = Math.min(RESEARCH_STEPS.length, Math.max(1, Math.ceil(events.length / 2)));

  return (
    <section className="surface-card min-w-0 overflow-hidden rounded-[22px]" aria-labelledby="research-activity-title">
      <div className="flex items-center justify-between gap-3 border-b border-[#e6e2dc] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef0fb] text-[#5669c4]">
            <FileSearch className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="research-activity-title" className="text-sm font-semibold text-[#292d3a]">Research activity</h2>
            <p className="mt-0.5 text-xs text-[#66616b]">A transparent trail of sources and analysis</p>
          </div>
        </div>
        {running && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef0fb] px-2.5 py-1 text-[11px] font-medium text-[#4053a5]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5669c4]" />
            Live
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <ol className="grid grid-cols-2 gap-y-3 rounded-xl bg-[#f7f5f1] p-4 sm:grid-cols-4" aria-label="Research progress">
          {RESEARCH_STEPS.map((step, index) => {
            const complete = !running || index < completedSteps - 1;
            const active = running && index === completedSteps - 1;
            return (
              <li key={step} className="relative flex items-center gap-2 pr-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-[#dfe5ff] text-[#4053a5]' : active ? 'border border-[#91a0de] bg-white text-[#5669c4]' : 'border border-[#dcd8d2] bg-white text-[#a39ea6]'}`}>
                  {complete ? <Check className="h-3 w-3" /> : <span className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse bg-[#5669c4]' : 'bg-[#c8c3bd]'}`} />}
                </span>
                <span className={`text-[11px] leading-4 ${complete || active ? 'font-medium text-[#454b5c]' : 'text-[#69636d]'}`}>{step}</span>
              </li>
            );
          })}
        </ol>

        {events.length === 0 && running && (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d8def5] border-t-[#5669c4]" />
            <h3 className="mt-4 text-sm font-semibold text-[#292d3a]">Starting your research</h3>
            <p className="mt-1.5 text-xs text-[#66616b]">Connecting to filings, market data, and news sources.</p>
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-4">
            {events.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="mb-2 flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#666571] hover:bg-[#f0f1f8] hover:text-[#4053a5]"
              >
                {showAll ? 'Show latest only' : `Show all ${events.length} steps`}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            )}
            <AnimatePresence initial={false}>
              {visibleEvents.map((event) => {
                const Icon = ICONS[event.kind];
                const style = KIND_STYLES[event.kind];
                const originalIndex = events.findIndex((item) => item.id === event.id);
                return (
                  <motion.article
                    key={event.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-b border-[#e8e4de] py-3 last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.icon}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[#69636d]">Step {String(originalIndex + 1).padStart(2, '0')} · {style.label}</span>
                            <h3 className="mt-0.5 text-sm font-medium leading-5 text-[#343746]">{event.label}</h3>
                          </div>
                          {event.endTime && event.startTime && (
                            <span className="shrink-0 font-mono text-[10px] text-[#69636d]">{((event.endTime - event.startTime) / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                        {event.detail && (
                          <details className="report-details mt-2 rounded-lg bg-[#f7f5f1] px-3 py-2">
                            <summary className="flex min-h-7 cursor-pointer items-center justify-between gap-2 text-[11px] font-medium text-[#66616b]">
                              <span className="inline-flex items-center gap-1.5"><Code className="h-3 w-3" />{event.toolName || 'View research detail'}</span>
                              <ChevronDown className="details-chevron h-3.5 w-3.5 transition-transform" aria-hidden="true" />
                            </summary>
                            <pre className="custom-scrollbar mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-[#e2ded8] pt-2 font-mono text-[10px] leading-5 text-[#666571]">{event.detail}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {running && events.length > 0 && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#d5dcf4] bg-[#eef0fb] px-3.5 py-3 text-xs text-[#4c5683]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#5669c4]" />
            Research is still running. New findings will appear automatically.
          </div>
        )}

        {hasReport && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onViewReport}
            className="group mt-4 flex w-full items-center justify-between gap-4 rounded-xl bg-[#252c4b] p-4 text-left text-white transition-colors hover:bg-[#1c2342]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10"><CheckCircle2 className="h-4 w-4 text-[#dfe5ff]" /></span>
              <span>
                <span className="block text-sm font-semibold">Your research brief is ready</span>
                {metrics && <span className="mt-0.5 block text-[11px] text-white/60">{metrics.documentCount} filings · {metrics.durationSecs}s · {metrics.tokenCount.toLocaleString()} tokens</span>}
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </motion.button>
        )}
      </div>
    </section>
  );
}
