import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Loader2, Copy, Check } from 'lucide-react';

const generateLinkSchema = z.object({
  coach_email: z.string().email('Please enter a valid email'),
  coach_name: z.string().optional(),
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
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<GenerateLinkFormData>({
    resolver: zodResolver(generateLinkSchema),
    defaultValues: {
      coach_email: '',
      coach_name: '',
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: GenerateLinkFormData) => {
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
      return result;
    },
    onSuccess: (result) => {
      const link = `${window.location.origin}/review/${result.token}`;
      setGeneratedLink(link);
      toast({
        title: 'Review link generated',
        description: 'Copy the link to share with the coach.',
      });
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
            <p className="text-sm text-muted-foreground">
              Share this link with the coach to allow them to view scores and request a review:
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
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={generateMutation.isPending}>
                  {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Generate Link
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
