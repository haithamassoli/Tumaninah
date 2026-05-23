import type { TumaninahApi } from "./index";

declare global {
  interface Window {
    tumaninah: TumaninahApi;
  }
}

export {};
