import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface RealtimeSyncOptions {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  filter?: string;
  enabled?: boolean;
}

/**
 * Hook for real-time database synchronization
 * Automatically subscribes to table changes and handles cleanup
 */
export function useRealtimeSync({
  table,
  onInsert,
  onUpdate,
  onDelete,
  filter,
  enabled = true,
}: RealtimeSyncOptions) {
  useEffect(() => {
    if (!enabled) return;

    const channel: RealtimeChannel = supabase
      .channel(`${table}-changes`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table,
          filter: filter,
        },
        (payload) => {
          console.log(`[Realtime] ${table} change:`, payload);
          
          switch (payload.eventType) {
            case "INSERT":
              onInsert?.(payload);
              break;
            case "UPDATE":
              onUpdate?.(payload);
              break;
            case "DELETE":
              onDelete?.(payload);
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] Subscribed to ${table} changes`);
        }
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from ${table} changes`);
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled, onInsert, onUpdate, onDelete]);
}
