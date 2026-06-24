import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Users, Shield, Bell, Loader2, Video, Cloud, Play, Mail, Palette, Upload } from 'lucide-react';
import { EmailTemplateManager } from '@/components/admin/EmailTemplateManager';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-west-2', label: 'EU (London)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
];

// Convert "H S% L%" → "#rrggbb"
function hslStringToHex(hsl: string): string {
  if (!hsl) return '';
  const m = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return '';
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert "#rrggbb" → "H S% L%" (Tailwind HSL CSS var format)
function hexToHslString(hex: string): string {
  const m = hex.trim().match(/^#?([a-f\d]{6})$/i);
  if (!m) return '';
  const num = parseInt(m[1], 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [integrationsDialogOpen, setIntegrationsDialogOpen] = useState(false);
  const [emailTemplatesOpen, setEmailTemplatesOpen] = useState(false);
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);

  // Use the reusable hook
  const { security, notifications, integrations, branding, isLoading } = usePlatformSettings();

  // Security settings state
  const [requireStrongPassword, setRequireStrongPassword] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('24');

  // Notification settings state
  const [emailNewSubmission, setEmailNewSubmission] = useState(true);
  const [emailReviewRequest, setEmailReviewRequest] = useState(true);
  const [emailScoreComplete, setEmailScoreComplete] = useState(false);

  // Integration settings state
  const [activeVideoProvider, setActiveVideoProvider] = useState<'brightcove' | 'vimeo' | 'aws_s3'>('brightcove');
  // Brightcove
  const [brightcoveAccountId, setBrightcoveAccountId] = useState('');
  const [brightcoveApiKey, setBrightcoveApiKey] = useState('');
  // Vimeo
  const [vimeoAccessToken, setVimeoAccessToken] = useState('');
  const [vimeoClientId, setVimeoClientId] = useState('');
  const [vimeoClientSecret, setVimeoClientSecret] = useState('');
  // AWS S3
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsS3Bucket, setAwsS3Bucket] = useState('');
  const [awsS3Region, setAwsS3Region] = useState('us-east-1');

  // Branding settings state
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [brandingPrimaryHex, setBrandingPrimaryHex] = useState('#1ddbb1');
  const [brandingUploading, setBrandingUploading] = useState(false);

  // Update local state when settings are loaded from the hook
  useEffect(() => {
    // Security settings
    setRequireStrongPassword(security.requireSpecialChars);
    setSessionTimeout(String(security.sessionTimeoutHours));

    // Notification settings
    setEmailNewSubmission(notifications.emailOnSubmission);
    setEmailReviewRequest(notifications.emailOnReview);
    setEmailScoreComplete(notifications.emailOnScoring);

    // Integration settings
    setActiveVideoProvider(integrations.activeVideoProvider);
    setBrightcoveAccountId(integrations.brightcoveAccountId);
    setBrightcoveApiKey(integrations.brightcoveApiKey);
    setVimeoAccessToken(integrations.vimeoAccessToken);
    setVimeoClientId(integrations.vimeoClientId);
    setVimeoClientSecret(integrations.vimeoClientSecret);
    setAwsAccessKeyId(integrations.awsAccessKeyId);
    setAwsSecretAccessKey(integrations.awsSecretAccessKey);
    setAwsS3Bucket(integrations.awsS3Bucket);
    setAwsS3Region(integrations.awsS3Region);

    // Branding settings
    setBrandingLogoUrl(branding.logoUrl);
    setBrandingPrimaryHex(hslStringToHex(branding.primaryColor) || '#1ddbb1');
  }, [security, notifications, integrations, branding]);

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
          activeVideoProvider,
          brightcoveAccountId,
          brightcoveApiKey,
          vimeoAccessToken,
          vimeoClientId,
          vimeoClientSecret,
          awsAccessKeyId,
          awsSecretAccessKey,
          awsS3Bucket,
          awsS3Region,
        },
      });
      toast({ title: 'Integration settings saved!' });
      setIntegrationsDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleLogoUpload = async (file: File) => {
    setBrandingUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `branding/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('email-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('email-assets').getPublicUrl(path);
      setBrandingLogoUrl(data.publicUrl);
      toast({ title: 'Logo uploaded!' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    } finally {
      setBrandingUploading(false);
    }
  };

  const handleSaveBrandingSettings = async () => {
    try {
      const hsl = hexToHslString(brandingPrimaryHex);
      if (!hsl) {
        toast({ variant: 'destructive', title: 'Invalid color', description: 'Please enter a valid hex color.' });
        return;
      }
      await saveMutation.mutateAsync({
        key: 'branding',
        value: {
          logoUrl: brandingLogoUrl,
          primaryColor: hsl,
        },
      });
      toast({ title: 'Branding saved!' });
      setBrandingDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const getProviderStatus = (provider: string) => {
    switch (provider) {
      case 'brightcove':
        return !!(integrations.brightcoveAccountId && integrations.brightcoveApiKey);
      case 'vimeo':
        return !!(integrations.vimeoAccessToken);
      case 'aws_s3':
        return !!(integrations.awsAccessKeyId && integrations.awsSecretAccessKey && integrations.awsS3Bucket);
      default:
        return false;
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
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Video Integrations</CardTitle>
                    {integrations.activeVideoProvider && (
                      <Badge variant="secondary" className="text-xs">
                        {integrations.activeVideoProvider === 'brightcove' && 'Brightcove'}
                        {integrations.activeVideoProvider === 'vimeo' && 'Vimeo'}
                        {integrations.activeVideoProvider === 'aws_s3' && 'AWS S3'}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>Brightcove, Vimeo, and AWS S3</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Configure video storage and streaming services.
              </p>
              <Button variant="outline" onClick={() => setIntegrationsDialogOpen(true)}>
                Configure Integrations
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Email Templates</CardTitle>
                  <CardDescription>Customize review and welcome emails</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Create and manage email templates for notifications.
              </p>
              <Button variant="outline" onClick={() => setEmailTemplatesOpen(true)}>
                Manage Templates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Branding</CardTitle>
                  <CardDescription>Portal logo and color scheme</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Customize the portal logo and primary color used across the app.
              </p>
              <Button variant="outline" onClick={() => setBrandingDialogOpen(true)}>
                Configure Branding
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Video Integration Settings</DialogTitle>
            <DialogDescription>Configure video storage and streaming services</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Active Provider Selection */}
            <div className="space-y-3">
              <Label>Active Video Provider</Label>
              <Select value={activeVideoProvider} onValueChange={(v) => setActiveVideoProvider(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brightcove">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      <span>Brightcove</span>
                      {getProviderStatus('brightcove') && (
                        <Badge variant="secondary" className="ml-2 text-xs">Configured</Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="vimeo">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      <span>Vimeo</span>
                      {getProviderStatus('vimeo') && (
                        <Badge variant="secondary" className="ml-2 text-xs">Configured</Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="aws_s3">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4" />
                      <span>AWS S3</span>
                      {getProviderStatus('aws_s3') && (
                        <Badge variant="secondary" className="ml-2 text-xs">Configured</Badge>
                      )}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select which video service to use for video uploads and playback
              </p>
            </div>

            {/* Provider-specific Settings */}
            <Tabs defaultValue="brightcove" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="brightcove" className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Brightcove
                </TabsTrigger>
                <TabsTrigger value="vimeo" className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Vimeo
                </TabsTrigger>
                <TabsTrigger value="aws_s3" className="flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  AWS S3
                </TabsTrigger>
              </TabsList>

              {/* Brightcove Tab */}
              <TabsContent value="brightcove" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-medium mb-1">Brightcove Video Cloud</h4>
                  <p className="text-sm text-muted-foreground">
                    Enterprise-grade video hosting with advanced analytics and monetization features.
                  </p>
                </div>
                <div className="space-y-4">
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
              </TabsContent>

              {/* Vimeo Tab */}
              <TabsContent value="vimeo" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-medium mb-1">Vimeo</h4>
                  <p className="text-sm text-muted-foreground">
                    Professional video hosting with customizable player, privacy controls, and team collaboration.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vimeoClientId">Client ID</Label>
                    <Input
                      id="vimeoClientId"
                      placeholder="Enter your Vimeo Client ID"
                      value={vimeoClientId}
                      onChange={(e) => setVimeoClientId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vimeoClientSecret">Client Secret</Label>
                    <Input
                      id="vimeoClientSecret"
                      type="password"
                      placeholder="Enter your Vimeo Client Secret"
                      value={vimeoClientSecret}
                      onChange={(e) => setVimeoClientSecret(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vimeoAccessToken">Access Token</Label>
                    <Input
                      id="vimeoAccessToken"
                      type="password"
                      placeholder="Enter your Vimeo Access Token"
                      value={vimeoAccessToken}
                      onChange={(e) => setVimeoAccessToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Generate an access token from your Vimeo Developer App settings
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* AWS S3 Tab */}
              <TabsContent value="aws_s3" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-medium mb-1">Amazon S3</h4>
                  <p className="text-sm text-muted-foreground">
                    Scalable cloud storage with global distribution. Best for custom video processing workflows.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="awsAccessKeyId">Access Key ID</Label>
                      <Input
                        id="awsAccessKeyId"
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        value={awsAccessKeyId}
                        onChange={(e) => setAwsAccessKeyId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsSecretAccessKey">Secret Access Key</Label>
                      <Input
                        id="awsSecretAccessKey"
                        type="password"
                        placeholder="Enter your AWS Secret Access Key"
                        value={awsSecretAccessKey}
                        onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="awsS3Bucket">S3 Bucket Name</Label>
                      <Input
                        id="awsS3Bucket"
                        placeholder="my-video-bucket"
                        value={awsS3Bucket}
                        onChange={(e) => setAwsS3Bucket(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awsS3Region">Region</Label>
                      <Select value={awsS3Region} onValueChange={setAwsS3Region}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                          {AWS_REGIONS.map((region) => (
                            <SelectItem key={region.value} value={region.value}>
                              {region.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ensure your IAM user has s3:PutObject, s3:GetObject, and s3:DeleteObject permissions on the bucket
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
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

      {/* Email Templates Manager */}
      <EmailTemplateManager
        open={emailTemplatesOpen}
        onOpenChange={setEmailTemplatesOpen}
      />
    </div>
  );
}
