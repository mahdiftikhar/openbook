export const IPC_CHANNELS = {
    workspace: {
        getPath: "workspace:get-path",
        pickExisting: "workspace:pick-existing",
        createNew: "workspace:create-new",
        clear: "workspace:clear",
        listFiles: "workspace:list-files",
        revealFile: "workspace:reveal-file",
    },
    notes: {
        create: "notes:create",
        read: "notes:read",
        write: "notes:write",
        rename: "notes:rename",
        delete: "notes:delete",
    },
    sources: {
        list: "sources:list",
        addPdf: "sources:add-pdf",
        remove: "sources:remove",
        rename: "sources:rename",
        open: "sources:open",
        readFile: "sources:read-file",
    },
    chat: {
        ask: "chat:ask",
        cancel: "chat:cancel",
        stream: "chat:stream",
    },
} as const;
