import { fetchWithAuth } from './util';

export async function getApiList() {
  try {
    const response = await fetchWithAuth('/api/apis');
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.error('Failed to fetch API list:', response.statusText);
      return [];
    }
  } catch (error) {
    console.error('Error fetching API list:', error);
    return [];
  }
}

export async function uploadSwaggerFile(file: File, name: string, description?: string, host?: string) {
  try {
    const formData = new FormData();
    formData.append('swaggerFile', file);
    formData.append('name', name);
    if (description) {
      formData.append('description', description);
    }
    if (host) {
      formData.append('host', host);
    }

    const response = await fetchWithAuth('/api/swagger/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload Swagger file');
    }
  } catch (error) {
    console.error('Error uploading Swagger file:', error);
    throw error;
  }
}

export async function updateSwaggerFile(id: string, file: File) {
  try {
    const formData = new FormData();
    formData.append('swaggerFile', file);

    const response = await fetchWithAuth(`/api/swagger/update/${id}`, {
      method: 'PUT',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update Swagger file');
    }
  } catch (error) {
    console.error('Error updating Swagger file:', error);
    throw error;
  }
}

export async function deleteApi(id: string) {
  try {
    const response = await fetchWithAuth(`/api/apis/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete API');
    }
  } catch (error) {
    console.error('Error deleting API:', error);
    throw error;
  }
}

export async function getApiDetails(id: string) {
  try {
    const response = await fetchWithAuth(`/api/apis/${id}`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to fetch API details:', response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error fetching API details:', error);
    return null;
  }
}
