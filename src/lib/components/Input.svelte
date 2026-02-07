<script lang="ts">
	import { Info } from 'lucide-svelte';

	interface Props {
		label: string;
		type?: 'text' | 'email' | 'password' | 'url';
		value: string;
		placeholder?: string;
		required?: boolean;
		id: string;
		error?: string;
		onchange?: (value: string) => void;
		onInfoClick?: () => void;
	}

	let {
		label,
		type = 'text',
		value = $bindable(),
		placeholder = '',
		required = false,
		id,
		error = '',
		onchange,
		onInfoClick
	}: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		onchange?.(target.value);
	}
</script>

<div class="space-y-1.5">
	<div class="flex items-center justify-between">
		<label for={id} class="block text-sm font-medium text-slate-300">
			{label}
			{#if required}
				<span class="text-rose-400">*</span>
			{/if}
		</label>
		{#if onInfoClick}
			<button
				type="button"
				onclick={onInfoClick}
				class="text-slate-400 transition-colors hover:text-violet-400"
				title="Więcej informacji"
			>
				<Info class="size-4" />
			</button>
		{/if}
	</div>
	<input
		{id}
		{type}
		{value}
		{placeholder}
		{required}
		oninput={handleInput}
		class="w-full rounded-lg border px-4 py-2.5 text-slate-100 placeholder-slate-500 transition-all duration-200 focus:outline-none
			{error
			? 'border-rose-500/50 bg-rose-500/5 text-rose-200 focus:border-rose-500'
			: 'border-slate-600 bg-slate-800/50 focus:border-violet-500 focus:ring-1 focus:ring-violet-500'}"
	/>
	{#if error}
		<p class="text-xs font-medium text-rose-500">{error}</p>
	{/if}
</div>
