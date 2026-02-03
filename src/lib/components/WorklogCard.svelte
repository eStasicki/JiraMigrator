<script lang="ts">
	import { GripVertical, Clock, MessageSquare, Check } from 'lucide-svelte';
	import type { WorklogEntry } from '$lib/stores/migration.svelte';

	interface Props {
		worklog: WorklogEntry;
		draggable?: boolean;
		isSelected?: boolean;
		showCheckbox?: boolean;
		onToggleSelect?: () => void;
		ondragstart?: (e: DragEvent) => void;
		ondragend?: (e: DragEvent) => void;
	}

	let {
		worklog,
		draggable = true,
		isSelected = false,
		showCheckbox = true,
		onToggleSelect,
		ondragstart,
		ondragend
	}: Props = $props();

	let isDragging = $state(false);
	let mouseDownPos = $state<{ x: number; y: number } | null>(null);

	function handleDragStart(e: DragEvent) {
		isDragging = true;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('application/json', JSON.stringify(worklog));
			// Mark if this is part of multi-select drag
			e.dataTransfer.setData('text/plain', isSelected ? 'multi' : 'single');
		}
		ondragstart?.(e);
	}

	function handleDragEnd(e: DragEvent) {
		isDragging = false;
		ondragend?.(e);
	}

	function handleMouseDown(e: MouseEvent) {
		// Save mouse position at start
		mouseDownPos = { x: e.clientX, y: e.clientY };
	}

	function handleClick(e: MouseEvent) {
		// Check if user was selecting text (dragged mouse)
		if (mouseDownPos) {
			const dx = Math.abs(e.clientX - mouseDownPos.x);
			const dy = Math.abs(e.clientY - mouseDownPos.y);

			// If mouse moved more than 5px, user was probably selecting text - don't toggle
			if (dx > 5 || dy > 5) {
				mouseDownPos = null;
				return;
			}
		}

		// Check if there's text selected - if so, don't toggle (user is copying)
		const selection = window.getSelection();
		if (selection && selection.toString().length > 0) {
			mouseDownPos = null;
			return;
		}

		mouseDownPos = null;
		onToggleSelect?.();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	{draggable}
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	onmousedown={handleMouseDown}
	onclick={handleClick}
	role="listitem"
	class="group relative cursor-pointer rounded-lg border p-4 transition-all duration-200
		{isDragging ? 'scale-105 opacity-50 shadow-2xl ring-2 ring-violet-500' : ''}
		{isSelected
		? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/50'
		: 'border-slate-700/50 bg-slate-800/60 hover:border-slate-600 hover:bg-slate-800'}"
>
	<div class="flex items-start gap-3">
		<!-- Checkbox -->
		{#if showCheckbox}
			<div
				class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-all
					{isSelected
					? 'border-violet-500 bg-violet-500 text-white'
					: 'border-slate-600 bg-slate-800 group-hover:border-violet-400'}"
			>
				{#if isSelected}
					<Check class="size-3" />
				{/if}
			</div>
		{/if}

		<!-- Drag handle -->
		{#if draggable}
			<div class="mt-0.5 text-slate-600 transition-colors group-hover:text-slate-400">
				<GripVertical class="size-4" />
			</div>
		{/if}

		<!-- Content - text is selectable -->
		<div class="min-w-0 flex-1 select-text">
			<!-- Issue Key & Summary -->
			<div class="mb-2">
				<span
					class="inline-block rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-400"
				>
					{worklog.issueKey}
				</span>
				<h4 class="mt-1 truncate text-sm font-medium text-slate-200" title={worklog.issueSummary}>
					{worklog.issueSummary}
				</h4>
			</div>

			<!-- Time & Comment -->
			<div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
				<div class="flex items-center gap-1">
					<Clock class="size-3.5" />
					<span class="font-semibold text-emerald-400">{worklog.timeSpentFormatted}</span>
				</div>
				{#if worklog.comment}
					<div class="flex items-center gap-1 truncate" title={worklog.comment}>
						<MessageSquare class="size-3.5 shrink-0" />
						<span class="truncate">{worklog.comment}</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
