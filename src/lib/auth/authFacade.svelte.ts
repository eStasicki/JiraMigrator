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

	async function fetchProfile(userId: string) {
		console.log('AuthFacade: fetchProfile started for', userId);
		try {
			const query = supabase.from('profiles').select('*').eq('id', userId).single();
			const { data, error } = await requestWithTimeout(query, 5000, 'fetchProfile');

			console.log('AuthFacade: fetchProfile result', { data, error });

			if (!error && data) {
				state.profile = data as Profile;
			} else {
				console.warn('AuthFacade: fetchProfile failed or no data', error);
			}
		} catch (e) {
			console.error('AuthFacade: fetchProfile exception', e);
			// If we timeout or fail, we stop loading
		} finally {
			console.log('AuthFacade: fetchProfile completed');
		}
	}

	// Initialize state
	// Initialize state
	// Initialize state
	if (browser) {
		console.log('AuthFacade: Initializing in browser...');

		// Note: We removed the global safety timeout because individual requests now have timeouts.

		supabase.auth
			.getSession()
			.then(async ({ data: { session }, error }) => {
				console.log('AuthFacade: getSession result', { session: !!session, error });
				if (error) {
					console.error('AuthFacade: getSession error', error);
				}

				try {
					state.session = session;
					state.user = session?.user ?? null;
					if (state.user) {
						console.log('AuthFacade: Fetching profile for user', state.user.id);
						await fetchProfile(state.user.id);
						console.log('AuthFacade: Profile fetched');
					}
				} catch (e) {
					console.error('AuthFacade: Error in getSession processing', e);
				} finally {
					console.log('AuthFacade: Setting isLoading = false (getSession)');
					state.isLoading = false;
				}
			})
			.catch((err) => {
				console.error('AuthFacade: Critical error in getSession promise', err);
				state.isLoading = false;
			});

		supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('AuthFacade: onAuthStateChange event:', event, { session: !!session });
			try {
				state.session = session;
				state.user = session?.user ?? null;
				console.log('AuthFacade: Current user state:', state.user ? state.user.id : 'null');

				if (state.user) {
					// Only fetch profile if not already present or if distinct user?
					// For now keep it simple but safe
					await fetchProfile(state.user.id);
				} else {
					state.profile = null;
				}
			} catch (e) {
				console.error('AuthFacade: Error in onAuthStateChange processing', e);
			} finally {
				// Only turn off loading if it was loading
				if (state.isLoading) {
					console.log('AuthFacade: Setting isLoading = false (onAuthStateChange)');
					state.isLoading = false;
				}
			}
		});
	}

	async function signInWithPassword(email: string, password: string) {
		state.isLoading = true;
		state.error = null;

		// Support simple username login for development
		const finalEmail = email.includes('@') ? email : `${email}@local.test`;

		const { data, error } = await supabase.auth.signInWithPassword({
			email: finalEmail,
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

		console.log('AuthFacade: updateProfile called with', Object.keys(updates));
		if (updates.settings) {
			console.log(
				'AuthFacade: updating settings payload size:',
				JSON.stringify(updates.settings).length
			);
		}

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
			const { data, error } = await requestWithTimeout(query, 10000, 'updateProfile');

			console.log('AuthFacade: updateProfile response', { data: !!data, error });

			if (error) {
				console.error('AuthFacade: updateProfile failed', error);
				state.error = error.message;
			} else {
				console.log('AuthFacade: updateProfile success, updating state');
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
