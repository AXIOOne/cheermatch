import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import FieldBuilderDialog, { ScoringField } from './FieldBuilderDialog';

interface Props {
  fields: ScoringField[];
  onChange: (fields: ScoringField[]) => void;
  availablePanels?: string[];
}

export default function SectionFieldsTable({ fields, onChange, availablePanels }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const openNew = () => { setEditingIdx(null); setDialogOpen(true); };
  const openEdit = (idx: number) => { setEditingIdx(idx); setDialogOpen(true); };

  const handleSave = (field: ScoringField) => {
    if (editingIdx === null) {
      onChange([...fields, field]);
    } else {
      const next = [...fields];
      next[editingIdx] = field;
      onChange(next);
    }
  };

  const remove = (idx: number) => onChange(fields.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Fields</span>
        <Button type="button" size="sm" variant="outline" onClick={openNew}>
          <Plus className="w-3 h-3 mr-1" /> Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
          No fields yet. Add one to define what judges score in this row.
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Field</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Range</th>
                <th className="text-left px-3 py-2 font-medium">Panels</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, idx) => (
                <tr key={f.temp_id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{f.name || <span className="text-muted-foreground italic">Unnamed</span>}</p>
                      <Badge variant={f.score_type === 'execution' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                        {f.score_type === 'execution' ? 'Exec' : 'Diff'}
                      </Badge>
                    </div>
                    {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {f.field_type === 'difficulty_driver' ? 'Difficulty Driver' : f.field_type}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {f.field_type === 'number'
                      ? `${f.min_value}–${f.max_value} / ${f.step}`
                      : f.field_type === 'difficulty_driver'
                        ? `${f.skills?.length || 0} skill${(f.skills?.length || 0) === 1 ? '' : 's'}`
                        : `${f.options.length} opt${f.options.length === 1 ? '' : 's'}`}
                    <span className="ml-2 text-xs">max {f.max_points}</span>
                  </td>
                  <td className="px-3 py-2">
                    {f.panels.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">unassigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {f.panels.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                        {f.panels.length > 1 && (
                          <Badge variant="secondary" className="text-xs">{f.aggregation}</Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(idx)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FieldBuilderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingIdx !== null ? fields[editingIdx] : null}
        availablePanels={availablePanels}
        onSave={handleSave}
      />
    </div>
  );
}
