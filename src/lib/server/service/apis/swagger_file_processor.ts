interface SwaggerFileProcessingParams {
  file: File;
  userProvidedHost?: string;
}

interface SwaggerFileProcessingResult {
  content: string;
  format: 'yaml' | 'json';
  hostValue: string | null;
}

export async function processSwaggerFile(params: SwaggerFileProcessingParams): Promise<SwaggerFileProcessingResult> {
  const { file, userProvidedHost } = params;

  // Determine the format based on file extension or content type
  const fileName = file.name.toLowerCase();
  const isYaml = fileName.endsWith('.yaml') || fileName.endsWith('.yml');
  const format = isYaml ? 'yaml' : 'json';

  // Read the file content
  const content = await file.text();

  return {
    content,
    format,
    hostValue: userProvidedHost || null
  };
}
