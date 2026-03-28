"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RepoInputProps {
  onSubmit: (repo: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function RepoInput({ onSubmit, isLoading, disabled }: RepoInputProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState("");

  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError("Please enter a GitHub repository URL");
      return;
    }
    setValidationError("");
    onSubmit(trimmed);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/owner/repo"
        className="flex-1"
        disabled={isLoading || disabled}
      />
      <Button type="submit" disabled={isLoading || disabled}>
        {isLoading ? "Checking..." : "Check Repository"}
      </Button>
      {validationError && (
        <p className="w-full text-sm text-destructive">{validationError}</p>
      )}
    </form>
  );
}
