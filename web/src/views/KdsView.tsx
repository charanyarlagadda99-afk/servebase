import React, { useState, useEffect } from 'react';
import { KdsTicket, Station } from '../types';
import { 
  Flame, Clock, CheckCircle2, RotateCcw, AlertTriangle, 
  UtensilsCrossed, ChefHat, Layers, Filter
} from 'lucide-react';

interface KdsViewProps {
  tickets: KdsTicket[];
  onBumpTicket: (ticketId: string) => void;
  onBumpItem: (ticketId: string, itemId: string) => void;
  onRecallTicket: (ticketId: string) => void;
}

export const KdsView: React.FC<KdsViewProps> = ({
  tickets,
  onBumpTicket,
  onBumpItem,
  onRecallTicket
}) => {
  const [selectedStation, setSelectedStation] = useState<Station | 'all'>('all');
  const [showRecalled, setShowRecalled] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Tick clock every 5 seconds for live kitchen timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const stations: { id: Station | 'all'; label: string }[] = [
    { id: 'all', label: 'All Stations' },
    { id: 'tandoor', label: 'Tandoor & Grill' },
    { id: 'curry', label: 'Main Curry Range' },
    { id: 'bar', label: 'Bar & Beverages' },
    { id: 'pantry', label: 'Pantry & Desserts' },
    { id: 'expediter', label: 'Expediter Pass' }
  ];

  const activeTickets = tickets.filter(t => t.status === 'open');
  const completedTickets = tickets.filter(t => t.status === 'completed');

  const filteredTickets = (showRecalled ? completedTickets : activeTickets).filter(t => {
    if (selectedStation === 'all' || selectedStation === 'expediter') return true;
    return t.station === selectedStation;
  });

  // Calculate elapsed time in minutes
  const getElapsedMinutes = (createdAt: string) => {
    const diffMs = currentTime.getTime() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Aggregated Expediter summary: totals of items in flight
  const expeditedItems = activeTickets.flatMap(t => t.items).reduce((acc, item) => {
    if (item.status !== 'ready' && item.status !== 'served') {
      acc[item.name] = (acc[item.name] || 0) + item.quantity;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1C1917] text-white overflow-hidden">
      {/* KDS TOP CONTROL BAR */}
      <div className="bg-[#141211] border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-[#D9531E]" />
            <h1 className="text-lg font-bold font-serif tracking-wide text-white">
              Kitchen Display System (KDS)
            </h1>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/80">
            {activeTickets.length} active KOTs in flight
          </span>
        </div>

        {/* STATION FILTER BUTTONS */}
        <div className="flex items-center gap-1.5">
          {stations.map(st => (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStation === st.id
                  ? 'bg-[#D9531E] text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              {st.label}
            </button>
          ))}

          <div className="w-[1px] h-6 bg-white/10 mx-2" />

          <button
            onClick={() => setShowRecalled(!showRecalled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              showRecalled ? 'bg-amber-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {showRecalled ? 'Active KOTs' : 'Recall (Recent)'}
          </button>
        </div>
      </div>

      {/* EXPEDITER SUMMARY TICKER */}
      {selectedStation === 'expediter' && (
        <div className="bg-[#24211E] border-b border-white/10 px-6 py-2.5 flex items-center gap-6 overflow-x-auto">
          <span className="text-xs uppercase tracking-wider font-bold text-[#D9531E] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> All Stations Summary:
          </span>
          {Object.entries(expeditedItems).map(([dishName, qty]) => (
            <span key={dishName} className="text-xs font-medium text-white/90 whitespace-nowrap bg-black/40 px-2 py-1 rounded">
              <strong className="text-[#D9531E] mr-1">{qty}x</strong> {dishName}
            </span>
          ))}
          {Object.keys(expeditedItems).length === 0 && (
            <span className="text-xs text-white/50">All station items clear.</span>
          )}
        </div>
      )}

      {/* KDS TICKETS GRID */}
      <div className="flex-1 p-6 overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/40">
            <CheckCircle2 className="w-12 h-12 mb-3 text-[#2D5A27]" />
            <h3 className="text-base font-bold text-white/80">All Orders Bumped & Dispatched</h3>
            <p className="text-xs mt-1 text-white/50">
              {showRecalled ? 'No recently completed KOTs found.' : 'Station is all clear. Waiting for incoming POS KOTs.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {filteredTickets.map(ticket => {
              const elapsed = getElapsedMinutes(ticket.created_at);
              const isUrgent = elapsed >= 15;
              const isWarning = elapsed >= 10 && elapsed < 15;

              return (
                <div
                  key={ticket.id}
                  className={`rounded-xl border transition-all flex flex-col overflow-hidden ${
                    isUrgent ? 'border-red-500 bg-[#291816] shadow-lg shadow-red-950/40' :
                    isWarning ? 'border-amber-500 bg-[#292214]' :
                    'border-white/10 bg-[#24211E]'
                  }`}
                >
                  {/* TICKET HEADER */}
                  <div className={`p-3 border-b flex items-center justify-between ${
                    isUrgent ? 'border-red-500/30 bg-red-950/40' :
                    isWarning ? 'border-amber-500/30 bg-amber-950/40' :
                    'border-white/10 bg-black/20'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-serif text-white">{ticket.table_number}</span>
                        <span className="text-[10px] font-mono text-white/50 uppercase">{ticket.kot_number.split('-').pop()}</span>
                      </div>
                      <span className="text-[11px] text-white/60">Server: {ticket.server_name}</span>
                    </div>

                    <div className="text-right">
                      <div className={`flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        isUrgent ? 'bg-red-500 text-white animate-pulse' :
                        isWarning ? 'bg-amber-500 text-black' :
                        'bg-white/10 text-white/80'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>{elapsed}m</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-[#D9531E] block mt-0.5">
                        {ticket.station}
                      </span>
                    </div>
                  </div>

                  {/* TICKET ITEMS */}
                  <div className="p-3 space-y-2 flex-1">
                    {ticket.items.map(item => {
                      const isReady = item.status === 'ready';
                      const isPreparing = item.status === 'preparing';

                      return (
                        <div
                          key={item.id}
                          onClick={() => onBumpItem(ticket.id, item.id)}
                          className={`p-2 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                            isReady ? 'bg-[#2D5A27]/20 border-[#2D5A27]/50 text-white/60 line-through' :
                            isPreparing ? 'bg-[#D9531E]/20 border-[#D9531E]/50 text-white' :
                            'bg-black/30 border-white/5 hover:border-white/20 text-white'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-bold text-[#D9531E] mt-0.5">{item.quantity}x</span>
                            <div>
                              <p className="text-xs font-semibold leading-tight">{item.name}</p>
                              {item.notes && (
                                <p className="text-[10px] text-amber-300/90 mt-0.5 font-normal">
                                  ★ {item.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            isReady ? 'bg-[#2D5A27] text-white' :
                            isPreparing ? 'bg-[#D9531E] text-white' :
                            'bg-white/10 text-white/60'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* TICKET FOOTER ACTIONS */}
                  <div className="p-3 border-t border-white/10 bg-black/20 flex items-center justify-between">
                    {showRecalled ? (
                      <button
                        onClick={() => onRecallTicket(ticket.id)}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Recall to Station
                      </button>
                    ) : (
                      <button
                        onClick={() => onBumpTicket(ticket.id)}
                        className="w-full py-2 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Bump KOT
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
