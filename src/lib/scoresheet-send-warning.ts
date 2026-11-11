export interface ScoresheetSendStatus {
  allComplete: boolean;
  allReviewed: boolean;
}

export function getScoresheetSendWarning(status: ScoresheetSendStatus): string | null {
  if (status.allComplete && status.allReviewed) return null;

  if (!status.allComplete) {
    return 'Not all panels have submitted scores. The score sheet will be incomplete, and unsubmitted criteria will contribute zero to the percentage.';
  }

  return 'All scores are submitted, but not all panels have been marked as reviewed.';
}
