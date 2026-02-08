<script lang="ts">
	import { goto } from '$app/navigation';
	import { settingsStore, type Project } from '$lib/stores/settings.svelte';
	import {
		testConnectionToJira,
		testConnectionToTempo,
		type ConnectionTestResult
	} from '$lib/api/jiraApi';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Card from '$lib/components/Card.svelte';
	import RulesSection from '$lib/components/RulesSection.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import InfoModal from '$lib/components/InfoModal.svelte';
	import {
		Save,
		RotateCcw,
		CheckCircle,
		AlertTriangle,
		Server,
		Plus,
		Trash2,
		FolderOpen,
		ChevronRight,
		Edit2,
		X,
		Wifi,
		Loader2,
		Settings2
	} from 'lucide-svelte';

	// State
	let showSavedMessage = $state(false);
	let showResetMessage = $state(false);
	let editingProjectId = $state<string | null>(null);
	let newProjectName = $state('');
	let showNewProjectForm = $state(false);
	let isSaving = $state(false);

	// Confirm modal state
	let showDeleteModal = $state(false);
	let showResetModal = $state(false);
	let projectToDelete = $state<string | null>(null);

	// Info modal state
	let showApiTokenHelp = $state(false);

	// Connection test state
	let testingConnectionX = $state(false);
	let connectionTestResultX = $state<ConnectionTestResult | null>(null);
	let testingConnectionY = $state(false);
	let connectionTestResultY = $state<ConnectionTestResult | null>(null);
	let testingTempoY = $state(false);
	let connectionTestResultTempoY = $state<ConnectionTestResult | null>(null);

	// Current editing project
	let editingProject = $state<Project | null>(null);

	// Get projects from store
	const projects = $derived(settingsStore.settings.projects);

	// Auto-select if only one project exists
	$effect(() => {
		if (projects.length === 1 && !editingProjectId && !showNewProjectForm) {
			startEditingProject(projects[0]);
		}
	});

	function startEditingProject(project: Project) {
		editingProjectId = project.id;
		// Deep clone for editing
		const clone = JSON.parse(JSON.stringify(project));

		// Ensure properties exist to avoid binding errors
		if (clone.jiraX) {
			if (!clone.jiraX.tempoToken) clone.jiraX.tempoToken = '';
			if (clone.jiraX.useProxy === undefined) clone.jiraX.useProxy = true;
		}
		if (clone.jiraY) {
			if (!clone.jiraY.tempoToken) clone.jiraY.tempoToken = '';
			if (clone.jiraY.useProxy === undefined) clone.jiraY.useProxy = true;
		}
		if (!clone.rules) clone.rules = [];

		editingProject = clone;
		// Reset connection test state
		connectionTestResultX = null;
		connectionTestResultY = null;
		connectionTestResultTempoY = null;
		lastTestedProjectId = project.id;

		// Trigger auto-tests if configured
		if (clone.jiraX.baseUrl && clone.jiraX.email && clone.jiraX.apiToken) {
			handleTestConnectionX();
		}
		if (clone.jiraY.baseUrl && clone.jiraY.email && clone.jiraY.apiToken) {
			handleTestConnectionY();
		}
		if (clone.jiraY.baseUrl && clone.jiraY.tempoToken) {
			handleTestTempoY();
		}
	}

	let lastTestedProjectId = $state<string | null>(null);

	function cancelEditing() {
		editingProjectId = null;
		editingProject = null;
		connectionTestResultX = null;
		connectionTestResultY = null;
		connectionTestResultTempoY = null;
	}

	async function handleTestConnectionX() {
		if (!editingProject) return;

		testingConnectionX = true;
		connectionTestResultX = null;

		try {
			connectionTestResultX = await testConnectionToJira(
				editingProject.jiraX.baseUrl,
				editingProject.jiraX.email,
				editingProject.jiraX.apiToken,
				editingProject.jiraX.useProxy
			);
		} finally {
			testingConnectionX = false;
		}
	}

	async function handleTestConnectionY() {
		if (!editingProject) return;

		testingConnectionY = true;
		connectionTestResultY = null;

		try {
			connectionTestResultY = await testConnectionToJira(
				editingProject.jiraY.baseUrl,
				editingProject.jiraY.email,
				editingProject.jiraY.apiToken,
				editingProject.jiraY.useProxy
			);
		} finally {
			testingConnectionY = false;
		}
	}

	async function handleTestTempoY() {
		if (!editingProject) return;

		testingTempoY = true;
		connectionTestResultTempoY = null;

		try {
			// Używamy dedykowanego tempoToken dla testu Tempo
			connectionTestResultTempoY = await testConnectionToTempo(
				editingProject.jiraY.baseUrl,
				editingProject.jiraY.tempoToken || '',
				editingProject.jiraY.useProxy
			);
		} finally {
			testingTempoY = false;
		}
	}

	async function handleSaveProject() {
		if (editingProject && editingProjectId) {
			isSaving = true;
			try {
				await settingsStore.updateProject(editingProjectId, {
					name: editingProject.name,
					jiraX: { ...editingProject.jiraX },
					jiraY: { ...editingProject.jiraY },
					rules: [...(editingProject.rules || [])],
					timeFormat: editingProject.timeFormat
				});
				showSavedMessage = true;
				setTimeout(() => {
					showSavedMessage = false;
				}, 3000);
			} catch (e) {
				console.error('Failed to save project:', e);
			} finally {
				isSaving = false;
			}
		}
	}

	function handleAddProject() {
		if (newProjectName.trim()) {
			const newProject = settingsStore.addProject(newProjectName.trim());
			newProjectName = '';
			showNewProjectForm = false;
			// Start editing the new project
			startEditingProject(newProject);
		}
	}

	function openDeleteModal(e: MouseEvent, projectId: string) {
		e.stopPropagation();
		e.preventDefault();
		projectToDelete = projectId;
		showDeleteModal = true;
	}

	function confirmDeleteProject() {
		if (projectToDelete) {
			settingsStore.removeProject(projectToDelete);
			if (editingProjectId === projectToDelete) {
				cancelEditing();
			}
		}
		showDeleteModal = false;
		projectToDelete = null;
	}

	function cancelDeleteProject() {
		showDeleteModal = false;
		projectToDelete = null;
	}

	function openResetModal(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		showResetModal = true;
	}

	function confirmReset() {
		settingsStore.reset();
		cancelEditing();
		showResetModal = false;
		showResetMessage = true;
		setTimeout(() => {
			showResetMessage = false;
		}, 3000);
	}

	function cancelReset() {
		showResetModal = false;
	}

	function isProjectFormValid(): boolean {
		if (!editingProject) return false;
		return !!(
			editingProject.name &&
			editingProject.jiraX.name &&
			editingProject.jiraX.baseUrl &&
			editingProject.jiraX.email &&
			editingProject.jiraX.apiToken &&
			editingProject.jiraY.name &&
			editingProject.jiraY.baseUrl &&
			editingProject.jiraY.email &&
			editingProject.jiraY.apiToken &&
			editingProject.jiraY.tempoToken
		);
	}

	function formatDate(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString('pl-PL', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Ustawienia | Jira Migrator</title>
	<meta name="description" content="Zarządzaj projektami i połączeniami z Jira" />
</svelte:head>

<div class="min-h-screen">
	<div class="app-container app-page-padding px-0">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-white">Ustawienia</h1>
			<p class="mt-2 text-slate-400">
				Zarządzaj projektami i połączeniami między instancjami Jira.
			</p>
		</div>

		<!-- Messages -->
		{#if showSavedMessage}
			<div
				class="mb-6 flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-3 text-emerald-400"
			>
				<CheckCircle class="size-5" />
				<span>Projekt został zapisany pomyślnie!</span>
			</div>
		{/if}
		{#if showResetMessage}
			<div class="mb-6 flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-3 text-amber-400">
				<RotateCcw class="size-5" />
				<span>Wszystkie dane zostały usunięte.</span>
			</div>
		{/if}

		<div class="grid gap-8 lg:grid-cols-[320px_1fr]">
			<!-- Projects Sidebar -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold text-white">Projekty</h2>
					<Button variant="primary" size="sm" onclick={() => (showNewProjectForm = true)}>
						<Plus class="size-4" />
						Dodaj projekt
					</Button>
				</div>

				<!-- New Project Form -->
				{#if showNewProjectForm}
					<div
						class="overflow-hidden rounded-xl border border-violet-500/30 bg-slate-800/80 shadow-lg shadow-violet-500/10"
					>
						<div class="flex items-center p-1.5">
							<input
								type="text"
								bind:value={newProjectName}
								placeholder="Nazwa projektu..."
								class="h-9 flex-1 bg-transparent pr-2 pl-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
								onkeydown={(e) => e.key === 'Enter' && handleAddProject()}
							/>
							<div class="flex items-center gap-1.5">
								<Button
									variant="primary"
									size="sm"
									onclick={handleAddProject}
									disabled={!newProjectName.trim()}
									class="h-9! px-4!"
								>
									<Plus class="size-4" />
									Dodaj
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => {
										showNewProjectForm = false;
										newProjectName = '';
									}}
									class="h-9! w-9! px-0!"
								>
									<X class="size-4" />
								</Button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Projects List -->
				{#if projects.length === 0}
					<div
						class="rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-8 text-center"
					>
						<FolderOpen class="mx-auto mb-3 size-10 text-slate-600" />
						<p class="font-medium text-slate-400">Brak projektów</p>
						<p class="mt-1 mb-6 text-sm text-slate-500">
							Dodaj swój pierwszy projekt, aby zacząć zarządzać migracją danych.
						</p>
						<Button variant="primary" size="md" onclick={() => (showNewProjectForm = true)}>
							<Plus class="size-4" />
							Dodaj pierwszy projekt
						</Button>
					</div>
				{:else}
					<div class="space-y-2">
						{#each projects as project (project.id)}
							<button
								type="button"
								onclick={() => startEditingProject(project)}
								class="group flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all
									{editingProjectId === project.id
									? 'border-violet-500 bg-violet-500/10'
									: 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800'}"
							>
								<div
									class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-fuchsia-600 font-bold text-white"
								>
									{project.name.charAt(0).toUpperCase()}
								</div>
								<div class="min-w-0 flex-1">
									<h3 class="truncate font-medium text-white">{project.name}</h3>
									<p class="truncate text-xs text-slate-500">
										Utworzono: {formatDate(project.createdAt)}
									</p>
								</div>
								<ChevronRight
									class="size-4 text-slate-600 transition-colors group-hover:text-slate-400"
								/>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Reset Button (at bottom) -->
				{#if projects.length > 0}
					<div class="border-t border-slate-700/50 pt-4">
						<Button
							variant="ghost"
							size="sm"
							onclick={(e) => openResetModal(e)}
							class="w-full text-red-400 hover:bg-red-500/10"
						>
							<RotateCcw class="size-4" />
							Usuń wszystkie projekty
						</Button>
					</div>
				{/if}
			</div>

			<!-- Project Editor -->
			<div>
				{#if editingProject}
					<div class="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
						<!-- Project Header -->
						<div class="mb-6 flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-600 text-xl font-bold text-white"
								>
									{editingProject.name.charAt(0).toUpperCase()}
								</div>
								<div>
									<input
										type="text"
										bind:value={editingProject.name}
										class="border-none bg-transparent text-xl font-bold text-white focus:outline-none {!editingProject.name
											? 'placeholder:text-rose-500/50'
											: ''}"
										placeholder="Nazwa projektu"
									/>
									{#if !editingProject.name}
										<p class="text-xs font-medium text-rose-500">To pole jest wymagane</p>
									{:else}
										<p class="text-sm text-slate-500">Edycja ustawień projektu</p>
									{/if}
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onclick={(e) => openDeleteModal(e, editingProject!.id)}
								class="text-red-400 hover:bg-red-500/10"
							>
								<Trash2 class="size-4" />
							</Button>
						</div>

						<!-- Jira Configs Grid -->
						<div class="grid gap-6 lg:grid-cols-2">
							<!-- Jira X Config -->
							<Card title="🔵 Jira X (Źródłowa)">
								<div class="space-y-4">
									<Input
										id="jiraX-name"
										label="Nazwa wyświetlana"
										bind:value={editingProject.jiraX.name}
										placeholder="np. Jira Produkcyjna"
										required
										error={!editingProject.jiraX.name ? 'To pole jest wymagane' : ''}
									/>
									<Input
										id="jiraX-url"
										label="URL Jira"
										type="url"
										bind:value={editingProject.jiraX.baseUrl}
										placeholder="https://twoja-firma.atlassian.net"
										required
										error={!editingProject.jiraX.baseUrl ? 'To pole jest wymagane' : ''}
									/>
									<Input
										id="jiraX-email"
										label="Email"
										type="email"
										bind:value={editingProject.jiraX.email}
										placeholder="twoj.email@firma.com"
										required
										error={!editingProject.jiraX.email ? 'To pole jest wymagane' : ''}
									/>
									<Input
										id="jiraX-token"
										label="API Token"
										type="password"
										bind:value={editingProject.jiraX.apiToken}
										placeholder="Twój API token z Atlassian"
										required
										error={!editingProject.jiraX.apiToken ? 'To pole jest wymagane' : ''}
										onInfoClick={() => (showApiTokenHelp = true)}
									/>

									<div class="space-y-2 py-1">
										<div class="flex items-center gap-2">
											<input
												id="jiraX-proxy"
												type="checkbox"
												bind:checked={editingProject.jiraX.useProxy}
												class="size-4 rounded border-slate-700 bg-slate-900 text-violet-500 focus:ring-violet-500"
											/>
											<label for="jiraX-proxy" class="text-sm font-medium text-slate-300">
												Używaj serwera proxy (Vercel)
											</label>
										</div>
										{#if !editingProject.jiraX.useProxy}
											<p class="text-[10px] leading-tight text-amber-500/80 italic">
												Wyłączenie proxy pozwala na połączenie z lokalną/VPN Jirą bezpośrednio z
												Twojej przeglądarki, ale może wymagać konfiguracji CORS w Jira.
											</p>
										{/if}
									</div>

									<!-- Test Connection Button -->
									<div class="border-t border-slate-700/50 pt-4">
										<Button
											variant={connectionTestResultX?.success
												? 'success'
												: connectionTestResultX?.success === false
													? 'danger'
													: 'secondary'}
											size="sm"
											onclick={handleTestConnectionX}
											disabled={testingConnectionX ||
												!editingProject?.jiraX.baseUrl ||
												!editingProject?.jiraX.email ||
												!editingProject?.jiraX.apiToken}
											class="w-full"
											title={connectionTestResultX?.success ? `Połączono z: API Token` : undefined}
										>
											{#if testingConnectionX}
												<Loader2 class="size-4 animate-spin" />
												Testowanie...
											{:else if connectionTestResultX?.success}
												<CheckCircle class="size-4" />
												Połączono
											{:else if connectionTestResultX?.success === false}
												<AlertTriangle class="size-4" />
												Błąd połączenia
											{:else}
												<Wifi class="size-4" />
												Test połączenia
											{/if}
										</Button>

										{#if connectionTestResultX && !connectionTestResultX.success}
											<div
												class="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400"
											>
												<AlertTriangle class="mt-0.5 size-4 shrink-0" />
												<div>
													<p class="font-medium">{connectionTestResultX.message}</p>
													{#if connectionTestResultX.serverInfo}
														<p class="mt-1 text-xs opacity-80">
															Serwer: {connectionTestResultX.serverInfo}
														</p>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								</div>
							</Card>

							<!-- Jira Y Config -->
							<Card title="🟢 Jira Y (Docelowa)">
								<div class="space-y-4">
									<Input
										id="jiraY-name"
										label="Nazwa wyświetlana"
										bind:value={editingProject.jiraY.name}
										placeholder="np. Jira Klienta"
										required
										error={!editingProject.jiraY.name ? 'To pole jest wymagane' : ''}
									/>
									<Input
										id="jiraY-url"
										label="URL Jira"
										type="url"
										bind:value={editingProject.jiraY.baseUrl}
										placeholder="https://klient.atlassian.net"
										required
										error={!editingProject.jiraY.baseUrl ? 'To pole jest wymagane' : ''}
									/>
									<Input
										id="jiraY-email"
										label="Email"
										type="email"
										bind:value={editingProject.jiraY.email}
										placeholder="twoj.email@klient.com"
										required
										error={!editingProject.jiraY.email ? 'To pole jest wymagane' : ''}
									/>
									<Input
										id="jiraY-token"
										label="Jira API Token"
										type="password"
										bind:value={editingProject.jiraY.apiToken}
										placeholder="Twój API token z Atlassian"
										required
										error={!editingProject.jiraY.apiToken ? 'To pole jest wymagane' : ''}
										onInfoClick={() => (showApiTokenHelp = true)}
									/>
									<Input
										id="jiraY-tempo-token"
										label="Tempo API Token"
										type="password"
										bind:value={editingProject.jiraY.tempoToken}
										placeholder="Twój API token z Tempo"
										required
										error={!editingProject.jiraY.tempoToken ? 'To pole jest wymagane' : ''}
									/>

									<div class="space-y-2 py-1">
										<div class="flex items-center gap-2">
											<input
												id="jiraY-proxy"
												type="checkbox"
												bind:checked={editingProject.jiraY.useProxy}
												class="size-4 rounded border-slate-700 bg-slate-900 text-violet-500 focus:ring-violet-500"
											/>
											<label for="jiraY-proxy" class="text-sm font-medium text-slate-300">
												Używaj serwera proxy (Vercel)
											</label>
										</div>
										{#if !editingProject.jiraY.useProxy}
											<p class="text-[10px] leading-tight text-amber-500/80 italic">
												Wyłączenie proxy zalecane tylko jeśli cel mierzysz w lokalną instancję Jira.
											</p>
										{/if}
									</div>

									<!-- Test Connection Buttons -->
									<div class="space-y-3 border-t border-slate-700/50 pt-4">
										<div class="grid grid-cols-2 gap-3">
											<Button
												variant={connectionTestResultY?.success
													? 'success'
													: connectionTestResultY?.success === false
														? 'danger'
														: 'secondary'}
												size="sm"
												onclick={handleTestConnectionY}
												disabled={testingConnectionY ||
													!editingProject?.jiraY.baseUrl ||
													!editingProject?.jiraY.email ||
													!editingProject?.jiraY.apiToken}
												class="w-full"
												title={connectionTestResultY?.success
													? `Połączono z: Jira API Token`
													: undefined}
											>
												{#if testingConnectionY}
													<Loader2 class="size-4 animate-spin" />
													Jira...
												{:else if connectionTestResultY?.success}
													<CheckCircle class="size-4" />
													Połączono
												{:else if connectionTestResultY?.success === false}
													<AlertTriangle class="size-4" />
													Błąd
												{:else}
													<Wifi class="size-4" />
													Test Jira
												{/if}
											</Button>

											<Button
												variant={connectionTestResultTempoY?.success === true
													? 'success'
													: connectionTestResultTempoY?.success === false
														? 'danger'
														: 'secondary'}
												size="sm"
												onclick={handleTestTempoY}
												disabled={testingTempoY ||
													!editingProject?.jiraY.baseUrl ||
													!editingProject?.jiraY.tempoToken}
												class="w-full"
												title={connectionTestResultTempoY?.success === true
													? `Połączono z: Tempo API Token`
													: undefined}
											>
												{#if testingTempoY}
													<Loader2 class="size-4 animate-spin" />
													Tempo...
												{:else if connectionTestResultTempoY?.success === true}
													<CheckCircle class="size-4" />
													Połączono
												{:else if connectionTestResultTempoY?.success === false}
													<AlertTriangle class="size-4" />
													Błąd
												{:else}
													<Wifi class="size-4" />
													Test Tempo
												{/if}
											</Button>
										</div>

										{#if connectionTestResultY && !connectionTestResultY.success}
											<div
												class="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400"
											>
												<AlertTriangle class="mt-0.5 size-4 shrink-0" />
												<div>
													<p class="font-medium">{connectionTestResultY.message}</p>
												</div>
											</div>
										{/if}

										{#if connectionTestResultTempoY && !connectionTestResultTempoY.success}
											<div
												class="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400"
											>
												<AlertTriangle class="mt-0.5 size-4 shrink-0" />
												<div>
													<p class="font-medium">Tempo: {connectionTestResultTempoY.message}</p>
													{#if connectionTestResultTempoY.serverInfo}
														<p class="mt-1 text-xs opacity-80">
															{connectionTestResultTempoY.serverInfo}
														</p>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								</div>
							</Card>
						</div>

						<!-- Migration Rules -->
						<RulesSection
							project={editingProject}
							isJiraXConnected={!!connectionTestResultX?.success}
							isJiraYConnected={!!connectionTestResultY?.success}
							isTestingX={testingConnectionX}
							isTestingY={testingConnectionY}
							onSave={handleSaveProject}
						/>

						<!-- Display Preferences -->
						<div class="mt-8 rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
							<div class="mb-6 flex items-center gap-3">
								<div
									class="flex size-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400"
								>
									<Settings2 class="size-5" />
								</div>
								<div>
									<h2 class="text-lg font-semibold text-white">Preferencje wyświetlania</h2>
									<p class="text-sm text-slate-500">
										Dostosuj sposób wyświetlania danych dla tego projektu
									</p>
								</div>
							</div>

							<div
								class="flex items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-900/40 p-5"
							>
								<div>
									<h3 class="font-medium text-slate-200">Format czasu</h3>
									<p class="mt-1 text-xs text-slate-500">
										Wybierz jak chcesz widzieć i wpisywać czas pracy (np. 1h 30m vs 1.5)
									</p>
								</div>
								<div class="flex rounded-lg bg-slate-900/50 p-1 ring-1 ring-slate-700/50">
									<button
										type="button"
										onclick={() => {
											editingProject!.timeFormat = 'hm';
											handleSaveProject();
										}}
										class="rounded-md px-4 py-1.5 text-xs font-bold transition-all
											{editingProject.timeFormat === 'hm'
											? 'bg-violet-500 text-white shadow-lg'
											: 'text-slate-500 hover:text-slate-300'}"
									>
										Standard (h/m)
									</button>
									<button
										type="button"
										onclick={() => {
											editingProject!.timeFormat = 'decimal';
											handleSaveProject();
										}}
										class="rounded-md px-4 py-1.5 text-xs font-bold transition-all
											{editingProject.timeFormat === 'decimal'
											? 'bg-violet-500 text-white shadow-lg'
											: 'text-slate-500 hover:text-slate-300'}"
									>
										Dziesiętny (0.5)
									</button>
								</div>
							</div>
						</div>

						<div class="mt-6 flex items-center justify-end gap-3 border-t border-slate-700/50 pt-6">
							{#if showSavedMessage}
								<div class="flex items-center gap-2 pr-4 text-sm font-medium text-emerald-400">
									<CheckCircle class="size-4" />
									<span>Zapisano</span>
								</div>
							{/if}
							{#if projects.length > 1}
								<Button variant="secondary" onclick={cancelEditing}>Anuluj</Button>
							{/if}
							<Button
								variant="primary"
								onclick={handleSaveProject}
								disabled={!isProjectFormValid() || isSaving}
							>
								{#if isSaving}
									<Loader2 class="size-4 animate-spin" />
									Zapisywanie...
								{:else}
									<Save class="size-4" />
									Zapisz projekt
								{/if}
							</Button>
						</div>
					</div>
				{:else}
					<!-- No project selected -->
					<div
						class="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/20 p-12"
					>
						<div class="text-center">
							<Edit2 class="mx-auto mb-4 size-12 text-slate-600" />
							<h3 class="text-lg font-medium text-slate-400">
								{projects.length === 0
									? 'Brak skonfigurowanych projektów'
									: 'Wybierz projekt do edycji'}
							</h3>
							<p class="mt-2 mb-6 text-sm text-slate-600">
								{projects.length === 0
									? 'Dodaj swój pierwszy projekt, aby zacząć zarządzać migracją danych.'
									: 'Lub dodaj nowy projekt, aby skonfigurować połączenia Jira'}
							</p>
							<Button variant="secondary" onclick={() => (showNewProjectForm = true)}>
								<Plus class="size-4" />
								{projects.length === 0 ? 'Dodaj pierwszy projekt' : 'Dodaj nowy projekt'}
							</Button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Back to Migration Button -->
		<div class="mt-8 text-center">
			<Button variant="ghost" onclick={() => goto('/')}>← Wróć do migracji</Button>
		</div>
	</div>

	<!-- API Token Info Modal -->
	<InfoModal
		isOpen={showApiTokenHelp}
		title="Jak uzyskać API Token?"
		onClose={() => (showApiTokenHelp = false)}
	>
		<div class="space-y-4">
			<!-- Security Notice -->
			<div class="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
				<AlertTriangle class="mt-0.5 size-5 shrink-0 text-amber-400" />
				<div>
					<h3 class="font-semibold text-amber-300">Bezpieczeństwo danych</h3>
					<p class="mt-1 text-sm text-amber-200/80">
						Wszystkie dane uwierzytelniające są przechowywane wyłącznie w localStorage Twojej
						przeglądarki. Nigdy nie są wysyłane do żadnego serwera zewnętrznego.
					</p>
				</div>
			</div>

			<div>
				<h4 class="mb-2 font-medium text-white">Jira Cloud (atlassian.net)</h4>
				<ol
					class="ml-1 list-inside list-decimal space-y-2 border-l-2 border-slate-700 pl-2 text-sm text-slate-400"
				>
					<li>
						Przejdź do strony zarządzania tokenami: <br />
						<a
							href="https://id.atlassian.com/manage-profile/security/api-tokens"
							target="_blank"
							rel="noopener noreferrer"
							class="mt-1 inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 hover:underline"
						>
							id.atlassian.com/manage-profile/security/api-tokens
							<ChevronRight class="size-3" />
						</a>
					</li>
					<li>Kliknij przycisk <strong>"Create API token"</strong>.</li>
					<li>Nadaj tokenowi łatwą do rozpoznania nazwę (np. "Jira Migrator").</li>
					<li>Skopiuj wygenerowany token i wklej go w polu formularza.</li>
				</ol>
			</div>

			<div class="mt-4 border-t border-slate-800 pt-4">
				<h4 class="mb-2 font-medium text-white">Jira Server / Data Center</h4>
				<div class="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
					<p class="text-sm text-amber-200/80">
						W przypadku własnej instancji Jira (on-premise), zamiast hasła użyj Personal Access
						Token (PAT) dla większego bezpieczeństwa.
					</p>
				</div>
				<ul
					class="ml-1 list-inside list-disc space-y-2 border-l-2 border-slate-700 pl-2 text-sm text-slate-400"
				>
					<li>Zaloguj się do swojej instancji Jira.</li>
					<li>
						Kliknij w swój awatar (Profile) &rarr; <strong>Profile</strong>.
					</li>
					<li>
						W menu wybierz <strong>Personal Access Tokens</strong>.
					</li>
					<li>
						Utwórz nowy token i użyj go w polu <strong>API Token</strong>.
					</li>
				</ul>
				<p class="mt-3 text-xs text-slate-500 italic">
					Uwaga: Jeśli Twoja organizacja nie obsługuje PAT, w polu API Token możesz wpisać swoje
					zwykłe hasło do konta, jednak zalecamy użycie tokenu.
				</p>
			</div>
		</div>
	</InfoModal>
</div>

<!-- Delete Project Modal -->
<ConfirmModal
	isOpen={showDeleteModal}
	title="Usuń projekt"
	message="Czy na pewno chcesz usunąć ten projekt? Ta akcja jest nieodwracalna."
	confirmLabel="Usuń projekt"
	cancelLabel="Anuluj"
	variant="danger"
	onConfirm={confirmDeleteProject}
	onCancel={cancelDeleteProject}
/>

<!-- Reset All Modal -->
<ConfirmModal
	isOpen={showResetModal}
	title="Usuń wszystkie projekty"
	message="Czy na pewno chcesz usunąć wszystkie projekty i ustawienia? Ta akcja jest nieodwracalna."
	confirmLabel="Usuń wszystko"
	cancelLabel="Anuluj"
	variant="danger"
	onConfirm={confirmReset}
	onCancel={cancelReset}
/>
