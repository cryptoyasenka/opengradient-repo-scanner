import type { RepoData } from "@/types/github";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RepoDataDisplayProps {
  data: RepoData;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RepoDataDisplay({ data }: RepoDataDisplayProps) {
  const { repo, contributors, recentCommits, readmeText, packageJson, workflowFiles, rateLimitWarning } = data;

  const deps = packageJson?.dependencies as Record<string, string> | undefined;
  const depNames = deps ? Object.keys(deps).slice(0, 10) : [];
  const depCount = deps ? Object.keys(deps).length : 0;

  return (
    <div className="space-y-4">
      {/* Rate limit warning */}
      {rateLimitWarning && (
        <Badge variant="outline" className="border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          GitHub API rate limit nearly exhausted. Set GITHUB_TOKEN to increase limit.
        </Badge>
      )}

      {/* Repository Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            {repo.full_name}
            {repo.archived && (
              <Badge variant="destructive">ARCHIVED</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {repo.description ?? <em>No description</em>}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {repo.language && <Badge variant="secondary">{repo.language}</Badge>}
            <Badge variant="outline">⭐ {repo.stargazers_count.toLocaleString()}</Badge>
            <Badge variant="outline">🍴 {repo.forks_count.toLocaleString()}</Badge>
            <Badge variant="outline">Issues: {repo.open_issues_count}</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>License: {repo.license?.name ?? "No license"}</p>
            <p>Last pushed: {formatDate(repo.pushed_at)}</p>
            <p>Created: {formatDate(repo.created_at)}</p>
            {repo.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {repo.topics.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Owner & Contributors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Owner &amp; Contributors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">{repo.owner.login}</span>
            {repo.owner.created_at && (
              <span className="text-muted-foreground ml-2">
                Account created: {formatDate(repo.owner.created_at)}
              </span>
            )}
            {repo.owner.public_repos !== undefined && (
              <span className="text-muted-foreground ml-2">
                · {repo.owner.public_repos} public repos
              </span>
            )}
            {repo.owner.followers !== undefined && (
              <span className="text-muted-foreground ml-2">
                · {repo.owner.followers} followers
              </span>
            )}
          </p>
          {contributors.length > 0 && (
            <ul className="space-y-1">
              {contributors.map((c) => (
                <li key={c.login} className="flex justify-between">
                  <span>{c.login}</span>
                  <span className="text-muted-foreground">{c.contributions} commits</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent Commits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Commits</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {recentCommits.map((c) => (
              <li key={c.sha} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">
                  {formatDate(c.commit.author.date)}
                </span>
                <span className="truncate">
                  {c.commit.message.split("\n")[0].slice(0, 80)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Package Manifest */}
      {packageJson !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Package Manifest</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {packageJson.name != null && <p>Name: <strong>{String(packageJson.name)}</strong></p>}
            {packageJson.version != null && <p>Version: {String(packageJson.version)}</p>}
            {depCount > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">{depCount} dependencies (showing first 10):</p>
                <div className="flex flex-wrap gap-1">
                  {depNames.map((d) => (
                    <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* README Excerpt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">README (first 500 chars)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
            {readmeText.slice(0, 500) || "No README found"}
          </pre>
        </CardContent>
      </Card>

      {/* GitHub Actions */}
      {workflowFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GitHub Actions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc list-inside text-muted-foreground">
              {workflowFiles.map((wf) => (
                <li key={wf.name}>{wf.name}</li>
              ))}
            </ul>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground mt-2">
              {workflowFiles[0].content.slice(0, 300)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
