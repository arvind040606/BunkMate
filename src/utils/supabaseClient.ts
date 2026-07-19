import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Reusable Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export interface SupabaseProfile {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_id?: string | null;
  college?: string | null;
  course?: string | null;
  semester?: string | null;
  section?: string | null;
  group_name?: string | null;
  created_at?: string;
}

/**
 * Health check to verify that Supabase connection variables are loaded and the backend is reachable.
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
 * Register a new user with Email + Password, and automatically create their profile record in the profiles table.
 */
export async function signUpUser(
  email: string,
  password: string,
  username: string,
  additionalProfileData: Partial<Omit<SupabaseProfile, 'id' | 'username' | 'created_at'>> = {}
): Promise<{ success: boolean; user: User | null; error?: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    
    // 1. Sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: cleanUsername,
        }
      }
    });

    if (authError) {
      return { success: false, user: null, error: authError.message };
    }

    const user = authData.user;
    if (!user) {
      return { success: false, user: null, error: 'Sign up succeeded, but no user object was returned.' };
    }

    // 2. Automatically create a profile row in the profiles table
    const profilePayload: SupabaseProfile = {
      id: user.id,
      username: cleanUsername,
      display_name: additionalProfileData.display_name || cleanUsername,
      avatar_id: additionalProfileData.avatar_id || null,
      college: additionalProfileData.college || null,
      course: additionalProfileData.course || null,
      semester: additionalProfileData.semester || null,
      section: additionalProfileData.section || null,
      group_name: additionalProfileData.group_name || null,
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload);

    if (profileError) {
      console.warn('[Supabase Profile Creation Warning] Auth succeeded, but profile creation failed:', profileError.message);
      // We still return success: true because auth succeeded, but note the profile issue
      return { success: true, user, error: `Auth succeeded, but profile failed: ${profileError.message}` };
    }

    return { success: true, user };
  } catch (err: any) {
    return { success: false, user: null, error: err.message || 'An unexpected registration error occurred.' };
  }
}

/**
 * Log in an existing user using Email + Password.
 */
export async function logInUser(email: string, password: string): Promise<{ success: boolean; user: User | null; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, user: null, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, user: null, error: err.message || 'An unexpected login error occurred.' };
  }
}

/**
 * Log out the currently authenticated user.
 */
export async function logOutUser(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected logout error occurred.' };
  }
}

/**
 * Send a password reset email.
 */
export async function resetUserPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected password reset error occurred.' };
  }
}

/**
 * Retrieve a profile by user ID.
 */
export async function getUserProfile(userId: string): Promise<{ success: boolean; profile: SupabaseProfile | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return { success: false, profile: null, error: error.message };
    }

    return { success: true, profile: data as SupabaseProfile };
  } catch (err: any) {
    return { success: false, profile: null, error: err.message || 'Failed to retrieve profile.' };
  }
}

/**
 * Update the current user's profile information.
 */
export async function updateUserProfile(
  userId: string,
  profileData: Partial<Omit<SupabaseProfile, 'id' | 'created_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update profile.' };
  }
}
