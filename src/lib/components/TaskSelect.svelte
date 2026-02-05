<script lang="ts">
	import { Search, Loader2, X } from 'lucide-svelte';
	import { searchJiraIssues } from '$lib/api/jiraApi';
	import type { JiraConfig } from '$lib/stores/settings.svelte';

	interface Props {
		config: JiraConfig;
		value: string;
		placeholder?: string;
		disabled?: boolean;
		onSelect: (key: string, summary: string) => void;
	}

	let { config, value, placeholder = 'Szukaj...', disabled = false, onSelect }: Props = $props();

	let searchQuery = $state(value || '');
	let isSearching = $state(false);
	let results = $state<any[]>([]);
	let showResults = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	let inputRef: HTMLInputElement | undefined = $state();

	async function handleSearch() {
		if (!searchQuery || searchQuery.length < 2) {
			results = [];
			return;
		}

		isSearching = true;
		try {
			results = await searchJiraIssues(config.baseUrl, config.email, config.apiToken, searchQuery);
		} finally {
			isSearching = false;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		showResults = true;

		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(handleSearch, 300);
	}

	function selectResult(result: any) {
		onSelect(result.issueKey, result.issueSummary);
		searchQuery = result.issueKey;
		showResults = false;
	}

	function handleBlur() {
		// Small delay to allow clicking on results
		setTimeout(() => {
			showResults = false;
		}, 200);
	}

	function handleFocus() {
		if (searchQuery.length >= 2) {
			showResults = true;
			if (results.length === 0) handleSearch();
		}
	}

	// Update local query if prop changes from outside (e.g. setting to empty)
	$effect(() => {
		if (value === '') {
			searchQuery = '';
		} else if (value && searchQuery === '') {
			searchQuery = value;
		}
	});
</script>

<div class="relative w-full">
	<div class="relative">
		<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
		<input
			bind:this={inputRef}
			type="text"
			{placeholder}
			{disabled}
			value={searchQuery}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			class="w-full rounded-lg border border-slate-700 bg-slate-900/50 py-2 pr-4 pl-9 text-sm text-slate-200 placeholder-slate-500 transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-900/20 disabled:text-slate-600 disabled:placeholder-slate-700"
		/>
		{#if isSearching}
			<Loader2
				class="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-500"
			/>
		{:else if searchQuery}
			<button
				type="button"
				onclick={() => {
					searchQuery = '';
					results = [];
					onSelect('', '');
					inputRef?.focus();
				}}
				class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-300"
			>
				<X class="size-4" />
			</button>
		{/if}
	</div>

	{#if showResults && (results.length > 0 || isSearching)}
		<div
			class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-1 shadow-2xl backdrop-blur-xl"
		>
			{#if isSearching && results.length === 0}
				<div class="flex items-center justify-center py-4 text-xs text-slate-500">
					<Loader2 class="mr-2 size-3 animate-spin" />
					Szukanie...
				</div>
			{:else if results.length > 0}
				{#each results as result}
					<button
						type="button"
						onclick={() => selectResult(result)}
						class="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-700/50"
					>
						<div class="flex items-center gap-2">
							<span class="text-xs font-bold text-emerald-400">{result.issueKey}</span>
							<span class="text-[10px] font-bold text-slate-500 uppercase">{result.type}</span>
						</div>
						<p class="truncate text-xs text-slate-300">{result.issueSummary}</p>
					</button>
				{/each}
			{:else if searchQuery.length >= 2}
				<div class="py-4 text-center text-xs text-slate-500">Nie znaleziono zadań</div>
			{/if}
		</div>
	{/if}
</div>
