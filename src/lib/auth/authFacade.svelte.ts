import { supabase } from '$lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import type { AppSettings } from '$lib/stores/settings.svelte';

export interface Profile {
	id: string;
	username: string | null;
	full_name: string | null;
	avatar_url: string | null;
	settings: AppSettings;
}

export interface AuthState {
	user: User | null;
	session: Session | null;
	profile: Profile | null;
	isLoading: boolean;
	error: string | null;
}

function createAuthFacade() {
	const state = $state<AuthState>({
		user: null,
		session: null,
		profile: null,
		isLoading: true,
		error: null
	});

	// Timeout helper
	function requestWithTimeout<T>(
		promise: PromiseLike<T>,
		ms: number = 10000,
		label: string
	): Promise<T> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error(`Request timeout: ${label} took longer than ${ms}ms`));
			}, ms);

			Promise.resolve(promise)
				.then((res) => {
					clearTimeout(timeoutId);
					resolve(res);
				})
				.catch((err) => {
					clearTimeout(timeoutId);
					reject(err);
				});
		});
	}

	let isFetchingProfile = false;

	async function fetchProfile(userId: string) {
		if (isFetchingProfile) return;
		isFetchingProfile = true;

		const MAX_RETRIES = 2;
		let attempt = 0;

		try {
			while (attempt < MAX_RETRIES) {
				try {
					const query = supabase.from('profiles').select('*').eq('id', userId).single();
					const { data, error } = await requestWithTimeout(query, 15000, 'fetchProfile');

					if (error) {
						// PostgREST error for "no rows found" is PGRST116
						if (error.code === 'PGRST116') {
							// Profile doesn't exist yet, which is fine for first-time users
							return;
						}
						throw error;
					}

					if (data) {
						state.profile = data as Profile;
						return; // Success
					}
				} catch (e) {
					attempt++;
					if (attempt >= MAX_RETRIES) {
						console.error(`AuthFacade: fetchProfile failed after ${MAX_RETRIES} attempts:`, e);
					} else {
						// Wait a bit before retry
						await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
					}
				}
			}
		} finally {
			isFetchingProfile = false;
		}
	}

	if (browser && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
		state.isLoading = false;
	} else if (browser) {
		supabase.auth
			.getSession()
			.then(async ({ data: { session }, error }) => {
				if (error) {
					console.error('AuthFacade: getSession error', error);
				}

				try {
					state.session = session;
					state.user = session?.user ?? null;
					state.isLoading = false; // Move this BEFORE fetching profile to unblock UI

					if (state.user) {
						fetchProfile(state.user.id);
					}
				} catch (e) {
					console.error('AuthFacade: Error in getSession processing', e);
					state.isLoading = false;
				}
			})
			.catch((err) => {
				console.error('AuthFacade: Critical error in getSession promise', err);
				state.isLoading = false;
			});

		supabase.auth.onAuthStateChange(async (event, session) => {
			try {
				state.session = session;
				state.user = session?.user ?? null;

				// Ensure loading is off if we resolved a session/user change
				if (state.isLoading) {
					state.isLoading = false;
				}

				if (state.user) {
					fetchProfile(state.user.id);
				} else {
					state.profile = null;
				}
			} catch (e) {
				console.error('AuthFacade: Error in onAuthStateChange processing', e);
				state.isLoading = false;
			}
		});
	}

	async function signInWithPassword(email: string, password: string) {
		state.isLoading = true;
		state.error = null;

		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password
		});
		if (error) {
			state.error = error.message;
			state.isLoading = false;
			return { data: null, error };
		}
		state.user = data.user;
		state.session = data.session;
		state.isLoading = false;
		return { data, error: null };
	}

	async function signUp(email: string, password: string) {
		state.isLoading = true;
		state.error = null;
		const { data, error } = await supabase.auth.signUp({ email, password });
		if (error) {
			state.error = error.message;
			state.isLoading = false;
			return { data: null, error };
		}
		state.user = data.user;
		state.session = data.session;
		state.isLoading = false;
		return { data, error: null };
	}

	async function updateProfile(updates: Partial<Profile>) {
		if (!state.user) return { error: new Error('Not authenticated') };

		// Do not block UI with global loading state for background updates
		// state.isLoading = true;
		try {
			const query = supabase
				.from('profiles')
				.update({
					...updates,
					updated_at: new Date().toISOString()
				})
				.eq('id', state.user.id)
				.select()
				.single();

			// Use a slightly longer timeout for writes
			const { data, error } = await requestWithTimeout(query, 15000, 'updateProfile');

			if (error) {
				console.error('AuthFacade: updateProfile failed', error);
				state.error = error.message;
			} else {
				state.profile = data as Profile;
			}
			return { data, error };
		} catch (e) {
			console.error('AuthFacade: updateProfile exception/timeout', e);
			// Cast error to match anticipated shape if needed, or just return error
			return { data: null, error: e as any };
		}
	}

	async function signInWithGoogle() {
		state.isLoading = true;
		state.error = null;
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/`
			}
		});
		if (error) {
			state.error = error.message;
			state.isLoading = false;
			return { data: null, error };
		}
		// Note: The page will redirect, so isLoading will remain true until redirect
		return { data, error: null };
	}

	async function signOut() {
		state.isLoading = true;
		const { error } = await supabase.auth.signOut();
		if (error) {
			state.error = error.message;
		} else {
			state.user = null;
			state.session = null;
			state.profile = null;
			state.error = null;
		}
		state.isLoading = false;
	}

	return {
		get user() {
			return state.user;
		},
		get session() {
			return state.session;
		},
		get profile() {
			return state.profile;
		},
		get isLoading() {
			return state.isLoading;
		},
		get error() {
			return state.error;
		},
		get isAuthenticated() {
			return !!state.user;
		},
		signInWithPassword,
		signInWithGoogle,
		signUp,
		signOut,
		updateProfile,
		supabase
	};
}

export const authFacade = createAuthFacade();
