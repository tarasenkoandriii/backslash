import { GraphIndex, GraphNode, Route, RouteFilter } from './types';

function nodeFor(route: Route, index: GraphIndex, position: number): GraphNode | undefined {
  const nodeId = position < 0 ? route.nodeIds[route.nodeIds.length + position] : route.nodeIds[position];
  return nodeId ? index.nodeById.get(nodeId) : undefined;
}

function routeNodes(route: Route, index: GraphIndex): GraphNode[] {
  return route.nodeIds.map((nodeId) => index.nodeById.get(nodeId)).filter((node): node is GraphNode => Boolean(node));
}

const filters: RouteFilter[] = [
  {
    name: 'public-start',
    description: 'Routes whose first node has publicExposed=true.',
    predicate: (route, index) => nodeFor(route, index, 0)?.publicExposed === true,
  },
  {
    name: 'sink-end',
    description: 'Routes whose last node is a data sink. Current default treats rds/sql/database nodes as sinks.',
    predicate: (route, index) => {
      const endNode = nodeFor(route, index, -1);
      if (!endNode) return false;
      const kind = (endNode.kind ?? '').toLowerCase();
      const name = endNode.id.toLowerCase();
      return ['rds', 'sql', 'database', 'db'].includes(kind) || name.includes('postgres') || name.includes('mysql');
    },
  },
  {
    name: 'has-vulnerability',
    description: 'Routes containing at least one node with a non-empty vulnerabilities array.',
    predicate: (route, index) => routeNodes(route, index).some((node) => (node.vulnerabilities?.length ?? 0) > 0),
  },
];

export class FilterRegistry {
  private readonly registry = new Map<string, RouteFilter>();

  constructor(initialFilters: RouteFilter[] = []) {
    initialFilters.forEach((filter) => this.register(filter));
  }

  register(filter: RouteFilter): void {
    if (this.registry.has(filter.name)) throw new Error(`Filter already exists: ${filter.name}`);
    this.registry.set(filter.name, filter);
  }

  list(): RouteFilter[] {
    return [...this.registry.values()];
  }

  getMany(names: string[]): RouteFilter[] {
    return names.map((name) => {
      const filter = this.registry.get(name);
      if (!filter) throw new Error(`Unknown filter: ${name}`);
      return filter;
    });
  }

  apply(routes: Route[], index: GraphIndex, filterNames: string[]): Route[] {
    const selected = this.getMany(filterNames);
    return routes.filter((route) => selected.every((filter) => filter.predicate(route, index)));
  }
}

export const filterRegistry = new FilterRegistry(filters);
