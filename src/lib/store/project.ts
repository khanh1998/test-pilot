import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { fetchWithAuth } from '$lib/http_client/util';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  projectJson: any;
  createdAt: string;
  updatedAt: string;
}

interface ProjectListResponse {
  projects: Project[];
  total: number;
}

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

const SELECTED_PROJECT_KEY = 'test-pilot-selected-project-id';

// Helper functions for localStorage persistence
// This allows users to return to their last selected project when reopening the app
function getStoredProjectId(): number | null {
  if (!browser) return null;
  
  try {
    const stored = localStorage.getItem(SELECTED_PROJECT_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch (error) {
    console.warn('Failed to read selected project from localStorage:', error);
    return null;
  }
}

function setStoredProjectId(projectId: number | null): void {
  if (!browser) return;
  
  try {
    if (projectId === null) {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    } else {
      localStorage.setItem(SELECTED_PROJECT_KEY, projectId.toString());
    }
  } catch (error) {
    console.warn('Failed to store selected project in localStorage:', error);
  }
}

const initialState: ProjectState = {
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null
};

function createProjectStore() {
  const { subscribe, set, update } = writable<ProjectState>(initialState);

  return {
    subscribe,
    
    // Load user's projects
    async loadProjects() {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        const response = await fetchWithAuth('/api/projects');
        
        if (!response.ok) {
          throw new Error('Failed to load projects');
        }
        
        const data: ProjectListResponse = await response.json();
        const projects: Project[] = data.projects || [];
        
        // Try to restore previously selected project from localStorage
        const storedProjectId = getStoredProjectId();
        let selectedProject: Project | null = null;
        
        if (storedProjectId) {
          // Find the stored project in the loaded projects
          selectedProject = projects.find(p => p.id === storedProjectId) || null;
        }
        
        // Fallback to first project if no stored selection or stored project not found
        if (!selectedProject && projects.length > 0) {
          selectedProject = projects[0];
        }
        
        // Store the selected project ID (could be from fallback)
        if (selectedProject) {
          setStoredProjectId(selectedProject.id);
        }
        
        update(state => ({
          ...state,
          projects,
          selectedProject,
          isLoading: false
        }));
        
        return data;
      } catch (error: any) {
        update(state => ({
          ...state,
          isLoading: false,
          error: error.message || 'Failed to load projects'
        }));
        throw error;
      }
    },

    // Select a project
    selectProject(project: Project | null) {
      // Store selection in localStorage
      setStoredProjectId(project?.id || null);
      
      update(state => ({
        ...state,
        selectedProject: project
      }));
    },

    // Clear project selection
    clearSelection() {
      setStoredProjectId(null);
      update(state => ({
        ...state,
        selectedProject: null
      }));
    },

    // Get selected project ID (helper)
    getSelectedProjectId(): number | null {
      let selectedId: number | null = null;
      
      // Get current state synchronously
      subscribe(state => {
        selectedId = state.selectedProject?.id || null;
      })();
      
      return selectedId;
    },

    // Restore selected project from localStorage (useful for app initialization)
    restoreSelectedProject() {
      const storedProjectId = getStoredProjectId();
      
      if (storedProjectId) {
        // Find and select the stored project if it exists in current projects
        update(state => {
          const storedProject = state.projects.find(p => p.id === storedProjectId);
          
          if (storedProject && state.selectedProject?.id !== storedProject.id) {
            return {
              ...state,
              selectedProject: storedProject
            };
          }
          
          return state;
        });
      }
    },

    // Clear projects (for logout)
    clear() {
      // Clear localStorage when logging out
      setStoredProjectId(null);
      set(initialState);
    },

    // Create new project via API
    async createProject(projectData: { name: string; description?: string; apiIds?: number[] }) {
      try {
        const response = await fetchWithAuth('/api/projects', {
          method: 'POST',
          body: JSON.stringify(projectData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create project');
        }

        const { project } = await response.json();
        
        // Add to store and auto-select the new project
        update(state => ({
          ...state,
          projects: [...state.projects, project],
          selectedProject: project
        }));

        // Store the new selection
        setStoredProjectId(project.id);

        return project;
      } catch (error: any) {
        update(state => ({
          ...state,
          error: error.message || 'Failed to create project'
        }));
        throw error;
      }
    },

    // Add new project to local store (used when project is created elsewhere)
    addProject(project: Project) {
      update(state => ({
        ...state,
        projects: [...state.projects, project]
      }));
    },

    // Update project via API
    async updateProject(projectId: number, projectData: { name?: string; description?: string }) {
      try {
        const response = await fetchWithAuth(`/api/projects/${projectId}`, {
          method: 'PUT',
          body: JSON.stringify(projectData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update project');
        }

        const { project } = await response.json();
        
        // Update in store
        update(state => ({
          ...state,
          projects: state.projects.map(p => 
            p.id === project.id ? project : p
          ),
          selectedProject: state.selectedProject?.id === project.id 
            ? project 
            : state.selectedProject
        }));

        return project;
      } catch (error: any) {
        update(state => ({
          ...state,
          error: error.message || 'Failed to update project'
        }));
        throw error;
      }
    },

    // Update project in local store (used when project is updated elsewhere)
    updateProjectLocal(updatedProject: Project) {
      update(state => ({
        ...state,
        projects: state.projects.map(p => 
          p.id === updatedProject.id ? updatedProject : p
        ),
        selectedProject: state.selectedProject?.id === updatedProject.id 
          ? updatedProject 
          : state.selectedProject
      }));
    },

    // Delete project via API
    async deleteProject(projectId: number) {
      try {
        const response = await fetchWithAuth(`/api/projects/${projectId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete project');
        }
        
        // Remove from store
        update(state => {
          const projects = state.projects.filter(p => p.id !== projectId);
          const wasSelectedProject = state.selectedProject?.id === projectId;
          const newSelectedProject = wasSelectedProject 
            ? projects[0] || null 
            : state.selectedProject;
          
          // Update localStorage if the selected project changed
          if (wasSelectedProject) {
            setStoredProjectId(newSelectedProject?.id || null);
          }
          
          return {
            ...state,
            projects,
            selectedProject: newSelectedProject
          };
        });

        return true;
      } catch (error: any) {
        update(state => ({
          ...state,
          error: error.message || 'Failed to delete project'
        }));
        throw error;
      }
    },

    // Remove project from local store (used when project is deleted elsewhere)
    removeProjectLocal(projectId: number) {
      update(state => {
        const projects = state.projects.filter(p => p.id !== projectId);
        const wasSelectedProject = state.selectedProject?.id === projectId;
        const newSelectedProject = wasSelectedProject 
          ? projects[0] || null 
          : state.selectedProject;
        
        // Update localStorage if the selected project changed
        if (wasSelectedProject) {
          setStoredProjectId(newSelectedProject?.id || null);
        }
        
        return {
          ...state,
          projects,
          selectedProject: newSelectedProject
        };
      });
    }
  };
}

export const projectStore = createProjectStore();