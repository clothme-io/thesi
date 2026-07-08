export const CRM_ROUTES = {
  brands: "/app/crm/brands",
  brand: (id: string) => `/app/crm/brands/${id}`,
  pipeline: "/app/crm/pipeline",
  jobs: "/app/crm/jobs",
  job: (id: string) => `/app/crm/jobs/${id}`,
  contracts: "/app/crm/contracts",
  payments: "/app/crm/payments",
  calendar: "/app/crm/calendar",
  tasks: "/app/crm/tasks",
} as const;
