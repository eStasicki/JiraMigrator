# JiraMigrator

Nowoczesna aplikacja SvelteKit 5 z TypeScript, Tailwind CSS i Supabase.

## Stack Technologiczny

### Core

- **SvelteKit 5** - Framework aplikacji webowej
- **TypeScript** - Typowanie statyczne
- **Vite 7** - Build tool i dev server

### Styling

- **Tailwind CSS 4** - Utility-first CSS framework
- **@tailwindcss/forms** - Stylowanie formularzy
- **@tailwindcss/typography** - Stylowanie treści
- **tailwindcss-animate** - Animacje
- **Lucide Svelte** - Ikony

### Backend & Database

- **Supabase** - Backend as a Service (autentykacja, baza danych, storage)
  - `@supabase/supabase-js` - Klient JavaScript
  - `@supabase/ssr` - Server-side rendering support

### Code Quality

- **ESLint** - Linting kodu
- **Prettier** - Formatowanie kodu
  - `prettier-plugin-svelte`
  - `prettier-plugin-tailwindcss`

### Testing

- **Vitest** - Unit testing i component testing
- **Playwright** - E2E testing

## Rozpoczęcie Pracy

### Wymagania

- Node.js 18+
- npm/pnpm/yarn

### Instalacja

```bash
# Instalacja zależności
npm install

# Konfiguracja zmiennych środowiskowych
cp .env.example .env
# Wypełnij wartości w pliku .env
```

### Development

```bash
# Uruchomienie serwera deweloperskiego
npm run dev

# Otwarcie w przeglądarce
npm run dev -- --open
```

### Dostępne Skrypty

#### Development

- `npm run dev` - Uruchom serwer deweloperski
- `npm run preview` - Podgląd wersji produkcyjnej

#### Build

- `npm run build` - Zbuduj aplikację produkcyjną

#### Code Quality

- `npm run format` - Formatuj kod (Prettier)
- `npm run lint` - Sprawdź kod (ESLint + Prettier)
- `npm run lint:fix` - Napraw błędy ESLint
- `npm run typecheck` - Sprawdź typy TypeScript
- `npm run check` - Sprawdź komponenty Svelte
- `npm run validate` - Uruchom wszystkie sprawdzenia (format, lint, typecheck, check)

#### Testing

- `npm run test` - Uruchom wszystkie testy
- `npm run test:unit` - Testy jednostkowe (watch mode)
- `npm run test:unit:ui` - Testy jednostkowe (UI)
- `npm run test:e2e` - Testy E2E
- `npm run test:e2e:ui` - Testy E2E (UI)

## Struktura Projektu

```
.
├── src/
│   ├── lib/
│   │   ├── assets/         # Statyczne zasoby
│   │   ├── supabase.ts     # Klient Supabase
│   │   ├── utils.ts        # Narzędzia pomocnicze
│   │   └── index.ts
│   ├── routes/             # Ścieżki aplikacji (file-based routing)
│   │   ├── +layout.svelte  # Layout główny
│   │   └── +page.svelte    # Strona główna
│   └── app.html            # Template HTML
├── static/                 # Pliki statyczne
├── e2e/                    # Testy E2E
├── .env.example            # Przykładowe zmienne środowiskowe
├── tailwind.config.js      # Konfiguracja Tailwind
├── vite.config.ts          # Konfiguracja Vite
└── svelte.config.js        # Konfiguracja SvelteKit
```

## Konfiguracja Supabase

1. Utwórz projekt na [supabase.com](https://supabase.com)
2. Skopiuj URL projektu i anon key
3. Dodaj do pliku `.env`:

```env
PUBLIC_SUPABASE_URL=your-project-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Użyj klienta Supabase w swoim kodzie:

```typescript
import { supabase } from '$lib/supabase';

// Przykład użycia
const { data, error } = await supabase.from('table').select('*');
```

## Deployment

Aplikacja jest skonfigurowana z `adapter-auto`, który automatycznie wykrywa środowisko deployment.

Popularne platformy:

- **Vercel** - Zero-config deployment
- **Netlify** - Ciągła integracja
- **Cloudflare Pages** - Edge deployment

Dla specyficznego środowiska, zmień adapter w `svelte.config.js`.

## Contributing

Przed commitem:

1. Uruchom `npm run validate` aby sprawdzić kod
2. Upewnij się, że testy przechodzą: `npm run test`
3. Commituj z opisowymi wiadomościami

## License

MIT
