export class R2Storage {
  private bucket: R2Bucket;
  private accountId: string;

  constructor(bucket: R2Bucket, accountId: string) {
    this.bucket = bucket;
    this.accountId = accountId;
  }

  /**
   * Upload a screenshot to R2 and return the stable URL.
   */
  async uploadScreenshot(
    leadId: string,
    imageBuffer: ArrayBuffer,
    contentType: string = "image/png"
  ): Promise<string> {
    const key = `screenshots/${leadId}.png`;

    await this.bucket.put(key, imageBuffer, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000", // 1 year
      },
    });

    return this.getPublicUrl(key);
  }

  /**
   * Upload HTML demo to R2 and return the stable URL.
   */
  async uploadDemo(
    slug: string,
    htmlContent: string
  ): Promise<string> {
    const key = `demos/${slug}.html`;

    await this.bucket.put(key, htmlContent, {
      httpMetadata: {
        contentType: "text/html",
        cacheControl: "public, max-age=31536000",
      },
    });

    return this.getPublicUrl(key);
  }

  /**
   * Download a file from R2.
   */
  async download(key: string): Promise<ArrayBuffer | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return await object.arrayBuffer();
  }

  /**
   * Get public URL for an R2 object.
   */
  private getPublicUrl(key: string): string {
    // Assumes bucket is public or has appropriate CORS/public access
    // URL format: https://{bucket}.{account-id}.r2.cloudflarestorage.com/{key}
    // Or via custom domain: https://r2.example.com/{key}
    // For now, using the standard R2 format - update domain as needed
    return `https://${this.bucket.name}.${this.accountId}.r2.cloudflarestorage.com/${key}`;
  }

  /**
   * Check if an object exists.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const object = await this.bucket.head(key);
      return !!object;
    } catch {
      return false;
    }
  }

  /**
   * Delete an object from R2.
   */
  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}

export function createR2Storage(bucket: R2Bucket, accountId: string) {
  return new R2Storage(bucket, accountId);
}
