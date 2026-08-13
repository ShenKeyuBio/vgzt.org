/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.yml?raw' {
  const value: string;
  export default value;
}

declare module '*.yaml?raw' {
  const value: string;
  export default value;
}
