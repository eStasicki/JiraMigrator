import { SvelteSet, SvelteMap } from 'svelte/reactivity';
import { formatTime } from '$lib/utils';
import { settingsStore } from './settings.svelte';

export interface WorklogEntry {
	id: string;
	issueKey: string;
	issueSummary: string;
	timeSpentSeconds: number;
	timeSpentFormatted: string;
	comment: string;
	author: string;
	started: string;
	labels?: string[];
	isNew?: boolean;
}

export interface ParentTask {
	id: string;
	issueKey: string;
	issueSummary: string;
	totalTimeSpentSeconds: number;
	totalTimeSpentFormatted: string;
	type: string;
	status: string;
	children: WorklogEntry[];
	isExpanded: boolean;
	initialTotalTimeSeconds?: number;
}

export interface MigrationState {
	jiraXDate: Date;
	jiraYMonth: Date;
	jiraXWorklogs: WorklogEntry[];
	jiraYParents: ParentTask[];
	selectedWorklogIds: Set<string>;
	isLoadingX: boolean;
	isLoadingY: boolean;
	isMigrating: boolean;
	isAddParentModalOpen: boolean;
	searchQuery: string;
	searchResults: ParentTask[];
	isSearching: boolean;
	dragOverParentId: string | null;
	dragOverWorklogId: string | null;
	dragOverWorklogSide: 'top' | 'bottom' | null;
}

function parseFormattedTime(formatted: string): number {
	if (!formatted) return 0;
	const clean = formatted.trim().toLowerCase();
	let totalSeconds = 0;

	// 1. Try to find hours (supports "1h", "1.5h", "1,5 h")
	const hMatch = clean.match(/(\d+([.,]\d+)?)\s*h/);
	if (hMatch) {
		const hVal = hMatch[1].replace(',', '.');
		totalSeconds += Math.round(parseFloat(hVal) * 3600);
	}

	// 2. Try to find minutes (supports "15m", "15 m")
	const mMatch = clean.match(/(\d+([.,]\d+)?)\s*m/);
	if (mMatch) {
		const mVal = mMatch[1].replace(',', '.');
		totalSeconds += Math.round(parseFloat(mVal) * 60);
	}

	// 3. Fallback: handle pure numbers
	if (!hMatch && !mMatch) {
		// Pure decimal or integer without unit
		if (/^(\d+([.,]\d+)?)$/.test(clean)) {
			const val = clean.replace(',', '.');
			// If it's a small decimal (like 0.5) or contains a separator, treat as hours
			// If it's a large integer (like 30), treat as minutes
			if (val.includes('.') || parseFloat(val) < 8) {
				totalSeconds = Math.round(parseFloat(val) * 3600);
			} else {
				totalSeconds = parseInt(val) * 60;
			}
		}
	}

	return totalSeconds;
}

function createMigrationStore() {
	const today = new Date();

	const state = $state<MigrationState>({
		jiraXDate: today,
		jiraYMonth: today,
		jiraXWorklogs: [],
		jiraYParents: [],
		selectedWorklogIds: new SvelteSet<string>(),
		isLoadingX: false,
		isLoadingY: false,
		isMigrating: false,
		isAddParentModalOpen: false,
		searchQuery: '',
		searchResults: [],
		isSearching: false,
		dragOverParentId: null,
		dragOverWorklogId: null,
		dragOverWorklogSide: null
	});

	function setDragOverParent(parentId: string | null) {
		state.dragOverParentId = parentId;
	}

	function setDragOverWorklog(worklogId: string | null, side: 'top' | 'bottom' | null = null) {
		state.dragOverWorklogId = worklogId;
		state.dragOverWorklogSide = side;
	}

	function clearAllDragOver() {
		state.dragOverParentId = null;
		state.dragOverWorklogId = null;
		state.dragOverWorklogSide = null;
	}

	function setJiraXDate(date: Date) {
		state.jiraXDate = date;
	}

	function setJiraYMonth(date: Date) {
		state.jiraYMonth = date;
	}

	function setJiraXWorklogs(worklogs: WorklogEntry[]) {
		state.jiraXWorklogs = worklogs;
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function setJiraYParents(parents: ParentTask[]) {
		// Collect existing pending migrations (isNew children) grouped by parent issueKey
		const pendingByParentKey = new SvelteMap<string, WorklogEntry[]>();
		const existingPlaceholders = new SvelteMap<string, ParentTask>();

		for (const p of state.jiraYParents) {
			const pending = p.children.filter((c) => c.isNew);
			if (pending.length > 0) {
				pendingByParentKey.set(p.issueKey, pending);
				// If it has "Z reguły" status, it's likely a placeholder created by applyRules
				if (p.status === 'Z reguły') {
					existingPlaceholders.set(p.issueKey, p);
				}
			}
		}

		// Update state with new parents, but merge pending children
		state.jiraYParents = parents.map((p) => {
			const initialTotalSeconds = p.children.reduce((sum, c) => sum + (c.timeSpentSeconds || 0), 0);
			const pendingByRule = pendingByParentKey.get(p.issueKey) || [];

			return {
				...p,
				initialTotalTimeSeconds: initialTotalSeconds,
				children: [...p.children, ...pendingByRule]
			};
		});

		// Add back any placeholder parents that weren't in the new list but have pending worklogs
		for (const key of pendingByParentKey.keys()) {
			if (!state.jiraYParents.find((p) => p.issueKey === key)) {
				const placeholder = existingPlaceholders.get(key);
				if (placeholder) {
					state.jiraYParents.push(placeholder);
				}
			}
		}
	}

	function setLoadingX(loading: boolean) {
		state.isLoadingX = loading;
	}

	function setLoadingY(loading: boolean) {
		state.isLoadingY = loading;
	}

	function setMigrating(migrating: boolean) {
		state.isMigrating = migrating;
	}

	function toggleParentExpanded(parentId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			parent.isExpanded = !parent.isExpanded;
		}
	}

	function toggleWorklogSelection(worklogId: string) {
		const newSet = new SvelteSet(state.selectedWorklogIds);
		if (newSet.has(worklogId)) {
			newSet.delete(worklogId);
		} else {
			newSet.add(worklogId);
		}
		state.selectedWorklogIds = newSet;
	}

	function selectAllWorklogs() {
		state.selectedWorklogIds = new SvelteSet(state.jiraXWorklogs.map((w) => w.id));
	}

	function deselectAllWorklogs() {
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function isWorklogSelected(worklogId: string): boolean {
		return state.selectedWorklogIds.has(worklogId);
	}

	function getSelectedWorklogs(): WorklogEntry[] {
		return state.jiraXWorklogs.filter((w) => state.selectedWorklogIds.has(w.id));
	}

	function getSelectedCount(): number {
		return state.selectedWorklogIds.size;
	}

	function getSelectedTotalTime(): string {
		const selected = getSelectedWorklogs();
		const totalSeconds = selected.reduce((sum, w) => sum + w.timeSpentSeconds, 0);
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function addSelectedToParent(
		parentId: string,
		targetWorklogId?: string,
		position: 'before' | 'after' = 'after'
	) {
		const selected = getSelectedWorklogs().map((w) => ({ ...w, isNew: true }));
		addChildrenToParentAt(parentId, selected, targetWorklogId, position);
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function addChildToParent(parentId: string, worklog: WorklogEntry) {
		addChildrenToParentAt(parentId, [{ ...worklog, isNew: true }]);
	}

	function addChildrenToParentAt(
		parentId: string,
		worklogs: WorklogEntry[],
		targetWorklogId?: string,
		position: 'before' | 'after' = 'after'
	) {
		const worklogIds = new Set(worklogs.map((w) => w.id));

		// Remove from source (X column)
		state.jiraXWorklogs = state.jiraXWorklogs.filter((w) => !worklogIds.has(w.id));

		// Remove from any existing parent
		for (const p of state.jiraYParents) {
			p.children = p.children.filter((c) => !worklogIds.has(c.id));
		}

		const targetParent = state.jiraYParents.find((p) => p.id === parentId);
		if (targetParent) {
			if (!targetWorklogId) {
				// Append to end
				targetParent.children = [...targetParent.children, ...worklogs];
			} else {
				// Insert at specific position
				const index = targetParent.children.findIndex((c) => c.id === targetWorklogId);
				if (index !== -1) {
					const insertIndex = position === 'before' ? index : index + 1;
					const newChildren = [...targetParent.children];
					newChildren.splice(insertIndex, 0, ...worklogs);
					targetParent.children = newChildren;
				} else {
					targetParent.children = [...targetParent.children, ...worklogs];
				}
			}
			targetParent.isExpanded = true;
		}
	}

	function removeChildFromParent(parentId: string, worklogId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			const worklog = parent.children.find((c) => c.id === worklogId);
			if (worklog) {
				parent.children = parent.children.filter((c) => c.id !== worklogId);
				if (!state.jiraXWorklogs.find((w) => w.id === worklogId)) {
					state.jiraXWorklogs = [...state.jiraXWorklogs, worklog];
				}
			}
		}
	}

	function addParent(parent: ParentTask) {
		if (!state.jiraYParents.find((p) => p.id === parent.id)) {
			state.jiraYParents = [
				...state.jiraYParents,
				{ ...parent, children: [], isExpanded: true, initialTotalTimeSeconds: 0 }
			];
		}
	}

	function removeParent(parentId: string) {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (parent) {
			for (const child of parent.children) {
				if (!state.jiraXWorklogs.find((w) => w.id === child.id)) {
					state.jiraXWorklogs = [...state.jiraXWorklogs, child];
				}
			}
			state.jiraYParents = state.jiraYParents.filter((p) => p.id !== parentId);
		}
	}

	function openAddParentModal() {
		state.isAddParentModalOpen = true;
		state.searchQuery = '';
		state.searchResults = [];
	}

	function closeAddParentModal() {
		state.isAddParentModalOpen = false;
		state.searchQuery = '';
		state.searchResults = [];
	}

	function setSearchQuery(query: string) {
		state.searchQuery = query;
	}

	function setSearchResults(results: ParentTask[]) {
		state.searchResults = results;
	}

	function setIsSearching(searching: boolean) {
		state.isSearching = searching;
	}

	function getInitialTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		return formatTime(parent.initialTotalTimeSeconds || 0, settingsStore.settings.timeFormat);
	}

	function getOriginalTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		const totalSeconds = parent.children
			.filter((c) => !c.isNew)
			.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function getAddedTime(parentId: string): string {
		return getTotalChildrenTime(parentId);
	}

	function getTotalTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		const totalSeconds = parent.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function getTotalChildrenTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return settingsStore.settings.timeFormat === 'decimal' ? '0' : '0m';
		const totalSeconds = parent.children
			.filter((c) => c.isNew)
			.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatTime(totalSeconds, settingsStore.settings.timeFormat);
	}

	function getTotalPendingMigration(): { count: number; time: string } {
		let totalSeconds = 0;
		let count = 0;
		for (const parent of state.jiraYParents) {
			const newChildren = parent.children.filter((c) => c.isNew);
			count += newChildren.length;
			totalSeconds += newChildren.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		}
		return { count, time: formatTime(totalSeconds, settingsStore.settings.timeFormat) };
	}

	function moveWorklogsToSource(worklogs: WorklogEntry[]) {
		const worklogIds = new Set(worklogs.map((w) => w.id));

		// Remove from all parents
		for (const p of state.jiraYParents) {
			p.children = p.children.filter((c) => !worklogIds.has(c.id));
		}

		// Add back to source if not already there
		for (const w of worklogs) {
			if (!state.jiraXWorklogs.find((xw) => xw.id === w.id)) {
				state.jiraXWorklogs = [...state.jiraXWorklogs, w];
			}
		}
	}

	function clearAllChildren() {
		for (const parent of state.jiraYParents) {
			for (const child of parent.children) {
				if (!state.jiraXWorklogs.find((w) => w.id === child.id)) {
					state.jiraXWorklogs = [...state.jiraXWorklogs, child];
				}
			}
			parent.children = [];
		}
	}

	function clearAllData() {
		state.jiraXWorklogs = [];
		state.jiraYParents = [];
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function getMigrationSummary(): {
		parentKey: string;
		parentSummary: string;
		children: WorklogEntry[];
		totalTime: string;
	}[] {
		return state.jiraYParents
			.filter((p) => p.children.some((c) => c.isNew))
			.map((p) => {
				const newChildren = p.children.filter((c) => c.isNew);
				return {
					parentKey: p.issueKey,
					parentSummary: p.issueSummary,
					children: newChildren,
					totalTime: formatTime(
						newChildren.reduce((sum, c) => sum + c.timeSpentSeconds, 0),
						settingsStore.settings.timeFormat
					)
				};
			});
	}

	function updateWorklog(id: string, updates: { comment?: string; timeSpentFormatted?: string }) {
		const xIdx = state.jiraXWorklogs.findIndex((w) => w.id === id);
		if (xIdx !== -1) {
			const w = state.jiraXWorklogs[xIdx];
			if (updates.comment !== undefined) w.comment = updates.comment;
			if (updates.timeSpentFormatted !== undefined) {
				const seconds = parseFormattedTime(updates.timeSpentFormatted);
				w.timeSpentSeconds = seconds;
				w.timeSpentFormatted = formatTime(seconds, settingsStore.settings.timeFormat);
			}
		}

		for (const parent of state.jiraYParents) {
			const yIdx = parent.children.findIndex((c) => c.id === id);
			if (yIdx !== -1) {
				const c = parent.children[yIdx];
				if (updates.comment !== undefined) {
					c.comment = updates.comment;
					c.issueSummary = updates.comment;
				}
				if (updates.timeSpentFormatted !== undefined) {
					const seconds = parseFormattedTime(updates.timeSpentFormatted);
					c.timeSpentSeconds = seconds;
					c.timeSpentFormatted = formatTime(seconds, settingsStore.settings.timeFormat);
				}
			}
		}
	}

	function applyRules() {
		const activeProject = settingsStore.getActiveProject();
		if (!activeProject || !activeProject.rules || activeProject.rules.length === 0) return;

		// Group worklogs by target parent key
		const ruleMatches = new SvelteMap<string, WorklogEntry[]>();

		state.jiraXWorklogs.forEach((worklog) => {
			for (const rule of activeProject.rules) {
				if (!rule.sourceValue || !rule.targetTaskKey) continue;

				let matched = false;
				if (rule.sourceType === 'task') {
					if (worklog.issueKey === rule.sourceValue) {
						matched = true;
					}
				} else if (rule.sourceType === 'label') {
					if (worklog.labels?.includes(rule.sourceValue)) {
						matched = true;
					}
				}

				if (matched) {
					const existing = ruleMatches.get(rule.targetTaskKey) || [];
					ruleMatches.set(rule.targetTaskKey, [...existing, { ...worklog, isNew: true }]);
					break; // Stop at first matching rule
				}
			}
		});

		// Apply moves for found matches
		ruleMatches.forEach((worklogs, targetKey) => {
			let parent = state.jiraYParents.find((p) => p.issueKey === targetKey);

			if (!parent) {
				// Try to find summary from rules to create a placeholder parent
				const ruleWithSummary = activeProject.rules.find(
					(r) => r.targetTaskKey === targetKey && r.targetTaskSummary
				);
				const summary = ruleWithSummary?.targetTaskSummary || 'Zadanie docelowe (Auto)';

				addParent({
					id: targetKey, // Fallback to key as ID
					issueKey: targetKey,
					issueSummary: summary,
					totalTimeSpentSeconds: 0,
					totalTimeSpentFormatted: '0h',
					type: 'Task',
					status: 'Z reguły',
					children: [],
					isExpanded: true
				});

				// Re-find the newly added parent
				parent = state.jiraYParents.find((p) => p.issueKey === targetKey);
			}

			if (parent) {
				addChildrenToParentAt(parent.id, worklogs);
			}
		});
	}

	return {
		get state() {
			return state;
		},
		setJiraXDate,
		setJiraYMonth,
		setJiraXWorklogs,
		setJiraYParents,
		setLoadingX,
		setLoadingY,
		setMigrating,
		setDragOverParent,
		setDragOverWorklog,
		clearAllDragOver,
		toggleParentExpanded,
		addChildToParent,
		addChildrenToParentAt,
		removeChildFromParent,
		moveWorklogsToSource,
		addParent,
		removeParent,
		openAddParentModal,
		closeAddParentModal,
		setSearchQuery,
		setSearchResults,
		setIsSearching,
		getInitialTime,
		getOriginalTime,
		getAddedTime,
		getTotalTime,
		getTotalChildrenTime,
		getTotalPendingMigration,
		clearAllChildren,
		clearAllData,
		getMigrationSummary,
		toggleWorklogSelection,
		selectAllWorklogs,
		deselectAllWorklogs,
		isWorklogSelected,
		getSelectedWorklogs,
		getSelectedCount,
		getSelectedTotalTime,
		addSelectedToParent,
		updateWorklog,
		applyRules
	};
}

export const migrationStore = createMigrationStore();
