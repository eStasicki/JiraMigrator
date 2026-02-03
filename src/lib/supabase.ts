import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Browser client for client-side operations
export const supabase = createBrowserClient(
	PUBLIC_SUPABASE_URL || '',
	PUBLIC_SUPABASE_ANON_KEY || ''
);

export function getSupabaseServerClient(event: {
	cookies: {
		get: (name: string) => string | undefined;
		set: (name: string, value: string, options: any) => void;
		delete: (name: string, options: any) => void;
	};
}) {
	return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => {
				return [];
			},
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, options);
				});
			}
		}
	});
}
