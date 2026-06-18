import { z } from 'zod';

/**
 * Schema for variables that must be available in both browser and server bundles.
 * Anything prefixed with NEXT_PUBLIC_ is inlined by Next at build time.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_BACKEND_URL: z.string().url(),
});

/**
 * Schema for server-only variables. Optional because not every server path needs
 * write access - only privileged code paths should require this key.
 *
 * Note: Next inlines empty `KEY=` lines as the empty string, not undefined. We
 * pre-coerce '' -> undefined before validating so an empty value is treated as
 * "not set" rather than as a too-short value.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

function nullifyEmpty(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

/** True when this module is evaluated in the browser bundle. */
const isBrowser = typeof window !== 'undefined';

function parsePublic() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Missing or invalid public env vars:\n${issues}`);
  }
  return parsed.data;
}

function parseServer() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: nullifyEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server env vars:\n${issues}`);
  }
  return parsed.data;
}

/** Validated environment, split by exposure (public vs. server-only). */
export const env = {
  ...parsePublic(),
  ...(isBrowser ? {} : parseServer()),
} as z.infer<typeof publicSchema> & z.infer<typeof serverSchema>;

/** Compile-time type of the merged env shape. */
export type Env = typeof env;
