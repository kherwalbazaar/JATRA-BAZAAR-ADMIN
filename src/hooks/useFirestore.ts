'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { EventItem, TicketType, BookingItem, GateInfo, CounterBooth, KPIStats } from '@/types';
import * as fs from '@/lib/firestore';

export interface FirestoreState {
  events: EventItem[];
  currentEvent: EventItem | null;
  ticketTypes: TicketType[];
  bookings: BookingItem[];
  gates: GateInfo[];
  counters: CounterBooth[];
  kpis: KPIStats;
  loading: boolean;
  isLiveConnected: boolean;
  error: string | null;
  isOfflineMode: boolean;
  isSeeding: boolean;
  isSyncing: boolean;
  isConnectionLost: boolean;
  lastUpdated: Date | null;

  setCurrentEvent: (event: EventItem) => void;
  addEvent: (event: Omit<EventItem, 'id'>) => Promise<string>;
  updateEvent: (event: EventItem) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  addBooking: (booking: Omit<BookingItem, 'id'> & { eventId: string }) => Promise<string>;
  checkInTicket: (bookingId: string) => Promise<void>;
  updateQuota: (typeId: string, delta: number) => Promise<void>;
  incrementGate: (gateId: string) => Promise<void>;
  decrementGate: (gateId: string) => Promise<void>;
  resetGate: (gateId: string) => Promise<void>;
  addTicketType: (type: Omit<TicketType, 'id'> & { eventId: string }) => Promise<string>;
  seedDatabase: () => Promise<void>;
  retryConnection: () => void;
}

function computeKPIs(
  bookings: BookingItem[],
  gates: GateInfo[],
  event: EventItem | null
): KPIStats {
  const totalCapacity = event?.totalCapacity ?? 0;
  const totalTicketsSold = bookings.reduce((s, b) => s + b.quantity, 0);
  const ticketsRemaining = Math.max(0, totalCapacity - totalTicketsSold);
  const totalCollection = bookings.reduce((s, b) => s + b.amount, 0);
  const peopleEntered = gates.reduce((s, g) => s + g.entered, 0);

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const todayBookings = bookings.filter((b) => b.date === todayStr);
  const todayCollection = todayBookings.reduce((s, b) => s + b.amount, 0);

  const onlineCollection = bookings.filter((b) => b.source === 'Online').reduce((s, b) => s + b.amount, 0);
  const offlineCollection = bookings.filter((b) => b.source === 'Counter').reduce((s, b) => s + b.amount, 0);
  const cashCollection = bookings.filter((b) => b.paymentMethod === 'Cash').reduce((s, b) => s + b.amount, 0);
  const upiCollection = bookings.filter((b) => b.paymentMethod === 'UPI').reduce((s, b) => s + b.amount, 0);

  return {
    totalTicketsSold,
    totalCollection,
    ticketsRemaining,
    totalCapacity,
    peopleEntered,
    todayCollection,
    todayPercentageOfTotal: totalCollection > 0 ? Math.round((todayCollection / totalCollection) * 1000) / 10 : 0,
    onlineCollection,
    offlineCollection,
    cashCollection,
    upiCollection,
    averageTicketValue: totalTicketsSold > 0 ? Math.round((totalCollection / totalTicketsSold) * 100) / 100 : 0,
    scannedTodayPercentage: totalTicketsSold > 0 ? Math.round((peopleEntered / totalTicketsSold) * 1000) / 10 : 0,
  };
}

export function useFirestore(): FirestoreState {
  // Initialize with empty arrays - real data loads from Firestore
  const [events, setEvents] = useState<EventItem[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [gates, setGates] = useState<GateInfo[]>([]);
  const [counters, setCounters] = useState<CounterBooth[]>([]);
  const [kpis, setKpis] = useState<KPIStats>(() => computeKPIs([], [], null));

  // Connection & live status
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnectionLost, setIsConnectionLost] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLocalActionRef = useRef(false);

  const unsubRefs = useRef<(() => void)[]>([]);

  const cleanup = useCallback(() => {
    unsubRefs.current.forEach((unsub) => unsub());
    unsubRefs.current = [];
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // 0. Keep "Create New Event" form format stored in Firestore (settings/createEventFormat)
  useEffect(() => {
    fs.saveEventFormFormat().catch((err) => {
      console.warn('Failed to sync event form format:', err);
    });
  }, []);

  // 1. Call Firebase in background to fetch & stream live events
  useEffect(() => {
    if (isOfflineMode) {
      setLoading(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let isCancelled = false;

    // Safety timeout: if Firestore real-time listener doesn't respond in 4.5 seconds,
    // attempt a direct getDocs fetch. UI is already visible so the user is never blocked.
    const timer = setTimeout(async () => {
      if (isCancelled) return;
      try {
        const directEvents = await fs.getEventsOnce();
        if (isCancelled) return;
        if (directEvents.length > 0) {
          setEvents(directEvents);
          setCurrentEvent((prev) => {
            if (prev) {
              const matched = directEvents.find((e) => e.id === prev.id);
              if (matched) return matched;
            }
            return directEvents.find((e) => e.status === 'active') ?? directEvents[0];
          });
          setIsLiveConnected(true);
          setIsConnectionLost(false);
          setError(null);
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : 'Timeout connecting to Firebase';
        console.warn('Direct fetch notice:', msg);
        setError('Firebase connection pending. Using cached data.');
        setIsConnectionLost(true);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, 4500);

    try {
      unsub = fs.listenEvents(
        (evts) => {
          if (isCancelled) return;
          clearTimeout(timer);
          setLoading(false);
          setIsLiveConnected(true);
          setIsConnectionLost(false);
          setError(null);
          
          // Clear retry timer when connection is restored
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }

          // Show syncing briefly, then "up to date" — only for external changes
          if (isLocalActionRef.current) {
            isLocalActionRef.current = false;
          } else {
            setIsSyncing(true);
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(() => {
              setIsSyncing(false);
              setLastUpdated(new Date());
            }, 500);
          }
          setLastUpdated(new Date());

          if (evts.length > 0) {
            setEvents(evts);
            // Auto-select or preserve currently selected event
            setCurrentEvent((prev) => {
              if (prev) {
                const matched = evts.find((e) => e.id === prev.id);
                if (matched) return matched;
              }
              return evts.find((e) => e.status === 'active') ?? evts[0];
            });
          }
        },
        (err) => {
          if (isCancelled) return;
          clearTimeout(timer);
          console.error('Firestore events listener error:', err);
          setError(err.message || 'Firebase connection failed');
          setIsConnectionLost(true);
          setIsLiveConnected(false);
          setLoading(false);
          
          // Auto-retry connection every 5 seconds when connection is lost
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            console.log('Auto-retrying connection...');
            setRetryCount(c => c + 1);
          }, 5000);
        }
      );

      unsubRefs.current.push(unsub);
    } catch (err: unknown) {
      if (!isCancelled) {
        clearTimeout(timer);
        console.error('Events listener sync error:', err);
        const msg = err instanceof Error ? err.message : 'Firebase initialization failed';
        setError(msg);
        setLoading(false);
      }
    }

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (unsub) {
        unsub();
        unsubRefs.current = unsubRefs.current.filter((u) => u !== unsub);
      }
    };
  }, [retryCount, isOfflineMode]);

  // 2. Call Firebase in background to stream sub-collections (ticket types, bookings, gates, counters)
  useEffect(() => {
    cleanup();
    if (!currentEvent?.id || isOfflineMode) return;

    const unsubs: (() => void)[] = [];

    try {
      unsubs.push(
        fs.listenTicketTypes(
          currentEvent.id,
          (types) => {
            setTicketTypes(types);
            setIsLiveConnected(true);
            setIsConnectionLost(false);
            if (isLocalActionRef.current) {
              isLocalActionRef.current = false;
            } else {
              setIsSyncing(true);
              if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
              syncTimerRef.current = setTimeout(() => {
                setIsSyncing(false);
                setLastUpdated(new Date());
              }, 500);
            }
            setLastUpdated(new Date());
          },
          (err) => {
            console.warn('TicketTypes listener error:', err);
            setIsConnectionLost(true);
          }
        )
      );
    } catch (err) {
      console.error('TicketTypes listener error:', err);
      setIsConnectionLost(true);
    }

    try {
      unsubs.push(
        fs.listenBookings(
          currentEvent.id,
          (bks) => {
            setBookings(bks);
            setIsLiveConnected(true);
            setIsConnectionLost(false);
            if (isLocalActionRef.current) {
              isLocalActionRef.current = false;
            } else {
              setIsSyncing(true);
              if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
              syncTimerRef.current = setTimeout(() => {
                setIsSyncing(false);
                setLastUpdated(new Date());
              }, 500);
            }
            setLastUpdated(new Date());
          },
          (err) => {
            console.warn('Bookings listener error:', err);
            setIsConnectionLost(true);
          }
        )
      );
    } catch (err) {
      console.error('Bookings listener error:', err);
      setIsConnectionLost(true);
    }

    try {
      unsubs.push(
        fs.listenGates(
          currentEvent.id,
          (gts) => {
            setGates(gts);
            setIsLiveConnected(true);
            setIsConnectionLost(false);
            if (isLocalActionRef.current) {
              isLocalActionRef.current = false;
            } else {
              setIsSyncing(true);
              if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
              syncTimerRef.current = setTimeout(() => {
                setIsSyncing(false);
                setLastUpdated(new Date());
              }, 500);
            }
            setLastUpdated(new Date());
          },
          (err) => {
            console.warn('Gates listener error:', err);
            setIsConnectionLost(true);
          }
        )
      );
    } catch (err) {
      console.error('Gates listener error:', err);
      setIsConnectionLost(true);
    }

    try {
      unsubs.push(
        fs.listenCounters(
          currentEvent.id,
          (cnts) => {
            setCounters(cnts);
            setIsLiveConnected(true);
            setIsConnectionLost(false);
            if (isLocalActionRef.current) {
              isLocalActionRef.current = false;
            } else {
              setIsSyncing(true);
              if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
              syncTimerRef.current = setTimeout(() => {
                setIsSyncing(false);
                setLastUpdated(new Date());
              }, 500);
            }
            setLastUpdated(new Date());
          },
          (err) => {
            console.warn('Counters listener error:', err);
            setIsConnectionLost(true);
          }
        )
      );
    } catch (err) {
      console.error('Counters listener error:', err);
      setIsConnectionLost(true);
    }

    unsubRefs.current.push(...unsubs);

    return () => {
      unsubs.forEach((u) => u());
      unsubRefs.current = unsubRefs.current.filter((u) => !unsubs.includes(u));
    };
  }, [currentEvent?.id, isOfflineMode, cleanup]);

  // Recompute KPIs whenever bookings/gates/event change
  useEffect(() => {
    setKpis(computeKPIs(bookings, gates, currentEvent));
  }, [bookings, gates, currentEvent]);

  // Retry connection to Firestore
  const seedDatabase = useCallback(async () => {
    setIsSeeding(true);
    setError(null);
    try {
      const freshEvents = await fs.getEventsOnce();
      if (freshEvents.length > 0) {
        setEvents(freshEvents);
        setCurrentEvent(freshEvents[0]);
      }
      setIsOfflineMode(false);
      setIsLiveConnected(true);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to connect to Firestore:', err);
      const msg = err instanceof Error ? err.message : 'Failed to connect to Firestore';
      setError(msg);
    } finally {
      setIsSeeding(false);
      setLoading(false);
    }
  }, []);

  // Retry connection
  const retryConnection = useCallback(() => {
    setLoading(true);
    setError(null);
    setIsOfflineMode(false);
    setRetryCount((c) => c + 1);
  }, []);

  const handleSetCurrentEvent = useCallback((event: EventItem) => {
    setCurrentEvent(event);
  }, []);

  const handleAddEvent = useCallback(async (event: Omit<EventItem, 'id'>) => {
    if (isOfflineMode || !isLiveConnected) {
      const newId = `EVT-LOC-${Date.now()}`;
      const newEvt: EventItem = { ...event, id: newId };
      setEvents((prev) => [newEvt, ...prev]);
      setCurrentEvent(newEvt);
      setLastUpdated(new Date());
      return newId;
    }
    isLocalActionRef.current = true;
    const id = await fs.addEvent(event);
    
    // Immediately fetch fresh data from database
    try {
      const freshEvents = await fs.getEventsOnce();
      setEvents(freshEvents);
      setCurrentEvent((prev) => {
        if (prev) {
          const matched = freshEvents.find((e) => e.id === prev.id);
          if (matched) return matched;
        }
        return freshEvents.find((e) => e.status === 'active') ?? freshEvents[0];
      });
    } catch (err) {
      console.error('Failed to fetch fresh events after add:', err);
    }
    
    setLastUpdated(new Date());
    return id;
  }, [isOfflineMode, isLiveConnected]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    // Always try to delete from Firestore, even if connection status is uncertain
    console.log('handleDeleteEvent called with eventId:', eventId);
    console.log('Connection status - isLiveConnected:', isLiveConnected, 'isOfflineMode:', isOfflineMode);
    
    try {
      isLocalActionRef.current = true;
      console.log('Calling fs.deleteEvent...');
      await fs.deleteEvent(eventId);
      console.log('fs.deleteEvent completed successfully');
      
      // Immediately fetch fresh data from database to confirm deletion
      console.log('Fetching fresh data from database...');
      const freshEvents = await fs.getEventsOnce();
      console.log('Fresh events fetched:', freshEvents.length);
      
      // Update local state with fresh data
      setEvents(freshEvents);
      setCurrentEvent((prev) => {
        if (prev) {
          const matched = freshEvents.find((e) => e.id === prev.id);
          if (matched) return matched;
        }
        return freshEvents.find((e) => e.status === 'active') ?? freshEvents[0];
      });
      
      console.log('Local state updated with fresh data');
    } catch (err) {
      console.error('Failed to delete event from Firestore:', err);
      // If Firestore delete fails, still update local state
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      if (currentEvent?.id === eventId) {
        setCurrentEvent(null);
      }
      throw err; // Re-throw so caller knows deletion failed
    }
    // Trigger instant sync feedback
    setLastUpdated(new Date());
  }, [currentEvent, isLiveConnected, isOfflineMode]);

  const handleUpdateEvent = useCallback(async (event: EventItem) => {
    if (isOfflineMode || !isLiveConnected) {
      setEvents((prev) => prev.map((e) => e.id === event.id ? event : e));
      if (currentEvent?.id === event.id) {
        setCurrentEvent(event);
      }
      setLastUpdated(new Date());
      return;
    }
    isLocalActionRef.current = true;
    await fs.updateEvent(event.id, event);
    
    // Immediately fetch fresh data from database
    try {
      const freshEvents = await fs.getEventsOnce();
      setEvents(freshEvents);
      setCurrentEvent((prev) => {
        if (prev) {
          const matched = freshEvents.find((e) => e.id === prev.id);
          if (matched) return matched;
        }
        return freshEvents.find((e) => e.status === 'active') ?? freshEvents[0];
      });
    } catch (err) {
      console.error('Failed to fetch fresh events after update:', err);
    }
    
    setLastUpdated(new Date());
  }, [isOfflineMode, isLiveConnected, currentEvent]);

  const handleAddBooking = useCallback(async (booking: Omit<BookingItem, 'id'> & { eventId: string }) => {
    if (isOfflineMode || !isLiveConnected) {
      const newId = `BK-${Date.now()}`;
      const newBooking: BookingItem = { ...booking, id: newId };
      setBookings((prev) => [newBooking, ...prev]);
      setLastUpdated(new Date());
      return newId;
    }
    isLocalActionRef.current = true;
    const id = await fs.addBooking(booking);
    setLastUpdated(new Date());
    return id;
  }, [isOfflineMode, isLiveConnected]);

  const handleCheckInTicket = useCallback(async (bookingId: string) => {
    if (isOfflineMode || !isLiveConnected) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'Checked-in' as const } : b))
      );
      const booking = bookings.find((b) => b.id === bookingId);
      if (booking) {
        setGates((prev) =>
          prev.map((g) => {
            if (g.name.includes(booking.assignedGate) || g.id.includes(booking.assignedGate.toUpperCase().replace(' ', '-'))) {
              const newEntered = g.entered + booking.quantity;
              return {
                ...g,
                entered: newEntered,
                percentage: Math.round((newEntered / g.capacity) * 100),
                status: newEntered >= g.capacity ? 'full' : newEntered >= g.capacity * 0.8 ? 'congested' : 'normal',
              };
            }
            return g;
          })
        );
      }
      setLastUpdated(new Date());
      return;
    }

    isLocalActionRef.current = true;
    await fs.checkInBooking(bookingId);
    const booking = bookings.find((b) => b.id === bookingId);
    if (booking) {
      const gate = gates.find(
        (g) => g.name.includes(booking.assignedGate) || g.id.includes(booking.assignedGate.toUpperCase().replace(' ', '-'))
      );
      if (gate) {
        await fs.incrementGateEntry(gate.id, booking.quantity);
      }
    }
    setLastUpdated(new Date());
  }, [isOfflineMode, isLiveConnected, bookings, gates]);

  const handleUpdateQuota = useCallback(async (typeId: string, delta: number) => {
    if (isOfflineMode || !isLiveConnected) {
      setTicketTypes((prev) =>
        prev.map((t) => (t.id === typeId ? { ...t, totalQuota: Math.max(t.sold, t.totalQuota + delta) } : t))
      );
      setLastUpdated(new Date());
      return;
    }
    const type = ticketTypes.find((t) => t.id === typeId);
    if (type) {
      isLocalActionRef.current = true;
      await fs.updateTicketType(typeId, { totalQuota: Math.max(type.sold, type.totalQuota + delta) });
      setLastUpdated(new Date());
    }
  }, [isOfflineMode, isLiveConnected, ticketTypes]);

  const handleIncrementGate = useCallback(async (gateId: string) => {
    if (isOfflineMode || !isLiveConnected) {
      setGates((prev) =>
        prev.map((g) => {
          if (g.id === gateId) {
            const newEntered = g.entered + 1;
            return {
              ...g,
              entered: newEntered,
              percentage: Math.round((newEntered / g.capacity) * 100),
              status: newEntered >= g.capacity ? 'full' : newEntered >= g.capacity * 0.8 ? 'congested' : 'normal',
            };
          }
          return g;
        })
      );
      setLastUpdated(new Date());
      return;
    }
    isLocalActionRef.current = true;
    await fs.incrementGateEntry(gateId, 1);
    setLastUpdated(new Date());
  }, [isOfflineMode, isLiveConnected]);

  const handleDecrementGate = useCallback(async (gateId: string) => {
    if (isOfflineMode || !isLiveConnected) {
      setGates((prev) =>
        prev.map((g) => {
          if (g.id === gateId) {
            const newEntered = Math.max(0, g.entered - 1);
            return {
              ...g,
              entered: newEntered,
              percentage: Math.round((newEntered / g.capacity) * 100),
              status: newEntered >= g.capacity ? 'full' : newEntered >= g.capacity * 0.8 ? 'congested' : 'normal',
            };
          }
          return g;
        })
      );
      setLastUpdated(new Date());
      return;
    }
    isLocalActionRef.current = true;
    await fs.incrementGateEntry(gateId, -1);
    setLastUpdated(new Date());
  }, [isOfflineMode, isLiveConnected]);

  const handleResetGate = useCallback(async (gateId: string) => {
    if (isOfflineMode || !isLiveConnected) {
      setGates((prev) =>
        prev.map((g) => (g.id === gateId ? { ...g, entered: 0, percentage: 0, status: 'normal' as const } : g))
      );
      setLastUpdated(new Date());
      return;
    }
    isLocalActionRef.current = true;
    await fs.resetGate(gateId);
    setLastUpdated(new Date());
  }, [isOfflineMode, isLiveConnected]);

  const handleAddTicketType = useCallback(async (type: Omit<TicketType, 'id'> & { eventId: string }) => {
    if (isOfflineMode || !isLiveConnected) {
      const newId = `TT-LOC-${Date.now()}`;
      const newType: TicketType = { ...type, id: newId };
      setTicketTypes((prev) => [...prev, newType]);
      setLastUpdated(new Date());
      return newId;
    }
    isLocalActionRef.current = true;
    const id = await fs.addTicketType(type);
    setLastUpdated(new Date());
    return id;
  }, [isOfflineMode, isLiveConnected]);

  return {
    events,
    currentEvent,
    ticketTypes,
    bookings,
    gates,
    counters,
    kpis,
    loading,
    isLiveConnected,
    error,
    isOfflineMode,
    isSeeding,
    isSyncing,
    isConnectionLost,
    lastUpdated,
    setCurrentEvent: handleSetCurrentEvent,
    addEvent: handleAddEvent,
    updateEvent: handleUpdateEvent,
    deleteEvent: handleDeleteEvent,
    addBooking: handleAddBooking,
    checkInTicket: handleCheckInTicket,
    updateQuota: handleUpdateQuota,
    incrementGate: handleIncrementGate,
    decrementGate: handleDecrementGate,
    resetGate: handleResetGate,
    addTicketType: handleAddTicketType,
    seedDatabase,
    retryConnection,
  };
}
