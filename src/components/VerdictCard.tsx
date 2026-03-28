import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type VerdictLevel = 'Safe' | 'Risky' | 'Dangerous';

const VERDICT_STYLES: Record<VerdictLevel, { bg: string; text: string; border: string }> = {
  Safe: { bg: "bg-green-50", text: "text-green-800", border: "border-green-300" },
  Risky: { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-300" },
  Dangerous: { bg: "bg-red-50", text: "text-red-800", border: "border-red-300" },
};

interface VerdictCardProps {
  verdict: VerdictLevel;
  score: number;
  summary: string;
}

export function VerdictCard({ verdict, score, summary }: VerdictCardProps) {
  const style = VERDICT_STYLES[verdict] ?? VERDICT_STYLES.Risky;

  return (
    <Card className={`border-2 ${style.border} ${style.bg}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h2 className={`text-4xl font-bold ${style.text}`}>{verdict.toUpperCase()}</h2>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Risk Score</p>
            <p className={`text-4xl font-bold ${style.text}`}>{score}</p>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={score} className="h-3" />
        {summary && <p className="mt-3 text-sm">{summary}</p>}
      </CardContent>
    </Card>
  );
}
