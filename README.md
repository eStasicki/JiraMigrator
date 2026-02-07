# JiraMigrator

Modern SvelteKit 5 application with TypeScript, Tailwind CSS, and Supabase.

## Tech Stack

### Core

- **SvelteKit 5** - Web application framework
- **TypeScript** - Static typing
- **Vite 7** - Build tool and dev server

### Styling

- **Tailwind CSS 4** - Utility-first CSS framework
- **@tailwindcss/forms** - Form styling
- **@tailwindcss/typography** - Content styling
- **tailwindcss-animate** - Animations
- **Lucide Svelte** - Icons

### Backend & Database

- **Supabase** - Backend as a Service (authentication, database, storage)
  - `@supabase/supabase-js` - JavaScript client
  - `@supabase/ssr` - Server-side rendering support

### Code Quality

- **ESLint** - Code linting
- **Prettier** - Code formatting
  - `prettier-plugin-svelte`
  - `prettier-plugin-tailwindcss`

### Testing

- **Vitest** - Unit testing and component testing
- **Playwright** - E2E testing

## Getting Started

### Requirements

- Node.js 18+
- npm/pnpm/yarn

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Fill in values in .env file
```

### Development

```bash
# Start development server
npm run dev

# Open in browser
npm run dev -- --open
```

### Available Scripts

#### Development

- `npm run dev` - Start development server
- `npm run preview` - Preview production build

#### Build

- `npm run build` - Build production application

#### Code Quality

- `npm run format` - Format code (Prettier)
- `npm run lint` - Check code (ESLint + Prettier)
- `npm run lint:fix` - Fix ESLint errors
- `npm run typecheck` - Check TypeScript types
- `npm run check` - Check Svelte components
- `npm run validate` - Run all checks (format, lint, typecheck, check)

#### Testing

- `npm run test` - Run all tests
- `npm run test:unit` - Unit tests (watch mode)
- `npm run test:unit:ui` - Unit tests (UI)
- `npm run test:e2e` - E2E tests
- `npm run test:e2e:ui` - E2E tests (UI)

## Project Structure

```
.
├── src/
│   ├── lib/
│   │   ├── assets/         # Static assets
│   │   ├── supabase.ts     # Supabase client
│   │   ├── utils.ts        # Helper utilities
│   │   └── index.ts
│   ├── routes/             # Application routes (file-based routing)
│   │   ├── +layout.svelte  # Main layout
│   │   └── +page.svelte    # Home page
│   └── app.html            # HTML template
├── static/                 # Static files
├── e2e/                    # E2E tests
├── .env.example            # Example environment variables
├── tailwind.config.js      # Tailwind configuration
├── vite.config.ts          # Vite configuration
└── svelte.config.js        # SvelteKit configuration
```

## Supabase Configuration

1. Create a project on [supabase.com](https://supabase.com)
2. Copy project URL and anon key
3. Add to `.env` file:

```env
PUBLIC_SUPABASE_URL=your-project-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Use Supabase client in your code:

```typescript
import { supabase } from '$lib/supabase';

// Usage example
const { data, error } = await supabase.from('table').select('*');
```

## Deployment

The application is configured with `adapter-auto`, which automatically detects the deployment environment.

Popular platforms:

- **Vercel** - Zero-config deployment
- **Netlify** - Continuous integration
- **Cloudflare Pages** - Edge deployment

For a specific environment, change the adapter in `svelte.config.js`.

## AI Configuration

The project contains configuration for AI assistants:

- **`.cursorrules`** - Rules for Cursor IDE
- **`.agent/rules.md`** - Rules for Antigravity (Google Deepmind)

These files ensure that AI assistants have full project context and can generate code following project conventions. See [`.agent/README.md`](.agent/README.md) for more information.

## Contributing

Before committing:

1. Run `npm run validate` to check code
2. Ensure tests pass: `npm run test`
3. Commit with descriptive messages (English, max 50 chars)

## License

MIT
