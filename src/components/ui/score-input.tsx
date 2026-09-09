import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

function formatValue(v: number, step: number): string {
  // Show one decimal if step is fractional, else integer
  const decimals = step < 1 ? 1 : 0;
  return v.toFixed(decimals);
}

export function ScoreInput({
  value,
  onChange,
  min = 0,
  max,
  step = 0.5,
  disabled = false,
  className,
}: ScoreInputProps) {
  const [text, setText] = React.useState<string>(() => formatValue(value, step));
  const [editing, setEditing] = React.useState(false);

  // Keep the displayed text in sync when the value changes externally
  // (e.g. +/- buttons or loaded scores), but not while the judge is typing.
  React.useEffect(() => {
    if (!editing) {
      setText(formatValue(value, step));
    }
  }, [value, step, editing]);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const decrement = () => {
    if (disabled) return;
    onChange(clamp(+(value - step).toFixed(2)));
  };

  const increment = () => {
    if (disabled) return;
    onChange(clamp(+(value + step).toFixed(2)));
  };

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(text);
    if (isNaN(parsed)) {
      setText(formatValue(value, step));
      return;
    }
    // Round to the nearest step increment and clamp to range
    const snapped = Math.round(parsed / step) * step;
    const clamped = clamp(+snapped.toFixed(2));
    setText(formatValue(clamped, step));
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setText(formatValue(value, step));
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-input bg-background p-1',
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={decrement}
        disabled={disabled || value <= min}
        aria-label="Decrease score"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          'w-14 rounded-sm bg-transparent text-center font-semibold text-lg tabular-nums',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        value={text}
        disabled={disabled}
        aria-label="Score value"
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          // Allow digits, one decimal point, and a leading minus
          const next = e.target.value;
          if (/^-?\d*\.?\d*$/.test(next)) {
            setText(next);
          }
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={increment}
        disabled={disabled || value >= max}
        aria-label="Increase score"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
