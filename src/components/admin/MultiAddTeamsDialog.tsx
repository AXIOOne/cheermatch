import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEventDivisions } from '@/hooks/useEventDivisions';
import { Loader2, Plus, X } from 'lucide-react';
import { CoachSelect, type CoachOption } from './CoachSelect';

const sb = supabase as any;

type Row = {
  key: number;
  coach: CoachOption | null;
  name: string;
  division_id: string;
  male: string;
  female: string;
};

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, coach: null, name: '', division_id: '', male: '0', female: '0' });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}

export function MultiAddTeamsDialog({ open, onOpenChange, eventId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: divisions } = useEventDivisions(eventId);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setRows([emptyRow(), emptyRow(), emptyRow()]);
  }, [open]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const isBlank = (r: Row) => !r.coach && !r.name.trim() && !r.division_id;

  const save = async () => {
    const filled = rows.filter((r) => !isBlank(r));
    if (filled.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing to save', description: 'Fill in at least one row.' });
      return;
    }
    const bad = filled.findIndex((r) => !r.coach || !r.name.trim() || !r.division_id);
    if (bad >= 0) {
      toast({
        variant: 'destructive',
        title: `Row ${rows.indexOf(filled[bad]) + 1} is incomplete`,
        description: 'Each row needs a coach, team name, and division.',
      });
      return;
    }
    setSaving(true);
    const payload = filled.map((r) => {
      const division = divisions?.find((d) => d.id === r.division_id);
      const c = r.coach!;
      return {
        event_id: eventId,
        name: r.name.trim(),
        gym_name: c.organization_name || '',
        organization_id: c.organization_id,
        coach_name: c.full_name || c.email,
        coach_email: c.email,
        coach_phone: c.phone || null,
        coach_user_id: c.user_id,
        division_id: r.division_id,
        level_id: division?.level_id ?? null,
        athletes_male: Math.max(0, parseInt(r.male) || 0),
        athletes_female: Math.max(0, parseInt(r.female) || 0),
      };
    });
    const { error } = await sb.from('teams').insert(payload);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
    toast({ title: `${payload.length} team${payload.length === 1 ? '' : 's'} registered` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Multiple Registrations</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.key} className="relative grid grid-cols-2 md:grid-cols-12 gap-3 rounded-md border border-border p-3 pr-10">
              <div className="col-span-2 md:col-span-3 space-y-1">
                <Label className="text-xs">Coach</Label>
                <CoachSelect value={r.coach?.user_id ?? null} onChange={(c) => update(r.key, { coach: c })} />
              </div>
              <div className="col-span-2 md:col-span-2 space-y-1">
                <Label className="text-xs">Team</Label>
                <Input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-3 space-y-1">
                <Label className="text-xs">Division</Label>
                <Select value={r.division_id} onValueChange={(v) => update(r.key, { division_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {divisions?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}{d.level_name ? ` — ${d.level_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1 space-y-1">
                <Label className="text-xs">Male</Label>
                <Input type="number" min={0} value={r.male} onChange={(e) => update(r.key, { male: e.target.value })} />
              </div>
              <div className="md:col-span-1 space-y-1">
                <Label className="text-xs">Female</Label>
                <Input type="number" min={0} value={r.female} onChange={(e) => update(r.key, { female: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-2 space-y-1">
                <Label className="text-xs">Gym</Label>
                <Input value={r.coach?.organization_name || ''} readOnly disabled placeholder="From coach" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                aria-label={`Remove row ${i + 1}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            <Plus className="w-4 h-4 mr-2" /> Add Row
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
