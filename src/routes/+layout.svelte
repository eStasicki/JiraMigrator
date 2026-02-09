<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import { settingsStore, type AppSettings } from '$lib/stores/settings.svelte';
	import { authFacade } from '$lib/auth/authFacade.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Loader2 } from 'lucide-svelte';
	import { isTauri } from '$lib/tauri';

	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let isDesktop = $state(false);

	$effect(() => {
		isDesktop = isTauri();
	});

	$effect(() => {
		if (isDesktop) return;

		if (!authFacade.isLoading) {
			if (!authFacade.user && $page.url.pathname !== '/login') {
				goto('/login');
			}
			if (authFacade.user && $page.url.pathname === '/login') {
				goto('/');
			}
		}
	});

	$effect(() => {
		if (isDesktop) return;
		if (
			authFacade.user &&
			authFacade.profile?.settings &&
			Object.keys(authFacade.profile.settings).length > 0
		) {
			try {
				const cloudSettings = authFacade.profile.settings as AppSettings;
				if (cloudSettings.projects && Array.isArray(cloudSettings.projects)) {
					// Use untrack to prevent this effect from re-running when we update the local settings store
					// This breaks the infinite loop: Cloud Change -> Update Local -> Local Change -> Effect Re-run -> ...
					untrack(() => {
						const currentSettings = settingsStore.settings;
						// Sanitize local settings (remove secrets) before comparing with cloud settings
						const sanitizedCurrent = settingsStore.sanitizeSettingsForCloud(currentSettings);

						if (JSON.stringify(sanitizedCurrent) !== JSON.stringify(cloudSettings)) {
							settingsStore.syncFromCloud(cloudSettings);
						}
					});
				}
			} catch (e) {
				console.error('Failed to sync settings:', e);
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 {authFacade.user || isDesktop
		? 'pb-24 md:pb-0'
		: ''}"
>
	{#if !isDesktop && authFacade.isLoading}
		<div class="flex h-screen items-center justify-center">
			<Loader2 class="size-12 animate-spin text-violet-500" />
		</div>
	{:else}
		{#if authFacade.user || isDesktop}
			<Navbar />
		{/if}
		{@render children()}
	{/if}
</div>
