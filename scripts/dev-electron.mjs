import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const devServerUrl = 'http://127.0.0.1:5173'
const nodeCommand = process.execPath

function run(command, args, options = {}) {
  const env = {
    ...process.env,
    ...options.env,
  }

  for (const key of options.unsetEnv ?? []) {
    delete env[key]
  }

  const child = spawn(command, args, {
    stdio: options.stdio ?? 'inherit',
    shell: false,
    cwd: projectRoot,
    env,
  })

  child.on('exit', (code) => {
    if (options.exitOnClose && code !== 0) {
      process.exit(code ?? 1)
    }
  })

  return child
}

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args)

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
    })
  })
}

function waitForViteReady(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for the Vite dev server.'))
    }, 30000)

    child.stdout?.on('data', (buffer) => {
      const text = buffer.toString()
      process.stdout.write(text)

      if (stripAnsi(text).includes(devServerUrl)) {
        clearTimeout(timeout)
        resolve()
      }
    })

    child.stderr?.on('data', (buffer) => {
      process.stderr.write(buffer.toString())
    })

    child.on('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Vite exited before Electron started. Exit code: ${code}`))
    })
  })
}

function localCli(relativePath) {
  return path.join(projectRoot, 'node_modules', relativePath)
}

function stripAnsi(text) {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
}

const vite = run(nodeCommand, [localCli('vite/bin/vite.js'), '--host', '127.0.0.1'], {
  stdio: ['inherit', 'pipe', 'pipe'],
})

try {
  await waitForViteReady(vite)
  await runOnce(nodeCommand, [localCli('typescript/bin/tsc'), '-p', 'tsconfig.node.json'])
  run(nodeCommand, [localCli('typescript/bin/tsc'), '-p', 'tsconfig.node.json', '--watch'], {
    exitOnClose: false,
  })

  const electron = run(nodeCommand, [localCli('electron/cli.js'), '.'], {
    env: {
      VITE_DEV_SERVER_URL: devServerUrl,
    },
    unsetEnv: ['ELECTRON_RUN_AS_NODE'],
    exitOnClose: true,
  })

  electron.on('exit', () => {
    vite.kill()
  })
} catch (error) {
  vite.kill()
  console.error(error)
  process.exit(1)
}
