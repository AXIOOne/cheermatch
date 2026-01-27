import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle, XCircle, AlertCircle, Eye, Settings2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmailTemplateManager } from './EmailTemplateManager';

interface SubmissionForEmail {
  id: string;
  teamName: string;
  gymName: string;
  eventId: string;
  eventName: string;
}

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: SubmissionForEmail[];
}

interface EmailResult {
  submissionId: string;
  teamName: string;
  status: 'pending' | 'sending' | 'success' | 'error';
  error?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  is_default: boolean;
}

export function BulkEmailDialog({ open, onOpenChange, submissions }: BulkEmailDialogProps) {
  const [emailMap, setEmailMap] = useState<Record<string, { email: string; name: string }>>({});
  const [results, setResults] = useState<EmailResult[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('recipients');
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch email templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, body_html, is_default')
        .eq('template_type', 'review_link')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: open,
  });

  // Set default template when loaded
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      setSelectedTemplateId(defaultTemplate.id);
      setCustomSubject(defaultTemplate.subject);
      setCustomBody(defaultTemplate.body_html);
    }
  }, [templates, selectedTemplateId]);

  // Update custom content when template changes
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setCustomSubject(template.subject);
      setCustomBody(template.body_html);
    }
  };

  // Initialize email map when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const initial: Record<string, { email: string; name: string }> = {};
      submissions.forEach(sub => {
        initial[sub.id] = { email: '', name: '' };
      });
      setEmailMap(initial);
      setResults([]);
      setIsDone(false);
      setActiveTab('recipients');
      setSelectedTemplateId('');
    }
    onOpenChange(isOpen);
  };

  const replaceVariables = (text: string, data: {
    coachName: string;
    coachEmail: string;
    teamName: string;
    gymName: string;
    eventName: string;
    reviewUrl: string;
  }) => {
    return text
      .replace(/\{\{coachName\}\}/g, data.coachName || 'Coach')
      .replace(/\{\{coachEmail\}\}/g, data.coachEmail)
      .replace(/\{\{teamName\}\}/g, data.teamName)
      .replace(/\{\{gymName\}\}/g, data.gymName)
      .replace(/\{\{eventName\}\}/g, data.eventName)
      .replace(/\{\{reviewUrl\}\}/g, data.reviewUrl);
  };

  const sendBulkEmails = async () => {
    setIsSending(true);
    setResults(submissions.map(sub => ({
      submissionId: sub.id,
      teamName: sub.teamName,
      status: 'pending' as const,
    })));

    for (const submission of submissions) {
      const emailData = emailMap[submission.id];
      if (!emailData?.email) {
        setResults(prev => prev.map(r => 
          r.submissionId === submission.id 
            ? { ...r, status: 'error' as const, error: 'Email not provided' }
            : r
        ));
        continue;
      }

      setResults(prev => prev.map(r => 
        r.submissionId === submission.id ? { ...r, status: 'sending' as const } : r
      ));

      try {
        // Create review token
        const { data: tokenResult, error: tokenError } = await supabase
          .from('scoring_review_tokens')
          .insert({
            submission_id: submission.id,
            coach_email: emailData.email,
            coach_name: emailData.name || null,
            created_by: user!.id,
          })
          .select('token')
          .single();

        if (tokenError) throw tokenError;

        const reviewUrl = `${window.location.origin}/review/${tokenResult.token}`;

        // Prepare customized email content
        const emailVars = {
          coachName: emailData.name || 'Coach',
          coachEmail: emailData.email,
          teamName: submission.teamName,
          gymName: submission.gymName,
          eventName: submission.eventName,
          reviewUrl,
        };

        const finalSubject = replaceVariables(customSubject, emailVars);
        const finalBody = replaceVariables(customBody, emailVars);

        // Send email with custom template
        const emailResponse = await supabase.functions.invoke('send-review-email', {
          body: {
            coachEmail: emailData.email,
            coachName: emailData.name || undefined,
            teamName: submission.teamName,
            gymName: submission.gymName,
            eventName: submission.eventName,
            reviewUrl,
            customSubject: finalSubject,
            customBodyHtml: finalBody,
          },
        });

        if (emailResponse.error || emailResponse.data?.error) {
          throw new Error(emailResponse.error?.message || emailResponse.data?.error || 'Failed to send email');
        }

        setResults(prev => prev.map(r => 
          r.submissionId === submission.id ? { ...r, status: 'success' as const } : r
        ));
      } catch (error: any) {
        setResults(prev => prev.map(r => 
          r.submissionId === submission.id 
            ? { ...r, status: 'error' as const, error: error.message }
            : r
        ));
      }
    }

    setIsSending(false);
    setIsDone(true);
    
    const successCount = submissions.filter((_, i) => 
      results[i]?.status === 'success'
    ).length;
    
    toast({
      title: 'Bulk email complete',
      description: `Successfully sent ${successCount} of ${submissions.length} emails.`,
    });
  };

  const updateEmail = (submissionId: string, field: 'email' | 'name', value: string) => {
    setEmailMap(prev => ({
      ...prev,
      [submissionId]: { ...prev[submissionId], [field]: value },
    }));
  };

  const allEmailsValid = submissions.every(sub => {
    const email = emailMap[sub.id]?.email;
    return email && email.includes('@');
  });

  const renderPreview = (html: string) => {
    const firstSubmission = submissions[0];
    const firstEmail = emailMap[firstSubmission?.id];
    return replaceVariables(html, {
      coachName: firstEmail?.name || 'John Smith',
      coachEmail: firstEmail?.email || 'coach@example.com',
      teamName: firstSubmission?.teamName || 'Elite Stars',
      gymName: firstSubmission?.gymName || 'Cheer Academy',
      eventName: firstSubmission?.eventName || 'National Championship',
      reviewUrl: '#',
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Review Links to {submissions.length} Coach{submissions.length !== 1 ? 'es' : ''}
            </DialogTitle>
            <DialogDescription>
              Customize the email template and enter recipient details
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="recipients" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Recipients
              </TabsTrigger>
              <TabsTrigger value="template" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Template
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            {/* Recipients Tab */}
            <TabsContent value="recipients" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {submissions.map((submission) => {
                    const result = results.find(r => r.submissionId === submission.id);
                    
                    return (
                      <div 
                        key={submission.id} 
                        className={`p-4 border rounded-lg space-y-3 ${
                          result?.status === 'success' ? 'bg-green-50 border-green-200' :
                          result?.status === 'error' ? 'bg-red-50 border-red-200' :
                          result?.status === 'sending' ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{submission.teamName}</p>
                            <p className="text-sm text-muted-foreground">{submission.gymName} • {submission.eventName}</p>
                          </div>
                          {result?.status === 'sending' && (
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          )}
                          {result?.status === 'success' && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                          {result?.status === 'error' && (
                            <div className="flex items-center gap-2 text-red-600">
                              <XCircle className="w-5 h-5" />
                              <span className="text-xs">{result.error}</span>
                            </div>
                          )}
                        </div>
                        
                        {!isDone && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Coach Email *</Label>
                              <Input
                                type="email"
                                placeholder="coach@example.com"
                                value={emailMap[submission.id]?.email || ''}
                                onChange={(e) => updateEmail(submission.id, 'email', e.target.value)}
                                disabled={isSending}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Coach Name (optional)</Label>
                              <Input
                                placeholder="John Smith"
                                value={emailMap[submission.id]?.name || ''}
                                onChange={(e) => updateEmail(submission.id, 'name', e.target.value)}
                                disabled={isSending}
                                className="h-9"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Template Tab */}
            <TabsContent value="template" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Email Template</Label>
                      <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates?.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} {template.is_default && '(Default)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setTemplateManagerOpen(true)}
                      className="mt-6"
                    >
                      <Settings2 className="w-4 h-4 mr-2" />
                      Manage Templates
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailSubject">Email Subject</Label>
                    <Input
                      id="emailSubject"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Your Score Review is Ready - {{teamName}}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use variables: {'{{coachName}}'}, {'{{teamName}}'}, {'{{gymName}}'}, {'{{eventName}}'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailBody">Email Body (HTML)</Label>
                    <Textarea
                      id="emailBody"
                      value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)}
                      className="min-h-[250px] font-mono text-sm"
                      placeholder="Enter HTML email content..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: {'{{coachName}}'}, {'{{coachEmail}}'}, {'{{teamName}}'}, {'{{gymName}}'}, {'{{eventName}}'}, {'{{reviewUrl}}'}
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      <strong>Subject:</strong> {renderPreview(customSubject)}
                    </p>
                  </div>
                  <div
                    className="border rounded-lg p-4 bg-white"
                    dangerouslySetInnerHTML={{ __html: renderPreview(customBody) }}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            {!isDone && !allEmailsValid && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Enter valid emails for all teams
              </p>
            )}
            {isDone && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {results.filter(r => r.status === 'success').length} emails sent successfully
              </p>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {isDone ? 'Close' : 'Cancel'}
              </Button>
              {!isDone && (
                <Button onClick={sendBulkEmails} disabled={isSending || !allEmailsValid || !customSubject || !customBody}>
                  {isSending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send All Emails
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EmailTemplateManager
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
      />
    </>
  );
}
