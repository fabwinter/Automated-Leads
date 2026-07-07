import type { PageSpeedResult } from "@outreach-engine/types";

export class PageSpeedClient {
  private apiKey: string;
  private readonly API_URL =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Run PageSpeed Insights for both mobile and desktop strategies.
   * Extract performance scores and key audits (viewport, tap-targets).
   */
  async analyze(url: string): Promise<PageSpeedResult> {
    const [mobileResult, desktopResult] = await Promise.all([
      this.runPageSpeed(url, "mobile"),
      this.runPageSpeed(url, "desktop"),
    ]);

    return {
      performanceScoreMobile: mobileResult.performanceScore,
      performanceScoreDesktop: desktopResult.performanceScore,
      hasViewport: mobileResult.hasViewport,
      hasTapTargets: mobileResult.hasTapTargets,
    };
  }

  /**
   * Run PageSpeed for a single strategy (mobile or desktop).
   */
  private async runPageSpeed(
    url: string,
    strategy: "mobile" | "desktop"
  ): Promise<{
    performanceScore: number;
    hasViewport: boolean;
    hasTapTargets: boolean;
  }> {
    const queryParams = new URLSearchParams({
      url: url,
      strategy: strategy,
      category: "performance",
      category: "seo",
      key: this.apiKey,
    });

    const response = await fetch(
      `${this.API_URL}?${queryParams.toString()}`
    );

    if (!response.ok) {
      // Graceful degradation: return neutral scores on error
      console.error(`PageSpeed error for ${url} (${strategy}): ${response.status}`);
      return {
        performanceScore: 50,
        hasViewport: true,
        hasTapTargets: true,
      };
    }

    const data = await response.json();
    const lighthouseResult = data.lighthouseResult;

    if (!lighthouseResult) {
      return {
        performanceScore: 50,
        hasViewport: true,
        hasTapTargets: true,
      };
    }

    // Extract performance score (0-100)
    const performanceScore = Math.round(
      (lighthouseResult.categories?.performance?.score || 0.5) * 100
    );

    // Check viewport audit (available in performance category)
    const viewportAudit = lighthouseResult.audits?.["viewport"];
    const hasViewport = viewportAudit?.score === 1 || false;

    // Check tap-targets audit
    const tapTargetsAudit = lighthouseResult.audits?.["tap-targets"];
    const hasTapTargets = tapTargetsAudit?.score === 1 || false;

    return {
      performanceScore,
      hasViewport,
      hasTapTargets,
    };
  }
}

export function createPageSpeedClient(apiKey: string) {
  return new PageSpeedClient(apiKey);
}
