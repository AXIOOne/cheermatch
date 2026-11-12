export function scoresheetSampleRecipient(value: unknown, callerEmail: string | undefined): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !callerEmail || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new Error('An authenticated administrator and a valid single sample recipient are required.');
  }
  return value.trim().toLowerCase();
}