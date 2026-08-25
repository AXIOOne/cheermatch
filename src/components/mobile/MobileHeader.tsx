import { Link } from "react-router-dom";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import logoWhite from "@/assets/logo-white.png.asset.json";

/**
 * Branded header shown at the top of the mobile capture app.
 * Uses the portal branding logo when configured, otherwise the default logo.
 */
export function MobileHeader() {
  const { branding } = usePlatformSettings();
  const src = branding?.logoUrl || logoWhite.url;

  return (
    <header className="sticky top-0 z-30 bg-sidebar border-b border-border">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center">
        <Link to="/m/events" className="flex items-center">
          <img src={src} alt="Portal logo" className="h-8 w-auto object-contain" />
        </Link>
      </div>
    </header>
  );
}

export default MobileHeader;
