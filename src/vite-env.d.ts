/// <reference types="vite/client" />

declare global {
  const google: any;

  interface Window {
    google?: any;
    __champsMapsCb?: () => void;
  }
}

export {};
