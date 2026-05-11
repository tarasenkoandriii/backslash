export type NodeId = string;

export interface Vulnerability {
  file?: string;
  severity?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphNode {
  id: NodeId;
  label: string;
  kind?: string;
  language?: string;
  path?: string;
  publicExposed?: boolean;
  vulnerabilities?: Vulnerability[];
  raw: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: NodeId;
  target: NodeId;
  label?: string;
  raw: Record<string, unknown>;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Route {
  nodeIds: NodeId[];
  edgeIds: string[];
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  routes: Route[];
  meta: {
    availableFilters: string[];
    appliedFilters: string[];
    nodeCount: number;
    edgeCount: number;
    routeCount: number;
  };
}

export interface RouteFilter {
  name: string;
  description: string;
  predicate: (route: Route, graph: GraphIndex) => boolean;
}

export interface GraphIndex {
  graph: Graph;
  nodeById: Map<NodeId, GraphNode>;
  edgeById: Map<string, GraphEdge>;
  outgoing: Map<NodeId, GraphEdge[]>;
  incoming: Map<NodeId, GraphEdge[]>;
}
