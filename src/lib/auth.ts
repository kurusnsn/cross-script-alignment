import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from '@/lib/devAuth';
import { AUTH_SECRET } from '@/lib/authSecret';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

function getDevHeaderUser(request: NextRequest): AuthenticatedUser | null {
  if (!DEV_MOCK_AUTH_ENABLED) return null;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  if (token === DEV_MOCK_USER.accessToken) {
    return { id: DEV_MOCK_USER.id, email: DEV_MOCK_USER.email };
  }

  return null;
}

/**
 * Validate Supabase session and extract user info.
 * Returns the user or null if authentication fails.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const token = await getToken({
      req: request,
      secret: AUTH_SECRET,
    });

    if (token?.sub || token?.id) {
      return {
        id: String(token.sub || token.id),
        email: (token.email as string) || '',
      };
    }

    // Fallback for development/testing if header is present
    return getDevHeaderUser(request);
  } catch (error) {
    console.error('Auth verification failed:', error);
    return getDevHeaderUser(request);
  }
}

/**
 * Helper to return 401 Unauthorized response
 */
export function unauthorizedResponse(message: string = 'Authentication required') {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Require authentication - returns user or throws 401
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw unauthorizedResponse();
  }
  return user;
}
