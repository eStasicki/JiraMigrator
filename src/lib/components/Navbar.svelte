<script lang="ts">
	import {
		Settings,
		ArrowLeftRight,
		CheckCircle,
		ChevronDown,
		FolderOpen,
		Plus,
		LogOut,
		User,
		Monitor
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { authFacade } from '$lib/auth/authFacade.svelte';
	import { isTauri } from '$lib/tauri';
	import { LogIn } from 'lucide-svelte';

	let isDesktop = $state(false);

	$effect(() => {
		isDesktop = isTauri();
	});

	const navItems = [
		{ href: '/', label: 'Migracja', icon: ArrowLeftRight },
		{ href: '/settings', label: 'Ustawienia', icon: Settings }
	];

	let showProjectDropdown = $state(false);

	const projects = $derived(settingsStore.settings.projects);
	const activeProject = $derived(settingsStore.getActiveProject());
	const userAvatar = $derived(
		authFacade.user?.user_metadata?.avatar_url ?? authFacade.user?.user_metadata?.picture ?? null
	);

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

<!-- Spacer to prevent content overlap since header is fixed -->
<div class="h-20"></div>

<nav
	class="fixed top-0 right-0 left-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl transition-all duration-300"
>
	<div class="app-container flex h-16 items-center justify-between px-0">
		<!-- Left: Brand & Context -->
		<div class="flex items-center gap-4 md:gap-6">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
				<div
					class="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20"
				>
					<ArrowLeftRight class="size-5 text-white" />
				</div>
				<span class="hidden text-base font-bold tracking-tight text-white md:block"
					>Jira Migrator</span
				>
			</a>

			<!-- Divider -->
			<div class="hidden h-6 w-px bg-slate-800 md:block"></div>

			<!-- Project Selector -->
			<div class="project-selector relative">
				{#if projects.length > 0}
					<button
						type="button"
						onclick={() => (showProjectDropdown = !showProjectDropdown)}
						class="group flex items-center gap-2 rounded-lg border border-transparent bg-slate-900/50 px-3 py-1.5 text-sm font-medium text-slate-300 transition-all hover:border-slate-700 hover:bg-slate-800 hover:text-white"
					>
						{#if activeProject}
							<div
								class="flex size-5 items-center justify-center rounded bg-linear-to-br from-violet-500 to-indigo-500 text-[10px] font-bold text-white shadow-sm"
							>
								{activeProject.name.charAt(0).toUpperCase()}
							</div>
							<span class="max-w-[100px] truncate md:max-w-[160px]">{activeProject.name}</span>
						{:else}
							<FolderOpen class="size-4 text-slate-500" />
							<span>Wybierz projekt</span>
						{/if}
						<ChevronDown
							class="size-3.5 text-slate-500 transition-transform duration-200 group-hover:text-slate-400 {showProjectDropdown
								? 'rotate-180'
								: ''}"
						/>
					</button>

					<!-- Dropdown -->
					{#if showProjectDropdown}
						<div
							class="absolute top-full left-0 mt-2 w-72 rounded-xl border border-slate-700/50 bg-slate-900 p-2 shadow-2xl ring-1 shadow-black/50 ring-white/5 backdrop-blur-xl"
						>
							<div
								class="mb-2 px-3 py-1.5 text-xs font-medium tracking-wider text-slate-500 uppercase"
							>
								Twoje Projekty
							</div>
							<div class="flex flex-col gap-1">
								{#each projects as project (project.id)}
									<button
										type="button"
										onclick={() => selectProject(project.id)}
										class="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all
                                            {activeProject?.id === project.id
											? 'bg-violet-500/10 text-violet-100'
											: 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
									>
										<div
											class="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold shadow-sm transition-transform group-hover:scale-105 {activeProject?.id ===
											project.id
												? 'bg-violet-500 text-white shadow-violet-500/20'
												: 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'}"
										>
											{project.name.charAt(0).toUpperCase()}
										</div>
										<div class="min-w-0 flex-1">
											<div class="truncate text-sm font-medium">{project.name}</div>
											<div class="truncate text-xs opacity-60">
												{project.jiraX?.name || '?'} → {project.jiraY?.name || '?'}
											</div>
										</div>
										{#if activeProject?.id === project.id}
											<CheckCircle class="size-4 shrink-0 text-violet-400" />
										{/if}
									</button>
								{/each}
							</div>
							<div class="my-2 h-px bg-slate-800/50"></div>
							<button
								type="button"
								onclick={() => {
									showProjectDropdown = false;
									goto('/settings');
								}}
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
							>
								<div class="flex size-6 items-center justify-center rounded-md bg-slate-800/50">
									<Plus class="size-3.5" />
								</div>
								Zarządzaj projektami
							</button>
						</div>
					{/if}
				{:else}
					<a
						href="/settings"
						class="flex items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-violet-500/50 hover:text-violet-300"
					>
						<Plus class="size-3.5" />
						<span>Dodaj projekt</span>
					</a>
				{/if}
			</div>
		</div>

		<!-- Center: Navigation (Desktop) -->
		<div class="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
			<div
				class="flex items-center gap-1 rounded-full border border-white/5 bg-white/5 p-1 backdrop-blur-md"
			>
				{#each navItems as item}
					<a
						href={item.href}
						class="relative flex items-center gap-2 rounded-full px-5 py-1.5 text-sm font-medium transition-all duration-300
                            {$page.url.pathname === item.href
							? 'text-white shadow-sm'
							: 'text-slate-400 hover:text-white'}"
					>
						{#if $page.url.pathname === item.href}
							<div
								class="absolute inset-0 -z-10 rounded-full bg-slate-700/80 shadow-inner"
								style="view-transition-name: nav-pill;"
							></div>
						{/if}
						<item.icon class="size-3.5" />
						{item.label}
					</a>
				{/each}
			</div>
		</div>

		<!-- Right: User & Actions -->
		<div class="flex items-center gap-4">
			{#if isDesktop}
				<div class="flex items-center gap-2 pl-4">
					<div
						class="flex size-9 items-center justify-center rounded-full bg-slate-800 ring-2 ring-violet-500/30"
					>
						<Monitor class="size-4 text-violet-400" />
					</div>
					<span class="hidden text-xs font-medium text-slate-400 md:block">Desktop</span>
				</div>
			{:else if authFacade.user}
				<div class="flex items-center gap-3 pl-4">
					<div class="hidden text-right md:block">
						<div class="text-xs font-medium text-slate-200">{authFacade.user.email}</div>
						<button
							onclick={() => authFacade.signOut()}
							class="flex items-center justify-end gap-1 text-[10px] text-slate-500 transition-colors hover:text-rose-400"
						>
							<LogOut class="size-3" />
							Wyloguj
						</button>
					</div>
					<div class="group relative">
						<div
							class="flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-2 ring-transparent transition-all hover:bg-slate-700 hover:ring-slate-700"
						>
							{#if userAvatar}
								<img src={userAvatar} alt="User" class="size-full object-cover" />
							{:else if authFacade.user.email}
								<span class="text-xs font-bold text-violet-200"
									>{authFacade.user.email.charAt(0).toUpperCase()}</span
								>
							{:else}
								<User class="size-4 text-slate-400" />
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<a
					href="/login"
					class="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-sm transition-all hover:bg-white/10 hover:shadow-md"
				>
					<LogIn class="size-4" />
					<span>Logowanie</span>
				</a>
			{/if}
		</div>
	</div>
</nav>

<!-- Mobile Nav Bottom (Optional backup if needed, but current fits top bar) -->
<div
	class="fixed right-0 bottom-0 left-0 z-40 border-t border-slate-800 bg-slate-900/95 p-4 md:hidden"
>
	<div class="flex justify-around">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex flex-col items-center gap-1 rounded-lg p-2 text-xs font-medium
                    {$page.url.pathname === item.href ? 'text-violet-400' : 'text-slate-500'}"
			>
				<item.icon class="size-5" />
				{item.label}
			</a>
		{/each}
	</div>
</div>
