---
id: "01-1"
title: "Project Bootstrap: Next.js 15 + shadcn/ui + TypeScript"
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - next.config.ts
  - tailwind.config.ts
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/globals.css
  - src/lib/utils.ts
  - components.json
  - .env.local.example
  - .gitignore
autonomous: true
requirements_addressed:
  - INPUT-01
  - GEN-03

must_haves:
  truths:
    - "Running `npm run dev` starts a Next.js 15 dev server on localhost:3000 without errors"
    - "The root page renders without TypeScript or React errors in the browser console"
    - "shadcn/ui Button and Card components are importable from '@/components/ui/button' and '@/components/ui/card'"
    - "Tailwind CSS v4 classes apply correctly (no broken styles)"
    - ".env.local.example documents GITHUB_TOKEN as optional"
  artifacts:
    - path: "package.json"
      provides: "dependency manifest with next@15, react@19, tailwindcss@4, typescript@5"
      contains: "\"next\": \"15"
    - path: "src/app/layout.tsx"
      provides: "root layout with html/body structure"
      contains: "RootLayout"
    - path: "components.json"
      provides: "shadcn/ui configuration"
      contains: "\"style\": \"new-york\""
    - path: "src/components/ui/button.tsx"
      provides: "shadcn Button component"
    - path: "src/components/ui/card.tsx"
      provides: "shadcn Card component"
    - path: ".env.local.example"
      provides: "env var documentation"
      contains: "GITHUB_TOKEN"
  key_links:
    - from: "src/app/layout.tsx"
      to: "src/app/globals.css"
      via: "import"
      pattern: "import.*globals.css"
    - from: "src/app/page.tsx"
      to: "src/components/ui/button.tsx"
      via: "import"
      pattern: "from.*components/ui/button"
---

<objective>
Bootstrap the GitHub Security Checker project from scratch: create the Next.js 15 app with TypeScript, Tailwind CSS v4, and shadcn/ui. Produce a runnable skeleton that all subsequent plans build on.

Purpose: Phase 1 has no working directory yet — the app must be created before any other work can happen. This plan produces the project foundation.
Output: A running Next.js 15 app at localhost:3000, with shadcn/ui initialized and required UI components installed.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Next.js 15 app with TypeScript + Tailwind</name>

  <read_first>
    - .planning/research/STACK.md (exact bootstrap command and dependency list)
  </read_first>

  <files>
    package.json, tsconfig.json, next.config.ts, src/app/layout.tsx, src/app/page.tsx,
    src/app/globals.css, .gitignore
  </files>

  <action>
Run the following exact command from the project root (C:/Projects/opengradient 1):

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --yes
```

The `--yes` flag accepts all defaults. When prompted about the existing directory, confirm overwrite.

After scaffolding, verify `package.json` shows `"next": "15.x"` and `"tailwindcss": "^4"`.

Update `next.config.ts` to add:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
};

export default nextConfig;
```

Update `src/app/page.tsx` to a minimal placeholder (will be replaced in Plan 03):
```tsx
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">GitHub Security Checker</h1>
      <p className="mt-2 text-muted-foreground">Phase 1 skeleton</p>
    </main>
  );
}
```
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npm run build 2>&1 | tail -5</automated>
  </verify>

  <acceptance_criteria>
    - `package.json` contains `"next"` with version starting with `"15`
    - `package.json` contains `"typescript"` with version starting with `"5`
    - `src/app/layout.tsx` exists and contains `export default function RootLayout`
    - `src/app/globals.css` exists and contains `@import "tailwindcss"`
    - `npm run build` exits 0 with no TypeScript errors
  </acceptance_criteria>

  <done>Next.js 15 TypeScript app builds cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Initialize shadcn/ui and install required components</name>

  <read_first>
    - src/app/layout.tsx (current state before modification)
    - src/app/globals.css (current state)
    - .planning/research/STACK.md (shadcn init command and component list)
    - .planning/research/ARCHITECTURE.md (component list: button, input, card, badge, tooltip, dialog, progress)
  </read_first>

  <files>
    components.json, src/lib/utils.ts, src/components/ui/button.tsx, src/components/ui/input.tsx,
    src/components/ui/card.tsx, src/components/ui/badge.tsx, src/components/ui/tooltip.tsx,
    src/components/ui/dialog.tsx, src/components/ui/progress.tsx
  </files>

  <action>
Run shadcn init (select defaults: New York style, Zinc base color, yes to globals.css):

```bash
cd "C:/Projects/opengradient 1"
npx shadcn@latest init --yes
```

If `--yes` is not accepted, answer the prompts as: style=New York, base color=Zinc, globals.css=yes, CSS variables=yes, tailwind config=no (v4 doesn't need one), import alias=@/components.

Then install all components needed across all Phase 1-4 plans (install once now, use later):

```bash
npx shadcn@latest add button input card badge tooltip dialog progress --yes
```

After running, confirm `src/lib/utils.ts` exists and exports `cn`:
```typescript
// Expected content in src/lib/utils.ts:
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Create `.env.local.example` with:
```
# Optional: GitHub Personal Access Token
# Raises GitHub API rate limit from 60/hr to 5,000/hr
# Create one at https://github.com/settings/tokens (no scopes needed for public repos)
GITHUB_TOKEN=ghp_your_token_here
```

Add `.env.local` to `.gitignore` if not already present (create-next-app should have added it).
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && node -e "const fs=require('fs'); ['src/components/ui/button.tsx','src/components/ui/card.tsx','src/components/ui/input.tsx','src/components/ui/badge.tsx','src/lib/utils.ts','components.json','.env.local.example'].forEach(f => { if(!fs.existsSync(f)) throw new Error('Missing: '+f); }); console.log('All files present');"</automated>
  </verify>

  <acceptance_criteria>
    - `components.json` exists and contains `"style": "new-york"`
    - `src/lib/utils.ts` exists and contains `export function cn`
    - `src/components/ui/button.tsx` exists and contains `buttonVariants`
    - `src/components/ui/card.tsx` exists and contains `CardContent`
    - `src/components/ui/input.tsx` exists
    - `src/components/ui/badge.tsx` exists
    - `src/components/ui/progress.tsx` exists
    - `.env.local.example` exists and contains `GITHUB_TOKEN`
    - `.gitignore` contains `.env.local`
    - `npm run build` still exits 0 after shadcn install
  </acceptance_criteria>

  <done>shadcn/ui initialized with all required components installed and importable. .env.local.example documents GITHUB_TOKEN.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `npm run build` exits 0
2. `npm run dev` starts without errors (Ctrl+C after confirming)
3. `grep -r "from \"@/components/ui/button\"" src/` returns the page.tsx placeholder import (if added) or can be manually confirmed importable
4. `cat .env.local.example` shows GITHUB_TOKEN documentation
</verification>

<success_criteria>
- Next.js 15 + TypeScript app created and building cleanly
- shadcn/ui initialized with New York style and Zinc base color
- Components installed: button, input, card, badge, tooltip, dialog, progress
- .env.local.example documents GITHUB_TOKEN as optional
- No TypeScript errors in build output
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-1-SUMMARY.md` with:
- What was created (project structure, shadcn config, components list)
- Exact Next.js version installed (from package.json)
- Exact shadcn version used
- Any deviations from plan (e.g., if Tailwind v4 config differs from expected)
- `npm run build` output confirming success
</output>
