import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { Link2, Loader2, Copy, Check, Mail } from 'lucide-react';

const generateLinkSchema = z.object({
  coach_email: z.string().email('Please enter a valid email'),
  coach_name: z.string().optional(),
  send_email: z.boolean().default(false),
});

type GenerateLinkFormData = z.infer<typeof generateLinkSchema>;

interface GenerateReviewLinkProps {
  submissionId: string;
  teamName: string;
}

export function GenerateReviewLink({ submissionId, teamName }: GenerateReviewLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch event name for email
  const { data: submissionData } = useQuery({
    queryKey: ['submission-event', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select('event:events(name)')
        .eq('id', submissionId)
        .single();
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

  const handleCopy = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setGeneratedLink(null);
    setEmailSent(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="w-4 h-4 mr-2" />
          Generate Review Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Review Link for {teamName}</DialogTitle>
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
              <Button variant="outline" size="icon" onClick={handleCopy}>
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
