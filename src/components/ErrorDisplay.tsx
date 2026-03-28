import type { FetchRepoError } from "@/types/github";
import { Button } from "@/components/ui/button";

interface ErrorDisplayProps {
  error: FetchRepoError;
  onReset: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_URL:  "Invalid GitHub repository URL. Use the format: github.com/owner/repo",
  NOT_FOUND:    "Repository not found. Check the URL and make sure the repo is public.",
  RATE_LIMITED: "GitHub API rate limit exceeded. Set GITHUB_TOKEN in .env.local to raise the limit to 5,000/hr.",
  PRIVATE_REPO: "This repository is private. Only public repositories can be analyzed.",
  API_ERROR:    "GitHub API error. Please try again in a moment.",
};

export function ErrorDisplay({ error, onReset }: ErrorDisplayProps) {
  const message = ERROR_MESSAGES[error.code] ?? error.error;

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
      <p className="text-sm text-destructive">{message}</p>
      {error.code === "RATE_LIMITED" && (
        <p className="text-xs text-muted-foreground">
          <a
            href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            How to create a GitHub Personal Access Token
          </a>
        </p>
      )}
      <Button variant="outline" size="sm" onClick={onReset}>
        Try another repository
      </Button>
    </div>
  );
}
