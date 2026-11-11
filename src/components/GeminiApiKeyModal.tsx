import { useEffect, useState } from 'react';
import { Check, ExternalLink, Key, Sparkles, Trash2, X } from 'lucide-react';

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSave: (newKey: string) => void;
  hasServerKey?: boolean;
}

export function GeminiApiKeyModal({
  isOpen,
  onClose,
  apiKey,
  onSave,
  hasServerKey = false,
}: GeminiApiKeyModalProps) {
  const [draftKey, setDraftKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftKey(apiKey);
      setShowKey(false);
    }
  }, [isOpen, apiKey]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(draftKey.trim());
    onClose();
  };

  const handleClear = () => {
    setDraftKey('');
    onSave('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#20222c]/35 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gemini-key-title"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white text-[#292d3a] shadow-[0_30px_90px_-30px_rgba(32,34,44,0.45)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#e5e1db] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef0fb] text-[#5669c4]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 id="gemini-key-title" className="font-serif text-2xl tracking-tight text-[#20222c]">
                Gemini API Key
              </h2>
              <p className="mt-0.5 text-xs text-[#66616b]">
                Connect your key to power SEC research & news sentiment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close API key dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#69636d] transition-colors hover:bg-[#f0eff4] hover:text-[#292d3a]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {hasServerKey && (
            <div className="flex items-center gap-2 rounded-xl border border-[#d5dcf4] bg-[#eef0fb] px-3.5 py-2.5 text-xs text-[#4053a5]">
              <Check className="h-4 w-4 shrink-0 text-[#5669c4]" />
              <span>A server environment key (<code className="font-mono text-[11px]">GEMINI_API_KEY</code>) is currently active.</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="gemini-api-key" className="flex items-center gap-1.5 text-xs font-semibold text-[#454b5c]">
                <Key className="h-3.5 w-3.5 text-[#5669c4]" />
                Gemini API key
              </label>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-[11px] font-medium text-[#5669c4] hover:underline"
              >
                {showKey ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <input
              id="gemini-api-key"
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={(event) => setDraftKey(event.target.value)}
              placeholder="AIzaSy..."
              autoComplete="off"
              spellCheck={false}
              className="mt-2 h-12 w-full rounded-xl border border-[#ddd9d3] bg-[#faf9f6] px-3.5 font-mono text-xs text-[#20222c] outline-none placeholder:text-[#a09ca3] focus:border-[#7d8bd2] focus:bg-white"
            />
            <p className="mt-2 text-[11px] leading-4 text-[#66616b]">
              Your key is saved locally in this browser and synced to the local <code className="font-mono text-[10px]">.env</code> file.
            </p>
          </div>

          <div className="rounded-xl border border-[#e5e1db] bg-[#f8f7f3] p-4 text-xs leading-5 text-[#585b66]">
            <div className="font-semibold text-[#292d3a]">Need a Gemini API key?</div>
            <p className="mt-1">
              Google provides free access to Gemini 2.5 Flash and Gemini 3.8 models with fast quotas for development.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 font-semibold text-[#5669c4] hover:underline"
            >
              <span>Get a free key at Google AI Studio</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#e5e1db] bg-[#faf9f6] px-5 py-4 sm:px-6">
          {apiKey ? (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#9e453c] hover:bg-[#f7e9e6]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove key
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-xl px-4 text-xs font-semibold text-[#716e77] hover:bg-[#eef0fb] hover:text-[#292d3a]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!draftKey.trim()}
              className="min-h-10 rounded-xl bg-[#252c4b] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#1c2342] disabled:opacity-40"
            >
              Save key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
