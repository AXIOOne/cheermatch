import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

/**
 * Toggle + divider for the main content header.
 * The side menu's own header carries a toggle while the menu is expanded, so this
 * one steps aside then and only shows when the menu is collapsed to icons or on mobile.
 */
export function HeaderSidebarControls({ className }: { className?: string }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const hidden = !isMobile && state === 'expanded';

  return (
    <div className={cn('flex items-center gap-2', hidden && 'hidden', className)}>
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
    </div>
  );
}
