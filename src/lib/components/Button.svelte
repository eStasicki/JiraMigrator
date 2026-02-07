<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		title?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		type = 'button',
		title,
		onclick,
		children,
		class: className = ''
	}: Props = $props();

	const baseClasses =
		'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none disabled:cursor-not-allowed';

	const variantClasses = {
		primary:
			'bg-linear-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 disabled:bg-slate-700 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none',
		secondary:
			'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700',
		ghost:
			'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white disabled:text-slate-600 disabled:hover:bg-transparent',
		danger:
			'bg-linear-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-500/25 disabled:bg-slate-700 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none',
		success:
			'bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25 disabled:bg-slate-700 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none'
	};

	const sizeClasses = {
		sm: 'px-3 py-2 text-sm gap-1.5',
		md: 'px-4 py-2.5 text-sm gap-2',
		lg: 'px-6 py-3.5 text-base gap-2.5'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	use:tooltip={title}
	class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]} {className}"
>
	{@render children()}
</button>
