<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import type { User } from '@supabase/supabase-js';
  
  let loading = false;
  let email = '';
  let password = '';
  let user: User | null = null;
  
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
    } catch (err: any) {
      alert(err?.message || 'An error occurred during sign in');
    } finally {
      loading = false;
    }
  }
  
  async function handleSignUp() {
    try {
      loading = true;
      const { error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      alert('Check your email for the confirmation link!');
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
    <form class="auth-form" on:submit|preventDefault={handleSignIn}>
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
        <button type="submit" disabled={loading}>Sign In</button>
        <button type="button" on:click={handleSignUp} disabled={loading}>Sign Up</button>
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
</style>
