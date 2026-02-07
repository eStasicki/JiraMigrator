<script lang="ts">
	import { ChevronDown, ChevronRight, Clock, Trash2, CheckSquare, Square } from 'lucide-svelte';
	import type { ParentTask, WorklogEntry } from '$lib/stores/migration.svelte';
	import { migrationStore } from '$lib/stores/migration.svelte';
	import { flip } from 'svelte/animate';
	import WorklogCard from './WorklogCard.svelte';

	interface Props {
		parent: ParentTask;
	}

	let { parent }: Props = $props();

	const isDragOver = $derived(migrationStore.state.dragOverParentId === parent.id);
	const selectedChildrenCount = $derived(migrationStore.getSelectedChildrenCount(parent.id));
	const selectedChildrenTime = $derived(migrationStore.getSelectedChildrenTotalTime(parent.id));
	const allChildrenSelected = $derived(
		parent.children.length > 0 && selectedChildrenCount === parent.children.length
	);

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		migrationStore.setDragOverParent(parent.id);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		// In case dragenter was missed
		if (!isDragOver) {
			migrationStore.setDragOverParent(parent.id);
		}
	}

	function handleDragLeave() {
		// We don't clear here because moving into a child (like WorklogCard)
		// would clear it. Instead, the child (WorklogCard) or the Column
		// will set it to something else or clear it.
		// However, to be safe, we can clear if we are sure we left the whole card.
		// But with global state, it's often better to let the next 'enter' or 'over' take over.
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		migrationStore.clearAllDragOver();

		if (migrationStore.state.isPeriodLocked) return;

		const data = e.dataTransfer?.getData('application/json');
		const dragType = e.dataTransfer?.getData('text/plain');

		if (data) {
			const worklog: WorklogEntry = JSON.parse(data);

			// Check if this was a multi-select drag (the dragged item was selected)
			if (dragType === 'multi' && migrationStore.getSelectedCount() > 0) {
				// Add all selected worklogs to this parent
				migrationStore.addSelectedToParent(parent.id);
			} else {
				// Single item drag
				migrationStore.addChildToParent(parent.id, worklog);
			}
		}
	}

	function handleRemoveChild(worklogId: string) {
		if (migrationStore.state.isPeriodLocked) return;
		migrationStore.removeChildFromParent(parent.id, worklogId);
	}

	function handleRemoveParent() {
		if (migrationStore.state.isPeriodLocked) return;
		migrationStore.removeParent(parent.id);
	}

	function handleToggleExpand() {
		migrationStore.toggleParentExpanded(parent.id);
	}

	function handleToggleSelectAll() {
		if (allChildrenSelected) {
			migrationStore.deselectAllChildrenInParent(parent.id);
		} else {
			migrationStore.selectAllChildrenInParent(parent.id);
		}
	}

	function handleRemoveSelected() {
		if (migrationStore.state.isPeriodLocked) return;
		migrationStore.removeSelectedChildrenFromParent(parent.id);
	}

	function getChildrenTotalTime(): string {
		return migrationStore.getTotalChildrenTime(parent.id);
	}
</script>

<div
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="region"
	aria-label={parent.issueKey}
	class="rounded-xl border transition-all duration-200
		{migrationStore.state.isPeriodLocked ? 'opacity-70 grayscale-[0.3]' : ''}
		{isDragOver
		? 'z-30 -translate-y-1 border-emerald-500 bg-emerald-500/10 shadow-2xl ring-4 ring-emerald-500/20'
		: 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'}"
>
	<!-- Parent Header -->
	<div class="flex items-center gap-3 p-4">
		<button
			type="button"
			onclick={handleToggleExpand}
			class="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
		>
			{#if parent.isExpanded}
				<ChevronDown class="size-5" />
			{:else}
				<ChevronRight class="size-5" />
			{/if}
		</button>

		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span
					class="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400"
				>
					{parent.issueKey}
				</span>
				{#if parent.children.some((c) => c.isNew)}
					<span
						class="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-400"
					>
						+{parent.children.filter((c) => c.isNew).length}
					</span>
				{/if}
			</div>
			<p class="mt-1 truncate text-sm text-slate-300" title={parent.issueSummary}>
				{parent.issueSummary}
			</p>
		</div>

		<div class="flex items-center gap-3">
			<!-- Time Dashboard -->
			<div
				class="flex items-center gap-2 rounded-xl bg-slate-900/60 p-1.5 shadow-inner ring-1 ring-white/5"
			>
				<div class="flex min-w-[70px] flex-col gap-0 px-2">
					<div class="flex items-center justify-between gap-2 leading-none">
						<span class="text-[9px] font-bold tracking-tight text-slate-500 uppercase"
							>Początek</span
						>
						<span class="font-mono text-[10px] font-bold text-slate-400"
							>{migrationStore.getInitialTime(parent.id)}</span
						>
					</div>
				</div>

				<div class="h-7 w-px bg-slate-700/50"></div>

				<div class="flex flex-col items-center px-2">
					<span class="mb-0.5 text-[8px] font-black tracking-[0.2em] text-slate-500 uppercase"
						>Łącznie</span
					>
					<div class="flex items-center gap-1.5 text-sm font-black text-white tabular-nums">
						<Clock class="size-3.5 text-violet-400" />
						<span>{migrationStore.getTotalTime(parent.id)}</span>
					</div>
				</div>
			</div>

			<button
				type="button"
				onclick={handleRemoveParent}
				disabled={migrationStore.state.isPeriodLocked}
				class="rounded-lg p-1.5 text-slate-500 transition-colors {migrationStore.state
					.isPeriodLocked
					? 'cursor-not-allowed opacity-50'
					: 'hover:bg-red-500/20 hover:text-red-400'}"
				title="Usuń rodzica"
			>
				<Trash2 class="size-4" />
			</button>
			{#if migrationStore.state.isPeriodLocked}
				<div title="Okres zamknięty" class="text-amber-500/50">
					<!-- Optional Lock Icon here if desired, but banner is enough -->
				</div>
			{/if}
		</div>
	</div>

	<!-- Children / Drop Zone -->
	{#if parent.isExpanded}
		<div class="border-t border-slate-700/30 p-3">
			{#if parent.children.length === 0}
				<div
					class="flex items-center justify-center rounded-lg border-2 border-dashed py-6 transition-colors
						{isDragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/30'}"
				>
					{#if isDragOver}
						<span class="flex items-center gap-2 font-bold text-emerald-400">
							📥 Upuść tutaj
							{#if migrationStore.getSelectedCount() > 0}
								<span
									class="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs ring-1 ring-emerald-500/30"
								>
									{migrationStore.getSelectedCount()} elem.
								</span>
							{/if}
						</span>
					{:else}
						<span class="text-slate-500">Przeciągnij worklogi z Jira X tutaj</span>
					{/if}
				</div>
			{:else}
				<!-- Selection toolbar for children -->
				<div class="mb-3 flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2">
					<button
						type="button"
						onclick={handleToggleSelectAll}
						disabled={migrationStore.state.isPeriodLocked}
						class="flex items-center gap-2 text-sm text-slate-400 transition-colors {migrationStore
							.state.isPeriodLocked
							? 'cursor-not-allowed opacity-50'
							: 'hover:text-white'}"
					>
						{#if allChildrenSelected}
							<CheckSquare class="size-4 text-emerald-400" />
							<span>Odznacz wszystkie</span>
						{:else}
							<Square class="size-4" />
							<span>Zaznacz wszystkie</span>
						{/if}
					</button>

					{#if selectedChildrenCount > 0}
						<div class="flex items-center gap-2">
							<span class="text-sm text-slate-400">
								Zaznaczono: <span class="font-semibold text-emerald-400"
									>{selectedChildrenCount}</span
								>
							</span>
							<span
								class="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400"
							>
								{selectedChildrenTime}
							</span>
							<button
								type="button"
								onclick={handleRemoveSelected}
								disabled={migrationStore.state.isPeriodLocked}
								class="rounded-lg p-1.5 text-slate-500 transition-colors {migrationStore.state
									.isPeriodLocked
									? 'cursor-not-allowed opacity-50'
									: 'hover:bg-red-500/20 hover:text-red-400'}"
								title="Usuń zaznaczone"
							>
								<Trash2 class="size-4" />
							</button>
						</div>
					{/if}
				</div>

				<div class="space-y-2">
					{#each parent.children as child (child.id)}
						<div animate:flip={{ duration: 300 }}>
							<WorklogCard
								worklog={child}
								draggable={true}
								showCheckbox={!migrationStore.state.isPeriodLocked}
								isSelected={migrationStore.isChildWorklogSelected(parent.id, child.id)}
								onToggleSelect={() => {
									if (!migrationStore.state.isPeriodLocked) {
										migrationStore.toggleChildWorklogSelection(parent.id, child.id);
									}
								}}
								dropTargetParentId={parent.id}
								onRemove={() => handleRemoveChild(child.id)}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
