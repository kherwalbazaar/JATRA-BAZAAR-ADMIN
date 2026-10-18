'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockCategory,
  defaultBlockCategories,
  isLegacyBuiltin,
  loadBlockCategories,
  normalizeBlockCategory,
  saveBlockCategories as cacheBlockCategories,
} from '@/lib/blockCategories';
import * as fs from '@/lib/firestore';
import {
  sbFetchBlockCategories,
  sbUpdateBlockChannel,
  sbUpdateBlockName,
  sbSaveAllBlockCategories,
  sbSubscribeBlockCategories,
} from '@/lib/supabase-db';

const SAVE_DEBOUNCE_MS = 150;

/**
 * Block categories with Supabase as the primary single source of truth.
 * - Live subscription to Supabase Realtime (postgres_changes & broadcast).
 * - Real-time channel toggling persists immediately to Supabase `public.block_categories`.
 * - Automatic optimistic UI with rollback on network/database failure.
 * - Dual-writes to Firestore and caches in localStorage as fallback.
 */
export function useBlockCategories() {
  const [blocks, setBlocksState] = useState<BlockCategory[]>(() => {
    const cached = loadBlockCategories();
    return cached.length ? cached : defaultBlockCategories();
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<BlockCategory[]>(blocks);
  latest.current = blocks;

  // Refresh from Supabase (source of truth)
  const refreshFromSupabase = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const remote = await sbFetchBlockCategories();
      const cleaned = remote
        .filter((b) => !isLegacyBuiltin(b.id, b.builtin))
        .map(normalizeBlockCategory);

      if (cleaned.length > 0) {
        setBlocksState(cleaned);
        cacheBlockCategories(cleaned);
        setError(null);
        // Ensure Firestore mirror matches Supabase
        fs.saveBlockCategories(cleaned).catch(() => {});
      } else if (isInitial) {
        // First-time seed into Supabase if empty
        const defaults = defaultBlockCategories();
        await sbSaveAllBlockCategories(defaults);
        setBlocksState(defaults);
        cacheBlockCategories(defaults);
      }
    } catch (err: any) {
      console.warn('[useBlockCategories] Supabase fetch warning, using cache/fallback:', err?.message || err);
      if (isInitial) {
        const cached = loadBlockCategories();
        setBlocksState(cached.length ? cached : defaultBlockCategories());
        setError('Connected using local cache. Check Supabase connection.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // 1. Initial load from Supabase
    refreshFromSupabase(true);

    // 2. Realtime listener to Supabase (postgres_changes + broadcast)
    const unsubSb = sbSubscribeBlockCategories(() => {
      if (active) refreshFromSupabase(false);
    });

    // 3. Re-sync on window focus / tab switch
    const onFocus = () => {
      if (active) refreshFromSupabase(false);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // 4. Secondary Firestore listener for dual-written updates
    const unsubFs = fs.listenBlockCategories((remote) => {
      if (!active) return;
      const cleaned = remote
        .filter((b) => !isLegacyBuiltin(b.id, b.builtin))
        .map(normalizeBlockCategory);
      if (cleaned.length && !latest.current.length) {
        setBlocksState(cleaned);
        cacheBlockCategories(cleaned);
      }
    });

    return () => {
      active = false;
      unsubSb();
      unsubFs();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [refreshFromSupabase]);

  /**
   * Dedicated channel switch action for an individual block category.
   * - Optimistically updates UI.
   * - Immediately commits to Supabase `block_categories`.
   * - Reverts on database failure and sets error message.
   */
  const setBlockChannel = useCallback(
    async (id: string, mode: 'online' | 'counter'): Promise<{ success: boolean; error?: string }> => {
      const prevBlocks = latest.current;
      const isOnline = mode === 'online';

      setUpdatingId(id);
      setError(null);

      // Optimistic update
      const optimistic = prevBlocks.map((b) =>
        b.id === id
          ? {
              ...b,
              online: isOnline,
              counter: !isOnline,
              enabled: isOnline,
            }
          : b
      );
      setBlocksState(optimistic);
      cacheBlockCategories(optimistic);

      try {
        const res = await sbUpdateBlockChannel(id, mode);
        if (!res.success) {
          throw new Error(res.error || 'Failed to update selling channel in Supabase');
        }

        // Mirror to Firestore in background
        fs.saveBlockCategories(optimistic).catch((err) => {
          console.warn('[useBlockCategories] Firestore dual-write notice:', err);
        });

        setUpdatingId(null);
        return { success: true };
      } catch (err: any) {
        const errMsg = err?.message || 'Database update failed';
        console.error(`[useBlockCategories] Failed to update block ${id}:`, errMsg);

        // Revert to previous confirmed database state
        setBlocksState(prevBlocks);
        cacheBlockCategories(prevBlocks);
        setUpdatingId(null);
        setError(`Failed to update ${id}: ${errMsg}. Reverted to previous status.`);

        return { success: false, error: errMsg };
      }
    },
    []
  );

  /**
   * Update a block's display name with Supabase persistence.
   */
  const setBlockName = useCallback(async (id: string, name: string): Promise<void> => {
    const next = latest.current.map((b) => (b.id === id ? { ...b, name } : b));
    setBlocksState(next);
    cacheBlockCategories(next);

    await sbUpdateBlockName(id, name);
    fs.saveBlockCategories(next).catch(() => {});
  }, []);

  /**
   * Persist complete block set edits (batch).
   */
  const setBlocks = useCallback((next: BlockCategory[], immediate = false) => {
    setBlocksState(next);
    cacheBlockCategories(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);

    const persist = () => {
      sbSaveAllBlockCategories(latest.current).catch((err) =>
        console.warn('[useBlockCategories] sbSaveAllBlockCategories error:', err)
      );
      fs.saveBlockCategories(latest.current).catch((err) =>
        console.warn('[useBlockCategories] saveBlockCategories error:', err)
      );
    };

    if (immediate) {
      persist();
      return;
    }
    saveTimer.current = setTimeout(persist, SAVE_DEBOUNCE_MS);
  }, []);

  const labels = useMemo(() => Object.fromEntries(blocks.map((b) => [b.id, b.name])), [blocks]);

  /** "Counter" when the block sells at the counter, otherwise "Online". */
  const channelLabels = useMemo(
    () => Object.fromEntries(blocks.map((b) => [b.id, b.counter ? 'Counter' : 'Online'])),
    [blocks]
  );

  // A block is unavailable (dimmed) only when it sells on neither channel.
  const disabledBlocks = useMemo(
    () => blocks.filter((b) => !b.online && !b.counter).map((b) => b.id),
    [blocks]
  );

  const onlineBlocks = useMemo(() => blocks.filter((b) => b.online).map((b) => b.id), [blocks]);
  const counterBlocks = useMemo(() => blocks.filter((b) => b.counter).map((b) => b.id), [blocks]);
  const isOnlineBlock = useCallback((id: string) => blocks.some((b) => b.id === id && b.online), [blocks]);
  const isCounterBlock = useCallback((id: string) => blocks.some((b) => b.id === id && b.counter), [blocks]);

  return {
    blocks,
    setBlocks,
    labels,
    channelLabels,
    disabledBlocks,
    onlineBlocks,
    counterBlocks,
    isOnlineBlock,
    isCounterBlock,
    loading,
    error,
    updatingId,
    setBlockChannel,
    setBlockName,
    reload: refreshFromSupabase,
  };
}
