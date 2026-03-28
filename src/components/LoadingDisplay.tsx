export function LoadingDisplay() {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      <p className="text-sm">Fetching repository data...</p>
      <p className="text-xs">This may take a few seconds</p>
    </div>
  );
}
