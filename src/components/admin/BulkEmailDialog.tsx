import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export function BulkEmailDialog({ open, onOpenChange, submissions }: BulkEmailDialogProps) {
  const [emailMap, setEmailMap] = useState<Record<string, { email: string; name: string }>>({});
  const [results, setResults] = useState<EmailResult[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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
    }
    onOpenChange(isOpen);
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

        // Send email
        const emailResponse = await supabase.functions.invoke('send-review-email', {
          body: {
            coachEmail: emailData.email,
            coachName: emailData.name || undefined,
            teamName: submission.teamName,
            eventName: submission.eventName,
            reviewUrl,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Review Links to {submissions.length} Coach{submissions.length !== 1 ? 'es' : ''}
          </DialogTitle>
          <DialogDescription>
            Enter the email addresses for each team's coach to send them their score review link.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4">
            {submissions.map((submission) => {
              const result = results.find(r => r.submissionId === submission.id);
              const isComplete = result?.status === 'success' || result?.status === 'error';
              
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
              <Button onClick={sendBulkEmails} disabled={isSending || !allEmailsValid}>
                {isSending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send All Emails
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
