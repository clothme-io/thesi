export const BRAND_CREATORS_ROUTES = {
  list: "/app/creators",
  creator: (id: string) => `/app/creators/${id}`,
} as const;
