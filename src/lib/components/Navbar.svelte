<script lang="ts">
	import {
		Settings,
		ArrowLeftRight,
		CheckCircle,
		ChevronDown,
		FolderOpen,
		Plus
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { authFacade } from '$lib/auth/authFacade.svelte';
	import { LogIn } from 'lucide-svelte';

	const navItems = [
		{ href: '/', label: 'Migracja', icon: ArrowLeftRight },
		{ href: '/settings', label: 'Ustawienia', icon: Settings }
	];

	let showProjectDropdown = $state(false);

	const projects = $derived(settingsStore.settings.projects);
	const activeProject = $derived(settingsStore.getActiveProject());

	function selectProject(projectId: string) {
		settingsStore.setActiveProject(projectId);
		showProjectDropdown = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.project-selector')) {
			showProjectDropdown = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<nav
	class="fixed top-0 right-0 left-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm"
>
	<div class="mx-auto w-[95%] max-w-[1600px] px-0 lg:w-[80%]">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/30"
				>
					<ArrowLeftRight class="size-5 text-white" />
				</div>
				<div>
					<span class="text-lg font-bold text-white">Jira Migrator</span>
					<span
						class="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-400"
					>
						v1.0
					</span>
				</div>
			</a>

			<!-- Center: Project Selector -->
			<div class="project-selector relative">
				{#if projects.length > 0}
					<button
						type="button"
						onclick={() => (showProjectDropdown = !showProjectDropdown)}
						class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm transition-colors hover:border-slate-600 hover:bg-slate-800"
					>
						{#if activeProject}
							<div
								class="flex size-6 items-center justify-center rounded bg-linear-to-br from-violet-500 to-fuchsia-600 text-xs font-bold text-white"
							>
								{activeProject.name.charAt(0).toUpperCase()}
							</div>
							<span class="max-w-32 truncate text-white">{activeProject.name}</span>
						{:else}
							<FolderOpen class="size-4 text-slate-500" />
							<span class="text-slate-400">Wybierz projekt</span>
						{/if}
						<ChevronDown class="size-4 text-slate-500" />
					</button>

					<!-- Dropdown -->
					{#if showProjectDropdown}
						<div
							class="absolute top-full left-1/2 mt-2 w-64 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-800 p-2 shadow-xl"
						>
							<div class="mb-2 px-2 text-xs font-medium tracking-wider text-slate-500 uppercase">
								Projekty
							</div>
							{#each projects as project (project.id)}
								<button
									type="button"
									onclick={() => selectProject(project.id)}
									class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors
										{activeProject?.id === project.id
										? 'bg-violet-500/20 text-white'
										: 'text-slate-300 hover:bg-slate-700/50'}"
								>
									<div
										class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-fuchsia-600 text-sm font-bold text-white"
									>
										{project.name.charAt(0).toUpperCase()}
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-medium">{project.name}</div>
										<div class="truncate text-xs text-slate-500">
											{project.jiraX.name} → {project.jiraY.name}
										</div>
									</div>
									{#if activeProject?.id === project.id}
										<CheckCircle class="size-4 shrink-0 text-violet-400" />
									{/if}
								</button>
							{/each}
							<hr class="my-2 border-slate-700" />
							<button
								type="button"
								onclick={() => {
									showProjectDropdown = false;
									goto('/settings');
								}}
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
							>
								<Plus class="size-4" />
								Zarządzaj projektami
							</button>
						</div>
					{/if}
				{:else}
					<a
						href="/settings"
						class="flex items-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-800/30 px-4 py-2 text-sm text-slate-400 transition-colors hover:border-violet-500 hover:text-white"
					>
						<Plus class="size-4" />
						Dodaj pierwszy projekt
					</a>
				{/if}
			</div>

			<!-- Right: Navigation -->
			<div class="flex items-center gap-1">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200
							{$page.url.pathname === item.href
							? 'bg-slate-800 text-white'
							: 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}"
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}

				<div class="ml-2 h-6 border-l border-slate-800"></div>

				{#if authFacade.user}
					<div class="ml-2 flex items-center gap-3">
						<div class="hidden text-right md:block">
							<p class="text-xs font-medium text-white">{authFacade.user.email}</p>
							<button
								onclick={() => authFacade.signOut()}
								class="text-[10px] text-slate-500 transition-colors hover:text-rose-400"
							>
								Wyloguj się
							</button>
						</div>
						<div
							class="flex size-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-violet-400"
						>
							{authFacade.user.email?.charAt(0).toUpperCase()}
						</div>
					</div>
				{:else}
					<a
						href="/login"
						class="ml-2 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/20"
					>
						<LogIn class="size-4" />
						Logowanie
					</a>
				{/if}
			</div>
		</div>
	</div>
</nav>
