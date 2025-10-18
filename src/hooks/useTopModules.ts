import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TopModule {
  module_key: string;
  module_name: string;
  module_path: string;
  module_icon: string;
  visit_count: number;
}

export const useTopModules = (limit: number = 6) => {
  return useQuery({
    queryKey: ['top-modules', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_module_usage')
        .select('module_key, module_name, module_path, module_icon, visit_count')
        .eq('user_id', user.id)
        .order('visit_count', { ascending: false })
        .order('last_visited_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching top modules:', error);
        return [];
      }

      return data as TopModule[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
