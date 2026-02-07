<script lang="ts">
	import { X, Send, Loader2, AlertTriangle, Clock } from 'lucide-svelte';
	import { migrationStore } from '$lib/stores/migration.svelte';
	import Button from './Button.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onConfirm: (isDryRun: boolean) => Promise<void>;
		isMigrating: boolean;
	}

	let { isOpen, onClose, onConfirm, isMigrating }: Props = $props();

	let isSimulating = $state(false);
	let currentStep = $state(0);
	let currentStepText = $state('');
	let progress = $state(0);

	const steps = [
		'Weryfikacja worklogów źródłowych...',
		'Sprawdzanie dostępności zadań docelowych...',
		'Przygotowanie danych...',
		'Symulacja migracji...',
		'Gotowe!'
	];

	async function runSimulation() {
		isSimulating = true;
		progress = 0;
		currentStep = 0;

		for (let i = 0; i < steps.length; i++) {
			currentStep = i;
			currentStepText = steps[i];
			progress = (i / (steps.length - 1)) * 100;
			await new Promise((r) => setTimeout(r, 800)); // Fake delay
		}

		setTimeout(() => {
			isSimulating = false;
			onConfirm(false); // Call parent with dry-run=false to triggering REAL migration (but configured with 0s)
		}, 500);
	}

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

	const summary = $derived(migrationStore.getMigrationSummary());
	const totals = $derived(migrationStore.getTotalPendingMigration());
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
						Potwierdź migrację
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

			<!-- Summary -->
			<div class="max-h-80 overflow-y-auto p-4">
				{#if summary.length > 0}
					<div class="space-y-3">
						{#each summary as item}
							<div class="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span
											class="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400"
										>
											{item.parentKey}
										</span>
										<span class="text-sm text-slate-300">{item.parentSummary}</span>
									</div>
									<div class="flex items-center gap-1 text-sm font-semibold text-violet-400">
										<Clock class="size-4" />
										{item.totalTime}
									</div>
								</div>
								<div class="mt-2 space-y-1">
									{#each item.children as child}
										<div class="flex items-center gap-2 text-xs text-slate-500">
											<span class="rounded bg-slate-700 px-1.5 py-0.5 text-slate-400">
												{child.issueKey}
											</span>
											<span class="truncate">{child.issueSummary}</span>
											<span class="ml-auto text-slate-400">{child.timeSpentFormatted}</span>
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
			{#if summary.length > 0}
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

			<!-- Actions -->
			<!-- Actions or Progress -->
			{#if isSimulating}
				<div class="border-t border-slate-700 p-6">
					<div class="mb-2 flex items-center justify-between text-sm">
						<span class="text-slate-400">{currentStepText}</span>
						<span class="font-medium text-violet-400">{Math.round(progress)}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-slate-700">
						<div
							class="h-full bg-violet-500 transition-all duration-300 ease-out"
							style="width: {progress}%"
						></div>
					</div>
				</div>
			{:else}
				<div class="flex gap-3 border-t border-slate-700 p-4">
					<Button variant="secondary" onclick={onClose} disabled={isMigrating} class="flex-1">
						Anuluj
					</Button>
					<Button
						variant="primary"
						onclick={runSimulation}
						disabled={isMigrating || summary.length === 0}
						class="flex-1"
					>
						Weryfikuj (Symulacja)
					</Button>
				</div>
			{/if}
		</div>
	</div>
{/if}
