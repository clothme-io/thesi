import { loadCrmData, saveCrmData } from "@/lib/creator-crm/storage";
import type { Brand } from "@/lib/creator-crm/types";
import { addInboxNotification } from "@/lib/inbox/storage";
import { sendStubNotification } from "@/lib/notifications/stub";
import { addPlatformBrandInvite, loadPlatformInviteData, savePlatformInviteData } from "./platform-storage";
import type { PlatformBrandInvite } from "./platform-types";

export interface SendPlatformBrandInviteInput {
  brandName: string;
  brandEmail: string;
  invitedBy: string;
  invitedByEmail: string;
  message?: string;
  addToCrm: boolean;
}

function addBrandToCrm(name: string, email: string): string {
  const crm = loadCrmData();
  const existing = crm.brands.find((b) => b.email.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const brand: Brand = {
    id: `brand-${Date.now()}`,
    name,
    contactName: name,
    email,
    phone: "",
    website: "",
    relationshipStage: "prospect",
    tags: ["Invited via Thesi"],
    notes: "Invited to join Thesi as a brand partner.",
    createdAt: now,
    updatedAt: now,
  };
  saveCrmData({ ...crm, brands: [...crm.brands, brand] });
  return brand.id;
}

export async function sendPlatformBrandInvite(
  input: SendPlatformBrandInviteInput,
): Promise<PlatformBrandInvite> {
  const now = new Date().toISOString();
  let crmBrandId: string | undefined;

  if (input.addToCrm) {
    crmBrandId = addBrandToCrm(input.brandName, input.brandEmail);
  }

  const invite: PlatformBrandInvite = {
    id: `pinv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    brandName: input.brandName,
    brandEmail: input.brandEmail,
    invitedBy: input.invitedBy,
    invitedByEmail: input.invitedByEmail,
    message: input.message,
    addToCrm: input.addToCrm,
    crmBrandId,
    status: "sent",
    sentAt: now,
  };

  const inviteData = addPlatformBrandInvite(loadPlatformInviteData(), invite);
  savePlatformInviteData(inviteData);

  addInboxNotification({
    type: "platform_invite",
    title: "Brand invite sent",
    body: `You invited ${input.brandName} (${input.brandEmail}) to join Thesi.${input.addToCrm ? " Added to CRM as prospect." : ""}`,
    href: "/app/crm/brands",
    audience: "creator",
  });

  await sendStubNotification({
    type: "platform_invite_brand",
    toEmail: input.brandEmail,
    brandName: input.brandName,
    invitedBy: input.invitedBy,
  });

  return invite;
}
