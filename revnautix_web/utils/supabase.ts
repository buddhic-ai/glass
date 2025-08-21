import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhlafyngkembyjogviaz.supabase.co' as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Ht-D79GX4PFUHP515wXY1A_28jt348_' as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


