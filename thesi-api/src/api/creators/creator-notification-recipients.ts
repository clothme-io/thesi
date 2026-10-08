import type { CreatorNotificationRecipient } from './creators-directory.repository';

export type CreatorNotificationCandidate = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  accountStatus: string;
};

export function activeCreatorRecipients(
  rows: CreatorNotificationCandidate[],
): CreatorNotificationRecipient[] {
  const seen = new Set<string>();
  const recipients: CreatorNotificationRecipient[] = [];

  for (const row of rows) {
    if (row.role !== 'creator' || row.accountStatus !== 'active') continue;
    const email = row.email.trim();
    const key = email.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    recipients.push({
      id: row.id,
      email,
      name: row.fullName.trim(),
    });
  }

  return recipients;
}
