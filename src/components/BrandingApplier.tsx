import { useEffect } from 'react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

/**
 * Applies branding settings (primary color) as CSS variables on :root.
 * Logo is read directly from the branding settings hook by consumers.
 */
export function BrandingApplier() {
  const { branding } = usePlatformSettings();

  useEffect(() => {
    if (!branding?.primaryColor) return;
    const root = document.documentElement;
    root.style.setProperty('--primary', branding.primaryColor);
    root.style.setProperty('--sidebar-primary', branding.primaryColor);
    root.style.setProperty('--ring', branding.primaryColor);
  }, [branding?.primaryColor]);

  return null;
}
