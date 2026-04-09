import { promises as fs } from 'node:fs';
import path from 'node:path';
import { normalizeEntityType, normalizeRelationType } from './kg-type-normalize';
import type { EntityType, RelationType } from './types';

type TypeKind = 'entity' | 'relation';

export interface TypeRegistryItem<TCanonical extends string> {
  label: string;
  canonical: TCanonical;
  description?: string;
  count: number;
  lastSeenAt: string;
}

export interface TypeRegistryFile {
  version: number;
  updatedAt: string;
  entityTypes: Array<TypeRegistryItem<EntityType>>;
  relationTypes: Array<TypeRegistryItem<RelationType>>;
}

const REGISTRY_PATH = path.join(process.cwd(), 'config', 'knowledge-graph', 'type-registry.json');

const EMPTY_REGISTRY: TypeRegistryFile = {
  version: 1,
  updatedAt: '',
  entityTypes: [],
  relationTypes: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeLabel(label: string): string {
  return (label || '').trim();
}

export async function loadTypeRegistry(): Promise<TypeRegistryFile> {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TypeRegistryFile>;
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      entityTypes: Array.isArray(parsed.entityTypes) ? parsed.entityTypes : [],
      relationTypes: Array.isArray(parsed.relationTypes) ? parsed.relationTypes : [],
    };
  } catch {
    return { ...EMPTY_REGISTRY };
  }
}

export async function saveTypeRegistry(registry: TypeRegistryFile): Promise<void> {
  const payload: TypeRegistryFile = {
    ...registry,
    updatedAt: nowIso(),
  };
  await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function canonicalFromLabel(kind: TypeKind, label: string): EntityType | RelationType {
  return kind === 'entity' ? normalizeEntityType(label) : normalizeRelationType(label);
}

function upsertTypeItem(
  items: Array<TypeRegistryItem<any>>,
  input: { label: string; description?: string; canonical: string }
): void {
  const label = normalizeLabel(input.label);
  if (!label) return;
  const existing = items.find((i) => i.label === label);
  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = nowIso();
    if (!existing.description && input.description) existing.description = input.description;
    if (input.canonical) existing.canonical = input.canonical;
    return;
  }
  items.push({
    label,
    canonical: input.canonical,
    description: input.description,
    count: 1,
    lastSeenAt: nowIso(),
  });
}

export async function updateTypeRegistry(params: {
  entityLabels?: Array<{ label: string; description?: string }>;
  relationLabels?: Array<{ label: string; description?: string }>;
}): Promise<TypeRegistryFile> {
  const registry = await loadTypeRegistry();
  for (const e of params.entityLabels ?? []) {
    const label = normalizeLabel(e.label);
    if (!label) continue;
    upsertTypeItem(registry.entityTypes, {
      label,
      description: e.description,
      canonical: canonicalFromLabel('entity', label) as EntityType,
    });
  }
  for (const r of params.relationLabels ?? []) {
    const label = normalizeLabel(r.label);
    if (!label) continue;
    upsertTypeItem(registry.relationTypes, {
      label,
      description: r.description,
      canonical: canonicalFromLabel('relation', label) as RelationType,
    });
  }
  await saveTypeRegistry(registry);
  return registry;
}

export function findCanonicalFromRegistry(
  registry: TypeRegistryFile | null | undefined,
  kind: TypeKind,
  rawLabel: string
): EntityType | RelationType {
  const label = normalizeLabel(rawLabel);
  if (registry && label) {
    const items = kind === 'entity' ? registry.entityTypes : registry.relationTypes;
    const hit = items.find((i) => i.label === label);
    if (hit?.canonical) return hit.canonical;
  }
  return canonicalFromLabel(kind, label);
}
