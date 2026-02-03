<script lang="ts">
	import { Rocket, Palette, Database, TestTube, Sparkles } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	const features = [
		{
			icon: Rocket,
			title: 'SvelteKit 5',
			description: 'Najnowsza wersja z Svelte 5 runes i ulepszoną wydajnością'
		},
		{
			icon: Palette,
			title: 'Tailwind CSS 4',
			description: 'Nowoczesne stylowanie z pluginami: forms, typography, animate'
		},
		{
			icon: Database,
			title: 'Supabase',
			description: 'Backend-as-a-Service z autentykacją i bazą danych'
		},
		{
			icon: TestTube,
			title: 'Vitest & Playwright',
			description: 'Kompletne testowanie: unit, component i E2E'
		},
		{
			icon: Sparkles,
			title: 'TypeScript',
			description: 'Pełne wsparcie TypeScript z ESLint i Prettier'
		}
	];
</script>

<div class="container mx-auto px-4 py-16">
	<div class="mx-auto max-w-4xl text-center">
		<h1 class="mb-4 text-5xl font-bold tracking-tight">
			Witaj w <span
				class="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent"
				>JiraMigrator</span
			>
		</h1>
		<p class="mb-12 text-xl text-gray-600 dark:text-gray-400">
			Nowoczesna aplikacja SvelteKit z TypeScript, Tailwind CSS i Supabase
		</p>

		<!-- Features Grid -->
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each features as feature}
				<div
					class={cn(
						'group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900'
					)}
				>
					<div
						class="mb-4 inline-flex rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 p-3 text-white"
					>
						<svelte:component this={feature.icon} class="size-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">{feature.title}</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
				</div>
			{/each}
		</div>

		<!-- CTA Section -->
		<div class="mt-12">
			<div
				class="rounded-lg border border-gray-200 bg-gradient-to-br from-orange-50 to-pink-50 p-8 dark:border-gray-800 dark:from-gray-900 dark:to-gray-800"
			>
				<h2 class="mb-4 text-2xl font-bold">Zacznij Budować</h2>
				<p class="mb-6 text-gray-600 dark:text-gray-400">
					Wszystkie narzędzia są już skonfigurowane. Możesz od razu zacząć tworzyć swoją aplikację!
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<a
						href="https://svelte.dev/docs/kit"
						target="_blank"
						rel="noopener noreferrer"
						class="rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 font-semibold text-white transition-transform hover:scale-105"
					>
						Dokumentacja SvelteKit
					</a>
					<a
						href="https://tailwindcss.com/docs"
						target="_blank"
						rel="noopener noreferrer"
						class="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
					>
						Dokumentacja Tailwind
					</a>
				</div>
			</div>
		</div>

		<!-- Quick Start Commands -->
		<div class="prose prose-gray dark:prose-invert mx-auto mt-12 text-left">
			<h2>Szybki Start</h2>
			<pre><code
					>npm run dev          # Uruchom serwer deweloperski
npm run build        # Zbuduj wersję produkcyjną
npm run test         # Uruchom testy
npm run validate     # Sprawdź kod (format, lint, typecheck)</code
				></pre>
		</div>
	</div>
</div>
