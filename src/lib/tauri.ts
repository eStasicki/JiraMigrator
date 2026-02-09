import { browser } from '$app/environment';

export function isTauri(): boolean {
	return browser && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
