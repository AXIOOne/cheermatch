// Status checks update an existing export; starts supply event_id and can create it.
export function exportWriteMode(row: Record<string, unknown>): 'upsert' | 'update' {
  return typeof row.event_id === 'string' ? 'upsert' : 'update';
}