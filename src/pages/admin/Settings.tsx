import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Users, Shield, Bell, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface SecuritySettings {
  minPasswordLength: number;
  requireSpecialChars: boolean;
  sessionTimeoutHours: number;
}

interface NotificationSettings {
  emailOnSubmission: boolean;
  emailOnReview: boolean;
  emailOnScoring: boolean;
}

interface IntegrationSettings {
  brightcoveAccountId: string;
  brightcoveApiKey: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [integrationsDialogOpen, setIntegrationsDialogOpen] = useState(false);

  // Security settings state
  const [requireStrongPassword, setRequireStrongPassword] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('24');

  // Notification settings state
  const [emailNewSubmission, setEmailNewSubmission] = useState(true);
  const [emailReviewRequest, setEmailReviewRequest] = useState(true);
  const [emailScoreComplete, setEmailScoreComplete] = useState(false);

  // Integration settings state
  const [brightcoveAccountId, setBrightcoveAccountId] = useState('');
  const [brightcoveApiKey, setBrightcoveApiKey] = useState('');

  // Fetch all settings from database
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value');
      
      if (error) throw error;
      
      const settingsMap: Record<string, any> = {};
      data?.forEach((item) => {
        settingsMap[item.key] = item.value;
      });
      return settingsMap;
    },
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings) {
      // Security settings
      const security = settings.security as SecuritySettings | undefined;
      if (security) {
        setRequireStrongPassword(security.requireSpecialChars ?? true);
        setSessionTimeout(String(security.sessionTimeoutHours ?? 24));
      }

      // Notification settings
      const notifications = settings.notifications as NotificationSettings | undefined;
      if (notifications) {
        setEmailNewSubmission(notifications.emailOnSubmission ?? true);
        setEmailReviewRequest(notifications.emailOnReview ?? true);
        setEmailScoreComplete(notifications.emailOnScoring ?? false);
      }

      // Integration settings
      const integrations = settings.integrations as IntegrationSettings | undefined;
      if (integrations) {
        setBrightcoveAccountId(integrations.brightcoveAccountId ?? '');
        setBrightcoveApiKey(integrations.brightcoveApiKey ?? '');
      }
    }
  }, [settings]);

  // Mutation to save settings
  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key,
          value,
          updated_by: userId,
        }, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
  });

  const handleSaveSecuritySettings = async () => {
    try {
      await saveMutation.mutateAsync({
        key: 'security',
        value: {
          minPasswordLength: 8,
          requireSpecialChars: requireStrongPassword,
          sessionTimeoutHours: parseInt(sessionTimeout) || 24,
        },
      });
      toast({ title: 'Security settings saved!' });
      setSecurityDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      await saveMutation.mutateAsync({
        key: 'notifications',
        value: {
          emailOnSubmission: emailNewSubmission,
          emailOnReview: emailReviewRequest,
          emailOnScoring: emailScoreComplete,
        },
      });
      toast({ title: 'Notification settings saved!' });
      setNotificationsDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleSaveIntegrationSettings = async () => {
    try {
      await saveMutation.mutateAsync({
        key: 'integrations',
        value: {
          brightcoveAccountId,
          brightcoveApiKey,
        },
      });
      toast({ title: 'Integration settings saved!' });
      setIntegrationsDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage platform settings and configurations</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">User Management</CardTitle>
                  <CardDescription>Invite users and manage roles</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Add new admins, judges, and gym owners to the platform.
              </p>
              <Button variant="outline" onClick={() => navigate('/admin/roles')}>
                Manage Users
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Security</CardTitle>
                  <CardDescription>Password and authentication settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Configure security policies and authentication requirements.
              </p>
              <Button variant="outline" onClick={() => setSecurityDialogOpen(true)}>
                Security Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <CardDescription>Email and notification preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Set up email notifications for events and score updates.
              </p>
              <Button variant="outline" onClick={() => setNotificationsDialogOpen(true)}>
                Notification Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Integrations</CardTitle>
                  <CardDescription>Brightcove and external services</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Configure Brightcove video integration and other services.
              </p>
              <Button variant="outline" onClick={() => setIntegrationsDialogOpen(true)}>
                Configure Integrations
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Settings Dialog */}
      <Dialog open={securityDialogOpen} onOpenChange={setSecurityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Security Settings</DialogTitle>
            <DialogDescription>Configure authentication and security policies</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Strong Passwords</Label>
                <p className="text-sm text-muted-foreground">
                  Minimum 8 characters with uppercase, lowercase, and numbers
                </p>
              </div>
              <Switch
                checked={requireStrongPassword}
                onCheckedChange={setRequireStrongPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Auto-logout after inactivity period
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSecurityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSecuritySettings} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Settings Dialog */}
      <Dialog open={notificationsDialogOpen} onOpenChange={setNotificationsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>Configure email notification preferences</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New Video Submissions</Label>
                <p className="text-sm text-muted-foreground">
                  Email when a team submits a new video
                </p>
              </div>
              <Switch
                checked={emailNewSubmission}
                onCheckedChange={setEmailNewSubmission}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Review Requests</Label>
                <p className="text-sm text-muted-foreground">
                  Email when a coach requests a score review
                </p>
              </div>
              <Switch
                checked={emailReviewRequest}
                onCheckedChange={setEmailReviewRequest}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Scoring Complete</Label>
                <p className="text-sm text-muted-foreground">
                  Email when all judges finish scoring a submission
                </p>
              </div>
              <Switch
                checked={emailScoreComplete}
                onCheckedChange={setEmailScoreComplete}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotificationsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotificationSettings} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Integrations Settings Dialog */}
      <Dialog open={integrationsDialogOpen} onOpenChange={setIntegrationsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integration Settings</DialogTitle>
            <DialogDescription>Configure external service connections</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="font-medium">Brightcove Video Platform</h4>
              <div className="space-y-2">
                <Label htmlFor="brightcoveAccountId">Account ID</Label>
                <Input
                  id="brightcoveAccountId"
                  placeholder="Enter your Brightcove account ID"
                  value={brightcoveAccountId}
                  onChange={(e) => setBrightcoveAccountId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brightcoveApiKey">API Key</Label>
                <Input
                  id="brightcoveApiKey"
                  type="password"
                  placeholder="Enter your Brightcove API key"
                  value={brightcoveApiKey}
                  onChange={(e) => setBrightcoveApiKey(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIntegrationsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveIntegrationSettings} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
