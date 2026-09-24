import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DivisionOption {
  id: string;
  name: string;
  level_name?: string | null;
}

interface DivisionSelectProps {
  value: string;
  onChange: (id: string) => void;
  divisions: DivisionOption[] | undefined;
  placeholder?: string;
}

export function DivisionSelect({ value, onChange, divisions, placeholder = 'Select a division' }: DivisionSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = (divisions || []).find((d) => d.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? `${selected.name}${selected.level_name ? ` — ${selected.level_name}` : ''}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[max(var(--radix-popover-trigger-width),28rem)] max-w-[90vw] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search divisions..." />
          <CommandList>
            <CommandEmpty>No division found.</CommandEmpty>
            <CommandGroup>
              {(divisions || []).map((d) => (
                <CommandItem
                  key={d.id}
                  value={`${d.name} ${d.level_name || ''}`}
                  onSelect={() => {
                    onChange(d.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === d.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="whitespace-normal break-words">
                    {d.name}{d.level_name ? ` — ${d.level_name}` : ''}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
