import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';

// Browser client for client-side operations
export const supabase = createBrowserClient(
	env.PUBLIC_SUPABASE_URL || '',
	env.PUBLIC_SUPABASE_ANON_KEY || ''
);

export function getSupabaseServerClient(event: RequestEvent) {
	return createServerClient(env.PUBLIC_SUPABASE_URL || '', env.PUBLIC_SUPABASE_ANON_KEY || '', {
		cookies: {
			getAll: () => {
				return event.cookies.getAll();
			},
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: options.path || '/' });
				});
			}
		}
	});
}
