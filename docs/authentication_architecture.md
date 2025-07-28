# Authentication Architecture

This document describes the refactored authentication system that follows a clean architecture pattern with separation of concerns.

## Architecture Overview

The authentication system is organized into three main layers:

### 1. Controllers (`src/routes/api/auth/`)
- **Responsibility**: Handle HTTP requests, validate input, and return responses
- **Files**: 
  - `sign-in/+server.ts` - Sign-in endpoint
  - `sign-up/+server.ts` - Sign-up endpoint

### 2. Services (`src/lib/server/service/`)
- **Responsibility**: Business logic, orchestrate multiple repositories
- **Files**:
  - `auth/authentication.ts` - Authentication business logic including token verification
  - `users/user_service.ts` - User-related business operations
  - `users/index.ts` - Aggregates and re-exports user services

### 3. Repositories (`src/lib/server/repository/`)
- **Responsibility**: Data access layer, interact with databases and external services
- **Files**:
  - `db/user.ts` - User database operations
  - `supabase/auth.ts` - Supabase authentication operations including token verification
  - `index.ts` - Aggregates and re-exports repositories

### 4. Middleware (`src/lib/server/auth/`)
- **Responsibility**: Request-level authentication and JWT utilities
- **Files**:
  - `auth.ts` - JWT utilities and `authenticateRequest` middleware

## Key Benefits

### 1. Separation of Concerns
- Controllers handle HTTP-specific logic
- Services contain business logic
- Repositories handle data access

### 2. Reusability
- Repository functions can be reused across different services
- Service functions can be reused across different controllers
- Clear interfaces make testing easier

### 3. Maintainability
- Changes to data storage don't affect business logic
- Changes to business logic don't affect HTTP handling
- Easy to add new authentication methods or databases

## Usage Examples

### In Controllers
```typescript
import { signUpUser, signInUser } from '$lib/server/service/auth/authentication';

// Use service functions directly
const result = await signUpUser({ name, email, password });
```

### In Services
```typescript
import { findUserByEmail, createUser } from '$lib/server/repository/db/user';
import { createSupabaseUser } from '$lib/server/repository/supabase/auth';

// Orchestrate multiple repository calls
const existingUser = await findUserByEmail(email);
const authData = await createSupabaseUser({ email, password });
const newUser = await createUser({ name, email, supabaseAuthId: authData.user.id });
```

### In Repositories
```typescript
// Direct database operations
export async function findUserByEmail(email: string): Promise<UserData | null> {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : null;
}
```

## Available Functions

### Authentication Service
- `signUpUser(signUpData: SignUpData): Promise<AuthResponse>`
- `signInUser(signInData: SignInData): Promise<AuthResponse>`
- `verifyAuthToken(token: string): Promise<{ user: UserData; payload: JWTPayload }>`
- `verifySupabaseAuthToken(token: string): Promise<{ user: UserData; supabaseUser: any }>`

### User Service
- `getUserByEmail(email: string): Promise<UserPublicData | null>`
- `getUserById(id: number): Promise<UserPublicData | null>`
- `getUserBySupabaseAuthId(supabaseAuthId: string): Promise<UserPublicData | null>`
- `createNewUser(userData: CreateUserData): Promise<UserPublicData>`
- `userExistsByEmail(email: string): Promise<boolean>`

### User Repository
- `findUserByEmail(email: string): Promise<UserData | null>`
- `findUserById(id: number): Promise<UserData | null>`
- `findUserBySupabaseAuthId(supabaseAuthId: string): Promise<UserData | null>`
- `createUser(userData: CreateUserData): Promise<UserData>`
- `updateUserSupabaseAuthId(userId: number, supabaseAuthId: string): Promise<UserData>`

### Supabase Auth Repository
- `createSupabaseUser(userData: CreateSupabaseUserData): Promise<SupabaseAuthData>`
- `signInSupabaseUser(credentials: SignInData): Promise<SupabaseAuthData>`
- `verifySupabaseToken(token: string): Promise<SupabaseAuthData>`

### JWT Utilities (Middleware)
- `generateToken(userData: UserPublicData): string`
- `verifyToken(token: string): JWTPayload | null`
- `authenticateRequest(event: RequestEvent): Promise<{ user: UserData; token?: string; supabaseUser?: any }>`

## Error Handling

The architecture provides consistent error handling:

1. **Repository Layer**: Throws specific errors for data access issues
2. **Service Layer**: Catches repository errors and throws business logic errors
3. **Controller Layer**: Catches service errors and converts to appropriate HTTP responses

## Future Enhancements

This architecture makes it easy to add:
- Password reset functionality
- Email verification
- Social authentication (Google, GitHub, etc.)
- Role-based access control
- User profile management
- Additional database operations
