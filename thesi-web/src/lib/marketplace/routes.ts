export const MARKETPLACE_ROUTES = {
  list: "/app/marketplace",
  listing: (id: string) => `/app/marketplace/${id}`,
} as const;
