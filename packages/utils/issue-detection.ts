import {
  Issues,
  HtmlParseResult,
  PageSpeedResult,
  ISSUE_SUMMARY_TEMPLATES,
  ISSUE_PRIORITY_ORDER,
} from "@outreach-engine/types";

/**
 * Parse HTML and extract metadata/features
 */
export function parseHtml(html: string): HtmlParseResult {
  const hasViewportMeta = /<meta\s+name=["']viewport["']/i.test(html);
  const hasTitle = /<title[^>]*>[^<]+<\/title>/i.test(html);
  const hasMetaDescription = /<meta\s+name=["']description["']/i.test(html);

  // Extract phone numbers (basic pattern)
  const phonePattern = /\b(\+?[0-9]{1,3}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9})\b/g;
  const phones = html.match(phonePattern) || [];

  // Extract email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailPattern) || [];

  // Extract address patterns (basic)
  const addressPattern =
    /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir)\b/gi;
  const addresses = html.match(addressPattern) || [];

  // Check for contact info (phone, email, or address)
  const hasContactInfo =
    phones.length > 0 || emails.length > 0 || addresses.length > 0;

  // Structural table detection (not for layout)
  const usesTable =
    /<table[^>]*>[\s\S]*?<\/table>/i.test(html) &&
    /<th[^>]*>/i.test(html); // th tag suggests data table

  // jQuery detection
  const usesJQuery = /jquery/i.test(html);

  // Flash detection
  const hasFlash =
    /<object[^>]*>[^<]*<param[^>]*name=["']movie["']/i.test(html) ||
    /<embed[^>]*\.(swf)/i.test(html);

  // Copyright year extraction
  let copyrightYear: number | undefined;
  const copyrightMatch = html.match(
    /[©&copy;]\s*(?:19|20)(\d{2})/i
  );
  if (copyrightMatch) {
    copyrightYear = parseInt("20" + copyrightMatch[1]);
  }

  // PDF menu detection (linked PDF)
  const hasPdfMenu = /href=["'][^"']*\.pdf["']/i.test(html);

  // Broken images detection
  const imgPattern = /<img[^>]+src=["']([^"']+)["']/gi;
  const brokenImages: string[] = [];
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    // Mark external or missing images
    if (!match[1] || match[1].includes("placeholder") || match[1].includes("404")) {
      brokenImages.push(match[1]);
    }
  }

  return {
    hasViewportMeta,
    hasTitle,
    hasMetaDescription,
    hasContactInfo,
    contactInfo: {
      phone: phones,
      email: emails,
      address: addresses,
    },
    usesTable,
    usesJQuery,
    hasFlash,
    copyrightYear,
    hasPdfMenu,
    brokenImages,
  };
}

/**
 * Detect if a URL is social-only (Facebook/Instagram/LinkedIn/Linktree)
 */
export function isSocialOnlyUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const socialDomains = [
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "linktree.com",
    "linktr.ee",
    "tiktok.com",
  ];
  return socialDomains.some((domain) => url.includes(domain));
}

/**
 * Detect SSL/HTTPS issues
 */
export function hasSSLIssue(
  url: string | null | undefined,
  hasValidSSL: boolean | null | undefined
): boolean {
  if (!url) return false;
  // If has valid SSL flag is explicitly false, it's an issue
  if (hasValidSSL === false) return true;
  // If URL is http (not https), it's an issue
  if (url.startsWith("http://")) return true;
  return false;
}

/**
 * Detect mobile responsiveness issues
 */
export function notMobileResponsive(
  hasViewport: boolean | null | undefined,
  pageSpeedData: PageSpeedResult | null | undefined
): boolean {
  if (!hasViewport) return true;
  if (pageSpeedData && !pageSpeedData.hasTapTargets) return true;
  return false;
}

/**
 * Detect performance issues
 */
export function isSlow(pageSpeedData: PageSpeedResult | null | undefined): boolean {
  if (!pageSpeedData) return false;
  // Mobile performance < 50 is slow
  return pageSpeedData.performanceScoreMobile < 50;
}

/**
 * Detect if site is dated
 */
export function isDated(html: HtmlParseResult): boolean {
  // Multiple outdated markers:
  // - Uses table for layout
  // - Uses jQuery 1.x
  // - Has Flash
  // - Footer copyright year is > 3 years old
  if (html.usesTable) return true;
  if (html.usesJQuery) return true;
  if (html.hasFlash) return true;
  if (html.copyrightYear) {
    const currentYear = new Date().getFullYear();
    if (currentYear - html.copyrightYear > 3) return true;
  }
  return false;
}

/**
 * Detect SEO issues from HTML
 */
export function detectSeoIssues(html: HtmlParseResult): string[] {
  const seoIssues: string[] = [];
  if (!html.hasTitle) seoIssues.push("missing_title");
  if (!html.hasMetaDescription) seoIssues.push("missing_meta_description");
  if (html.brokenImages.length > 0) seoIssues.push("broken_images");
  return seoIssues;
}

/**
 * Full issue detection pipeline.
 * Returns structured issues object and prioritized summary.
 */
export function detectIssues(options: {
  website_url: string | null | undefined;
  html: string | null | undefined;
  hasSSL: boolean | null | undefined;
  pageSpeedData: PageSpeedResult | null | undefined;
}): {
  issues: Issues;
  seoIssues: string[];
  issuesSummary: string | null;
} {
  const issues: Issues = {
    no_site: false,
    broken: false,
    no_ssl: false,
    social_only: false,
    not_mobile: false,
    slow: false,
    no_contact: false,
    pdf_menu: false,
    dated: false,
    seo_issues_present: false,
  };

  let seoIssues: string[] = [];

  // Check 1: No website
  if (!options.website_url) {
    issues.no_site = true;
  }

  // Check 2: Social-only website
  if (options.website_url && isSocialOnlyUrl(options.website_url)) {
    issues.social_only = true;
  }

  // Check 3: Website didn't load (broken)
  if (options.website_url && !options.html) {
    issues.broken = true;
  }

  // Parse HTML for remaining checks
  let htmlParsed: HtmlParseResult | null = null;
  if (options.html) {
    htmlParsed = parseHtml(options.html);

    // Check 4: No SSL
    if (hasSSLIssue(options.website_url, options.hasSSL)) {
      issues.no_ssl = true;
    }

    // Check 5: Not mobile responsive
    if (
      notMobileResponsive(
        htmlParsed.hasViewportMeta,
        options.pageSpeedData
      )
    ) {
      issues.not_mobile = true;
    }

    // Check 6: Slow performance
    if (isSlow(options.pageSpeedData)) {
      issues.slow = true;
    }

    // Check 7: No visible contact info
    if (!htmlParsed.hasContactInfo) {
      issues.no_contact = true;
    }

    // Check 8: PDF menu
    if (htmlParsed.hasPdfMenu) {
      issues.pdf_menu = true;
    }

    // Check 9: Dated appearance
    if (isDated(htmlParsed)) {
      issues.dated = true;
    }

    // Check 10: SEO issues
    seoIssues = detectSeoIssues(htmlParsed);
    if (seoIssues.length > 0) {
      issues.seo_issues_present = true;
    }
  }

  // Compute summary: find highest priority issue
  let issuesSummary: string | null = null;
  for (const issueKey of ISSUE_PRIORITY_ORDER) {
    if (issues[issueKey as keyof Issues]) {
      issuesSummary = ISSUE_SUMMARY_TEMPLATES[issueKey as keyof Issues] || null;
      break;
    }
  }

  return { issues, seoIssues, issuesSummary };
}

/**
 * Helper to validate website URL format
 */
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url || !isValidUrl(url)) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
