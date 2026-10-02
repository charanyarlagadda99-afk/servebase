// Client API layer communicating with the Fastify server when online
const API_BASE = 'http://localhost:3000';

export async function checkBackendHealth(): Promise<{ online: boolean; coreActive: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const resp = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      return { online: true, coreActive: data.core_engine === 'active' };
    }
    return { online: false, coreActive: false };
  } catch {
    return { online: false, coreActive: false };
  }
}

export async function fetchLiveTables() {
  const resp = await fetch(`${API_BASE}/api/tables`);
  return resp.json();
}

export async function fetchLiveMenu() {
  const resp = await fetch(`${API_BASE}/api/menu`);
  return resp.json();
}

export async function fetchLiveInventory() {
  const resp = await fetch(`${API_BASE}/api/inventory`);
  return resp.json();
}

export async function fetchLiveStaff() {
  const resp = await fetch(`${API_BASE}/api/staff`);
  return resp.json();
}

export async function fetchLiveRooms() {
  const resp = await fetch(`${API_BASE}/api/hotel/rooms`);
  return resp.json();
}

export async function priceBillViaNativeCore(items: any[]) {
  const resp = await fetch(`${API_BASE}/api/bills/price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return resp.json();
}

export async function splitBillViaNativeCore(totalPaise: number, splitsCount: number) {
  const resp = await fetch(`${API_BASE}/api/bills/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ total_paise: totalPaise, split_count: splitsCount }),
  });
  return resp.json();
}
