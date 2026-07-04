import { useState } from "react";
import { BookOpen, FolderOpen, FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface OnboardingProps {
  onComplete: (workspacePath: string) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [loading, setLoading] = useState(false);

  const handlePickExisting = async () => {
    setLoading(true);
    try {
      const result = await window.electron.workspace.pickExisting();
      if (result) onComplete(result);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    setLoading(true);
    try {
      const result = await window.electron.workspace.createNew();
      if (result) onComplete(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-lg">
        <BookOpen className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Welcome to openbook
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select an existing project or create a new one to get started.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePickExisting}
            disabled={loading}
          >
            <FolderOpen className="size-4" />
            Open Existing Project
          </Button>
          <Button
            className="w-full"
            onClick={handleCreateNew}
            disabled={loading}
          >
            <FolderPlus className="size-4" />
            Create New Project
          </Button>
        </div>
      </div>
    </div>
  );
}
