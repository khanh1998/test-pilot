# API Components

This directory contains components for displaying and interacting with API specifications.

## Components

### `ApiEndpoints.svelte`
Main component for displaying a list of API endpoints with filtering and search functionality.

**Props:**
- `apiId: number` - The ID of the API to display endpoints for

**Features:**
- Lists all endpoints grouped by path
- Filter by tags
- Search by path, summary, description, or operation ID  
- Click on any endpoint to view detailed information
- Click on tags to filter by that tag

### `EndpointDetails.svelte`
A sliding panel component that displays detailed information about a specific API endpoint.

**Props:**
- `isOpen: boolean` - Controls the visibility of the panel
- `endpoint: ApiEndpoint | null` - The endpoint to display details for

**Events:**
- `close` - Fired when the user closes the panel

**Features:**
- Displays endpoint overview (method, path, summary, description, tags)
- Shows detailed parameter information organized by type (path, query, header, cookie)
- Displays request schema in formatted JSON with sample payload generation
- Shows response schema in formatted JSON with sample payload generation
- Copy-to-clipboard functionality for JSON schemas and sample payloads
- Toggle between schema view and sample payload view for request/response tabs
- Responsive design that adapts to different screen sizes

**Tabs:**
- **Overview**: Basic endpoint information, summary, and description
- **Parameters**: Detailed parameter table with type information and requirements
- **Request**: JSON schema and sample payload for request body (if available) with toggle between schema/sample view
- **Response**: JSON schema and sample payload for response body (if available) with toggle between schema/sample view

## Usage Example

```svelte
<script>
  import ApiEndpoints from '$lib/components/apis/ApiEndpoints.svelte';
  
  export let apiId = 1;
</script>

<ApiEndpoints {apiId} />
```

The `EndpointDetails` component is automatically included and managed by `ApiEndpoints`, so you don't need to import it separately unless you want to use it standalone.
