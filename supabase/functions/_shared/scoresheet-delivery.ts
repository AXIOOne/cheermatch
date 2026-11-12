export type DeliveryStatus = 'sending' | 'sent' | 'delivered' | 'delayed' | 'failed' | 'bounced' | 'complained' | 'unknown';
export interface Delivery { status: DeliveryStatus; email_id?: string | null; error?: string | null; }
export interface ReviewScore { status: string; panel_id: string | null; judge_user_id?: string; reviewed_at?: string | null; needs_review?: boolean; }

export function scoresheetReviewed(scores: ReviewScore[], panelIds: string[], resolve: (s: ReviewScore) => string | null = s => s.panel_id): boolean {
  if (!panelIds.length) return false;
  if (scores.some(s => s.needs_review && !s.reviewed_at)) return false;
  return panelIds.every(id => {
    const score = scores.find(s => resolve(s) === id);
    return score?.status === 'submitted' && !!score.reviewed_at;
  });
}

export function canSendAll(reviewed: boolean[], ready: boolean, unsentCount: number): boolean {
  return ready && reviewed.length > 0 && reviewed.every(Boolean) && unsentCount > 0;
}

export function shouldSendUnsent(delivery: Delivery | undefined, hasReceipt: boolean): boolean {
  if (delivery) return delivery.status === 'failed' || delivery.status === 'bounced';
  return !hasReceipt;
}

export function providerDeliveryStatus(event: string | undefined): DeliveryStatus {
  switch (event?.replace(/^email\./, '')) {
    case 'sent': return 'sent';
    case 'delivered': case 'opened': case 'clicked': return 'delivered';
    case 'delivery_delayed': return 'delayed';
    case 'failed': case 'canceled': case 'suppressed': return 'failed';
    case 'bounced': return 'bounced';
    case 'complained': return 'complained';
    default: return 'unknown';
  }
}

export async function sendUnsentSequentially<T>(items: T[], send: (item: T) => Promise<void>, progress: (done: number, failed: number) => void) {
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    try { await send(items[i]); } catch { failed++; }
    progress(i + 1, failed);
  }
  return { sent: items.length - failed, failed };
}