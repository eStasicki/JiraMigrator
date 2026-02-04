<script lang="ts">
	interface Props {
		label: string;
		type?: 'text' | 'email' | 'password' | 'url';
		value: string;
		placeholder?: string;
		required?: boolean;
		id: string;
		onchange?: (value: string) => void;
	}

	let {
		label,
		type = 'text',
		value = $bindable(),
		placeholder = '',
		required = false,
		id,
		onchange
	}: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		onchange?.(value);
	}
</script>

<div class="space-y-2">
	<label for={id} class="block text-sm font-medium text-slate-300">
		{label}
		{#if required}
			<span class="text-rose-400">*</span>
		{/if}
	</label>
	<input
		{id}
		{type}
		{value}
		{placeholder}
		{required}
		oninput={handleInput}
		class="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 transition-all duration-200 focus:outline-none"
	/>
</div>
