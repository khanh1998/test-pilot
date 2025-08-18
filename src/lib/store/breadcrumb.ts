import { writable } from 'svelte/store';

export interface BreadcrumbOverride {
  segment: string;
  name: string;
}

export const breadcrumbOverrides = writable<BreadcrumbOverride[]>([]);

export function setBreadcrumbOverride(segment: string, name: string) {
  breadcrumbOverrides.update(overrides => {
    const filtered = overrides.filter(o => o.segment !== segment);
    return [...filtered, { segment, name }];
  });
}

export function clearBreadcrumbOverride(segment: string) {
  breadcrumbOverrides.update(overrides => 
    overrides.filter(o => o.segment !== segment)
  );
}

export function clearAllBreadcrumbOverrides() {
  breadcrumbOverrides.set([]);
}
