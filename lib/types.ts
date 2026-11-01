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

// ── Visits ───────────────────────────────────────────────────────────────────

/** Mirrors clinic-management lib/rep-visit-rules.ts REP_VISIT_STATUSES exactly. */
export const REP_VISIT_STATUSES = ['requested', 'scheduled', 'declined', 'completed', 'cancelled', 'no-show'] as const;
export type RepVisitStatus = (typeof REP_VISIT_STATUSES)[number];

/** Statuses a rep may set on their own (not clinic-linked) log entries (PERSONAL_VISIT_STATUSES). */
export const PERSONAL_VISIT_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
export type PersonalVisitStatus = (typeof PERSONAL_VISIT_STATUSES)[number];

/** A booked visit still waiting on, or approved by, the clinic (ACTIVE_CLINIC_STATUSES). */
export const ACTIVE_CLINIC_STATUSES: readonly RepVisitStatus[] = ['requested', 'scheduled'];

/** GET /visits items and GET /visits/[id]. */
export interface Visit {
  _id: string;
  /** Set for visits booked with a clinic on MyClinicSoft; unset on the rep's own log entries. */
  clinicId?: string | null;
  clinicName: string;
  clinicLocation: string;
  /** Shown to the clinic. */
  purpose: string;
  /** A calendar day stored as UTC midnight: use the first 10 characters, never convert. */
  date: string;
  /** "HH:mm" in the clinic's timezone. */
  time: string;
  /** Minutes. */
  duration: number;
  status: RepVisitStatus;
  /** Private to the rep: hidden from the clinic and from team managers. */
  notes?: string;
  productIds?: string[];
  /** The clinic's own words: a decline reason, or instructions with an approval. */
  clinicNote?: string;
  respondedAt?: string;
  checkedInAt?: string | null;
  cancelledBy?: 'rep' | 'clinic';
  createdAt?: string;
  updatedAt?: string;
}

/** POST /visits for an own log entry. `date` is "YYYY-MM-DD". */
export interface LogEntryInput {
  clinicName: string;
  clinicLocation: string;
  purpose: string;
  date: string;
  time: string;
  duration?: number;
  status?: PersonalVisitStatus;
  notes?: string;
  productIds?: string[];
}

// ── Products ─────────────────────────────────────────────────────────────────

export const PRODUCT_STATUSES = ['active', 'discontinued', 'inactive'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** GET /products items and GET /products/[id]. */
export interface Product {
  _id: string;
  name: string;
  category: string;
  manufacturer: string;
  description: string;
  dosage?: string;
  strength?: string;
  packaging: string;
  /** Stored as UTC midnight of the day. */
  expiryDate: string;
  status: ProductStatus;
  specifications?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** POST /products and PUT /products/[id] (PUT takes the full object). `expiryDate` is "YYYY-MM-DD". */
export interface ProductInput {
  name: string;
  category: string;
  manufacturer: string;
  description: string;
  packaging: string;
  expiryDate: string;
  dosage?: string;
  strength?: string;
  status?: ProductStatus;
}

// ── Home ─────────────────────────────────────────────────────────────────────

/** GET /dashboard. "This month" is the UTC calendar month. */
export interface Dashboard {
  profile: Pick<RepProfile, 'firstName' | 'lastName' | 'company' | 'title' | 'territory' | 'status'> & { isActivated?: boolean };
  stats: {
    totalVisits: number;
    /** Leaves out cancelled and declined visits. */
    visitsThisMonth: number;
    completedThisMonth: number;
    upcomingVisits: number;
    /** Clinic bookings from today on that the clinic hasn't answered. */
    pendingRequests: number;
    activeProducts: number;
    /** Active products that expire within 30 days. */
    expiringProducts: number;
    openSupportRequests: number;
  };
  /** Up to 5 scheduled visits from today on, soonest first. */
  nextVisits: Pick<
    Visit,
    '_id' | 'clinicId' | 'clinicName' | 'clinicLocation' | 'purpose' | 'date' | 'time' | 'duration' | 'status' | 'checkedInAt'
  >[];
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
