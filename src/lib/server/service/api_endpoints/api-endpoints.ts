import { getMultipleEndpoints } from './endpoint_details';

export async function fetchApiEndpoints(endpointIds: number[]) {
  return await getMultipleEndpoints({ endpointIds });
}