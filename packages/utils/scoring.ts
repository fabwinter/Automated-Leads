import {
  Lead,
  Audit,
  Issues,
  ScoringInput,
  ScoringOutput,
  BADNESS_WEIGHTS,
  QUALIFICATION_THRESHOLDS,
  ISSUE_PRIORITY_ORDER,
} from "@outreach-engine/types";

/**
 * Compute the revenue signal based on review count and rating.
 * Uses logarithmic scale for review count to apply diminishing returns.
 */
export function calculateRevenueSignal(lead: Lead): number {
  const reviewCount = lead.review_count || 0;
  const rating = lead.rating || 0;
  return Math.log(Math.max(reviewCount, 1) + 1) * rating;
}

/**
 * Compute the badness score from audit issues.
 * Weighted sum of issue flags with a cap at 100.
 * Takes max or weighted sum depending on the number of issues.
 */
export function calculateBadnessScore(
  issues: Issues,
  hasVisualSummary: boolean
): number {
  let totalBadness = 0;

  // Apply weights for each issue
  if (issues.no_site) totalBadness += BADNESS_WEIGHTS.no_site;
  if (issues.broken) totalBadness += BADNESS_WEIGHTS.broken;
  if (issues.no_ssl) totalBadness += BADNESS_WEIGHTS.no_ssl;
  if (issues.social_only) totalBadness += BADNESS_WEIGHTS.social_only;
  if (issues.not_mobile) totalBadness += BADNESS_WEIGHTS.not_mobile;
  if (issues.slow) totalBadness += BADNESS_WEIGHTS.slow;
  if (issues.no_contact) totalBadness += BADNESS_WEIGHTS.no_contact;
  if (issues.pdf_menu) totalBadness += BADNESS_WEIGHTS.pdf_menu;
  if (issues.dated) totalBadness += BADNESS_WEIGHTS.dated;
  if (issues.seo_issues_present) totalBadness += BADNESS_WEIGHTS.seo_issues;

  // If only visual issue (no technical issues), add visual badness
  const hasAnyTechnicalIssue =
    issues.no_site ||
    issues.broken ||
    issues.no_ssl ||
    issues.social_only ||
    issues.not_mobile ||
    issues.slow ||
    issues.no_contact ||
    issues.pdf_menu ||
    issues.dated ||
    issues.seo_issues_present;

  if (!hasAnyTechnicalIssue && hasVisualSummary) {
    totalBadness = BADNESS_WEIGHTS.visual_only;
  }

  // Cap at 100 to keep scoring reasonable
  return Math.min(totalBadness, 100);
}

/**
 * Calculate priority score: revenue_signal * badness
 */
export function calculatePriority(
  lead: Lead,
  audit: Audit
): number {
  const revenueSignal = calculateRevenueSignal(lead);
  const hasVisualSummary = audit.visual_summary ? true : false;
  const badnessScore = calculateBadnessScore(audit.issues, hasVisualSummary);
  return revenueSignal * badnessScore;
}

/**
 * Determine if a lead meets qualification criteria.
 * Criteria:
 * - Rating >= 4.4
 * - Review count >= 50
 * - Has at least one issue (badness > 0)
 */
export function qualifyLead(lead: Lead, audit: Audit): boolean {
  const rating = lead.rating || 0;
  const reviewCount = lead.review_count || 0;
  const hasVisualSummary = audit.visual_summary ? true : false;
  const badnessScore = calculateBadnessScore(audit.issues, hasVisualSummary);

  return (
    rating >= QUALIFICATION_THRESHOLDS.minRating &&
    reviewCount >= QUALIFICATION_THRESHOLDS.minReviewCount &&
    badnessScore > 0
  );
}

/**
 * Compute full scoring output for a lead.
 */
export function scoreLeadFull(input: ScoringInput): ScoringOutput {
  const revenueSignal = calculateRevenueSignal(input.lead);
  const hasVisualSummary = input.audit.visual_summary ? true : false;
  const badnessScore = calculateBadnessScore(input.audit.issues, hasVisualSummary);
  const priority = revenueSignal * badnessScore;
  const isQualified = qualifyLead(input.lead, input.audit);

  return {
    revenueSignal,
    badnessScore,
    priority,
    isQualified,
  };
}

/**
 * Sort leads by priority (highest first).
 */
export function sortLeadsByPriority(
  leads: Lead[]
): Lead[] {
  return [...leads].sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * Filter leads to only qualified ones.
 */
export function filterQualifiedLeads(
  leads: Lead[],
  audits: Map<string, Audit>
): Lead[] {
  return leads.filter((lead) => {
    const audit = audits.get(lead.id);
    if (!audit) return false;
    return qualifyLead(lead, audit);
  });
}

/**
 * Get the highest-priority issue key for an issues object.
 * Returns the first issue found in priority order.
 */
export function getHighestPriorityIssue(issues: Issues): keyof Issues | null {
  for (const issueKey of ISSUE_PRIORITY_ORDER) {
    if (issues[issueKey]) {
      return issueKey;
    }
  }
  return null;
}
