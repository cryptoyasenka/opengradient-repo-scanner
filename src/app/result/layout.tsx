import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Analysis Result | GitHub Security Checker',
  description: 'AI-powered security verdict, verified on-chain via OpenGradient TEE.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResultLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
