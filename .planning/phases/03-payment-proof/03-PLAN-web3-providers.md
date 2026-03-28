---
id: "03-1"
title: "Web3 Providers: wagmi + RainbowKit + WalletConnect setup"
wave: 1
depends_on: []
files_modified:
  - package.json
  - src/app/providers.tsx
  - src/app/layout.tsx
  - src/lib/web3/config.ts
  - .env.local.example
autonomous: true
requirements_addressed:
  - PAY-01

must_haves:
  truths:
    - "RainbowKit ConnectButton renders in the page header without hydration errors"
    - "MetaMask and WalletConnect appear as wallet options in the connect modal"
    - "Connecting MetaMask on Base Sepolia updates useAccount().isConnected to true"
    - "The app builds without TypeScript errors after wagmi/RainbowKit are added"
    - "NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is documented in .env.local.example"
  artifacts:
    - path: "src/app/providers.tsx"
      provides: "WagmiProvider + QueryClientProvider + RainbowKitProvider tree"
      contains: "RainbowKitProvider"
    - path: "src/lib/web3/config.ts"
      provides: "wagmi config with Base Sepolia chain, metaMask + walletConnect connectors"
      contains: "baseSepolia"
    - path: "src/app/layout.tsx"
      provides: "root layout wrapping children in Providers"
      contains: "Providers"
    - path: ".env.local.example"
      provides: "env var documentation including wallet connect project ID"
      contains: "NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID"
  key_links:
    - from: "src/app/layout.tsx"
      to: "src/app/providers.tsx"
      via: "import + JSX wrap"
      pattern: "import.*Providers.*from.*providers"
    - from: "src/app/providers.tsx"
      to: "src/lib/web3/config.ts"
      via: "wagmi config import"
      pattern: "import.*config.*from.*web3/config"
---

<objective>
Install and configure the Web3 provider stack: wagmi v2, viem v2, @tanstack/react-query v5, and RainbowKit. Wire them into the Next.js App Router layout so wallet connection is available app-wide.

Purpose: All payment and balance-check functionality in Plans 03-2 through 03-4 depends on `useAccount`, `useWalletClient`, and `useReadContract` hooks that only work inside this provider tree.
Output: A running app where the RainbowKit connect button appears and users can connect MetaMask or WalletConnect on Base Sepolia.
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
@.planning/research/PITFALLS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Web3 dependencies</name>

  <read_first>
    - .planning/research/STACK.md (exact package names, version constraints, install commands)
    - package.json (current state — confirm next/react versions before installing)
  </read_first>

  <files>
    package.json
  </files>

  <action>
From the project root (C:/Projects/opengradient 1), install all Web3 dependencies in a single command:

```bash
npm install wagmi viem @tanstack/react-query @rainbow-me/rainbowkit @x402/fetch @x402/evm @x402/core
```

Expected versions after install:
- wagmi: ^2.x
- viem: ^2.x
- @tanstack/react-query: ^5.x
- @rainbow-me/rainbowkit: latest (^2.x expected)
- @x402/fetch, @x402/evm, @x402/core: latest

If any peer dependency conflicts arise, use `--legacy-peer-deps` flag.

After install, verify package.json contains all seven packages. Do NOT install @x402 packages as devDependencies — they are used in the production API route.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && node -e "const p=require('./package.json'); const deps={...p.dependencies,...p.devDependencies}; ['wagmi','viem','@tanstack/react-query','@rainbow-me/rainbowkit','@x402/fetch','@x402/evm','@x402/core'].forEach(d => { if(!deps[d]) throw new Error('Missing dep: '+d); }); console.log('All Web3 deps present');"</automated>
  </verify>

  <acceptance_criteria>
    - `package.json` contains `"wagmi"` in dependencies
    - `package.json` contains `"viem"` in dependencies
    - `package.json` contains `"@tanstack/react-query"` in dependencies
    - `package.json` contains `"@rainbow-me/rainbowkit"` in dependencies
    - `package.json` contains `"@x402/fetch"` in dependencies
    - `package.json` contains `"@x402/evm"` in dependencies
    - `package.json` contains `"@x402/core"` in dependencies
    - `node_modules/@rainbow-me/rainbowkit` directory exists
  </acceptance_criteria>

  <done>All seven Web3 packages installed and present in package.json.</done>
</task>

<task type="auto">
  <name>Task 2: Create wagmi config, Providers component, and wire into layout</name>

  <read_first>
    - src/app/layout.tsx (current state — must preserve existing imports and metadata)
    - .planning/research/STACK.md (exact wagmiConfig pattern with ssr: true, connector list, RainbowKitProvider pattern)
    - .planning/research/ARCHITECTURE.md (component structure: app/providers.tsx wraps WagmiProvider + QueryClientProvider + RainbowKitProvider)
  </read_first>

  <files>
    src/lib/web3/config.ts, src/app/providers.tsx, src/app/layout.tsx, .env.local.example
  </files>

  <action>
**Step 1: Create `src/lib/web3/config.ts`**

```typescript
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { metaMask, walletConnect } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true, // Required for Next.js SSR compatibility — prevents hydration mismatch
});

// Export chain + token constants for use across the app
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const OPG_TOKEN_ADDRESS = "0x240b09731D96979f50B2C649C9CE10FcF9C7987F" as `0x${string}`;
export const BASESCAN_TX_URL = (txHash: string) =>
  `https://sepolia.basescan.org/tx/${txHash}`;
```

**Step 2: Create `src/app/providers.tsx`**

```tsx
"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/web3/config";
import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient must be created inside component to avoid sharing state between requests
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Step 3: Update `src/app/layout.tsx`**

Read the existing layout.tsx first. Add the Providers import and wrap `{children}` with `<Providers>`. Preserve all existing imports (fonts, metadata, globals.css import). The body should look like:

```tsx
import { Providers } from "./providers";
// ... keep existing imports ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={/* existing font classes */}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 4: Update `.env.local.example`**

Append to the existing file (do not overwrite — read first):
```
# Required for WalletConnect (get project ID from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# Required: funded app wallet private key for server-side x402 payments
# Generate a new wallet, fund it with OPG on Base Sepolia from https://faucet.opengradient.ai
APP_WALLET_PRIVATE_KEY=0x_your_private_key_here
```
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npm run build 2>&1 | tail -10</automated>
  </verify>

  <acceptance_criteria>
    - `src/lib/web3/config.ts` exists and contains `baseSepolia` and `ssr: true`
    - `src/lib/web3/config.ts` contains `OPG_TOKEN_ADDRESS = "0x240b09731D96979f50B2C649C9CE10FcF9C7987F"`
    - `src/app/providers.tsx` starts with `"use client"` directive
    - `src/app/providers.tsx` contains `RainbowKitProvider`
    - `src/app/providers.tsx` contains `import "@rainbow-me/rainbowkit/styles.css"`
    - `src/app/layout.tsx` contains `import { Providers } from "./providers"`
    - `src/app/layout.tsx` contains `<Providers>` wrapping `{children}`
    - `.env.local.example` contains `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
    - `.env.local.example` contains `APP_WALLET_PRIVATE_KEY`
    - `npm run build` exits 0 (no TypeScript or compilation errors)
  </acceptance_criteria>

  <done>wagmi config, Providers component, and layout wiring complete. RainbowKit connect button is renderable in any client component. App builds cleanly.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `npm run build` exits 0
2. `grep -r "RainbowKitProvider" src/app/providers.tsx` returns a match
3. `grep "Providers" src/app/layout.tsx` returns a match
4. `grep "ssr: true" src/lib/web3/config.ts` returns a match
5. `cat .env.local.example` shows both NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID and APP_WALLET_PRIVATE_KEY
</verification>

<success_criteria>
- wagmi, viem, react-query, RainbowKit, and @x402 packages installed
- wagmiConfig with Base Sepolia chain, MetaMask + WalletConnect connectors, ssr: true
- Providers component wraps WagmiProvider > QueryClientProvider > RainbowKitProvider
- layout.tsx wraps all children in Providers
- OPG_TOKEN_ADDRESS and BASESCAN_TX_URL helpers exported from config
- .env.local.example documents both NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID and APP_WALLET_PRIVATE_KEY
- App builds cleanly after all changes
</success_criteria>

<output>
After completion, create `.planning/phases/03-payment-proof/03-1-SUMMARY.md` with:
- Exact package versions installed (wagmi, viem, RainbowKit)
- Any peer dependency warnings or resolutions applied
- Confirmation that `npm run build` passed
- Any deviations from planned file content
</output>
