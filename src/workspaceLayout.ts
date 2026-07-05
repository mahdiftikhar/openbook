export const WORKSPACE_DIRS = {
  notes: "notes",
  sources: "sources",
  metadata: ".openbook",
  text: "text",
} as const;

export const WORKSPACE_FILES = {
  sourcesIndex: "sources-index.json",
} as const;

export const REQUIRED_WORKSPACE_DIRS = [
  WORKSPACE_DIRS.notes,
  WORKSPACE_DIRS.sources,
  WORKSPACE_DIRS.metadata,
] as const;
