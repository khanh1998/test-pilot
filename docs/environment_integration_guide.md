# Environment Integration Guide

The environment management system is now fully integrated with test flow execution. This guide demonstrates how to use environments in your test flows.

## Overview

The environment integration provides:

1. **Environment Selection**: Choose an environment and sub-environment for test execution
2. **Variable Resolution**: Use `{{env:variableName}}` expressions in test parameters
3. **API Host Overrides**: Environment-specific API hosts override flow-level hosts
4. **Template Context**: Environment variables are available in all template expressions

## Features Implemented

### ✅ Environment Selector in Test Flow Editor

- Added environment dropdown to test flow execution controls
- Loads all available environments from user's workspace
- Allows selection of environment and sub-environment (dev, staging, prod, etc.)
- Persists selection in flow settings for reuse

### ✅ Enhanced Template Engine

- Extended template context to include environment variables
- Support for `{{env:variableName}}` expressions
- Fallback to default values when variables are undefined
- Integration with existing `{{param:}}`, `{{res:}}`, and `{{proc:}}` expressions

### ✅ API Host Override System

- Environment API hosts take precedence over flow-level API hosts
- Automatic fallback to flow hosts when environment doesn't specify
- Debug logging shows which host source is being used
- Support for per-API, per-environment host configuration

### ✅ Variable Resolution

- Environment variables are computed from:
  - Variable values in selected sub-environment
  - Default values from variable definitions
  - API host mappings (available as `api_host_{apiId}`)

## Usage Examples

### Example 1: Using Environment Variables in Parameters

```javascript
// In test flow parameter:
{
  "apiKey": "{{env:API_KEY}}",
  "baseUrl": "{{env:api_host_1}}",
  "timeout": "{{env:REQUEST_TIMEOUT}}"
}
```

### Example 2: Environment-Specific API Hosts

```json
// Environment Configuration:
{
  "environments": {
    "dev": {
      "name": "Development",
      "variables": {
        "API_KEY": "dev-key-123",
        "REQUEST_TIMEOUT": 5000
      },
      "api_hosts": {
        "1": "https://api-dev.example.com",
        "2": "https://auth-dev.example.com"
      }
    },
    "prod": {
      "name": "Production", 
      "variables": {
        "API_KEY": "prod-key-456",
        "REQUEST_TIMEOUT": 30000
      },
      "api_hosts": {
        "1": "https://api.example.com",
        "2": "https://auth.example.com"
      }
    }
  }
}
```

### Example 3: Mixed Template Expressions

```javascript
// Complex parameter using multiple sources:
{
  "url": "{{env:api_host_1}}/users/{{param:userId}}",
  "headers": {
    "Authorization": "Bearer {{env:API_KEY}}",
    "X-Request-ID": "{{res:login-0.headers.x-request-id}}"
  },
  "timeout": "{{env:REQUEST_TIMEOUT}}"
}
```

## Implementation Details

### TestFlowEditor Changes

- Added `EnvironmentSelector` component to execution controls
- Environment selection persisted in `flowData.settings.environment`
- Loads environments on component mount
- Passes environment context to `FlowRunner`

### FlowRunner Enhancements

- Accepts `environments` and `selectedEnvironment` props
- Computes environment variables from selected environment/sub-environment
- Enhanced API host resolution with environment override support
- Updated template context creation to include environment data

### Template Engine Updates

- Extended `TemplateContext` to include `environment` field
- Updated `createTemplateContextFromFlowRunner` to accept environment data
- Support for `{{env:variableName}}` expressions
- Fallback handling for undefined environment variables

## Testing the Integration

1. **Create an Environment**:
   - Navigate to `/dashboard/environments`
   - Create a new environment with multiple sub-environments
   - Define variables and API hosts

2. **Create a Test Flow**:
   - Navigate to `/dashboard/test-flows`
   - Create a test flow with API endpoints
   - Add parameters using `{{env:}}` expressions

3. **Execute with Environment**:
   - Select environment and sub-environment in execution controls
   - Run the test flow
   - Verify environment variables are resolved correctly
   - Check debug logs for API host resolution

## Next Steps

The environment integration is now complete with these major components:

- ✅ Environment Management UI (EnvironmentCard, EnvironmentSelector, EnvironmentEditor)
- ✅ Test Flow Integration (Environment selection in TestFlowEditor)
- ✅ FlowRunner Enhancement (Environment-aware execution)
- ✅ Template Engine Extension ({{env:}} expressions)
- ✅ API Host Override System

Ready for production use! 🎉
