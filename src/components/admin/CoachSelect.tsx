import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserRoundPlus } from 'lucide-react';
import { useOrganizations } from '@/hooks/useOrganizations';

const sb = supabase as any;

export interface CoachOption {
  user_id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
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
        .select('user_id, email, full_name, organization_id, organizations(name)')
        .in('user_id', ids)
        .order('full_name');
      if (error) throw error;

      return (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        email: p.email,
        full_name: p.full_name,
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
        .select('user_id, email, full_name, organization_id, organizations(name)')
        .ilike('email', newCoach.email.trim())
        .maybeSingle();

      if (profile) {
        onChange({
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
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
      <Select
        value={value || ''}
        onValueChange={(v) => {
          if (v === '__add__') {
            setAddOpen(true);
            return;
          }
          onChange((coaches || []).find((c) => c.user_id === v) || null);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? 'Loading coaches...' : 'Select a coach'} />
        </SelectTrigger>
        <SelectContent>
          {(coaches || []).map((c) => (
            <SelectItem key={c.user_id} value={c.user_id}>
              {(c.full_name || c.email)}
              {c.organization_name ? ` — ${c.organization_name}` : ' — no organization'}
            </SelectItem>
          ))}
          <SelectItem value="__add__">
            <span className="flex items-center gap-2">
              <UserRoundPlus className="w-4 h-4" /> Add new coach
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
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
