import type { DataName, FiananceBridge, LoadResult } from '../types';

const storageKey = (name: DataName) => `fianance:${name}`;
const NAMES: DataName[] = ['mois', 'objectifs', 'patrimoine'];

function readLocal(name: DataName) {
  try {
    const raw = localStorage.getItem(storageKey(name));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Used when the renderer runs in a plain browser (`npm run dev:web`), outside Electron.
const browserBridge: FiananceBridge = {
  async load(): Promise<LoadResult> {
    return {
      mois: readLocal('mois'),
      objectifs: readLocal('objectifs'),
      patrimoine: readLocal('patrimoine'),
      dataDir: null,
      warnings: [],
    };
  },
  async save(name, data) {
    localStorage.setItem(storageKey(name), JSON.stringify(data));
  },
  saveSync(name, data) {
    localStorage.setItem(storageKey(name), JSON.stringify(data));
    return true;
  },
  async backup() {
    const payload = Object.fromEntries(NAMES.map((n) => [n, readLocal(n)]));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fianance_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return { ok: true };
  },
  async openDataFolder() {
    return '';
  },
};

export const bridge: FiananceBridge = window.fianance ?? browserBridge;
export const isDesktop = window.fianance !== undefined;
