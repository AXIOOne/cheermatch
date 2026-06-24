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
  const decrement = () => {
    if (disabled) return;
    const newValue = Math.max(min, +(value - step).toFixed(2));
    onChange(newValue);
  };

  const increment = () => {
    if (disabled) return;
    const newValue = Math.min(max, +(value + step).toFixed(2));
    onChange(newValue);
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
      <div
        className="min-w-[3rem] text-center font-semibold text-lg tabular-nums select-none"
        aria-live="polite"
      >
        {formatValue(value, step)}
      </div>
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
