import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  currentPoints: number;
  maxPoints: number;
  onConfirm: (reason: string, newPoints: number) => Promise<void>;
}

export default function ScoreFieldOverrideDialog({
  open, onOpenChange, fieldName, currentPoints, maxPoints, onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [value, setValue] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setReason(''); setValue('0'); setSaving(false); } }, [open]);

  const parsed = parseFloat(value);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= Number(maxPoints || 0);
  const canSave = valid && !!reason.trim();

  const handleConfirm = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onConfirm(reason.trim(), parsed);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-warning" />
            Admin Override Score
          </DialogTitle>
          <DialogDescription>
            Set a new score for <strong>{fieldName}</strong>. Current score is{' '}
            <strong>{Number(currentPoints).toFixed(2)}</strong> (max {Number(maxPoints).toFixed(2)}).
            The original score and your reason are logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New score <span className="text-destructive">*</span></label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={Number(maxPoints || 0)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {!valid && value !== '' && (
              <p className="text-xs text-destructive">
                Enter a value between 0 and {Number(maxPoints || 0).toFixed(2)}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for override <span className="text-destructive">*</span></label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Skill not performed, illegal element, judge error confirmed by head judge..."
              rows={4}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving || !canSave}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Apply override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
