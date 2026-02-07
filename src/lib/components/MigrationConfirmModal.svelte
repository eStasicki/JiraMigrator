<script lang="ts">
	import { X, Send, Loader2, AlertTriangle, Clock } from 'lucide-svelte';
	import { migrationStore } from '$lib/stores/migration.svelte';
	import Button from './Button.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onConfirm: (isDryRun: boolean) => Promise<void>;
		isMigrating: boolean;
		migrationProgress?: {
			current: number;
			total: number;
			percentage: number;
			currentParent: string;
			currentWorklog: string;
			phase: string;
		} | null;
	}

	let { isOpen, onClose, onConfirm, isMigrating, migrationProgress = null }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !isMigrating) {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget && !isMigrating) {
			onClose();
		}
	}

	async function handleConfirm() {
		await onConfirm(false);
	}

	const summary = $derived(migrationStore.getMigrationSummary());
	const totals = $derived(migrationStore.getTotalPendingMigration());
	const selectedDate = $derived(migrationStore.state.jiraXDate);
	const formattedDate = $derived(
		selectedDate.toLocaleDateString('pl-PL', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
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
			aria-labelledby="confirm-modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-700 p-4">
				<div class="flex items-center gap-3">
					<div class="flex shrink-0 items-center justify-center rounded-full bg-violet-500/20">
						<Send class="size-5 text-violet-400" />
					</div>
					<h2 id="confirm-modal-title" class="text-lg font-semibold text-white">
						Potwierdź migrację worklogów
					</h2>
				</div>
				{#if !isMigrating}
					<button
						type="button"
						onclick={onClose}
						class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
					>
						<X class="size-5" />
					</button>
				{/if}
			</div>

			<!-- Target Date Info -->
			<div class="border-b border-slate-700 bg-violet-500/10 px-4 py-3">
				<div class="flex items-center gap-2 text-sm">
					<Clock class="size-4 text-violet-400" />
					<span class="text-slate-300">Worklogi zostaną zmigrowane na dzień:</span>
					<span class="font-semibold text-violet-400">{formattedDate}</span>
				</div>
			</div>

			<!-- Summary -->
			<div class="max-h-80 overflow-y-auto p-4">
				{#if summary.length > 0}
					<div class="space-y-3">
						{#each summary as item}
							<div class="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
								<div class="flex items-center justify-between gap-3">
									<div class="flex min-w-0 flex-1 items-center gap-2">
										<span
											class="inline-flex min-w-[80px] items-center justify-center rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-400"
										>
											{item.parentKey}
										</span>
										<span class="truncate text-sm text-slate-300">{item.parentSummary}</span>
									</div>
									<div
										class="flex shrink-0 items-center gap-1 text-sm font-semibold text-violet-400"
									>
										<Clock class="size-4" />
										{item.totalTime}
									</div>
								</div>
								<div class="mt-3 space-y-1.5 border-t border-slate-700/50 pt-2">
									{#each item.children as child}
										<div class="flex items-center gap-2 text-xs">
											<span
												class="inline-flex min-w-[80px] shrink-0 items-center justify-center rounded bg-slate-700/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-300"
											>
												{child.issueKey}
											</span>
											<span class="min-w-0 flex-1 truncate text-slate-400"
												>{child.issueSummary}</span
											>
											<span class="shrink-0 font-mono text-[10px] font-semibold text-violet-400"
												>{child.timeSpentFormatted}</span
											>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex items-center gap-3 rounded-lg bg-amber-500/10 p-4 text-amber-400">
						<AlertTriangle class="size-5 shrink-0" />
						<p>
							Nie ma żadnych worklogów do zmigrowania. Przeciągnij worklogi z Jira X do rodziców w
							Jira Y.
						</p>
					</div>
				{/if}
			</div>

			<!-- Totals -->
			{#if summary.length > 0 && !isMigrating}
				<div class="border-t border-slate-700 bg-slate-900/50 px-4 py-3">
					<div class="flex items-center justify-between text-sm">
						<span class="text-slate-400">Łącznie do migracji:</span>
						<div class="flex items-center gap-3">
							<span class="font-medium text-white">{totals.count} worklogów</span>
							<span class="rounded-lg bg-violet-500/20 px-2 py-1 font-semibold text-violet-400">
								{totals.time}
							</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Migration Progress -->
			{#if isMigrating && migrationProgress}
				<div class="border-t border-slate-700 bg-slate-900/50 p-6">
					<!-- Phase and Percentage -->
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Loader2 class="size-4 animate-spin text-violet-400" />
							<span class="text-sm font-medium text-slate-300">{migrationProgress.phase}</span>
						</div>
						<span class="text-2xl font-bold text-violet-400">{migrationProgress.percentage}%</span>
					</div>

					<!-- Progress Bar -->
					<div class="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-700">
						<div
							class="h-full bg-linear-to-r from-violet-500 to-emerald-500 transition-all duration-300 ease-out"
							style="width: {migrationProgress.percentage}%"
						></div>
					</div>

					<!-- Current Task Details -->
					<div class="space-y-2 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-slate-400">Postęp:</span>
							<span class="font-mono text-slate-300"
								>{migrationProgress.current} / {migrationProgress.total}</span
							>
						</div>

						{#if migrationProgress.currentParent}
							<div class="flex items-start gap-2">
								<span class="shrink-0 text-slate-400">Zadanie:</span>
								<span
									class="min-w-[80px] rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-400"
								>
									{migrationProgress.currentParent}
								</span>
							</div>
						{/if}

						{#if migrationProgress.currentWorklog}
							<div class="flex items-start gap-2">
								<span class="shrink-0 text-slate-400">Worklog:</span>
								<span class="font-medium text-violet-300">{migrationProgress.currentWorklog}</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Actions -->
			{#if !isMigrating}
				<div class="flex gap-3 border-t border-slate-700 p-4">
					<Button variant="secondary" onclick={onClose} disabled={isMigrating} class="flex-1">
						Anuluj
					</Button>
					<Button
						variant="primary"
						onclick={handleConfirm}
						disabled={isMigrating || summary.length === 0}
						class="flex-1"
					>
						<Send class="size-4" />
						Potwierdź migrację
					</Button>
				</div>
			{/if}
		</div>
	</div>
{/if}
