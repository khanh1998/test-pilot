export function formatEnvironmentValueForInput(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function formatEnvironmentDefaultPlaceholder(value: unknown): string {
  const formattedValue = formatEnvironmentValueForInput(value);
  return formattedValue ? `Default: ${formattedValue}` : 'Use default';
}
