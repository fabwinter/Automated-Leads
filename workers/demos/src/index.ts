/**
 * Demos Worker: Wildcard route handler for serving templated demos.
 * Routes like {slug}.demos.example.com/* fetch {slug}.html from R2.
 */

export interface Env {
  R2: R2Bucket;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Extract slug from host (format: {slug}.demos.example.com)
      const hostname = url.hostname;
      const parts = hostname.split(".");

      if (parts.length < 3 || !parts.includes("demos")) {
        return new Response("Invalid demo URL format", { status: 400 });
      }

      // Get slug (everything before "demos")
      const demoIndex = parts.indexOf("demos");
      const slug = parts.slice(0, demoIndex).join(".");

      if (!slug) {
        return new Response("No demo slug provided", { status: 400 });
      }

      // Fetch HTML from R2
      const key = `demos/${slug}.html`;
      const object = await env.R2.get(key);

      if (!object) {
        return new Response("Demo not found", { status: 404 });
      }

      // Return HTML with appropriate headers
      const text = await object.text();
      return new Response(text, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=31536000", // 1 year
          "X-Robots-Tag": "noindex", // Prevent search indexing of demo sites
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Demo server error:", errorMsg);

      return new Response("Internal server error", {
        status: 500,
      });
    }
  },
};
