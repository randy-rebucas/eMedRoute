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
  /**
   * An own log entry linked to a clinic on MyClinicSoft (the clinic didn't book it): deliveries
   * can go to it. Doesn't make the visit a booking.
   */
  linkedClinicId?: string | null;
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
  /** A clinic from GET /clinics (its name and location replace the typed ones); null unlinks. */
  linkedClinicId?: string | null;
}

/** POST /visits with `clinicId`: a request to the clinic. `date` is "YYYY-MM-DD", `time` one of its slots. */
export interface BookingInput {
  clinicId: string;
  purpose: string;
  date: string;
  time: string;
  notes?: string;
  productIds?: string[];
}

// ── Clinics ──────────────────────────────────────────────────────────────────

/** GET /clinics items: clinics the rep can book. */
export interface Clinic {
  id: string;
  name: string;
  location: string;
  city: string | null;
  /** The clinic added this rep (otherwise it is open to all reps). */
  linked: boolean;
  /** One line per window, from describeWindows: "Tue 15:00–17:00" (English day, clinic time). */
  hours: string[];
  slotMinutes: number;
  maxAdvanceDays: number;
  /** Shown to reps when they book: where to go, what to bring. */
  instructions: string | null;
}

export interface Slot {
  /** "HH:mm", the clinic's local time. */
  time: string;
  /** Approved visits the slot can still take; 0 = full. */
  remaining: number;
}

/** GET /clinics/[id]/slots?date=YYYY-MM-DD */
export interface ClinicSlots {
  clinicId: string;
  date: string;
  timezone: string;
  slotMinutes: number;
  slots: Slot[];
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

// ── Plan and teams ───────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'yearly';

/** A team's plan (teamCoverage on the server). Members are covered while active and members ≤ seats. */
export interface TeamCoverage {
  active: boolean;
  seats: number;
  members: number;
  expiresAt: string | null;
}

/** GET /subscription. Prices come from the platform; never hard-code them. */
export interface Subscription {
  canBookClinics: boolean;
  coveredBy: 'free' | 'individual' | 'team' | null;
  prices: { monthly: number; yearly: number; seatMonthly: number; seatYearly: number; currency: 'PHP' };
  /** The rep fee is ₱0: booking is free for everyone. */
  free: boolean;
  /** Online payment is set up on the server. */
  payable: boolean;
  individual: { billingCycle: BillingCycle; expiresAt: string; active: boolean } | null;
  team: TeamCoverage | null;
}

export interface TeamInvite {
  teamId: string;
  teamName: string;
  invitedBy: string | null;
  invitedAt: string;
}

export interface TeamMemberStats {
  visitsThisMonth: number;
  completedThisMonth: number;
  /** Approved visits from today on. */
  upcoming: number;
  pendingRequests: number;
  lastVisitAt: string | null;
}

/** `members` items (managers only). `id` is the member's rep profile id. */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  role: 'manager' | 'member';
  stats: TeamMemberStats;
}

export interface PendingTeamInvite {
  /** The invited rep's profile id (for withdrawing). */
  id: string;
  name: string;
  email: string;
  invitedAt: string;
}

export interface Team {
  id: string;
  name: string;
  role: 'manager' | 'member';
  /** Managers' names. */
  managers: string[];
  memberCount: number;
  subscription: TeamCoverage;
  /** Managers only. */
  members?: TeamMember[];
  /** Managers only. */
  pendingInvites?: PendingTeamInvite[];
}

/** GET /team */
export interface TeamState {
  invite: TeamInvite | null;
  team: Team | null;
}

/** GET /team/visits items: a member's visit without private notes. */
export type TeamVisit = Omit<Visit, 'notes'> & { member: { id: string; name: string } | null };

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

// ── Deliveries ───────────────────────────────────────────────────────────────

export type DeliveryKind = 'sample' | 'delivery';
export type DeliveryStatus = 'pending' | 'received' | 'rejected' | 'cancelled';

export interface DeliveryLine {
  productId: string;
  /** As the product was when delivered. */
  productName: string;
  strength?: string;
  quantity: number;
  unit: string;
  lotNumber?: string;
  expiryDate?: string;
  /** What the clinic counted on receipt; can differ from `quantity`. */
  receivedQuantity?: number;
  /** Set when the clinic put the line into its stock. */
  inventoryItemId?: string;
}

/** GET /deliveries item (MOBILE_API.md → Deliveries and samples). */
export interface Delivery {
  _id: string;
  visitId: string;
  clinicId: string;
  clinicName: string;
  kind: DeliveryKind;
  status: DeliveryStatus;
  lines: DeliveryLine[];
  note?: string;
  clinicNote?: string;
  respondedAt?: string;
  createdAt: string;
}

/** POST /deliveries. `expiryDate` is "YYYY-MM-DD"; left out, the product's is used. */
export interface DeliveryInput {
  visitId: string;
  kind: DeliveryKind;
  lines: { productId: string; quantity: number; unit: string; lotNumber?: string; expiryDate?: string }[];
  note?: string;
}
