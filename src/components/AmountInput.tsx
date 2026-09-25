import { useState } from 'react';
import { parseAmount } from '../lib/format';

const formatters = new Map<string, Intl.NumberFormat>();
function formatNumber(value: number, maxDecimals: number): string {
  // Euro amounts with cents read as "12,50", not "12,5".
  const minDecimals = maxDecimals === 2 && !Number.isInteger(value) ? 2 : 0;
  const key = `${minDecimals}-${maxDecimals}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals });
    formatters.set(key, f);
  }
  return f.format(value);
}

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Lets the user clear the field (value becomes null). */
  allowEmpty?: boolean;
  variant?: 'inline' | 'field';
  placeholder?: string;
  ariaLabel?: string;
  suffix?: string;
  maxDecimals?: number;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function AmountInput({
  value,
  onChange,
  allowEmpty = false,
  variant = 'inline',
  placeholder,
  ariaLabel,
  suffix = '€',
  maxDecimals = 2,
  disabled = false,
  className = '',
  autoFocus,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : formatNumber(value, maxDecimals));

  return (
    <div className={`relative ${className}`}>
      <input
        className={`${variant === 'inline' ? 'inline-input' : 'field'} tabular text-right`}
        style={{ paddingRight: `calc(1rem + ${suffix.length}ch)` }}
        inputMode="decimal"
        value={shown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        disabled={disabled}
        onFocus={(e) => {
          // Keep the displayed text as-is: rewriting it here would move the caret mid-edit.
          setDraft(shown);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = parseAmount(raw);
          if (n !== null) onChange(n);
          else if (allowEmpty && raw.trim() === '') onChange(null);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}
