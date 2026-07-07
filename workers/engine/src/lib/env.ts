import { z } from "zod";

export const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  GOOGLE_PAGESPEED_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  ENVIRONMENT: z.enum(["development", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(env: Record<string, string | undefined>): Env {
  const validated = EnvSchema.safeParse(env);
  if (!validated.success) {
    throw new Error(`Invalid environment variables: ${validated.error.message}`);
  }
  return validated.data;
}
