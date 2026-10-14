import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, Loader2, Copy, Check, Mail } from 'lucide-react';

const generateLinkSchema = z.object({
  coach_email: z.string().email('Please enter a valid email'),
  coach_name: z.string().optional(),
  send_email: z.boolean().default(false),
});

type GenerateLinkFormData = z.infer<typeof generateLinkSchema>;

interface GenerateReviewLinkProps {
  submissionId: string;
  teamName: string;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function GenerateReviewLink({ submissionId, teamName, variant = 'outline', size = 'sm', open, onOpenChange, hideTrigger }: GenerateReviewLinkProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = (o: boolean) => { setInternalOpen(o); onOpenChange?.(o); };
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch event name for email (and the team's coach for link generation)
  const { data: submissionData } = useQuery({
    queryKey: ['submission-event', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select('event:events(name, accuscore_enabled, accuscore_end_at), team:teams(coach_user_id)')
        .eq('id', submissionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const coachUserId: string | undefined = (submissionData as any)?.team?.coach_user_id;
  const { data: coachProfile } = useQuery({
    queryKey: ['submission-coach-profile', coachUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('user_id', coachUserId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!coachUserId,
  });

  // Look up an existing (non-expired) review link for this submission so it
  // can be copied directly when the scoresheet email was undeliverable.
  const { data: existingToken, isFetched: existingTokenFetched } = useQuery({
    queryKey: ['existing-review-token', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_review_tokens')
        .select('id, token, coach_email, coach_name, expires_at, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const form = useForm<GenerateLinkFormData>({
    resolver: zodResolver(generateLinkSchema),
    defaultValues: {
      coach_email: '',
      coach_name: '',
      send_email: true,
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: GenerateLinkFormData) => {
      // Create the review token
      const { data: result, error } = await supabase
        .from('scoring_review_tokens')
        .insert({
          submission_id: submissionId,
          coach_email: data.coach_email,
          coach_name: data.coach_name || null,
          created_by: user!.id,
        })
        .select('token')
        .single();

      if (error) throw error;

      const reviewUrl = `${window.location.origin}/review/${result.token}`;

      // Send email if requested
      if (data.send_email) {
        const eventName = submissionData?.event?.name || 'Event';
        
        const emailResponse = await supabase.functions.invoke('send-review-email', {
          body: {
            coachEmail: data.coach_email,
            coachName: data.coach_name || undefined,
            teamName,
            eventName,
            reviewUrl,
          },
        });

        if (emailResponse.error) {
          console.error('Email error:', emailResponse.error);
          // Don't throw - still return the link even if email fails
          return { token: result.token, emailSent: false, emailError: emailResponse.error.message };
        }

        if (emailResponse.data?.error) {
          console.error('Email API error:', emailResponse.data.error);
          return { token: result.token, emailSent: false, emailError: emailResponse.data.error };
        }

        return { token: result.token, emailSent: true };
      }

      return { token: result.token, emailSent: false };
    },
    onSuccess: (result) => {
      const link = `${window.location.origin}/review/${result.token}`;
      setGeneratedLink(link);
      setEmailSent(result.emailSent);
      
      if (result.emailSent) {
        toast({
          title: 'Review link generated and emailed',
          description: 'The coach will receive an email with the review link.',
        });
      } else if (result.emailError) {
        toast({
          title: 'Link generated, but email failed',
          description: result.emailError,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Review link generated',
          description: 'Copy the link to share with the coach.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const handleSubmit = (data: GenerateLinkFormData) => {
    generateMutation.mutate(data);
  };

  const [showNewForm, setShowNewForm] = useState(false);

  const handleCopy = async (text?: string) => {
    const link = text ?? generatedLink;
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setGeneratedLink(null);
    setEmailSent(false);
    setShowNewForm(false);
    form.reset();
  };

  const existingLink = existingToken ? `${window.location.origin}/review/${existingToken.token}` : null;
  const existingExpired = existingToken ? new Date(existingToken.expires_at) <= new Date() : false;

  const ev: any = (submissionData as any)?.event;
  const cutoffAt: Date | null = ev?.accuscore_end_at ? new Date(ev.accuscore_end_at) : null;
  const cutoffPassed = !!cutoffAt && cutoffAt <= new Date();

  const extendMutation = useMutation({
    mutationFn: async () => {
      // Never extend past the event's AccuScore cutoff.
      let expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      if (cutoffAt) expiry = Math.min(expiry, cutoffAt.getTime());
      const newExpiry = new Date(expiry).toISOString();
      const { error } = await supabase
        .from('scoring_review_tokens')
        .update({ expires_at: newExpiry })
        .eq('id', existingToken!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Link extended', description: cutoffAt ? `The link works until the AccuScore cutoff (${cutoffAt.toLocaleString()}).` : 'The existing link now works for another 30 days.' });
      queryClient.invalidateQueries({ queryKey: ['existing-review-token', submissionId] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error extending link', description: error.message });
    },
  });

  // When opened and no link exists yet, create one silently (no email) so the
  // admin always gets a copyable URL right away.
  const autoCreateMutation = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase
        .from('scoring_review_tokens')
        .insert({
          submission_id: submissionId,
          coach_email: coachProfile?.email || '',
          coach_name: coachProfile?.full_name || null,
          created_by: user!.id,
        })
        .select('token')
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['existing-review-token', submissionId] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error creating link', description: error.message });
    },
  });

  const coachQuerySettled = !coachUserId || !!coachProfile;
  useEffect(() => {
    if (
      isOpen &&
      existingTokenFetched &&
      !existingToken &&
      coachQuerySettled &&
      !autoCreateMutation.isPending &&
      !autoCreateMutation.isSuccess &&
      !autoCreateMutation.isError
    ) {
      autoCreateMutation.mutate();
    }
  }, [isOpen, existingTokenFetched, existingToken, coachQuerySettled, autoCreateMutation.isPending, autoCreateMutation.isSuccess, autoCreateMutation.isError]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleClose()}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant={variant} size={size}>
            <Send className="w-4 h-4 mr-2" />
            Send
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Coach review link for {teamName}</DialogTitle>

        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4">
            {emailSent && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
                <Mail className="w-4 h-4" />
                <span className="text-sm">Email sent to {form.getValues('coach_email')}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {emailSent 
                ? 'The coach has been emailed. You can also share this link directly:'
                : 'Share this link with the coach to allow them to view scores and request a review:'
              }
            </p>
            <div className="flex gap-2">
              <Input value={generatedLink} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={() => handleCopy()}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link will expire in 30 days.
            </p>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (existingLink && !showNewForm) || !existingTokenFetched || autoCreateMutation.isPending ? (
          <div className="space-y-4">
            {existingLink && !showNewForm ? (
          <div className="space-y-4">
            {existingExpired ? (
              <p className="text-sm text-muted-foreground">
                This team's review link expired on {new Date(existingToken!.expires_at).toLocaleDateString()}. Extend it to make it work again, then copy it and send it to the coach directly — no new email needed.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                A review link already exists for this team. If the scoresheet email was undeliverable, copy this link and send it to the coach directly:
              </p>
            )}
            <div className="flex gap-2">
              <Input value={existingLink} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={() => handleCopy(existingLink)} disabled={existingExpired}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {ev?.accuscore_enabled && cutoffAt && (
                <span className={cutoffPassed ? 'block text-destructive font-medium mb-1' : 'block mb-1'}>
                  AccuScore cutoff: {cutoffAt.toLocaleString()}{cutoffPassed ? ' — closed. Coaches can view scores but can no longer submit requests.' : ' — coaches can submit requests until then.'}
                </span>
              )}
              Originally sent to {existingToken!.coach_email} · {existingExpired ? 'expired' : 'expires'} {new Date(existingToken!.expires_at).toLocaleDateString()}.
            </p>
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowNewForm(true)}>
                Create a new link instead
              </Button>
              {existingExpired ? (
                <Button onClick={() => extendMutation.mutate()} disabled={extendMutation.isPending || cutoffPassed} title={cutoffPassed ? 'AccuScore cutoff has passed' : undefined}>
                  {extendMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {cutoffAt ? 'Extend link to cutoff' : 'Extend link 30 days'}
                </Button>
              ) : (
                <Button onClick={handleClose}>
                  Done
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="coach_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coach Email</FormLabel>
                    <FormControl>
                      <Input placeholder="coach@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="coach_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coach Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="send_email"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        Send email notification
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Automatically email the review link to the coach
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={generateMutation.isPending}>
                  {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {form.watch('send_email') ? 'Generate & Send' : 'Generate Link'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
