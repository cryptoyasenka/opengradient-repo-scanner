"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { VerdictResult, CategoryRiskLevel } from "@/types/verdict";

const CATEGORY_LABELS: Record<keyof VerdictResult["categories"], string> = {
  account_credibility: "Account Credibility",
  repository_credibility: "Repository Credibility",
  package_manifest_risks: "Package Manifest Risks",
  code_behavior_risks: "Code Behavior Risks",
  commit_integrity: "Commit Integrity",
  readme_red_flags: "README Red Flags",
  github_actions_risks: "GitHub Actions Risks",
};

const RISK_COLORS: Record<CategoryRiskLevel, string> = {
  none: "bg-green-100 text-green-800 border-green-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

interface CategoryAccordionProps {
  categories: VerdictResult["categories"];
}

export function CategoryAccordion({ categories }: CategoryAccordionProps) {
  return (
    <Accordion className="w-full">
      {(Object.keys(categories) as Array<keyof typeof categories>).map((key) => {
        const cat = categories[key];
        return (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger className="flex justify-between hover:no-underline">
              <span className="text-sm font-medium">{CATEGORY_LABELS[key]}</span>
              <Badge className={`ml-2 text-xs ${RISK_COLORS[cat.risk_level]}`}>
                {cat.risk_level}
              </Badge>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {cat.findings}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
