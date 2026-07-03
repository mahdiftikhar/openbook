/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

interface Window {
  electron: {
    platform: string;
  };
}
