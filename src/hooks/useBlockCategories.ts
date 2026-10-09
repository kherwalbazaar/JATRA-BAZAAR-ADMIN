'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockCategory,
  defaultBlockCategories,
  isLegacyBuiltin,
  loadBlockCategories,
  saveBlockCategories as cacheBlockCategories,
} from '@/lib/blockCategories';
import * as fs from '@/lib/firestore';

const SAVE_DEBOUNCE_MS = 150;

/**
 * Block categories with Firebase persistence.
 * - Live listener keeps every screen in sync with Firestore (blockCategories collection).
 * - Local edits are applied immediately, mirrored to localStorage, and flushed to
 *   Firestore (debounced) as a full set (upsert + delete removed).
 * - Falls back to the localStorage cache when Firebase is unreachable.
 */
export function useBlockCategories() {
  const [blocks, setBlocksState] = useState<BlockCategory[]>(defaultBlockCategories);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<BlockCategory[]>(blocks);
  latest.current = blocks;

  useEffect(() => {
    let firstSnapshot = true;
    const unsub = fs.listenBlockCategories(
      (remote) => {
        // Only the 9 venue blocks + custom (non built-in) blocks are valid —
        // legacy built-ins (A, B, C, D, D1-D3, Gallery …) are dropped and
        // purged from Firestore on the next write.
        const cleaned = remote.filter((b) => !isLegacyBuiltin(b.id, b.builtin));
        if (cleaned.length) {
          setBlocksState(cleaned);
          cacheBlockCategories(cleaned);
          if (cleaned.length !== remote.length) {
            fs.saveBlockCategories(cleaned)
              .catch((err) => console.warn('purge blockCategories error:', err));
          }
        } else if (firstSnapshot) {
          // Nothing stored in Firebase yet — fall back to the local cache.
          const cached = loadBlockCategories();
          setBlocksState(cached);
        }
        firstSnapshot = false;
      },
      () => {
        // Firebase unreachable → local cache / defaults.
        if (firstSnapshot) {
          setBlocksState(loadBlockCategories());
          firstSnapshot = false;
        }
      }
    );
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /**
   * Persist edits. `immediate = true` (status / channel flips) writes to
   * Firestore straight away so the user & scanner apps see it in real time.
   */
  const setBlocks = useCallback((next: BlockCategory[], immediate = false) => {
    setBlocksState(next);
    cacheBlockCategories(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (immediate) {
      fs.saveBlockCategories(next)
        .catch((err) => console.warn('saveBlockCategories error:', err));
      return;
    }
    saveTimer.current = setTimeout(() => {
      fs.saveBlockCategories(latest.current)
        .catch((err) => console.warn('saveBlockCategories error:', err));
    }, SAVE_DEBOUNCE_MS);
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

  return { blocks, setBlocks, labels, channelLabels, disabledBlocks };
}
