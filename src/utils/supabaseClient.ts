import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Reusable Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SupabaseUser {
  id: string;
  username: string;
  avatar_id?: string | null;
  display_name?: string | null;
  college?: string | null;
  course?: string | null;
  semester?: string | null;
  section?: string | null;
  group_name?: string | null;
  createdAt?: number;
  passwordHash?: string;
  salt?: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  securityAnswerSalt?: string;
}

/**
 * Health check to verify that Supabase connection variables are loaded and reachable.
 */
export async function checkSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return { 
        success: false, 
        error: 'Supabase credentials are missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.' 
      };
    }
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Supabase host unreachable.' };
  }
}

/**
 * Create a new user in the Supabase 'users' table.
 */
export async function createUser(user: SupabaseUser): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('users')
      .insert([user]);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create user record.' };
  }
}

/**
 * Check if a username already exists in the Supabase 'users' table.
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', cleanUsername);

    if (error) {
      console.error('[Supabase checkUsernameExists Error]:', error.message);
      return false;
    }
    return data && data.length > 0;
  } catch (err) {
    console.error('[Supabase checkUsernameExists Error]:', err);
    return false;
  }
}

/**
 * Update the avatar ID of a user.
 */
export async function updateAvatar(userId: string, avatarId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ avatar_id: avatarId })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update avatar.' };
  }
}

/**
 * Fetch a user's details by their username.
 */
export async function fetchUserByUsername(username: string): Promise<SupabaseUser | null> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error) {
      console.error('[Supabase fetchUserByUsername Error]:', error.message);
      return null;
    }
    return data as SupabaseUser;
  } catch (err) {
    console.error('[Supabase fetchUserByUsername Error]:', err);
    return null;
  }
}
