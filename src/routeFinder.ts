import { GraphEdge, GraphIndex, NodeId, Route } from './types';

export interface RouteSearchOptions {
  start?: NodeId;
  end?: NodeId;
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 12;

function routeToEdge(edge: GraphEdge): Route {
  return { nodeIds: [edge.source, edge.target], edgeIds: [edge.id] };
}

export function findRoutes(index: GraphIndex, options: RouteSearchOptions = {}): Route[] {
  const maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const startNodes = options.start ? [options.start] : index.graph.nodes.map((node) => node.id);
  const routes: Route[] = [];

  for (const startNode of startNodes) {
    if (!index.nodeById.has(startNode)) continue;

    const stack: Route[] = (index.outgoing.get(startNode) ?? []).map(routeToEdge);

    while (stack.length) {
      const route = stack.pop();
      if (!route) continue;

      const lastNode = route.nodeIds[route.nodeIds.length - 1];
      const matchesEnd = !options.end || lastNode === options.end;
      if (matchesEnd) routes.push(route);

      if (route.edgeIds.length >= maxDepth) continue;

      for (const nextEdge of index.outgoing.get(lastNode) ?? []) {
        if (route.nodeIds.includes(nextEdge.target)) continue; // avoid cycles in returned paths
        stack.push({
          nodeIds: [...route.nodeIds, nextEdge.target],
          edgeIds: [...route.edgeIds, nextEdge.id],
        });
      }
    }
  }

  return routes;
}

export function graphForRoutes(index: GraphIndex, routes: Route[]) {
  const nodeIds = new Set<NodeId>();
  const edgeIds = new Set<string>();

  for (const route of routes) {
    route.nodeIds.forEach((nodeId) => nodeIds.add(nodeId));
    route.edgeIds.forEach((edgeId) => edgeIds.add(edgeId));
  }

  return {
    nodes: [...nodeIds].map((nodeId) => index.nodeById.get(nodeId)).filter(Boolean),
    edges: [...edgeIds].map((edgeId) => index.edgeById.get(edgeId)).filter(Boolean),
  };
}
