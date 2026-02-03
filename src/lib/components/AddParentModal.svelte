<script lang="ts">
	import { X, Search, Loader2, Plus } from 'lucide-svelte';
	import { migrationStore, type ParentTask } from '$lib/stores/migration.svelte';
	import { searchJiraYTasks } from '$lib/api/mockJiraApi';
	import Button from './Button.svelte';

	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	async function handleSearch() {
		const query = migrationStore.state.searchQuery;

		if (!query.trim()) {
			migrationStore.setSearchResults([]);
			return;
		}

		migrationStore.setIsSearching(true);
		try {
			const results = await searchJiraYTasks(query);
			// Filter out already added parents
			const existingKeys = migrationStore.state.jiraYParents.map((p) => p.issueKey);
			const filteredResults = results.filter((r) => !existingKeys.includes(r.issueKey));
			migrationStore.setSearchResults(filteredResults);
		} finally {
			migrationStore.setIsSearching(false);
		}
	}

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		migrationStore.setSearchQuery(target.value);

		// Debounce search
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(handleSearch, 300);
	}

	function handleAddParent(parent: ParentTask) {
		migrationStore.addParent(parent);
		migrationStore.closeAddParentModal();
	}

	function handleClose() {
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
			class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-700 p-4">
				<h2 id="modal-title" class="text-lg font-semibold text-white">Dodaj rodzica z Jira Y</h2>
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
			</div>

			<!-- Results -->
			<div class="max-h-80 overflow-y-auto border-t border-slate-700 p-4">
				{#if migrationStore.state.searchResults.length > 0}
					<div class="space-y-2">
						{#each migrationStore.state.searchResults as result}
							<button
								type="button"
								onclick={() => handleAddParent(result)}
								class="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-left transition-all hover:border-violet-500/50 hover:bg-slate-900"
							>
								<div
									class="flex size-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20"
								>
									<Plus class="size-5 text-emerald-400" />
								</div>
								<div class="min-w-0 flex-1">
									<span
										class="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400"
									>
										{result.issueKey}
									</span>
									<p class="mt-1 truncate text-sm text-slate-300">{result.issueSummary}</p>
								</div>
							</button>
						{/each}
					</div>
				{:else if migrationStore.state.searchQuery && !migrationStore.state.isSearching}
					<div class="py-8 text-center text-slate-500">
						<p>Nie znaleziono zadań pasujących do "{migrationStore.state.searchQuery}"</p>
					</div>
				{:else if !migrationStore.state.searchQuery}
					<div class="py-8 text-center text-slate-500">
						<Search class="mx-auto mb-3 size-8 opacity-50" />
						<p>Wpisz klucz lub nazwę zadania, aby wyszukać</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="border-t border-slate-700 p-4">
				<Button variant="secondary" onclick={handleClose} class="w-full">Anuluj</Button>
			</div>
		</div>
	</div>
{/if}
