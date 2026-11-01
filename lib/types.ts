/**
 * API response types, from MOBILE_API.md → "Medical representative app" and the route handlers
 * under clinic-management/app/api/medical-representatives. Dates arrive as ISO strings.
 */

import type { TokenPair } from './api';

/** `medicalRepresentative` on a successful sign-in (`repSummary` on the server). */
export interface RepSummary {
  id: string;
  name: string;
  company: string;
  email: string;
}

/** POST /auth/token and POST /auth/2fa. */
export interface RepTokenResponse extends TokenPair {
  medicalRepresentative: RepSummary;
}

/** POST /auth/token when two-step sign-in is on: a 401 with this body. */
export interface TwoFactorChallenge {
  requires2fa: true;
  pendingToken: string;
}

export type RepStatus = 'active' | 'inactive' | 'on-leave';

/** GET /session: the rep's own profile, with payment and internal fields removed. */
export interface RepProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  territory?: string;
  title?: string;
  bio?: string;
  profileImage?: string | null;
  status: RepStatus;
  isActivated?: boolean;
  /** Default true on the server. */
  notificationsEnabled?: boolean;
  /** Default true on the server. */
  emailNotifications?: boolean;
  teamId?: string | null;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** PUT /profile body. `profileImage`: base64 data URI ≤ 2 MB (jpeg/png/gif/webp), or null to remove. */
export interface RepProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  territory?: string;
  title?: string;
  bio?: string;
  profileImage?: string | null;
}

/** POST /change-password with Bearer auth: a new token pair for this device. */
export type ChangePasswordResponse = TokenPair & { success: true; message?: string };

export const SUPPORT_CATEGORIES = ['general', 'technical', 'billing', 'account', 'onboarding', 'other'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export type SupportStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

export interface SupportReply {
  _id: string;
  authorType: 'platform' | 'requester';
  authorEmail: string;
  message: string;
  createdAt: string;
}

/** GET /support items. */
export interface SupportRequest {
  _id: string;
  /** "SR-<id>". */
  reference: string;
  email: string;
  subject: string;
  category: SupportCategory;
  message: string;
  status: SupportStatus;
  replies?: SupportReply[];
  createdAt: string;
  updatedAt: string;
}

/** POST /support. */
export interface SupportCreateResponse {
  success: true;
  message?: string;
  reference: string;
}
