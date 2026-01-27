import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Edit2, Trash2, Star, Eye, Copy } from 'lucide-react';
import { format } from 'date-fns';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  description: string | null;
  template_type: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATE_VARIABLES = [
  { variable: '{{coachName}}', description: 'Coach full name' },
  { variable: '{{coachEmail}}', description: 'Coach email address' },
  { variable: '{{teamName}}', description: 'Team name' },
  { variable: '{{gymName}}', description: 'Gym/organization name' },
  { variable: '{{eventName}}', description: 'Event name' },
  { variable: '{{reviewUrl}}', description: 'Score review link' },
];

export function EmailTemplateManager({ open, onOpenChange }: EmailTemplateManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [description, setDescription] = useState('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', 'review_link')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate>) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: template.name,
            subject: template.subject,
            body_html: template.body_html,
            description: template.description,
          })
          .eq('id', editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('email_templates').insert({
          name: template.name,
          subject: template.subject,
          body_html: template.body_html,
          description: template.description,
          template_type: 'review_link',
          created_by: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: editingTemplate ? 'Template updated!' : 'Template created!' });
      resetForm();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Template deleted!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      // First unset all defaults
      await supabase
        .from('email_templates')
        .update({ is_default: false })
        .eq('template_type', 'review_link');

      // Then set the new default
      const { error } = await supabase
        .from('email_templates')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Default template updated!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const resetForm = () => {
    setEditingTemplate(null);
    setIsCreating(false);
    setName('');
    setSubject('');
    setBodyHtml('');
    setDescription('');
  };

  const startEditing = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsCreating(true);
    setName(template.name);
    setSubject(template.subject);
    setBodyHtml(template.body_html);
    setDescription(template.description || '');
  };

  const duplicateTemplate = (template: EmailTemplate) => {
    setEditingTemplate(null);
    setIsCreating(true);
    setName(`${template.name} (Copy)`);
    setSubject(template.subject);
    setBodyHtml(template.body_html);
    setDescription(template.description || '');
  };

  const handleSave = () => {
    if (!name || !subject || !bodyHtml) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all required fields' });
      return;
    }
    saveMutation.mutate({ name, subject, body_html: bodyHtml, description });
  };

  const renderPreview = (html: string) => {
    return html
      .replace(/\{\{coachName\}\}/g, 'John Smith')
      .replace(/\{\{coachEmail\}\}/g, 'john@example.com')
      .replace(/\{\{teamName\}\}/g, 'Elite Stars')
      .replace(/\{\{gymName\}\}/g, 'Cheer Academy')
      .replace(/\{\{eventName\}\}/g, 'National Championship 2026')
      .replace(/\{\{reviewUrl\}\}/g, '#');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Email Templates</DialogTitle>
          <DialogDescription>
            Create and manage email templates for score review notifications
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isCreating ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Template Name *</Label>
                  <Input
                    id="templateName"
                    placeholder="e.g., Competition Results"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of this template"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Your Score Review is Ready - {{teamName}}"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bodyHtml">Email Body (HTML) *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewTemplate({ body_html: bodyHtml } as EmailTemplate)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                </div>
                <Textarea
                  id="bodyHtml"
                  placeholder="Enter HTML email content..."
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              {/* Variable Reference */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Available Variables</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <Button
                        key={v.variable}
                        variant="outline"
                        size="sm"
                        className="text-xs font-mono"
                        onClick={() => {
                          navigator.clipboard.writeText(v.variable);
                          toast({ title: `Copied ${v.variable}` });
                        }}
                      >
                        {v.variable}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates && templates.length > 0 ? (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <Card key={template.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{template.name}</h4>
                              {template.is_default && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              Subject: {template.subject}
                            </p>
                            {template.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Updated {format(new Date(template.updated_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewTemplate(template)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateTemplate(template)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(template)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {!template.is_default && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDefaultMutation.mutate(template.id)}
                                  disabled={setDefaultMutation.isPending}
                                >
                                  <Star className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this template?')) {
                                      deleteMutation.mutate(template.id);
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No templates found. Create your first template to get started.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>
                Preview with sample data
              </DialogDescription>
            </DialogHeader>
            {previewTemplate && (
              <div
                className="border rounded-lg p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: renderPreview(previewTemplate.body_html) }}
              />
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
