<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import type { User } from '@supabase/supabase-js';
  
  let loading = false;
  let email = '';
  let password = '';
  let name = ''; // New field for sign up
  let user: User | null = null;
  let isSignUp = false; // Toggle between sign in and sign up forms
  
  // Check for existing session on mount
  // Initialize auth on component mount
  onMount(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        user = data.session.user;
      }
    });
    
    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          user = session.user;
        } else if (event === 'SIGNED_OUT') {
          user = null;
        }
      }
    );
    
    // Return cleanup function
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  });
  
  async function handleSignIn() {
    try {
      loading = true;
      
      // Call our backend sign-in endpoint
      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sign in failed');
      }
      
      // No need to manually update user state as the auth listener will do it
    } catch (err: any) {
      alert(err?.message || 'An error occurred during sign in');
    } finally {
      loading = false;
    }
  }
  
  async function handleSignUp() {
    try {
      loading = true;
      
      // Validate name field for sign up
      if (!name) {
        throw new Error('Name is required for registration');
      }
      
      // Call our backend sign-up endpoint
      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sign up failed');
      }
      
      alert('Registration successful! You can now sign in.');
      isSignUp = false; // Switch to sign in form after successful registration
    } catch (err: any) {
      alert(err?.message || 'An error occurred during sign up');
    } finally {
      loading = false;
    }
  }
  
  async function handleSignOut() {
    try {
      loading = true;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      alert(err?.message || 'An error occurred during sign out');
    } finally {
      loading = false;
    }
  }
  
  // Helper function to toggle between sign in and sign up forms
  function toggleAuthMode() {
    isSignUp = !isSignUp;
  }
</script>

<div class="auth-container">
  <h2>Supabase Auth</h2>
  
  {#if user}
    <div class="profile">
      <h3>You're signed in</h3>
      <p>Email: {user.email}</p>
      <button on:click={handleSignOut} disabled={loading}>Sign Out</button>
    </div>
  {:else}
    <form class="auth-form" on:submit|preventDefault={isSignUp ? handleSignUp : handleSignIn}>
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="Your email"
          required
        />
      </div>
      
      {#if isSignUp}
        <div class="form-group">
          <label for="name">Full Name</label>
          <input
            id="name"
            type="text"
            bind:value={name}
            placeholder="Your full name"
            required
          />
        </div>
      {/if}
      
      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Your password"
          required
        />
      </div>
      
      <div class="buttons">
        <button type="submit" disabled={loading}>
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </div>
      
      <div class="toggle-auth">
        <button type="button" class="link-button" on:click={toggleAuthMode}>
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .auth-container {
    max-width: 400px;
    margin: 0 auto;
  }
  
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  input {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  .buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: #0070f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background-color: #0060df;
  }
  
  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  .profile {
    padding: 1rem;
    background-color: #f4f4f4;
    border-radius: 4px;
  }
  
  .toggle-auth {
    margin-top: 1rem;
    text-align: center;
  }
  
  .link-button {
    background: none;
    border: none;
    color: #0070f3;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
  }
  
  .link-button:hover {
    color: #0060df;
    background: none;
  }
</style>
