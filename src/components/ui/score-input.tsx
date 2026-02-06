import * as React from 'react';
import { Input } from '@/components/ui/input';
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

export function ScoreInput({
  value,
  onChange,
  min = 0,
  max,
  step = 0.5,
  disabled = false,
  className,
}: ScoreInputProps) {
  const [inputValue, setInputValue] = React.useState<string>(value.toString());

  // Sync external value changes
  React.useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    // Allow empty input for typing
    if (raw === '' || raw === '-') return;

    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      // Clamp to valid range
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    // On blur, ensure value is valid and formatted
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || inputValue === '') {
      setInputValue(min.toString());
      onChange(min);
    } else {
      const clamped = Math.min(max, Math.max(min, parsed));
      setInputValue(clamped.toString());
      onChange(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow increment/decrement with arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newValue = Math.min(max, value + step);
      setInputValue(newValue.toString());
      onChange(newValue);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newValue = Math.max(min, value - step);
      setInputValue(newValue.toString());
      onChange(newValue);
    }
  };

  return (
    <Input
      type="number"
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        'w-24 text-center font-semibold text-lg',
        className
      )}
    />
  );
}
