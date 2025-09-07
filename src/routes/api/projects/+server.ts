import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createProjectService } from '$lib/server/service/projects/create_project';
import { listProjectsService } from '$lib/server/service/projects/list_projects';

// Get all projects for the authenticated user
export async function GET({ locals, url }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';

    // Validate parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: 'Invalid pagination parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Use the service to get projects with pagination
    const result = await listProjectsService(locals.user.userId, {
      limit,
      offset,
      search: search.trim() || undefined
    });

    return json({
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit)
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch projects' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Create a new project
export async function POST({ request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, description, variables, api_dependencies, environment_id } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Project name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the service to create the project
    const result = await createProjectService(locals.user.userId, {
      name: name.trim(),
      description,
      variables,
      api_dependencies,
      environment_id
    });

    return json(result);
  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle specific service errors
    if (error instanceof Error && error.message.includes('APIs not found')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to create project' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
