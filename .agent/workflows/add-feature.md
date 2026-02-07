---
description: Example workflow - how to add a new feature
---

# Adding a New Feature

This workflow describes the standard process for adding a new feature to the JiraMigrator project.

## Step 1: Planning

1. Define feature requirements
2. Determine which components will be needed
3. Plan data structure (TypeScript types)
4. Check for conflicts with existing code

## Step 2: Create Types

1. Create new types in `src/lib/types/`
2. Export types in `src/lib/types/index.ts`

```typescript
// src/lib/types/NewFeature.ts
export type NewFeature = {
  id: string;
  name: string;
  // ... other fields
};
```

## Step 3: Implement Logic

1. Create helper functions in `src/lib/utils/` or `src/lib/api/`
2. Add unit tests for logic

```typescript
// src/lib/utils/newFeature.ts
import type { NewFeature } from '$lib/types';

export function processNewFeature(data: NewFeature): ProcessedData {
  // implementation
}
```

## Step 4: Create Component

1. Create component in `src/lib/components/`
2. Use Svelte 5 Runes API
3. Apply Tailwind CSS for styling

```svelte
<!-- src/lib/components/NewFeatureCard.svelte -->
<script lang="ts">
	import type { NewFeature } from '$lib/types';

	let { feature } = $props<{ feature: NewFeature }>();
	let isActive = $state(false);
</script>

<div class="rounded-lg border p-4">
	<h3>{feature.name}</h3>
	<!-- ... -->
</div>
```

## Step 5: Integrate with Routing

1. Add new page in `src/routes/` (if needed)
2. Or integrate with existing page

## Step 6: Testing

// turbo

```bash
npm run validate
```

// turbo

```bash
npm run test:unit
```

## Step 7: Verify in Browser

1. Run dev server: `npm run dev`
2. Test functionality manually
3. Check responsiveness (mobile, tablet, desktop)
4. Check dark mode

## Step 8: Documentation

1. Update README if needed
2. Add comments to complex logic
3. Update `.agent/rules.md` if new patterns were added

## Step 9: Commit

```bash
git add .
git commit -m "feat: add new feature description"
```

## Checklist

- [ ] TypeScript types defined
- [ ] Business logic implemented
- [ ] Components created
- [ ] Tests written and passing
- [ ] Code formatted (`npm run format`)
- [ ] No linting errors (`npm run lint`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Functionality tested in browser
- [ ] Responsiveness checked
- [ ] Dark mode checked
- [ ] Documentation updated
