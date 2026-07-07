export type UserRole = "creator" | "brand" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
  onboardingCompleted: boolean;
  onboardingStep: "change-password" | "welcome" | "questions" | "complete";
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  companyName?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface OnboardingAnswers {
  contentType: string;
  monthlyProjects: string;
  preferredPayment: string;
  biggestChallenge: string;
  hearAbout: string;
}

export const ONBOARDING_QUESTIONS = [
  {
    key: "contentType" as const,
    label: "What type of UGC content do you create most?",
    options: ["Fashion", "Lifestyle", "Beauty", "Tech", "Other"],
  },
  {
    key: "monthlyProjects" as const,
    label: "How many UGC projects do you complete per month?",
    options: ["0–2", "3–5", "6–10", "10+"],
  },
  {
    key: "preferredPayment" as const,
    label: "What is your preferred payment structure?",
    options: ["Flat fee", "Milestones", "Royalty", "Mix of all"],
  },
  {
    key: "biggestChallenge" as const,
    label: "What is your biggest challenge running your UGC business?",
    options: ["Finding clients", "Invoicing", "Contracts", "Pricing", "Other"],
  },
  {
    key: "hearAbout" as const,
    label: "How did you hear about Thesi?",
    options: ["ClothME", "Social media", "Referral", "Other"],
  },
] satisfies Array<{
  key: keyof OnboardingAnswers;
  label: string;
  options: string[];
}>;
