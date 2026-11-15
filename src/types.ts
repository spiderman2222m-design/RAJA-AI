export type AppLanguage = 'en' | 'hi' | 'gu';

export type WorkspaceMode =
  | 'chat'
  | 'voice'
  | 'image'
  | 'video'
  | 'writer'
  | 'code'
  | 'translate'
  | 'admin';

export type ChatMode = 'chat' | 'voice' | 'writer' | 'code' | 'translate';

export type PlanTier = 'free' | 'premium_monthly' | 'premium_yearly';

export interface UsageMap {
  chatCount: number;
  voiceCount: number;
  imageCount: number;
  videoCount: number;
  writerCount: number;
  codeCount: number;
  translateCount: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  plan: PlanTier;
  subscriptionStatus: 'active' | 'cancelled' | 'expired';
  subscriptionBillingCycle: 'none' | 'monthly' | 'yearly';
  subscriptionExpiresAt: string;
  lastPaymentId: string;
  preferredLanguage: AppLanguage;
  usage: UsageMap;
  isBlocked: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  mode: ChatMode;
  language: AppLanguage;
  messageCount: number;
  lastMessagePreview: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  mode: ChatMode;
  language: AppLanguage;
  createdAt?: unknown;
}

export interface CreationRecord {
  id: string;
  userId: string;
  type: 'image' | 'video';
  prompt: string;
  mediaUrl: string;
  aspectRatio: string;
  status: 'completed' | 'failed';
  createdAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  plan: 'premium_monthly' | 'premium_yearly';
  amount: number;
  currency: 'INR' | 'USD';
  provider: 'razorpay_verified' | 'stripe_verified' | 'upi_verified';
  transactionRef: string;
  signature: string;
  status: 'verified';
  createdAt?: unknown;
}

export interface AppSettings {
  id: string;
  freeLimits: UsageMap;
  monthlyPriceInr: number;
  yearlyPriceInr: number;
  merchantUpiId: string;
  updatedBy: string;
  updatedAt?: unknown;
}

export const DEFAULT_FREE_LIMITS: UsageMap = {
  chatCount: 25,
  voiceCount: 10,
  imageCount: 5,
  videoCount: 2,
  writerCount: 15,
  codeCount: 15,
  translateCount: 25,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'global',
  freeLimits: DEFAULT_FREE_LIMITS,
  monthlyPriceInr: 499,
  yearlyPriceInr: 4999,
  merchantUpiId: '6353688361@fam',
  updatedBy: 'system',
};

export const OWNER_ADMIN_EMAIL = 'spiderman2222m@gmail.com';
