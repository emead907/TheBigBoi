/** Wording a staff member edited in the send panel, used instead of the template's for this one message. */
export type MessageOverride = { subject?: string | null; body: string };

/** Basic limits on edited wording. Returns a problem to show, or null. */
export function checkOverride(o?: MessageOverride): string | null {
  if (!o) return null;
  if (typeof o.body !== 'string' || !o.body.trim()) return 'The message is empty.';
  if (o.body.length > 10000) return 'The message is too long.';
  if (o.subject != null && (typeof o.subject !== 'string' || o.subject.length > 200)) return 'The subject is too long.';
  return null;
}

