<script lang="ts">
	import { ChevronDown, ChevronRight, Clock, Trash2, GripVertical } from 'lucide-svelte';
	import type { ParentTask, WorklogEntry } from '$lib/stores/migration.svelte';
	import { migrationStore } from '$lib/stores/migration.svelte';
	import WorklogCard from './WorklogCard.svelte';

	interface Props {
		parent: ParentTask;
	}

	let { parent }: Props = $props();

	let isDragOver = $state(false);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;

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
		migrationStore.removeChildFromParent(parent.id, worklogId);
	}

	function handleRemoveParent() {
		migrationStore.removeParent(parent.id);
	}

	function handleToggleExpand() {
		migrationStore.toggleParentExpanded(parent.id);
	}

	function getChildrenTotalTime(): string {
		return migrationStore.getTotalChildrenTime(parent.id);
	}
</script>

<div
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="region"
	aria-label={parent.issueKey}
	class="rounded-xl border transition-all duration-200
		{isDragOver
		? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
		: 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'}"
>
	<!-- Parent Header -->
	<div class="flex items-center gap-3 p-4">
		<button
			type="button"
			onclick={handleToggleExpand}
			class="flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
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
				{#if parent.children.length > 0}
					<span
						class="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-400"
					>
						+{parent.children.length}
					</span>
				{/if}
			</div>
			<p class="mt-1 truncate text-sm text-slate-300" title={parent.issueSummary}>
				{parent.issueSummary}
			</p>
		</div>

		<div class="flex items-center gap-2">
			<!-- Existing time in Y -->
			<div
				class="flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-2 py-1 text-xs text-slate-400"
				title="Czas już zalogowany w Jira Y"
			>
				<Clock class="size-3.5" />
				<span>{parent.totalTimeSpentFormatted}</span>
			</div>

			<!-- New time from children -->
			{#if parent.children.length > 0}
				<div
					class="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-400"
					title="Nowy czas do zmigrowania"
				>
					<span>+{getChildrenTotalTime()}</span>
				</div>
			{/if}

			<button
				type="button"
				onclick={handleRemoveParent}
				class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
				title="Usuń rodzica"
			>
				<Trash2 class="size-4" />
			</button>
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
					<p class="text-sm text-slate-500">
						{isDragOver ? '📥 Upuść tutaj' : 'Przeciągnij worklogi z Jira X'}
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each parent.children as child (child.id)}
						<WorklogCard worklog={child} draggable={false} showCheckbox={false} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
