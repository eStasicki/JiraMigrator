<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Clock, Loader2 } from 'lucide-svelte';

	interface Props {
		title: string;
		subtitle?: string;
		totalTime?: string;
		itemCount: number;
		isLoading?: boolean;
		accentColor?: 'violet' | 'emerald' | 'amber';
		ondrop?: (e: DragEvent) => void;
		ondragover?: (e: DragEvent) => void;
		ondragleave?: (e: DragEvent) => void;
		children: Snippet;
		headerActions?: Snippet;
	}

	let {
		title,
		subtitle,
		totalTime,
		itemCount,
		isLoading = false,
		accentColor = 'violet',
		ondrop,
		ondragover,
		ondragleave,
		children,
		headerActions
	}: Props = $props();

	let isDragOver = $state(false);

	const accentClasses = {
		violet: {
			border: 'border-violet-500/30',
			bg: 'from-violet-500/10',
			text: 'text-violet-400',
			badge: 'bg-violet-500/20 text-violet-400'
		},
		emerald: {
			border: 'border-emerald-500/30',
			bg: 'from-emerald-500/10',
			text: 'text-emerald-400',
			badge: 'bg-emerald-500/20 text-emerald-400'
		},
		amber: {
			border: 'border-amber-500/30',
			bg: 'from-amber-500/10',
			text: 'text-amber-400',
			badge: 'bg-amber-500/20 text-amber-400'
		}
	};

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		isDragOver = true;
		ondragover?.(e);
	}

	function handleDragLeave(e: DragEvent) {
		isDragOver = false;
		ondragleave?.(e);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		ondrop?.(e);
	}
</script>

<div
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	role="region"
	aria-label={title}
	class="flex h-full flex-col overflow-visible rounded-xl border bg-gradient-to-b to-slate-900/80 backdrop-blur-sm transition-all duration-200
		{accentClasses[accentColor].border}
		{accentClasses[accentColor].bg}
		{isDragOver ? 'scale-[1.02] ring-2 ring-violet-500/50' : ''}"
>
	<!-- Header -->
	<div class="relative z-20 overflow-visible border-b border-slate-700/50 p-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="flex items-center gap-2 text-lg font-semibold text-white">
					{title}
					<span
						class="rounded-full {accentClasses[accentColor].badge} px-2 py-0.5 text-xs font-medium"
					>
						{itemCount}
					</span>
				</h3>
				{#if subtitle}
					<p class="mt-0.5 text-sm text-slate-400">{subtitle}</p>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				{#if totalTime}
					<div class="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5">
						<Clock class="size-4 {accentClasses[accentColor].text}" />
						<span class="text-sm font-semibold text-white">{totalTime}</span>
					</div>
				{/if}
				{#if headerActions}
					{@render headerActions()}
				{/if}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if isLoading}
			<div class="flex h-32 items-center justify-center">
				<Loader2 class="size-8 animate-spin text-slate-500" />
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>
</div>
