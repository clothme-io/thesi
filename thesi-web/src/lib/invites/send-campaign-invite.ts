import { loadInboxData, saveInboxData } from "@/lib/inbox/storage";
import type { InboxContact, InboxMessage } from "@/lib/inbox/types";
import { sendStubNotification } from "@/lib/notifications/stub";
import { addInvite, loadInviteData, saveInviteData } from "./storage";
import type { CampaignInvite } from "./types";

function ensureBrandInboxContact(brandName: string): string {
  const inbox = loadInboxData();
  const existing = inbox.contacts.find(
    (c) => c.company?.toLowerCase() === brandName.toLowerCase() || c.name.toLowerCase() === brandName.toLowerCase(),
  );
  if (existing) return existing.id;

  const contact: InboxContact = {
    id: `contact-brand-${Date.now()}`,
    name: brandName,
    email: `team@${brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    company: brandName,
  };
  saveInboxData({ ...inbox, contacts: [...inbox.contacts, contact] });
  return contact.id;
}

export interface SendCampaignInviteInput {
  campaignId: string;
  campaignName: string;
  brandName: string;
  creatorId?: string;
  creatorEmail: string;
  creatorName: string;
  external: boolean;
}

export async function sendCampaignInvite(input: SendCampaignInviteInput): Promise<CampaignInvite> {
  const now = new Date().toISOString();
  const invite: CampaignInvite = {
    id: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    brandName: input.brandName,
    creatorId: input.creatorId,
    creatorEmail: input.creatorEmail,
    creatorName: input.creatorName,
    external: input.external,
    status: "sent",
    sentAt: now,
  };

  const inviteData = addInvite(loadInviteData(), invite);
  saveInviteData(inviteData);

  if (!input.external) {
    const contactId = ensureBrandInboxContact(input.brandName);
    const inbox = loadInboxData();
    const message: InboxMessage = {
      id: `msg-invite-${invite.id}`,
      contactId,
      subject: `Campaign invite: ${input.campaignName}`,
      content: `${input.brandName} invited you to collaborate on "${input.campaignName}". Open this thread to reply or ask questions about the campaign brief.`,
      createdAt: now,
      read: false,
      isFromMe: false,
      kind: "invite",
      campaignId: input.campaignId,
    };
    saveInboxData({ ...inbox, messages: [...inbox.messages, message] });
  }

  await sendStubNotification({
    type: "campaign_invite",
    toEmail: input.creatorEmail,
    creatorName: input.creatorName,
    brandName: input.brandName,
    campaignName: input.campaignName,
    campaignId: input.campaignId,
  });

  return invite;
}
