import { z } from "zod";

// ============= Database Models =============

export const IssuesSchema = z.object({
  no_site: z.boolean().default(false),
  broken: z.boolean().default(false),
  no_ssl: z.boolean().default(false),
  social_only: z.boolean().default(false),
  not_mobile: z.boolean().default(false),
  slow: z.boolean().default(false),
  no_contact: z.boolean().default(false),
  pdf_menu: z.boolean().default(false),
  dated: z.boolean().default(false),
  seo_issues_present: z.boolean().default(false),
});

export type Issues = z.infer<typeof IssuesSchema>;

export const ConfigSchema = z.object({
  vision_audit: z.boolean().default(false),
  ssl_check: z.boolean().default(true),
  seo_basics: z.boolean().default(true),
  social_only_check: z.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;

export const RunSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  niche: z.string().min(1),
  city: z.string().min(1),
  config: ConfigSchema,
  status: z.enum(["running", "completed", "failed"]).default("running"),
  discovered_count: z.number().int().nonnegative().default(0),
  audited_count: z.number().int().nonnegative().default(0),
  error_message: z.string().nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Run = z.infer<typeof RunSchema>;

export const LeadSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  place_id: z.string(),
  name: z.string().min(1),
  niche: z.string(),
  city: z.string(),
  rating: z.number().min(0).max(5).nullable().default(null),
  review_count: z.number().int().nonnegative().default(0),
  website_url: z.string().url().nullable().default(null),
  phone: z.string().nullable().default(null),
  email: z.string().email().nullable().default(null),
  instagram: z.string().nullable().default(null),
  photo_refs: z.array(z.string()).default([]),
  status: z
    .enum([
      "discovered",
      "audited",
      "qualified",
      "demo_ready",
      "drafted",
      "sent",
      "replied",
      "dead",
    ])
    .default("discovered"),
  priority: z.number().nonnegative().default(0),
  discovered_at: z.string().datetime(),
  refreshed_at: z.string().datetime(),
});

export type Lead = z.infer<typeof LeadSchema>;

export const AuditSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  pagespeed_mobile: z.number().int().min(0).max(100).nullable(),
  pagespeed_desktop: z.number().int().min(0).max(100).nullable(),
  has_viewport: z.boolean().nullable(),
  has_ssl: z.boolean().nullable(),
  is_social_only: z.boolean().nullable(),
  seo_issues: z
    .array(
      z.object({
        field: z.string(),
        issue: z.string(),
      })
    )
    .default([]),
  issues: IssuesSchema.default({}),
  issue_summary: z.string().nullable(),
  screenshot_url: z.string().url().nullable(),
  visual_summary: z.string().nullable(),
  checks_run: z.record(z.boolean()).default({}),
  audited_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Audit = z.infer<typeof AuditSchema>;

export const TemplateSchema = z.object({
  id: z.string().uuid(),
  niche: z.string().min(1),
  direction: z.string().nullable(),
  storage_key: z.string().nullable(),
  reference_images: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Template = z.infer<typeof TemplateSchema>;

export const DemoSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  template_id: z.string().uuid().nullable(),
  slug: z.string().nullable(),
  storage_key: z.string().nullable(),
  deploy_url: z.string().url().nullable(),
  video_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Demo = z.infer<typeof DemoSchema>;

export const OutreachSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  channel: z.enum(["email", "instagram"]).default("email"),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  status: z
    .enum(["draft", "approved", "sent", "replied", "bounced"])
    .default("draft"),
  sent_at: z.string().datetime().nullable(),
  follow_up_at: z.string().datetime().nullable(),
  reply_body: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Outreach = z.infer<typeof OutreachSchema>;

// ============= API Request/Response Schemas =============

export const DiscoverRequestSchema = z.object({
  run_id: z.string().uuid(),
  niche: z.string().min(1),
  city: z.string().min(1),
});

export type DiscoverRequest = z.infer<typeof DiscoverRequestSchema>;

export const DiscoverResponseSchema = z.object({
  status: z.enum(["queued", "error"]),
  run_id: z.string().uuid().optional(),
  message: z.string().optional(),
});

export type DiscoverResponse = z.infer<typeof DiscoverResponseSchema>;

export const CreateRunRequestSchema = z.object({
  niche: z.string().min(1),
  city: z.string().min(1),
  config: ConfigSchema.partial().optional(),
});

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;

// ============= Google Places API Types =============

export const PlaceSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  websiteUri: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  photos: z
    .array(
      z.object({
        name: z.string(),
        widthPx: z.number(),
        heightPx: z.number(),
      })
    )
    .optional(),
});

export type Place = z.infer<typeof PlaceSchema>;

// ============= Audit-Related Types =============

export interface HtmlParseResult {
  hasViewportMeta: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasContactInfo: boolean;
  contactInfo: {
    phone?: string[];
    email?: string[];
    address?: string[];
  };
  usesTable: boolean;
  usesJQuery: boolean;
  hasFlash: boolean;
  copyrightYear?: number;
  hasPdfMenu: boolean;
  brokenImages: string[];
}

export interface PageSpeedResult {
  performanceScoreMobile: number;
  performanceScoreDesktop: number;
  hasViewport: boolean;
  hasTapTargets: boolean;
}

// ============= Scoring Types =============

export interface ScoringInput {
  lead: Lead;
  audit: Audit;
}

export interface ScoringOutput {
  revenueSignal: number;
  badnessScore: number;
  priority: number;
  isQualified: boolean;
}

// ============= Scoring Constants =============

export const BADNESS_WEIGHTS = {
  no_site: 100,
  broken: 90,
  no_ssl: 65,
  social_only: 60,
  not_mobile: 55,
  slow: 40,
  no_contact: 30,
  pdf_menu: 25,
  dated: 20,
  seo_issues: 15,
  visual_only: 45, // when no technical issues but visual summary exists
};

export const QUALIFICATION_THRESHOLDS = {
  minRating: 4.4,
  minReviewCount: 50,
};

export const ISSUE_PRIORITY_ORDER = [
  "no_site",
  "broken",
  "no_ssl",
  "social_only",
  "not_mobile",
  "slow",
  "no_contact",
  "pdf_menu",
  "dated",
  "seo_issues",
] as const;

export const ISSUE_SUMMARY_TEMPLATES: Record<keyof Issues, string> = {
  no_site:
    "You don't have a website at all — customers who search for you find nothing.",
  broken: "Your site doesn't load.",
  no_ssl:
    "Your site shows a 'Not Secure' warning in every browser — that's the first thing a new customer sees.",
  social_only:
    "Your 'website' is just a Facebook page — customers can't tell if you're still open, and you don't show up when people Google you.",
  not_mobile:
    "Your site doesn't work properly on phones — that's where most of your customers are.",
  slow: "Your site takes several seconds to load; most visitors leave before it does.",
  no_contact:
    "Someone can't even find your phone number on your own site.",
  pdf_menu: "Your menu is a PDF nobody opens on a phone.",
  dated: "Your site looks older than your business is.",
  seo_issues_present:
    "Your site is missing key information that Google needs to rank you.",
};
