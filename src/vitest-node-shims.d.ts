declare module 'node:fs/promises' {
  export function readFile(path: URL): Promise<Uint8Array>
  export function readFile(path: string, encoding: 'utf8'): Promise<string>
  export function writeFile(path: string, content: string, encoding: 'utf8'): Promise<void>
  export function mkdtemp(prefix: string): Promise<string>
  export function rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>
}

declare module 'node:os' {
  export function tmpdir(): string
}

declare module 'node:path' {
  export function basename(path: string): string
  export function dirname(path: string): string
  export function join(...paths: string[]): string
  export function resolve(...paths: string[]): string
}
