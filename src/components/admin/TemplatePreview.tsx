import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { ScoringSection } from './SectionTabs';
import { DeductionType } from './DeductionTypeManager';

interface TemplatePreviewProps {
  templateName: string;
  sections: ScoringSection[];
  deductions: DeductionType[];
}

const DEDUCTION_CATEGORIES = {
  athlete: { label: 'Athlete', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  building: { label: 'Building', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  rule_violation: { label: 'Rule Violation', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  legality: { label: 'Legality', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
};

export default function TemplatePreview({ templateName, sections, deductions }: TemplatePreviewProps) {
  const totalPoints = sections.reduce(
    (sum, s) => sum + s.fields.reduce((a, f) => a + (Number(f.max_points) || 0), 0),
    0
  );

  if (sections.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Add sections and fields to see the preview.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{templateName || 'Untitled Template'}</h3>
            <p className="text-sm text-muted-foreground">Preview of judge scoring interface</p>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {totalPoints.toFixed(2)} pts max
          </Badge>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.temp_id} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-medium">{section.abbreviation}</Badge>
            <span className="font-medium">{section.name}</span>
            {section.description && (
              <span className="text-sm text-muted-foreground">— {section.description}</span>
            )}
          </div>

          {section.fields.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                No fields in this section
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium text-sm">Field</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Type / Range</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Panels</th>
                      <th className="text-right py-3 px-4 font-medium text-sm w-24">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.fields.map((f, idx) => (
                      <tr key={f.temp_id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-sm">{f.name || 'Unnamed'}</p>
                          {f.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {f.field_type === 'number'
                            ? `${f.min_value}–${f.max_value} (step ${f.step})`
                            : f.field_type === 'difficulty_driver'
                              ? `${f.skills?.length || 0} skill${(f.skills?.length || 0) === 1 ? '' : 's'} (sum)`
                              : `${f.options.length} dropdown options`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {f.panels.length === 0 ? (
                              <span className="text-xs italic text-muted-foreground">unassigned</span>
                            ) : f.panels.map((p) => (
                              <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                            ))}
                            {f.panels.length > 1 && (
                              <Badge variant="secondary" className="text-xs">{f.aggregation}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-medium">
                          {Number(f.max_points).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      ))}

      <Separator />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <CardTitle className="text-base text-destructive">Deductions</CardTitle>
          </div>
          <CardDescription>Safety violations, legality issues, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          {deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No deduction types defined</p>
          ) : (
            <div className="space-y-3">
              {deductions.map((ded) => {
                const catInfo = DEDUCTION_CATEGORIES[ded.category] || DEDUCTION_CATEGORIES.athlete;
                return (
                  <div key={ded.temp_id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={catInfo.color}>{catInfo.label}</Badge>
                      <div>
                        <span className="font-medium">{ded.name || 'Unnamed'}</span>
                        <span className="text-destructive font-bold ml-2">
                          ({ded.points > 0 ? `-${ded.points}` : ded.points} pts)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">0</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total Score</span>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary">0.0</span>
              <span className="text-muted-foreground ml-1">/ {totalPoints.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
