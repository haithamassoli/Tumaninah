import { contextBridge, ipcRenderer } from "electron";

const api = {
  ping: (): Promise<"pong"> => ipcRenderer.invoke("app:ping"),
} as const;

export type TumaninahApi = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("tumaninah", api);
} else {
  (globalThis as unknown as { tumaninah: TumaninahApi }).tumaninah = api;
}
