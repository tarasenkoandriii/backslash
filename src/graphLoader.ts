import fs from 'node:fs';
import path from 'node:path';
import { Graph, GraphEdge, GraphIndex, GraphNode, NodeId, Vulnerability } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function pickArray(root: unknown, keys: string[]): unknown[] | undefined {
  if (!isRecord(root)) return undefined;
  for (const key of keys) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  return undefined;
}

function normalizeVulnerabilities(input: Record<string, unknown>): Vulnerability[] | undefined {
  const candidates = [input.vulnerabilities, input.vulnerability, input.vulns];
  const firstArray = candidates.find(Array.isArray);
  return Array.isArray(firstArray) ? (firstArray as Vulnerability[]) : undefined;
}

function normalizeNode(input: unknown, index: number): GraphNode {
  if (!isRecord(input)) {
    const id = String(input ?? index);
    return { id, label: id, raw: { value: input } };
  }

  const id = firstString(input, ['id', 'key', 'name', 'serviceName', 'service', 'nodeId']) ?? `node-${index}`;
  const label = firstString(input, ['label', 'name', 'serviceName', 'service', 'title']) ?? id;
  const kind = firstString(input, ['kind', 'type', 'category']);
  const language = firstString(input, ['language']);
  const nodePath = firstString(input, ['path']);
  const publicExposed = asBoolean(input.publicExposed) ?? asBoolean(input.public) ?? asBoolean(input.isPublic);
  const vulnerabilities = normalizeVulnerabilities(input);

  return { id, label, kind, language, path: nodePath, publicExposed, vulnerabilities, raw: input };
}

function normalizeTargets(value: unknown): NodeId[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter((target): target is string => Boolean(target));
  }
  const single = asString(value);
  return single ? [single] : [];
}

function normalizeEdges(input: unknown, index: number): GraphEdge[] {
  if (!isRecord(input)) return [];

  const source = firstString(input, ['source', 'from', 'src', 'start', 'caller', 'sourceId']);
  if (!source) return [];

  const targetValue = input.target ?? input.to ?? input.dst ?? input.end ?? input.callee ?? input.targetId;
  const targets = normalizeTargets(targetValue);

  return targets.map((target, targetIndex) => {
    const baseId = firstString(input, ['id', 'key', 'edgeId']) ?? `${source}->${target}`;
    const id = targets.length === 1 ? `${baseId}#${index}` : `${baseId}#${index}.${targetIndex}`;
    const label = firstString(input, ['label', 'name', 'protocol', 'relation', 'type']);
    return { id, source, target, label, raw: input };
  });
}

export function normalizeGraph(json: unknown): Graph {
  const nodeInputs = pickArray(json, ['nodes', 'vertices', 'services']) ?? [];
  const edgeInputs = pickArray(json, ['edges', 'links', 'relations', 'dependencies', 'routes']) ?? [];

  if (!nodeInputs.length || !edgeInputs.length) {
    throw new Error('Unsupported graph JSON. Expected arrays named nodes/services and edges/links/relations/dependencies.');
  }

  const nodes = nodeInputs.map(normalizeNode);
  const edges = edgeInputs.flatMap(normalizeEdges);
  const knownNodeIds = new Set(nodes.map((node) => node.id));
  const syntheticNodes: GraphNode[] = [];

  for (const edge of edges) {
    if (!knownNodeIds.has(edge.source)) {
      knownNodeIds.add(edge.source);
      syntheticNodes.push({ id: edge.source, label: edge.source, raw: { generated: true } });
    }
    if (!knownNodeIds.has(edge.target)) {
      knownNodeIds.add(edge.target);
      syntheticNodes.push({ id: edge.target, label: edge.target, raw: { generated: true } });
    }
  }

  return { nodes: [...nodes, ...syntheticNodes], edges };
}

export function loadGraphFromFile(filePath: string): Graph {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return normalizeGraph(JSON.parse(raw));
}

export function buildIndex(graph: Graph): GraphIndex {
  const nodeById = new Map<NodeId, GraphNode>();
  const edgeById = new Map<string, GraphEdge>();
  const outgoing = new Map<NodeId, GraphEdge[]>();
  const incoming = new Map<NodeId, GraphEdge[]>();

  for (const node of graph.nodes) nodeById.set(node.id, node);

  for (const edge of graph.edges) {
    edgeById.set(edge.id, edge);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  return { graph, nodeById, edgeById, outgoing, incoming };
}
