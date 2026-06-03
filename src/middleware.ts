import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

/** Edge middleware: refresh the Supabase auth session on every dynamic request. */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match every path except:
     *   - _next/static (build output)
     *   - _next/image (next/image loader)
     *   - favicon.ico
     *   - any static asset (svg, png, jpg, jpeg, gif, webp, ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
