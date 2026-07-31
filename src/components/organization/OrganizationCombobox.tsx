import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrganizations } from '@/hooks/useOrganizations';

interface Organization {
  id: string;
  name: string;
}

interface OrganizationComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowNone?: boolean;
  noneLabel?: string;
  activeOnly?: boolean;
  disabled?: boolean;
}

export function OrganizationCombobox({
  value,
  onChange,
  placeholder = 'Select an organization',
  emptyLabel = 'No organization found.',
  allowNone = false,
  noneLabel = 'No organization',
  activeOnly = false,
  disabled = false,
}: OrganizationComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: organizations, isLoading } = useOrganizations({ activeOnly });

  const items: Organization[] = [
    ...(allowNone ? [{ id: 'none', name: noneLabel }] : []),
    ...(organizations || []),
  ];

  const selected = items.find((item) => item.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {isLoading ? 'Loading...' : selected?.name || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ minWidth: 'var(--radix-popover-trigger-width)' }}>
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  textValue={item.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? (allowNone ? 'none' : '') : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === item.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
