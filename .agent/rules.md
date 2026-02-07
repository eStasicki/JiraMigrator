# AI Rules for JiraMigrator

## Project Information

**JiraMigrator** is a modern web application for migrating worklogs between Jira instances, built with SvelteKit 5, TypeScript, Tailwind CSS, and Supabase.

## Tech Stack

### Core

- **SvelteKit 5** - Application framework (runes API, file-based routing)
- **TypeScript** - Static typing (strict mode)
- **Vite 7** - Build tool and dev server

### Styling

- **Tailwind CSS 4** - Utility-first CSS framework
- **Lucide Svelte** - Icons
- **tailwindcss-animate** - Animations

### Backend & Database

- **Supabase** - Backend as a Service
  - Authentication (Google OAuth)
  - PostgreSQL database
  - Server-side rendering support

### Code Quality & Testing

- **ESLint** + **Prettier** - Linting and formatting
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Coding Conventions

### TypeScript

1. **Use strict mode** - all TypeScript strict flags are enabled
2. **Avoid `any`** - type `any` is allowed only in exceptional cases (`noImplicitAny: false`)
3. **Prefer types over interfaces** - use `type` instead of `interface` for simple structures
4. **Export types** - all types used in APIs should be exported

### Svelte

1. **Use Svelte 5 Runes API**:
   - `$state()` instead of `let` for reactive variables
   - `$derived()` for computed values
   - `$effect()` for side effects
   - `$props()` for component properties
2. **Component structure**:

   ```svelte
   <script lang="ts">
   	// Imports
   	// Props
   	// State
   	// Derived values
   	// Effects
   	// Functions
   </script>

   <!-- Template -->

   <style>
   	/* Styles (if needed) */
   </style>
   ```

3. **File naming**: PascalCase for components (e.g., `WorklogCard.svelte`)
4. **Routing**: Use SvelteKit conventions (`+page.svelte`, `+layout.svelte`, `+server.ts`)

### Styling

1. **Tailwind-first** - prefer Tailwind classes over custom CSS
2. **Responsive design** - always consider mobile breakpoints
3. **Dark mode** - application supports dark mode
4. **Utility functions** - use `clsx` and `tailwind-merge` for conditional classes:
   ```typescript
   import { cn } from '$lib/utils';
   const classes = cn('base-class', condition && 'conditional-class');
   ```

### API & Data Fetching

1. **Supabase client**:
   - Use `createBrowserClient` on client side
   - Use `createServerClient` on server side
2. **Error handling** - always handle API errors:
   ```typescript
   const { data, error } = await supabase.from('table').select();
   if (error) {
     console.error('Error:', error.message);
     // Handle error appropriately
   }
   ```
3. **Loading states** - always show loading state for async operations

### State Management

1. **Local state** - use Svelte stores or runes for simple cases
2. **Global state** - use Svelte stores in `$lib/stores/`
3. **Persistence** - use Supabase for user data

## Project Architecture

### Directory Structure

```
src/
├── lib/
│   ├── api/              # API clients (Jira, Supabase)
│   ├── components/       # Reusable components
│   ├── stores/           # Svelte stores
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions
│   └── supabase.ts       # Supabase client
├── routes/
│   ├── +layout.svelte    # Root layout
│   ├── +page.svelte      # Home page (worklog migration)
│   ├── settings/         # Settings page
│   └── auth/             # Auth callbacks
└── app.html              # HTML template
```

### Design Patterns

1. **Separation of concerns** - business logic separated from UI
2. **Composition over inheritance** - composable components
3. **Single responsibility** - each module has one responsibility

## Application Features

### Core Features

1. **Authentication** - Google OAuth via Supabase
2. **Project management** - configure connections to Jira instances
3. **Worklog migration**:
   - Display worklogs from Jira X (source)
   - Display tasks from Jira Y (target)
   - Drag & drop to assign worklogs
   - Automatic migration rules (based on task keys/labels)
4. **Persistence** - save configuration in Supabase

### Key Components

- **WorklogCard** - single worklog card
- **ParentTaskCard** - target task card
- **MigrationRules** - automatic migration rules management
- **ProjectSettings** - project and Jira connection configuration

## AI Working Principles

### When Modifying Code

1. **Read existing code** - always check current implementation before changes
2. **Maintain consistency** - stick to existing patterns and conventions
3. **Test changes** - ensure code works (run `npm run validate`)
4. **Document** - add comments for complex logic

### When Adding New Features

1. **Plan** - think through architecture before implementation
2. **Modularity** - create reusable components and functions
3. **Type safety** - define types for all data structures
4. **Error handling** - handle all edge cases

### When Debugging

1. **Check console** - TypeScript errors, ESLint, runtime errors
2. **Check network** - requests to Jira and Supabase
3. **Check state** - use Svelte DevTools
4. **Check logs** - server logs in dev server terminal

## Helper Commands

### Development

```bash
npm run dev              # Start dev server
npm run validate         # Run all checks (format, lint, typecheck, check)
```

### Testing

```bash
npm run test:unit        # Unit tests (watch mode)
npm run test:e2e         # E2E tests
npm run test             # All tests
```

### Code Quality

```bash
npm run format           # Format code
npm run lint:fix         # Fix linting issues
npm run typecheck        # Check TypeScript types
npm run check            # Check Svelte components
```

## Common Problems and Solutions

### TypeScript Errors

- **Problem**: `Type 'any' is not assignable`
  - **Solution**: Define specific type or use type assertion

### Svelte Reactivity

- **Problem**: State changes don't trigger re-render
  - **Solution**: Ensure you're using `$state()` for reactive values

### Supabase Auth

- **Problem**: User not logged in after redirect
  - **Solution**: Check redirect URLs configuration in Supabase dashboard

### Jira API

- **Problem**: 401 Unauthorized
  - **Solution**: Check credentials and encoding (Base64 for Basic Auth)

## Security

1. **Never commit** `.env` to repository
2. **Use environment variables** for all secrets
3. **Validate input** on server and client side
4. **Sanitize data** before rendering (XSS protection)
5. **CORS** - configure properly for API requests

## Performance

1. **Lazy loading** - load components on-demand when possible
2. **Debouncing** - for search and input handlers
3. **Memoization** - use `$derived()` for expensive computations
4. **Pagination** - for large data lists

## Accessibility

1. **Semantic HTML** - use appropriate tags
2. **ARIA labels** - for interactive elements
3. **Keyboard navigation** - all actions accessible via keyboard
4. **Focus management** - visible focus indicator

## Git Commits

### Commit Conventions

1. **Language**: Always in English
2. **Length**: Maximum 50 characters
3. **Format**: Use Conventional Commits convention
4. **Structure**: `type: short description`

### Commit Types

- `feat:` - new feature
- `fix:` - bug fix
- `refactor:` - code refactoring
- `style:` - styling changes (CSS, formatting)
- `docs:` - documentation changes
- `test:` - adding or modifying tests
- `chore:` - configuration, dependencies changes

### Good Commit Examples

```bash
feat: add worklog drag and drop
fix: resolve auth redirect issue
refactor: extract Jira API logic
style: update button hover states
docs: update README with setup steps
test: add unit tests for migration rules
chore: update dependencies
```

### AI Rules for Commits

**IMPORTANT**: After completing each task/prompt, the AI should:

1. **Propose a commit message** following the above conventions
2. **Check length** - maximum 50 characters
3. **Use appropriate type** - feat, fix, refactor, etc.
4. **Ask the user** if they want to add the commit

Example proposal:

```
Changes have been applied. I suggest this commit:

git add .
git commit -m "feat: add migration rules UI"

Would you like me to add this commit?
```

## Language

- **Code**: English (variable names, functions, comments)
- **UI**: Polish (interface text)
- **User communication**: Polish
- **Git commits**: English (max 50 characters)
- **AI rules and documentation**: English
