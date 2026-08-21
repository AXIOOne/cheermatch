import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowUp, ArrowDown, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface TemplatePanel {
  id?: string;
  temp_id: string;
  name: string;
  abbreviation: string;
}

interface Props {
  panels: TemplatePanel[];
  onChange: (panels: TemplatePanel[]) => void;
  /** Abbreviations already referenced by fields in this template. */
  usedAbbreviations?: string[];
}

const ALLSTAR_PRESET = [
  { name: 'Building 1', abbreviation: 'B1' },
  { name: 'Building 2', abbreviation: 'B2' },
  { name: 'Tumbling 1', abbreviation: 'T1' },
  { name: 'Tumbling 2', abbreviation: 'T2' },
  { name: 'Overall', abbreviation: 'OV' },
  { name: 'Safety & Deductions', abbreviation: 'SD' },
];

function tempId() {
  return `tp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function TemplatePanelsManager({ panels, onChange, usedAbbreviations = [] }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({ name: '', abbreviation: '' });
  const [judgeCount, setJudgeCount] = useState(4);

  const existing = new Set(panels.map((p) => p.abbreviation.toUpperCase()));

  const addPanels = (rows: { name: string; abbreviation: string }[]) => {
    const next = [...panels];
    let added = 0;
    rows.forEach((r) => {
      const abbr = r.abbreviation.trim().toUpperCase();
      if (!abbr || existing.has(abbr)) return;
      existing.add(abbr);
      next.push({ temp_id: tempId(), name: r.name.trim() || abbr, abbreviation: abbr });
      added++;
    });
    if (added === 0) {
      toast({ title: 'Nothing to add', description: 'Those panels already exist on this template.' });
      return;
    }
    onChange(next);
  };

  const handleAdd = () => {
    if (!draft.abbreviation.trim()) {
      toast({ variant: 'destructive', title: 'Abbreviation is required' });
      return;
    }
    addPanels([draft]);
    setDraft({ name: '', abbreviation: '' });
  };

  const update = (idx: number, patch: Partial<TemplatePanel>) => {
    const next = [...panels];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => onChange(panels.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= panels.length) return;
    const next = [...panels];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const missing = usedAbbreviations
    .map((a) => a.toUpperCase())
    .filter((a) => a !== 'ALL' && !existing.has(a));
  const uniqueMissing = [...new Set(missing)];

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-muted/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium">Quick setup</p>
            <p className="text-sm text-muted-foreground">
              Define the judge slots this scoresheet uses. Fields are then assigned to these slots.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => addPanels(ALLSTAR_PRESET)}>
              All Star preset
            </Button>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={20}
                value={judgeCount}
                onChange={(e) => setJudgeCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-16"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  addPanels(
                    Array.from({ length: judgeCount }, (_, i) => ({
                      name: `Judge ${i + 1}`,
                      abbreviation: `J${i + 1}`,
                    }))
                  )
                }
              >
                Numbered judges
              </Button>
            </div>
          </div>
        </div>

        {uniqueMissing.length > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-md border border-amber-300 bg-amber-50 p-3 flex-wrap dark:bg-amber-950/30">
            <p className="text-sm">
              Fields in this template already use:{' '}
              {uniqueMissing.map((a) => (
                <Badge key={a} variant="outline" className="mr-1">{a}</Badge>
              ))}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addPanels(uniqueMissing.map((a) => ({ name: a, abbreviation: a })))}
            >
              Add these as panels
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {panels.length === 0 ? (
          <div className="border rounded-lg py-10 text-center text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No panels defined yet — fields will fall back to the standard All Star slots.</p>
          </div>
        ) : (
          panels.map((panel, idx) => (
            <div key={panel.temp_id} className="flex items-center gap-2 border rounded-md p-2">
              <Input
                value={panel.abbreviation}
                onChange={(e) => update(idx, { abbreviation: e.target.value.toUpperCase() })}
                className="w-24 font-mono"
                placeholder="J1"
              />
              <Input
                value={panel.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="Judge 1"
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => move(idx, 1)}
                disabled={idx === panels.length - 1}
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(idx)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <Label>Add a panel</Label>
        <div className="flex items-end gap-2">
          <div className="w-28">
            <Label className="text-xs text-muted-foreground">Abbreviation</Label>
            <Input
              value={draft.abbreviation}
              onChange={(e) => setDraft((d) => ({ ...d, abbreviation: e.target.value.toUpperCase() }))}
              placeholder="J5"
              className="font-mono"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Judge 5"
            />
          </div>
          <Button type="button" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
