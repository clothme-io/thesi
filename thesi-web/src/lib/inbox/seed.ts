import type { InboxData } from "./types";

export const SEED_INBOX_DATA: InboxData = {
  contacts: [
    {
      id: "contact-nike",
      brandId: "brand-nike",
      name: "Jordan Lee",
      email: "jordan.lee@nike.com",
      company: "Nike",
    },
    {
      id: "contact-boutique",
      brandId: "brand-boutique",
      name: "Maya Ortiz",
      email: "maya@lunaboutique.co",
      company: "Luna Boutique",
    },
    {
      id: "contact-skincare",
      brandId: "brand-skincare",
      name: "Priya Shah",
      email: "priya@glowtheory.com",
      company: "Glow Theory",
    },
    {
      id: "contact-clothme",
      brandId: "brand-clothme",
      name: "Creator Team",
      email: "creators@clothme.io",
      company: "ClothME",
    },
    {
      id: "contact-restaurant",
      brandId: "brand-restaurant",
      name: "Chris Nguyen",
      email: "chris@harborhearth.com",
      company: "Harbor & Hearth",
    },
  ],
  messages: [
    {
      id: "msg-1",
      contactId: "contact-nike",
      subject: "Spring Training Series — draft feedback",
      content:
        "Hi! We reviewed draft 2 and love the energy. Can you tighten the hook in the first 3 seconds and resubmit by Friday?",
      createdAt: "2026-07-07T14:30:00.000Z",
      read: false,
      isFromMe: false,
    },
    {
      id: "msg-2",
      contactId: "contact-nike",
      subject: "Re: Spring Training Series — draft feedback",
      content: "Thanks Jordan — I'll revise the hook and send an updated cut by EOD Thursday.",
      createdAt: "2026-07-07T15:05:00.000Z",
      read: true,
      isFromMe: true,
    },
    {
      id: "msg-3",
      contactId: "contact-boutique",
      subject: "Fall Lookbook contract",
      content:
        "Contract is attached for review. Let us know if the usage terms work for you — we'd like to kick off shoots the week of July 14.",
      createdAt: "2026-07-06T09:15:00.000Z",
      read: false,
      isFromMe: false,
    },
    {
      id: "msg-4",
      contactId: "contact-clothme",
      subject: "Creator Store Promo — invoice reminder",
      content: "Friendly reminder that invoice INV-2026-014 is due July 15. Let us know if you need anything from our side.",
      createdAt: "2026-07-05T11:00:00.000Z",
      read: true,
      isFromMe: false,
    },
    {
      id: "msg-5",
      contactId: "contact-clothme",
      subject: "Re: Creator Store Promo — invoice reminder",
      content: "Got it — payment will go out once the final deliverables are approved.",
      createdAt: "2026-07-05T11:45:00.000Z",
      read: true,
      isFromMe: true,
    },
    {
      id: "msg-6",
      contactId: "contact-skincare",
      subject: "Serum launch creative brief",
      content:
        "Sharing the creative brief for the serum launch. Main ask is authentic morning-routine style content with before/after framing.",
      createdAt: "2026-07-04T16:20:00.000Z",
      read: true,
      isFromMe: false,
    },
    {
      id: "msg-7",
      contactId: "contact-restaurant",
      subject: "Menu launch video inquiry",
      content:
        "We saw your portfolio and would love 3 short videos for our new summer menu. Are you available for a discovery call next week?",
      createdAt: "2026-07-03T10:00:00.000Z",
      read: false,
      isFromMe: false,
    },
  ],
};
