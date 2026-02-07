<script lang="ts">
	import { onMount } from 'svelte';
	import { migrationStore, type WorklogEntry } from '$lib/stores/migration.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import {
		fetchWorklogsFromJiraX,
		fetchParentsFromJiraY,
		migrateWorklogsToJiraY,
		checkTempoPeriodStatus
	} from '$lib/api/jiraApi';
	import { getTotalProgress } from '$lib/utils';
	import WorklogCard from '$lib/components/WorklogCard.svelte';
	import ParentCard from '$lib/components/ParentCard.svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import Button from '$lib/components/Button.svelte';
	import AddParentModal from '$lib/components/AddParentModal.svelte';
	import MigrationConfirmModal from '$lib/components/MigrationConfirmModal.svelte';
	import { goto } from '$app/navigation';
	import {
		RefreshCw,
		Send,
		Inbox,
		Plus,
		Clock,
		Loader2,
		CheckCircle2,
		AlertCircle,
		CheckSquare,
		Square,
		Settings,
		Sparkles,
		Lock,
		ArrowRight
	} from 'lucide-svelte';

	let migrationMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let showConfirmModal = $state(false);

	async function loadJiraX() {
		if (!activeProject) {
			return;
		}

		migrationStore.setLoadingX(true);
		try {
			const worklogs = await fetchWorklogsFromJiraX(
				activeProject.jiraX.baseUrl,
				activeProject.jiraX.email,
				activeProject.jiraX.apiToken,
				migrationStore.state.jiraXDate
			);

			migrationStore.setJiraXWorklogs(worklogs);
		} catch (error) {
			console.error('[Page] Error loading Jira X:', error);
		} finally {
			migrationStore.setLoadingX(false);
		}
	}

	async function loadJiraY() {
		if (!activeProject) {
			return;
		}

		migrationStore.setLoadingY(true);
		try {
			// Fetch parents and period status in parallel
			const [parents, periodStatus] = await Promise.all([
				fetchParentsFromJiraY(
					activeProject.jiraY.baseUrl,
					activeProject.jiraY.email,
					activeProject.jiraY.apiToken,
					migrationStore.state.jiraXDate,
					activeProject.jiraY.tempoToken
				),
				checkTempoPeriodStatus(
					activeProject.jiraY.baseUrl,
					activeProject.jiraY.email, // Use email for identifying user
					activeProject.jiraY.apiToken,
					migrationStore.state.jiraXDate,
					activeProject.jiraY.tempoToken || ''
				)
			]);

			migrationStore.setJiraYParents(parents);
			migrationStore.setPeriodStatus(periodStatus.isLocked, periodStatus.status);
		} catch (error) {
			console.error('[Page] Error loading Jira Y:', error);
		} finally {
			migrationStore.setLoadingY(false);
		}
	}

	async function loadAllData() {
		await Promise.all([loadJiraX(), loadJiraY()]);
	}

	function handleJiraXDateChange(date: Date) {
		migrationStore.setJiraXDate(date);
		migrationStore.setJiraYMonth(date);
		migrationStore.clearAllData();
		loadAllData();
	}

	function openConfirmModal() {
		const pending = migrationStore.getTotalPendingMigration();
		if (pending.count > 0) {
			showConfirmModal = true;
		}
	}

	let migrationProgress = $state<{
		current: number;
		total: number;
		percentage: number;
		currentParent: string;
		currentWorklog: string;
		phase: string;
	} | null>(null);

	async function handleMigrate(isDryRun: boolean = false) {
		if (isDryRun) {
			migrationMessage = {
				type: 'success',
				text: 'Symulacja zakończona powodzeniem! Dane są gotowe do migracji.'
			};
			showConfirmModal = false;
			return;
		}

		if (!activeProject) return;
		migrationStore.setMigrating(true);
		migrationMessage = null;
		migrationProgress = null;

		try {
			const summary = migrationStore.getMigrationSummary();
			const migrations = summary.map((s: any) => ({
				parentKey: s.parentKey,
				children: s.children
			}));

			const result = await migrateWorklogsToJiraY(
				activeProject.jiraY.baseUrl,
				activeProject.jiraY.email,
				activeProject.jiraY.apiToken,
				migrations,
				migrationStore.state.jiraXDate, // Pass the selected date from calendar
				activeProject.jiraY.tempoToken,
				(progress) => {
					migrationProgress = progress;
				}
			);

			if (result.success) {
				migrationStore.clearAllChildren();
				showConfirmModal = false;
				migrationMessage = {
					type: 'success',
					text: `Pomyślnie zmigrowano ${result.migratedCount} worklogów do Jira Y!`
				};
			} else {
				migrationMessage = {
					type: 'error',
					text: 'Wystąpił błąd podczas migracji. Spróbuj ponownie.'
				};
			}
		} finally {
			migrationStore.setMigrating(false);
			migrationProgress = null;
			setTimeout(() => {
				migrationMessage = null;
			}, 5000);
		}
	}

	function handleDragStart(e: DragEvent, worklog: WorklogEntry) {
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('application/json', JSON.stringify(worklog));
		}
	}

	const pendingMigration = $derived(migrationStore.getTotalPendingMigration());
	const selectedCount = $derived(migrationStore.getSelectedCount());
	const selectedTime = $derived(migrationStore.getSelectedTotalTime());
	const allSelected = $derived(
		migrationStore.state.jiraXWorklogs.length > 0 &&
			selectedCount === migrationStore.state.jiraXWorklogs.length
	);

	// Active project
	const activeProject = $derived(settingsStore.getActiveProject());
	const jiraXName = $derived(activeProject?.jiraX?.name || 'Jira X');
	const jiraYName = $derived(activeProject?.jiraY?.name || 'Jira Y');

	// Track last loaded to avoid redundant triggers
	let lastLoadedKey = $state<string>('');

	$effect(() => {
		// Only trigger on project ID change or initial load
		const currentProjectId = activeProject?.id ?? null;
		if (!currentProjectId) return;

		// We don't track date here anymore to avoid double-triggers
		// with handleJiraXDateChange, but we handle the initial load.
		if (lastLoadedKey !== currentProjectId) {
			lastLoadedKey = currentProjectId;
			loadAllData();
		}
	});

	onMount(() => {
		// If project is already there, effect will catch it.
	});

	let jiraXDragOver = $state(false);

	function handleJiraXDragOver(e: DragEvent) {
		e.preventDefault();
		jiraXDragOver = true;
		migrationStore.clearAllDragOver(); // Cards highlights are not needed here
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	async function handleJiraXDrop(e: DragEvent) {
		e.preventDefault();
		jiraXDragOver = false;
		migrationStore.clearAllDragOver();

		if (migrationStore.state.isPeriodLocked) return;

		const data = e.dataTransfer?.getData('application/json');
		const dragType = e.dataTransfer?.getData('text/plain');

		if (data) {
			const droppedWorklog: WorklogEntry = JSON.parse(data);

			if (dragType === 'multi' && migrationStore.getSelectedCount() > 0) {
				await migrationStore.moveWorklogsToSource(migrationStore.getSelectedWorklogs());
			} else {
				await migrationStore.moveWorklogsToSource([droppedWorklog]);
			}
		}
	}
</script>

<svelte:head>
	<title>Jira Migrator - Przenoś worklogi między Jirami</title>
	<meta
		name="description"
		content="Aplikacja do migracji zalogowanego czasu między dwoma instancjami Jira"
	/>
</svelte:head>

<!-- Modals -->
<AddParentModal />
<MigrationConfirmModal
	isOpen={showConfirmModal}
	onClose={() => (showConfirmModal = false)}
	onConfirm={handleMigrate}
	isMigrating={migrationStore.state.isMigrating}
	{migrationProgress}
/>

<div class="flex min-h-screen flex-col pt-0 lg:h-[calc(100vh-5rem)] lg:min-h-0 lg:overflow-hidden">
	<!-- Migration Message -->
	{#if migrationMessage}
		<div
			class="animate-in fade-in slide-in-from-top-4 fixed top-20 right-4 left-4 z-50 mx-auto max-w-md"
		>
			<div
				class="flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm
					{migrationMessage.type === 'success'
					? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
					: 'border-red-500/30 bg-red-500/20 text-red-400'}"
			>
				{#if migrationMessage.type === 'success'}
					<CheckCircle2 class="size-5 shrink-0" />
				{:else}
					<AlertCircle class="size-5 shrink-0" />
				{/if}
				<span class="font-medium">{migrationMessage.text}</span>
			</div>
		</div>
	{/if}

	<!-- Global Loading Indicator -->
	{#if migrationStore.state.isLoadingX || migrationStore.state.isLoadingY}
		<div class="animate-in fade-in slide-in-from-bottom-4 fixed right-6 bottom-6 z-50">
			<div
				class="flex items-center justify-center rounded-full bg-slate-900/80 p-3 text-violet-400 shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-all duration-300"
			>
				<Loader2 class="size-6 animate-spin" />
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<main class="app-container flex min-h-0 flex-1 flex-col gap-4 px-0 pt-2 pb-6 lg:overflow-hidden">
		{#if !activeProject}
			<div class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
				<div
					class="relative flex size-24 items-center justify-center rounded-3xl bg-slate-800/80 shadow-2xl backdrop-blur-xl"
				>
					<div
						class="absolute inset-0 rounded-3xl bg-linear-to-tr from-violet-500/20 to-emerald-500/20 blur-xl"
					></div>
					<Settings class="relative size-12 text-slate-400" />
				</div>

				<div class="max-w-md space-y-2">
					<h2 class="text-2xl font-bold text-white">Brak skonfigurowanego projektu</h2>
					<p class="text-slate-400">
						Aby rozpocząć pracę z worklogami, musisz najpierw dodać i skonfigurować projekt w
						ustawieniach, łącząc się z instancjami Jira.
					</p>
				</div>

				<Button onclick={() => goto('/settings')} variant="primary" size="lg">
					<Settings class="size-5" />
					Przejdź do ustawień
				</Button>
			</div>
		{:else}
			<!-- Central Date Picker -->
			<div class="relative z-30 flex flex-col items-center justify-center gap-4 pb-6">
				<DatePicker
					bind:selectedDate={migrationStore.state.jiraXDate}
					onDateChange={handleJiraXDateChange}
					label=""
				/>
			</div>

			<!-- Floating Action Button (Apply Rules) -->
			{#if migrationStore.state.jiraXWorklogs.length > 0 && !migrationStore.state.isPeriodLocked}
				{@const allMoved = migrationStore.state.jiraXWorklogs.every((w) => w.isMoved)}
				{@const isDisabled = migrationStore.state.isPeriodLocked || allMoved}
				<div class="fixed bottom-8 left-1/2 z-30 -translate-x-1/2 transform lg:bottom-10">
					<button
						type="button"
						onclick={() => !isDisabled && migrationStore.applyRules()}
						disabled={isDisabled}
						class="group flex items-center gap-2 rounded-full border border-violet-500/30 bg-slate-900/90 py-3 pr-5 pl-4 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.3)] backdrop-blur-md transition-all duration-300
						{isDisabled
							? 'cursor-not-allowed opacity-50 grayscale'
							: 'hover:scale-105 hover:border-violet-500/50 hover:bg-slate-800 hover:text-white hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]'}"
						title={migrationStore.state.isPeriodLocked
							? 'Edycja zablokowana (okres zamknięty)'
							: allMoved
								? 'Wszystkie elementy zostały już przeniesione'
								: 'Zastosuj reguły automatyczne'}
					>
						<div
							class="flex size-8 items-center justify-center rounded-full bg-violet-500/20 group-hover:bg-violet-500/30"
						>
							{#if migrationStore.state.isPeriodLocked}
								<Lock class="size-4" />
							{:else if allMoved}
								<CheckCircle2 class="size-4" />
							{:else}
								<ArrowRight class="size-4" />
							{/if}
						</div>
						<span class="text-sm font-semibold">
							{allMoved ? 'Wszystko przeniesione' : 'Zastosuj reguły'}
						</span>
					</button>
				</div>
			{/if}

			<!-- Two Column Layout -->
			<div
				class="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:overflow-hidden"
			>
				<!-- Column 1: Jira X (Source) -->
				<div
					class="flex h-full flex-col overflow-visible rounded-xl border border-violet-500/30 bg-linear-to-b from-violet-500/10 to-slate-900/80 backdrop-blur-sm"
				>
					<!-- Header -->
					<div class="relative z-20 overflow-visible border-b border-slate-700/50 p-4">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="flex items-center gap-2 text-lg font-semibold text-white">
									{jiraXName}
									<span
										class="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-400"
									>
										{migrationStore.state.jiraXWorklogs.length}
									</span>
								</h3>
								<p class="mt-0.5 text-sm text-slate-400">Źródło worklogów</p>
								{#if migrationStore.state.isPeriodLocked}
									<div class="mt-2 text-xs font-bold text-amber-500">
										<div class="flex items-center gap-1.5 tracking-wider uppercase">
											<Lock class="size-3" />
											<span>{migrationStore.state.periodStatus}</span>
										</div>
										<p class="mt-1 flex font-normal opacity-80">
											Ten miesiąc został już zatwierdzony w Jira {jiraYName}. Przenoszenie jest
											zablokowane.
										</p>
									</div>
								{/if}
							</div>

							<div class="flex items-center gap-2">
								{#if migrationStore.state.jiraXWorklogs.length > 0}
									<div class="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5">
										<Clock class="size-4 text-violet-400" />
										<span class="text-sm font-semibold text-white">
											{getTotalProgress(migrationStore.state.jiraXWorklogs)}
										</span>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Content -->
					<div
						class="flex-1 overflow-y-auto p-4 transition-colors {jiraXDragOver
							? 'bg-violet-500/5'
							: ''}"
						ondragover={handleJiraXDragOver}
						ondragleave={() => (jiraXDragOver = false)}
						ondrop={handleJiraXDrop}
						role="region"
						aria-label="Lista źródłowa worklogów"
					>
						{#if migrationStore.state.isLoadingX}
							<div class="flex h-32 items-center justify-center">
								<Loader2 class="size-8 animate-spin text-slate-500" />
							</div>
						{:else if migrationStore.state.jiraXWorklogs.length === 0}
							<div class="flex h-32 flex-col items-center justify-center text-slate-500">
								<Inbox class="mb-2 size-8" />
								<p>Brak worklogów na ten dzień</p>
							</div>
						{:else}
							<!-- Selection toolbar -->
							<div
								class="mb-3 flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2"
							>
								<button
									type="button"
									onclick={() => {
										if (!migrationStore.state.isPeriodLocked) {
											allSelected
												? migrationStore.deselectAllWorklogs()
												: migrationStore.selectAllWorklogs();
										}
									}}
									disabled={migrationStore.state.isPeriodLocked}
									class="flex items-center gap-2 text-sm text-slate-400 transition-colors {migrationStore
										.state.isPeriodLocked
										? 'cursor-not-allowed opacity-50'
										: 'hover:text-white'}"
								>
									{#if allSelected}
										<CheckSquare class="size-4 text-violet-400" />
										<span>Odznacz wszystkie</span>
									{:else}
										<Square class="size-4" />
										<span>Zaznacz wszystkie</span>
									{/if}
								</button>

								{#if selectedCount > 0}
									<div class="flex items-center gap-2">
										<span class="text-sm text-slate-400">
											Zaznaczono: <span class="font-semibold text-violet-400">{selectedCount}</span>
										</span>
										<span
											class="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-400"
										>
											{selectedTime}
										</span>
									</div>
								{/if}
							</div>

							{#if selectedCount > 0}
								<div
									class="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-center text-sm text-violet-300"
								>
									💡 Przeciągnij dowolny zaznaczony element, aby przenieść wszystkie {selectedCount} zaznaczone
								</div>
							{/if}

							<div class="space-y-3">
								{#each migrationStore.state.jiraXWorklogs as worklog (worklog.id)}
									<WorklogCard
										{worklog}
										draggable={true}
										showCheckbox={!migrationStore.state.isPeriodLocked}
										isSelected={migrationStore.isWorklogSelected(worklog.id)}
										onToggleSelect={() => {
											if (!migrationStore.state.isPeriodLocked) {
												migrationStore.toggleWorklogSelection(worklog.id);
											}
										}}
									/>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Column 2: Jira Y (Target with Parents) -->
				<div
					class="flex h-full flex-col overflow-visible rounded-xl border border-emerald-500/30 bg-linear-to-b from-emerald-500/10 to-slate-900/80 backdrop-blur-sm"
				>
					<!-- Header -->
					<div class="relative z-20 overflow-visible border-b border-slate-700/50 p-4">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="flex items-center gap-2 text-lg font-semibold text-white">
									{jiraYName}
									<span
										class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400"
									>
										{migrationStore.state.jiraYParents.length}
									</span>
								</h3>
								<p class="mt-0.5 text-sm text-slate-400">Zadania z ostatnich 7 dni</p>
								{#if migrationStore.state.isPeriodLocked}
									<div class="mt-2 text-xs font-bold text-amber-500">
										<div class="flex items-center gap-1.5 tracking-wider uppercase">
											<Lock class="size-3" />
											<span>{migrationStore.state.periodStatus}</span>
										</div>
										<p class="mt-1 flex font-normal opacity-80">
											Ten miesiąc został już zatwierdzony w Jira {jiraYName}. Edycja jest
											zablokowana.
										</p>
									</div>
								{/if}
							</div>

							<div class="flex items-center gap-2">
								{#if migrationStore.state.jiraYParents.length > 0}
									{@const allYWorklogs = migrationStore.state.jiraYParents.flatMap(
										(p) => p.children
									)}
									{#if allYWorklogs.length > 0}
										<div class="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5">
											<Clock class="size-4 text-emerald-400" />
											<span class="text-sm font-semibold text-white">
												{getTotalProgress(allYWorklogs)}
											</span>
										</div>
									{/if}
								{/if}

								{#if pendingMigration.count > 0}
									<div
										class="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5"
										title="Do migracji"
									>
										<span class="text-sm font-semibold text-violet-400">
											+{pendingMigration.count} ({pendingMigration.time})
										</span>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Content -->
					<div class="flex-1 overflow-y-auto p-4">
						{#if migrationStore.state.isLoadingY}
							<div class="flex h-32 items-center justify-center">
								<Loader2 class="size-8 animate-spin text-slate-500" />
							</div>
						{:else}
							<div class="space-y-4">
								{#if migrationStore.state.jiraYParents.length === 0}
									<div
										class="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 text-slate-500"
									>
										<Inbox class="mb-2 size-8" />
										<p>Brak rodziców - dodaj pierwszego</p>
									</div>
								{:else}
									{#each migrationStore.state.jiraYParents as parent (parent.id)}
										<ParentCard {parent} />
									{/each}
								{/if}

								<!-- Add Parent Button -->
								<button
									type="button"
									onclick={() => migrationStore.openAddParentModal()}
									disabled={migrationStore.state.isPeriodLocked}
									class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-4 text-slate-400 transition-all
									{migrationStore.state.isPeriodLocked
										? 'cursor-not-allowed bg-slate-900/50 opacity-50'
										: 'hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-400'}"
								>
									<Plus class="size-5" />
									<span class="font-medium">
										{migrationStore.state.isPeriodLocked
											? 'Dodawanie zablokowane (okres zamknięty)'
											: `Dodaj rodzica z Jira ${jiraYName}`}
									</span>
								</button>
							</div>
						{/if}
					</div>

					<!-- Migrate Button -->
					{#if pendingMigration.count > 0 && !migrationStore.state.isPeriodLocked}
						<div
							class="sticky bottom-0 z-10 border-t border-slate-700/50 bg-slate-900/90 p-4 backdrop-blur-md"
						>
							<Button
								variant="primary"
								size="lg"
								class="w-full"
								onclick={openConfirmModal}
								disabled={migrationStore.state.isMigrating}
							>
								{#if migrationStore.state.isMigrating}
									<Loader2 class="size-5 animate-spin" />
									Migrowanie...
								{:else}
									<Send class="size-5" />
									Zmigruj worklogi
								{/if}
							</Button>
						</div>
					{:else if migrationStore.state.isPeriodLocked}
						<div
							class="sticky bottom-0 z-10 border-t border-slate-700/50 bg-slate-900/90 p-4 text-center backdrop-blur-md"
						>
							<p class="text-sm font-medium text-amber-500/80">
								Migracja zablokowana - okres zatwierdzony
							</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
</div>
