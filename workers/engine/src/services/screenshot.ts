/**
 * Screenshot service using Cloudflare Browser Rendering.
 * Captures full-page mobile screenshots (375px width).
 * Returns screenshot as ArrayBuffer for R2 upload.
 */

export class ScreenshotService {
  private browser: any; // Puppeteer-like browser instance

  constructor(browser?: any) {
    this.browser = browser;
  }

  /**
   * Capture a website screenshot using Browser Rendering.
   * This uses Cloudflare's native Puppeteer binding when available,
   * or falls back to the REST API.
   */
  async captureScreenshot(
    url: string,
    timeout: number = 10000
  ): Promise<ArrayBuffer | null> {
    try {
      // When running in Cloudflare Worker, env.BROWSER is available
      // if Browser Rendering is enabled. Fall back to REST API if not.
      if (this.browser) {
        return await this.captureWithPuppeteer(url, timeout);
      } else {
        return await this.captureWithRestAPI(url);
      }
    } catch (error) {
      console.error(`Screenshot capture failed for ${url}:`, error);
      return null;
    }
  }

  /**
   * Capture using Puppeteer binding (native Cloudflare Browser Rendering).
   */
  private async captureWithPuppeteer(
    url: string,
    timeout: number
  ): Promise<ArrayBuffer | null> {
    let browser: any;
    try {
      // In Cloudflare Workers, env.BROWSER is the Puppeteer browser instance
      browser = this.browser;

      const page = await browser.newPage();

      // Set mobile viewport (iPhone 12)
      await page.setViewport({
        width: 375,
        height: 812,
        deviceScaleFactor: 2,
      });

      // Navigate with timeout
      await Promise.race([
        page.goto(url, { waitUntil: "networkidle2" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Navigation timeout")), timeout)
        ),
      ]);

      // Capture full-page screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: "png",
      });

      await page.close();
      return screenshot;
    } catch (error) {
      console.error("Puppeteer screenshot failed:", error);
      return null;
    }
  }

  /**
   * Capture using REST API (fallback).
   * Cloudflare Browser Rendering REST API endpoint.
   */
  private async captureWithRestAPI(url: string): Promise<ArrayBuffer | null> {
    try {
      // Note: This requires additional setup; for MVP, we'll return null
      // and handle it gracefully in audit flow
      console.warn("REST API screenshot not yet implemented, returning null");
      return null;
    } catch (error) {
      console.error("REST API screenshot failed:", error);
      return null;
    }
  }

  /**
   * Convert screenshot ArrayBuffer to data URL for testing/preview.
   */
  static bufferToDataUrl(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return "data:image/png;base64," + btoa(binary);
  }
}

export function createScreenshotService(browser?: any) {
  return new ScreenshotService(browser);
}
