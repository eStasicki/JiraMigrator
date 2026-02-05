<script lang="ts">
	import { GripVertical, Clock, MessageSquare, Check, Edit2, X } from 'lucide-svelte';
	import type { WorklogEntry } from '$lib/stores/migration.svelte';
	import { migrationStore } from '$lib/stores/migration.svelte';

	interface Props {
		worklog: WorklogEntry;
		draggable?: boolean;
		isSelected?: boolean;
		showCheckbox?: boolean;
		dropTargetParentId?: string; // New: context for reordering
		onToggleSelect?: () => void;
		ondragstart?: (e: DragEvent) => void;
		ondragend?: (e: DragEvent) => void;
	}

	let {
		worklog,
		draggable = true,
		isSelected = false,
		showCheckbox = true,
		dropTargetParentId,
		onToggleSelect,
		ondragstart,
		ondragend
	}: Props = $props();

	let isDragging = $state(false);
	let isEditing = $state(false);
	let editComment = $state(worklog.comment);
	let editTime = $state(worklog.timeSpentFormatted);
	let mouseDownPos = $state<{ x: number; y: number } | null>(null);

	// Reordering state
	const isDragOverTarget = $derived(migrationStore.state.dragOverWorklogId === worklog.id);
	const dragOverSide = $derived(isDragOverTarget ? migrationStore.state.dragOverWorklogSide : null);

	function handleDragStart(e: DragEvent) {
		if (isEditing) {
			e.preventDefault();
			return;
		}

		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('application/json', JSON.stringify(worklog));
			const isMulti = isSelected;
			e.dataTransfer.setData('text/plain', isMulti ? 'multi' : 'single');
		}

		// Add global class to body to allow styling other elements during drag
		document.body.classList.add('dragging-active');

		// Delay opacity change to capture full-opacity drag image
		setTimeout(() => {
			isDragging = true;
		}, 0);

		ondragstart?.(e);
	}

	function handleDragEnd(e: DragEvent) {
		isDragging = false;
		document.body.classList.remove('dragging-active');
		migrationStore.clearAllDragOver();
		ondragend?.(e);
	}

	function handleDragOver(e: DragEvent) {
		if (!dropTargetParentId) return;

		e.preventDefault();
		e.stopPropagation();

		if (isDragging) return; // Don't drop on self

		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const midY = rect.top + rect.height / 2;

		const side = e.clientY < midY ? 'top' : 'bottom';
		migrationStore.setDragOverWorklog(worklog.id, side);
		migrationStore.setDragOverParent(dropTargetParentId);

		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragLeave() {
		if (isDragOverTarget) {
			migrationStore.setDragOverWorklog(null);
		}
	}

	function handleDrop(e: DragEvent) {
		if (!dropTargetParentId || !dragOverSide) return;

		e.preventDefault();
		e.stopPropagation();

		const dropSide = dragOverSide;
		migrationStore.clearAllDragOver();

		const data = e.dataTransfer?.getData('application/json');
		const dragType = e.dataTransfer?.getData('text/plain');

		if (data) {
			const droppedWorklog: WorklogEntry = JSON.parse(data);
			const position = dropSide === 'top' ? 'before' : 'after';

			if (dragType === 'multi' && migrationStore.getSelectedCount() > 0) {
				migrationStore.addSelectedToParent(dropTargetParentId, worklog.id, position);
			} else {
				migrationStore.addChildrenToParentAt(
					dropTargetParentId,
					[droppedWorklog],
					worklog.id,
					position
				);
			}
		}
	}

	function handleMouseDown(e: MouseEvent) {
		// Save mouse position at start
		mouseDownPos = { x: e.clientX, y: e.clientY };
	}

	function handleClick(e: MouseEvent) {
		if (isEditing) return;

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

	function startEdit(e: MouseEvent) {
		e.stopPropagation();
		editComment = worklog.comment;
		editTime = worklog.timeSpentFormatted;
		isEditing = true;
	}

	function saveEdit() {
		migrationStore.updateWorklog(worklog.id, {
			comment: editComment,
			timeSpentFormatted: editTime
		});
		isEditing = false;
	}

	function cancelEdit() {
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveEdit();
		if (e.key === 'Escape') cancelEdit();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	{draggable}
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onmousedown={handleMouseDown}
	onclick={handleClick}
	role="listitem"
	class="group relative rounded-lg border p-4 transition-all duration-200
		{draggable ? 'cursor-grab' : 'cursor-default'}
		{isDragging
		? 'scale-[0.98] cursor-grabbing opacity-20 shadow-none ring-1 ring-slate-700'
		: 'hover:shadow-lg'}
		{isSelected
		? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/50'
		: 'border-slate-700/50 bg-slate-800/60 hover:border-slate-600 hover:bg-slate-800'}"
>
	<!-- Drop Indicators -->
	{#if dragOverSide === 'top'}
		<div
			class="absolute -top-1.5 right-0 left-0 z-50 h-1 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
		></div>
	{/if}
	{#if dragOverSide === 'bottom'}
		<div
			class="absolute right-0 -bottom-1.5 left-0 z-50 h-1 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
		></div>
	{/if}
	<div class="flex items-start gap-3">
		<!-- Checkbox -->
		{#if showCheckbox && !isEditing}
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
		{#if draggable && !isEditing}
			<div class="mt-0.5 text-slate-600 transition-colors group-hover:text-slate-400">
				<GripVertical class="size-4" />
			</div>
		{/if}

		<!-- Content - text is selectable -->
		<div class="min-w-0 flex-1 select-text">
			{#if isEditing}
				<div class="space-y-3" onclick={(e) => e.stopPropagation()}>
					<div>
						<label
							for="edit-comment-{worklog.id}"
							class="mb-1 block text-[10px] font-bold tracking-wider text-slate-500 uppercase"
							>Opis (Komentarz)</label
						>
						<input
							id="edit-comment-{worklog.id}"
							type="text"
							bind:value={editComment}
							onkeydown={handleKeydown}
							class="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
							placeholder="Co robiłeś?"
						/>
					</div>
					<div>
						<label
							for="edit-time-{worklog.id}"
							class="mb-1 block text-[10px] font-bold tracking-wider text-slate-500 uppercase"
							>Czas (np. 1h 30m)</label
						>
						<input
							id="edit-time-{worklog.id}"
							type="text"
							bind:value={editTime}
							onkeydown={handleKeydown}
							class="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
							placeholder="1h 30m"
						/>
					</div>
					<div class="flex justify-end gap-2 pt-1">
						<button
							onclick={cancelEdit}
							class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
						>
							<X class="size-3" /> Anuluj
						</button>
						<button
							onclick={saveEdit}
							class="flex items-center gap-1 rounded bg-violet-500 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-violet-600"
						>
							<Check class="size-3" /> Zapisz
						</button>
					</div>
				</div>
			{:else}
				<!-- Issue Key & Summary -->
				<div class="mb-2">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span
								class="inline-block rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-400"
							>
								{worklog.issueKey}
							</span>

							<div
								class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/20"
							>
								<Clock class="size-3" />
								<span>{worklog.timeSpentFormatted}</span>
							</div>
						</div>

						<button
							onclick={startEdit}
							class="rounded p-1 text-slate-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-700 hover:text-white"
							title="Edytuj wpis"
						>
							<Edit2 class="size-3.5" />
						</button>
					</div>
					<h4 class="mt-1 truncate text-sm font-medium text-slate-200" title={worklog.issueSummary}>
						{worklog.issueSummary}
					</h4>
				</div>
			{/if}
		</div>
	</div>
</div>
