import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";

export interface OrgDataOptions {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filter?: Record<string, any>;
  enabled?: boolean;
}

/**
 * Fetch data scoped to the current organization
 * Automatically handles org context and common query patterns
 */
export function useOrgData<T = any>(
  tableName: string,
  options?: OrgDataOptions
): UseQueryResult<T[], Error> {
  const { effectiveOrgId } = useOrgContext();

  return useQuery({
    queryKey: [tableName, effectiveOrgId, options],
    queryFn: async () => {
      if (!effectiveOrgId) throw new Error("No organization context");

      let query: any = supabase
        .from(tableName as any)
        .select(options?.select || "*")
        .eq("org_id", effectiveOrgId);

      if (options?.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    },
    enabled: !!effectiveOrgId && (options?.enabled !== false),
  });
}
