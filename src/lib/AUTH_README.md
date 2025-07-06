# Authentication Flow for Test-Pilot

This document describes the authentication flow implemented in the Test-Pilot application.

## Overview

The application uses a token-based authentication system with the following components:

1. **Frontend Authentication Store**: Manages authentication state, token storage, and authenticated API requests
2. **Backend Authentication**: Validates tokens and provides user information to API endpoints
3. **Token Storage**: Uses localStorage for token persistence on the client side
4. **API Authentication**: All API requests include the token in the Authorization header

## Authentication Flow

### Sign In
1. User enters credentials on the login page
2. Frontend sends credentials to `/api/auth/sign-in` endpoint
3. Backend validates credentials with Supabase Auth
4. Backend returns user info and auth token to frontend
5. Frontend stores token in localStorage and updates auth state
6. User is redirected to the dashboard

### API Requests
1. All API requests include the token in the Authorization header
2. Backend validates the token by calling Supabase Auth
3. If valid, the request is processed and data is returned
4. If invalid, a 401 error is returned and the user is logged out

### Sign Out
1. User clicks sign out button
2. Frontend removes token from localStorage and updates auth state
3. User is redirected to the login page

## Implementation Details

### Frontend
- `src/lib/stores/auth.ts`: Authentication store with sign in/out methods
- `src/lib/api.ts`: Utility for making authenticated API requests
- `src/routes/+layout.ts`: Handles authentication redirects
- `src/routes/+page.svelte`: Login/signup form using auth store
- `src/routes/dashboard/+page.svelte`: Dashboard that uses authenticated API requests

### Backend
- `src/lib/server/auth.ts`: Authentication middleware for API endpoints
- `src/routes/api/auth/sign-in/+server.ts`: Sign in endpoint
- `src/routes/api/auth/sign-up/+server.ts`: Sign up endpoint
