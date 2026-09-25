import { useState } from 'react';
import { parseAmount } from '../lib/format';

const display = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Lets the user clear the field (value becomes null). */
  allowEmpty?: boolean;
  variant?: 'inline' | 'field';
  placeholder?: string;
  ariaLabel?: string;
  suffix?: string;
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
  className = '',
  autoFocus,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : display.format(value));

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
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>
    </div>
  );
}
