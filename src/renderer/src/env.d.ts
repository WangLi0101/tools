/// <reference types="vite/client" />

declare global {
  interface File extends File {
    path: string
  }
}
