<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
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
		'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed';

	const variantClasses = {
		primary:
			'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 focus:ring-violet-500 shadow-lg shadow-violet-500/25',
		secondary:
			'bg-slate-700 text-slate-200 hover:bg-slate-600 focus:ring-slate-500 border border-slate-600',
		ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white focus:ring-slate-500',
		danger:
			'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 focus:ring-red-500 shadow-lg shadow-red-500/25'
	};

	const sizeClasses = {
		sm: 'px-3 py-1.5 text-sm gap-1.5',
		md: 'px-4 py-2 text-sm gap-2',
		lg: 'px-6 py-3 text-base gap-2.5'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	{title}
	class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]} {className}"
>
	{@render children()}
</button>
