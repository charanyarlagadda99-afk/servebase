import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (err: any) => void;
  timeoutTimer: NodeJS.Timeout;
}

class CoreWorker {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private binaryPath: string;
  public isBusy = false;
  public isAlive = false;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
    this.spawnProcess();
  }

  private spawnProcess() {
    this.process = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.isAlive = true;

    const rl = readline.createInterface({
      input: this.process.stdout!,
      terminal: false,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const resp = JSON.parse(line);
        const reqId = resp.id;
        const pending = this.pendingRequests.get(reqId);
        if (pending) {
          clearTimeout(pending.timeoutTimer);
          this.pendingRequests.delete(reqId);
          this.isBusy = this.pendingRequests.size > 0;
          if (resp.ok) {
            pending.resolve(resp.result);
          } else {
            pending.reject(new Error(resp.error || 'Core engine error'));
          }
        }
      } catch (err) {
        console.error('[CORE WORKER] Failed to parse stdout JSON line:', line, err);
      }
    });

    this.process.on('exit', (code, signal) => {
      this.isAlive = false;
      this.isBusy = false;
      // Reject any pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeoutTimer);
        pending.reject(new Error(`Core engine worker exited unexpectedly (code: ${code}, signal: ${signal})`));
      }
      this.pendingRequests.clear();
      // Auto-restart after brief delay
      setTimeout(() => {
        if (!this.isAlive) {
          this.spawnProcess();
        }
      }, 500);
    });
  }

  public execute(id: string, op: string, payload: any): Promise<any> {
    if (!this.isAlive || !this.process || !this.process.stdin || !this.process.stdin.writable) {
      return Promise.reject(new Error('Core worker is offline'));
    }

    return new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Core worker timed out processing operation: ${op}`));
      }, 8000);

      this.pendingRequests.set(id, { resolve, reject, timeoutTimer });
      this.isBusy = true;

      const reqLine = JSON.stringify({ id, op, payload }) + '\n';
      this.process!.stdin!.write(reqLine, 'utf8');
    });
  }

  public terminate() {
    this.isAlive = false;
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

export class CorePool {
  private workers: CoreWorker[] = [];
  private poolSize: number;
  private reqCounter = 0;

  constructor(poolSize = 4) {
    this.poolSize = poolSize;
    const projectRoot = path.resolve(__dirname, '../../../');
    const binaryName = process.platform === 'win32' ? 'servebase_core.exe' : 'servebase_core';
    const binaryPath = path.join(projectRoot, 'core', 'bin', binaryName);

    for (let i = 0; i < poolSize; i++) {
      this.workers.push(new CoreWorker(binaryPath));
    }
  }

  public async execute(op: string, payload: any): Promise<any> {
    const id = `req-${++this.reqCounter}-${Date.now()}`;

    // Select least busy alive worker
    const aliveWorkers = this.workers.filter((w) => w.isAlive);
    if (aliveWorkers.length === 0) {
      const err: any = new Error('503 Service Unavailable: All C++ core engine workers are offline');
      err.statusCode = 503;
      throw err;
    }

    const availableWorker = aliveWorkers.find((w) => !w.isBusy) || aliveWorkers[0];
    return availableWorker.execute(id, op, payload);
  }

  public shutdown() {
    for (const w of this.workers) {
      w.terminate();
    }
  }
}

// Global singleton pool
export const corePool = new CorePool(4);
