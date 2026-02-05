import { SvelteSet } from 'svelte/reactivity';
import { formatSeconds } from '$lib/utils';

export interface WorklogEntry {
	id: string;
	issueKey: string;
	issueSummary: string;
	timeSpentSeconds: number;
	timeSpentFormatted: string;
	comment: string;
	author: string;
	started: string;
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
	let totalSeconds = 0;
	const hMatch = formatted.match(/(\d+)h/);
	const mMatch = formatted.match(/(\d+)m/);

	if (hMatch) totalSeconds += parseInt(hMatch[1]) * 3600;
	if (mMatch) totalSeconds += parseInt(mMatch[1]) * 60;

	if (!hMatch && !mMatch && /^\d+$/.test(formatted)) {
		totalSeconds = parseInt(formatted) * 60;
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
		state.jiraYParents = parents;
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
		return formatSeconds(totalSeconds);
	}

	function addSelectedToParent(
		parentId: string,
		targetWorklogId?: string,
		position: 'before' | 'after' = 'after'
	) {
		const selected = getSelectedWorklogs();
		addChildrenToParentAt(parentId, selected, targetWorklogId, position);
		state.selectedWorklogIds = new SvelteSet<string>();
	}

	function addChildToParent(parentId: string, worklog: WorklogEntry) {
		addChildrenToParentAt(parentId, [worklog]);
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
			state.jiraYParents = [...state.jiraYParents, { ...parent, children: [], isExpanded: true }];
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

	function getTotalChildrenTime(parentId: string): string {
		const parent = state.jiraYParents.find((p) => p.id === parentId);
		if (!parent) return '0m';
		const totalSeconds = parent.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		return formatSeconds(totalSeconds);
	}

	function getTotalPendingMigration(): { count: number; time: string } {
		let totalSeconds = 0;
		let count = 0;
		for (const parent of state.jiraYParents) {
			count += parent.children.length;
			totalSeconds += parent.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0);
		}
		return { count, time: formatSeconds(totalSeconds) };
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

	function getMigrationSummary(): {
		parentKey: string;
		parentSummary: string;
		children: WorklogEntry[];
		totalTime: string;
	}[] {
		return state.jiraYParents
			.filter((p) => p.children.length > 0)
			.map((p) => ({
				parentKey: p.issueKey,
				parentSummary: p.issueSummary,
				children: p.children,
				totalTime: formatSeconds(p.children.reduce((sum, c) => sum + c.timeSpentSeconds, 0))
			}));
	}

	function updateWorklog(id: string, updates: { comment?: string; timeSpentFormatted?: string }) {
		const xIdx = state.jiraXWorklogs.findIndex((w) => w.id === id);
		if (xIdx !== -1) {
			const w = state.jiraXWorklogs[xIdx];
			if (updates.comment !== undefined) w.comment = updates.comment;
			if (updates.timeSpentFormatted !== undefined) {
				w.timeSpentFormatted = updates.timeSpentFormatted;
				w.timeSpentSeconds = parseFormattedTime(updates.timeSpentFormatted);
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
					c.timeSpentFormatted = updates.timeSpentFormatted;
					c.timeSpentSeconds = parseFormattedTime(updates.timeSpentFormatted);
				}
			}
		}
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
		getTotalChildrenTime,
		getTotalPendingMigration,
		clearAllChildren,
		getMigrationSummary,
		toggleWorklogSelection,
		selectAllWorklogs,
		deselectAllWorklogs,
		isWorklogSelected,
		getSelectedWorklogs,
		getSelectedCount,
		getSelectedTotalTime,
		addSelectedToParent,
		updateWorklog
	};
}

export const migrationStore = createMigrationStore();
