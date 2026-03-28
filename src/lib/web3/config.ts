import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { metaMask, walletConnect } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "demo",
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const OPG_TOKEN_ADDRESS = "0x240b09731D96979f50B2C649C9CE10FcF9C7987F" as `0x${string}`;
export const BASESCAN_TX_URL = (txHash: string) =>
  `https://sepolia.basescan.org/tx/${txHash}`;
