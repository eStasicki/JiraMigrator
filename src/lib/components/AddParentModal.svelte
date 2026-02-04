<script lang="ts">
	import { X, Search, Loader2, Plus, Check, CheckSquare, Square } from 'lucide-svelte';
	import { migrationStore, type ParentTask } from '$lib/stores/migration.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { searchJiraIssues } from '$lib/api/jiraApi';
	import Button from './Button.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	let selectedIssues = $state(new SvelteSet<ParentTask>());

	async function handleSearch() {
		const query = migrationStore.state.searchQuery;
		const activeProject = settingsStore.getActiveProject();

		if (!query.trim() || !activeProject) {
			migrationStore.setSearchResults([]);
			selectedIssues.clear(); // Clear selection when search query is empty or no active project
			return;
		}

		migrationStore.setIsSearching(true);
		try {
			const results = await searchJiraIssues(
				activeProject.jiraY.baseUrl,
				activeProject.jiraY.email,
				activeProject.jiraY.apiToken,
				query
			);
			console.log('DEBUG MODAL: API Results:', results);
			migrationStore.setSearchResults(results);
		} finally {
			migrationStore.setIsSearching(false);
		}
	}

	function isAlreadyAdded(key: string) {
		return migrationStore.state.jiraYParents.some((p) => p.issueKey === key);
	}

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		migrationStore.setSearchQuery(target.value);

		// Debounce search
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(handleSearch, 300);
	}

	function toggleSelection(parent: ParentTask) {
		if (selectedIssues.has(parent)) {
			selectedIssues.delete(parent);
		} else {
			selectedIssues.add(parent);
		}
	}

	function handleAddSelected() {
		for (const parent of selectedIssues) {
			migrationStore.addParent(parent);
		}
		handleClose();
	}

	function handleClose() {
		selectedIssues.clear();
		migrationStore.closeAddParentModal();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function toggleSelectAll() {
		if (selectedIssues.size === migrationStore.state.searchResults.length) {
			selectedIssues.clear();
		} else {
			for (const res of migrationStore.state.searchResults) {
				selectedIssues.add(res);
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if migrationStore.state.isAddParentModalOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		onclick={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-700 p-4">
				<h2 id="modal-title" class="text-lg font-semibold text-white">Dodaj rodziców z Jira Y</h2>
				<button
					type="button"
					onclick={handleClose}
					class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
				>
					<X class="size-5" />
				</button>
			</div>

			<!-- Search -->
			<div class="p-4">
				<div class="relative">
					<Search class="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Szukaj po kluczu lub nazwie (np. BCMS-1, Development)"
						value={migrationStore.state.searchQuery}
						oninput={handleInputChange}
						class="w-full rounded-lg border border-slate-600 bg-slate-900 py-3 pr-4 pl-10 text-slate-100 placeholder-slate-500 transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
					/>
					{#if migrationStore.state.isSearching}
						<Loader2
							class="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-slate-400"
						/>
					{/if}
				</div>

				{#if selectedIssues.size > 0}
					<div class="mt-3 flex flex-wrap gap-2 px-1">
						<span class="w-full text-[10px] font-bold tracking-widest text-slate-500 uppercase"
							>Wybrane ({selectedIssues.size}):</span
						>
						{#each Array.from(selectedIssues) as issue}
							<div
								class="flex items-center gap-1.5 rounded-full bg-violet-500/20 py-1 pr-1.5 pl-2.5 text-xs font-semibold text-violet-400 ring-1 ring-violet-500/30"
							>
								{issue.issueKey}
								<button
									onclick={() => selectedIssues.delete(issue)}
									class="rounded-full bg-violet-500/20 p-0.5 transition-colors hover:bg-violet-500 hover:text-white"
								>
									<X class="size-3" />
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if migrationStore.state.searchResults.length > 0}
					<div class="mt-4 flex items-center justify-between px-1">
						<button
							onclick={toggleSelectAll}
							class="flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-white"
						>
							{#if selectedIssues.size === migrationStore.state.searchResults.length}
								<CheckSquare class="size-4 text-violet-400" />
								<span>Odznacz wszystkie</span>
							{:else}
								<Square class="size-4" />
								<span>Zaznacz wszystkie</span>
							{/if}
						</button>
						<span class="text-xs text-slate-500">
							Znaleziono: {migrationStore.state.searchResults.length}
						</span>
					</div>
				{/if}
			</div>

			<!-- Results -->
			<div class="max-h-80 overflow-y-auto border-t border-slate-700 p-2">
				{#if migrationStore.state.searchResults.length > 0}
					<div class="space-y-1">
						{#each migrationStore.state.searchResults as result}
							{@const added = isAlreadyAdded(result.issueKey)}
							<button
								type="button"
								onclick={() => !added && toggleSelection(result)}
								disabled={added}
								class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all
                                    {selectedIssues.has(result)
									? 'border-violet-500/50 bg-violet-500/10'
									: added
										? 'cursor-not-allowed border-transparent bg-slate-900/50 opacity-60'
										: 'border-transparent bg-transparent hover:bg-slate-900'}"
							>
								<!-- Checkbox Visual -->
								<div
									class="flex size-5 shrink-0 items-center justify-center rounded border-2 transition-all
                                    {selectedIssues.has(result)
										? 'border-violet-500 bg-violet-500 text-white'
										: added
											? 'border-slate-700 bg-slate-800'
											: 'border-slate-600 bg-slate-900'}"
								>
									{#if selectedIssues.has(result)}
										<Check class="size-3" />
									{:else if added}
										<Plus class="size-3 rotate-45 text-slate-500" />
									{/if}
								</div>

								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span
											class="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400"
										>
											{result.issueKey}
										</span>
										<span class="text-[10px] font-bold text-slate-500 uppercase">{result.type}</span
										>
										{#if added}
											<span
												class="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 uppercase"
											>
												Już dodano
											</span>
										{/if}
									</div>
									<p class="mt-1 truncate text-sm text-slate-300">{result.issueSummary}</p>
								</div>
							</button>
						{/each}
					</div>
				{:else if migrationStore.state.searchQuery && !migrationStore.state.isSearching}
					<div class="py-12 text-center text-slate-500">
						<p>Nie znaleziono zadań pasujących do "{migrationStore.state.searchQuery}"</p>
					</div>
				{:else if !migrationStore.state.searchQuery}
					<div class="py-12 text-center text-slate-500">
						<Search class="mx-auto mb-3 size-8 opacity-30" />
						<p>Wpisz klucz lub nazwę zadania, aby wyszukać</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex gap-3 border-t border-slate-700 p-4">
				<Button variant="secondary" onclick={handleClose} class="flex-1">Anuluj</Button>
				<Button
					variant="primary"
					onclick={handleAddSelected}
					class="flex-1"
					disabled={selectedIssues.size === 0}
				>
					{#if selectedIssues.size > 0}
						Dodaj zaznaczone ({selectedIssues.size})
					{:else}
						Wybierz zadania
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
