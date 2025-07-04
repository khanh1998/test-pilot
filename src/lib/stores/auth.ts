import { writable } from 'svelte/store';

export interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
}

function createAuthStore() {
  // Initialize with stored token if available
  const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
  const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('authUser') : null;
  
  const initialState: AuthState = {
    isAuthenticated: !!storedToken,
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    loading: false
  };

  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    
    // Sign in user and store token
    signIn: async (email: string, password: string) => {
      update(state => ({ ...state, loading: true }));
      
      try {
        const response = await fetch('/api/auth/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Sign in failed');
        }
        
        const data = await response.json();
        // Use our custom JWT token instead of Supabase session token
        const token = data.token;
        const user = data.user;
        
        // Store token in localStorage for persistence
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify(user));
        
        // Update store
        set({
          isAuthenticated: true,
          user,
          token,
          loading: false
        });
        
        return { success: true };
      } catch (error: any) {
        update(state => ({ ...state, loading: false }));
        return { success: false, error: error.message || 'Authentication failed' };
      }
    },
    
    // Sign up user
    signUp: async (name: string, email: string, password: string) => {
      update(state => ({ ...state, loading: true }));
      
      try {
        const response = await fetch('/api/auth/sign-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Sign up failed');
        }
        
        const data = await response.json();
        
        // After successful signup, automatically sign in the user
        if (data.token) {
          const token = data.token;
          const user = data.user;
          
          // Store token in localStorage for persistence
          localStorage.setItem('authToken', token);
          localStorage.setItem('authUser', JSON.stringify(user));
          
          // Update store
          set({
            isAuthenticated: true,
            user,
            token,
            loading: false
          });
        } else {
          update(state => ({ ...state, loading: false }));
        }
        
        return { success: true };
      } catch (error: any) {
        update(state => ({ ...state, loading: false }));
        return { success: false, error: error.message || 'Registration failed' };
      }
    },
    
    // Sign out user
    signOut: async () => {
      // Clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      
      // Reset store
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });
    },
    
    // Check authentication status
    checkAuth: async () => {
      const token = localStorage.getItem('authToken');
      const user = localStorage.getItem('authUser');
      
      if (!token) {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false
        });
        return false;
      }
      
      set({
        isAuthenticated: true,
        user: user ? JSON.parse(user) : null,
        token,
        loading: false
      });
      
      return true;
    },
    
    // Get auth headers for API requests
    getAuthHeaders: () => {
      const token = localStorage.getItem('authToken');
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    }
  };
}

export const authStore = createAuthStore();
