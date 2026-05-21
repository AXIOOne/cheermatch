import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SecuritySettings {
  minPasswordLength: number;
  requireSpecialChars: boolean;
  sessionTimeoutHours: number;
}

export interface NotificationSettings {
  emailOnSubmission: boolean;
  emailOnReview: boolean;
  emailOnScoring: boolean;
}

export interface IntegrationSettings {
  brightcoveAccountId: string;
  brightcoveApiKey: string;
  vimeoAccessToken: string;
  vimeoClientId: string;
  vimeoClientSecret: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsS3Bucket: string;
  awsS3Region: string;
  activeVideoProvider: 'brightcove' | 'vimeo' | 'aws_s3';
}

export interface PlatformSettings {
  security: SecuritySettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
}

const DEFAULT_SECURITY: SecuritySettings = {
  minPasswordLength: 8,
  requireSpecialChars: true,
  sessionTimeoutHours: 24,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailOnSubmission: true,
  emailOnReview: true,
  emailOnScoring: false,
};

const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  brightcoveAccountId: '',
  brightcoveApiKey: '',
  vimeoAccessToken: '',
  vimeoClientId: '',
  vimeoClientSecret: '',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsS3Bucket: '',
  awsS3Region: 'us-east-1',
  activeVideoProvider: 'brightcove',
};

export function usePlatformSettings() {
  const query = useQuery({
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

  const security: SecuritySettings = useMemo(() => ({
    ...DEFAULT_SECURITY,
    ...(query.data?.security as Partial<SecuritySettings> | undefined),
  }), [query.data]);

  const notifications: NotificationSettings = useMemo(() => ({
    ...DEFAULT_NOTIFICATIONS,
    ...(query.data?.notifications as Partial<NotificationSettings> | undefined),
  }), [query.data]);

  const integrations: IntegrationSettings = useMemo(() => ({
    ...DEFAULT_INTEGRATIONS,
    ...(query.data?.integrations as Partial<IntegrationSettings> | undefined),
  }), [query.data]);

  return {
    ...query,
    security,
    notifications,
    integrations,
    settings: {
      security,
      notifications,
      integrations,
    } as PlatformSettings,
  };
}

// Individual hooks for specific settings categories
export function useSecuritySettings() {
  const { security, isLoading, error } = usePlatformSettings();
  return { settings: security, isLoading, error };
}

export function useNotificationSettings() {
  const { notifications, isLoading, error } = usePlatformSettings();
  return { settings: notifications, isLoading, error };
}

export function useIntegrationSettings() {
  const { integrations, isLoading, error } = usePlatformSettings();
  return { settings: integrations, isLoading, error };
}
