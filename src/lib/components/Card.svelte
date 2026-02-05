<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children: Snippet;
		class?: string;
	}

	let { title, children, class: className = '' }: Props = $props();
</script>

<div
	class="rounded-xl border border-slate-700/50 bg-linear-to-br from-slate-800/80 to-slate-900/80 p-6 backdrop-blur-sm {className}"
>
	<h2 class="mb-6 border-b border-slate-700/50 pb-4 text-lg font-semibold text-white">
		{title}
	</h2>
	{@render children()}
</div>
