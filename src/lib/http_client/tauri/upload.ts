import { isDesktop } from '$lib/environment';

/**
 * Type definitions for Tauri upload functionality
 */
type UploadProgressCallback = (progress: { progress: number; total: number }) => void;

/**
 * Check if we're in desktop mode for Tauri HTTP uploads
 */
export function isTauriUploadAvailable(): boolean {
  return isDesktop;
}

/**
 * Upload a file using Tauri's HTTP client with raw body data
 * This approach sends the file content directly in the HTTP request body
 * and is simpler than using the upload plugin
 */
export async function uploadFileWithTauri(
  url: string,
  file: File,
  progressCallback?: UploadProgressCallback,
  headers?: Record<string, string>
): Promise<string> {
  if (!isDesktop) {
    throw new Error('Tauri upload is only available in desktop mode');
  }

  try {
    // Import Tauri HTTP client
    const tauriHttp = await import('@tauri-apps/plugin-http');
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    // Simulate progress callback if provided (since we're doing a single upload)
    if (progressCallback) {
      progressCallback({ progress: fileData.byteLength, total: fileData.byteLength });
    }
    
    // Prepare headers
    const requestHeaders = {
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileData.byteLength.toString(),
      ...headers
    };
    
    // Make the HTTP request with raw body data
    const response = await tauriHttp.fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: fileData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const responseText = await response.text();
    console.log('[Tauri Upload] Upload successful');
    return responseText;
  } catch (error) {
    console.error('[Tauri Upload] Failed to upload file:', error);
    throw error;
  }
}
