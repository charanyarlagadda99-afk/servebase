import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface RealtimeEvent {
  id: string;
  outlet_id: string;
  type:
    | 'KOT_CREATED'
    | 'KOT_BUMPED'
    | 'KOT_RECALLED'
    | 'ITEM_BUMPED'
    | 'COURSE_FIRED'
    | 'TABLE_UPDATED'
    | 'BILL_PRINTED'
    | 'PAYMENT_RECEIVED';
  station_id?: string;
  order_id?: string;
  table_id?: string;
  data: any;
  timestamp: string;
}

class RealtimeEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  publish(eventInput: Omit<RealtimeEvent, 'id' | 'timestamp'>): RealtimeEvent {
    const event: RealtimeEvent = {
      ...eventInput,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Emit globally
    this.emit('event', event);

    // Emit outlet specific
    this.emit(`outlet:${event.outlet_id}`, event);

    // Emit station specific if present
    if (event.station_id) {
      this.emit(`station:${event.station_id}`, event);
    }

    return event;
  }

  subscribeOutlet(outletId: string, listener: (event: RealtimeEvent) => void): () => void {
    const channel = `outlet:${outletId}`;
    this.on(channel, listener);
    return () => this.off(channel, listener);
  }

  subscribeStation(stationId: string, listener: (event: RealtimeEvent) => void): () => void {
    const channel = `station:${stationId}`;
    this.on(channel, listener);
    return () => this.off(channel, listener);
  }
}

export const realtimeBus = new RealtimeEventBus();
