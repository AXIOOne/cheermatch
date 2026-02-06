import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScoreInput } from '@/components/ui/score-input';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { ScoringSection } from './SectionTabs';
import { DeductionType } from './DeductionTypeManager';
import { CategoryItem } from './ScoringCategoryTree';

interface TemplatePreviewProps {
  templateName: string;
  sections: ScoringSection[];
  deductions: DeductionType[];
}

// Get leaf categories (no children) from a category tree
function getLeafCategories(categories: CategoryItem[]): CategoryItem[] {
  const result: CategoryItem[] = [];
  categories.forEach((cat) => {
    if (cat.children.length > 0) {
      result.push(...getLeafCategories(cat.children));
    } else {
      result.push(cat);
    }
  });
  return result;
}

// Group deductions by category
const DEDUCTION_CATEGORIES = {
  athlete: { label: 'Athlete', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  building: { label: 'Building', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  rule_violation: { label: 'Rule Violation', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  legality: { label: 'Legality', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
};

export default function TemplatePreview({ templateName, sections, deductions }: TemplatePreviewProps) {
  // Flatten all leaf categories from all sections
  const allLeafCategories = sections.flatMap((section) => 
    getLeafCategories(section.categories).map((cat) => ({
      ...cat,
      sectionName: section.name,
      sectionAbbr: section.abbreviation,
    }))
  );

  const totalPoints = allLeafCategories.reduce((sum, cat) => sum + cat.max_points, 0);

  if (sections.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Add sections and categories to see the preview.</p>
      </div>
    );
  }

  // Group categories by section
  const categoriesBySection = sections.map((section) => ({
    section,
    categories: getLeafCategories(section.categories),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{templateName || 'Untitled Template'}</h3>
            <p className="text-sm text-muted-foreground">Preview of judge scoring interface</p>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {totalPoints.toFixed(1)} pts max
          </Badge>
        </div>
      </div>

      {/* Scoring Categories Table by Section */}
      {categoriesBySection.map(({ section, categories }) => (
        <div key={section.temp_id} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-medium">
              {section.abbreviation}
            </Badge>
            <span className="font-medium">{section.name}</span>
            {section.description && (
              <span className="text-sm text-muted-foreground">— {section.description}</span>
            )}
          </div>

          {categories.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                No scoring categories in this section
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium text-sm">Judge Criteria</th>
                        <th className="text-center py-3 px-4 font-medium text-sm whitespace-nowrap">Min - Max</th>
                        <th className="text-right py-3 px-4 font-medium text-sm w-32">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category, index) => (
                        <tr key={category.temp_id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-medium text-sm">{category.name}</span>
                              {category.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-muted-foreground whitespace-nowrap">
                            0 - {category.max_points}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end">
                              <ScoreInput
                                value={0}
                                onChange={() => {}}
                                max={category.max_points}
                                step={0.5}
                                disabled
                                className="w-24"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ))}

      <Separator />

      {/* Deductions Preview */}
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
            <p className="text-sm text-muted-foreground text-center py-4">
              No deduction types defined
            </p>
          ) : (
            <div className="space-y-3">
              {deductions.map((ded) => {
                const catInfo = DEDUCTION_CATEGORIES[ded.category] || DEDUCTION_CATEGORIES.athlete;
                return (
                  <div
                    key={ded.temp_id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={catInfo.color}>
                        {catInfo.label}
                      </Badge>
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

      {/* Comments Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Judge Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Overall feedback and comments..."
            disabled
            className="opacity-60"
          />
        </CardContent>
      </Card>

      {/* Score Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total Score</span>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary">0.0</span>
              <span className="text-muted-foreground ml-1">/ {totalPoints.toFixed(1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
