import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown, Loader2, UserRoundPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrganizations } from '@/hooks/useOrganizations';

const sb = supabase as any;

export interface CoachOption {
  user_id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  phone?: string | null;
}

export function useCoaches() {
  return useQuery({
    queryKey: ['coach-options'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await sb
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gym_coach');
      if (rolesError) throw rolesError;
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [] as CoachOption[];

      const { data: profiles, error } = await sb
        .from('profiles')
        .select('user_id, email, full_name, phone, organization_id, organizations(name)')
        .in('user_id', ids)
        .order('full_name');
      if (error) throw error;

      return (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        phone: p.phone ?? null,
        organization_id: p.organization_id ?? null,
        organization_name: p.organizations?.name ?? null,
      })) as CoachOption[];
    },
  });
}

interface CoachSelectProps {
  value: string | null;
  onChange: (coach: CoachOption | null) => void;
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
  let out = '';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  bytes.forEach((b) => { out += chars[b % chars.length]; });
  return out;
}

export function CoachSelect({ value, onChange }: CoachSelectProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: coaches, isLoading } = useCoaches();
  const { data: organizations } = useOrganizations({ activeOnly: true });

  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCoach, setNewCoach] = useState({ full_name: '', email: '', organization_id: '' });

  const selected = useMemo(
    () => (coaches || []).find((c) => c.user_id === value) || null,
    [coaches, value]
  );

  const handleCreate = async () => {
    if (!newCoach.full_name.trim() || !newCoach.email.trim() || !newCoach.organization_id) {
      toast({ variant: 'destructive', title: 'Missing information', description: 'Name, email and organization are required.' });
      return;
    }
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newCoach.email.trim(),
          password: randomPassword(),
          fullName: newCoach.full_name.trim(),
          role: 'gym_coach',
          organizationId: newCoach.organization_id,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      const created = await queryClient.invalidateQueries({ queryKey: ['coach-options'] });
      const { data: profile } = await sb
        .from('profiles')
        .select('user_id, email, full_name, phone, organization_id, organizations(name)')
        .ilike('email', newCoach.email.trim())
        .maybeSingle();

      if (profile) {
        onChange({
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone ?? null,
          organization_id: profile.organization_id ?? null,
          organization_name: profile.organizations?.name ?? null,
        });
      }
      toast({ title: 'Coach created' });
      setAddOpen(false);
      setNewCoach({ full_name: '', email: '', organization_id: '' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not create coach', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
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
              {selected
                ? `${selected.full_name || selected.email}${selected.organization_name ? ` — ${selected.organization_name}` : ''}`
                : isLoading
                  ? 'Loading coaches...'
                  : 'Select a coach'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search coaches..." />
            <CommandList>
              <CommandEmpty>No coach found.</CommandEmpty>
              <CommandGroup>
                {(coaches || []).map((c) => (
                  <CommandItem
                    key={c.user_id}
                    value={`${c.full_name || ''} ${c.email} ${c.organization_name || ''}`}
                    onSelect={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === c.user_id ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">
                      {c.full_name || c.email}
                      {c.organization_name ? ` — ${c.organization_name}` : ' — no organization'}
                    </span>
                  </CommandItem>
                ))}
                <CommandItem
                  value="__add_new_coach__"
                  onSelect={() => {
                    setOpen(false);
                    setAddOpen(true);
                  }}
                >
                  <UserRoundPlus className="mr-2 h-4 w-4" /> Add new coach
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && !selected.organization_id && (
        <p className="text-xs text-destructive">
          This coach has no organization assigned. Set one under Settings → User Roles before saving.
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Coach</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={newCoach.full_name}
                onChange={(e) => setNewCoach((s) => ({ ...s, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newCoach.email}
                onChange={(e) => setNewCoach((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select
                value={newCoach.organization_id}
                onValueChange={(v) => setNewCoach((s) => ({ ...s, organization_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select an organization" /></SelectTrigger>
                <SelectContent>
                  {(organizations || []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Coach
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
