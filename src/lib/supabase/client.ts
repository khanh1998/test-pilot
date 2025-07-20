import { createClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

// Since you're only using Supabase on the backend, this client setup 
// will only be used in server-side code
export const supabase = createClient<Database>(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);
