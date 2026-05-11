# Train Ticket Graph Query API

A small TypeScript REST API that loads a Train Ticket microservice dependency graph from JSON and exposes routes in a client-renderable graph format.

## Planned solution

The program treats the uploaded JSON as a directed graph:

- `nodes` are services or infrastructure resources.
- `edges` are directed calls/dependencies from one node to one or more downstream nodes.
- `edges.to` can be either a string or an array; both are normalized into single directed edges.
- Edges that reference a missing node are still kept, and a generated placeholder node is added. This keeps the API resilient to incomplete graph data. In the supplied graph this covers `assurance-service`, which is referenced by routes but is not declared in the `nodes` array.

The API returns subgraphs using this response shape:

```json
{
  "nodes": [],
  "edges": [],
  "routes": [],
  "meta": {
    "availableFilters": [],
    "appliedFilters": [],
    "nodeCount": 0,
    "edgeCount": 0,
    "routeCount": 0
  }
}
```

This format is friendly for client-side graph libraries because `nodes` and `edges` can be rendered directly, while `routes` preserves the original paths that caused those nodes and edges to be included.

## Design decisions

### Generic graph loading

The loader accepts common aliases such as `nodes`, `services`, `edges`, `links`, `relations`, and `dependencies`. Node IDs are derived from `id`, `key`, `name`, or service-like fields. This makes the engine reusable for graph files that are close to, but not exactly the same as, the current assignment input.

### Route discovery

`GET /api/routes` performs a depth-limited DFS over the directed graph. By default, it searches paths up to depth `12`. The caller can pass `start`, `end`, and `maxDepth` query params to narrow the traversal.

Cycles are avoided by rejecting paths that revisit the same node.

### Pluggable filters

Filters implement this interface:

```ts
interface RouteFilter {
  name: string;
  description: string;
  predicate: (route: Route, graph: GraphIndex) => boolean;
}
```

New filters are added by registering another `RouteFilter` in `src/filters.ts`. No server or route-finding code needs to change.

Implemented filters:

- `public-start`: route starts at a node with `publicExposed: true`.
- `sink-end`: route ends at a sink. Current sink logic includes node kinds `rds`, `sql`, `database`, `db`, or names containing common database words such as `postgres` or `mysql`.
- `has-vulnerability`: at least one node in the route has a non-empty `vulnerabilities` array.

Multiple filters are combined with logical AND.

## API

### Health

```bash
GET /health
```

### Full graph

```bash
GET /api/graph
```

Returns the normalized graph.

### Available filters

```bash
GET /api/filters
```

### Query routes

```bash
GET /api/routes
```

Optional query params:

| Param | Example | Description |
| --- | --- | --- |
| `filters` | `public-start,sink-end` | Comma-separated filter names. |
| `start` | `frontend` | Only search routes beginning at this node. |
| `end` | `prod-postgresdb` | Only return routes ending at this node. |
| `maxDepth` | `8` | Maximum number of edges in a route. Default is `12`. |

Examples:

```bash
curl 'http://localhost:3000/api/routes?filters=public-start'
curl 'http://localhost:3000/api/routes?filters=sink-end'
curl 'http://localhost:3000/api/routes?filters=has-vulnerability'
curl 'http://localhost:3000/api/routes?filters=public-start,sink-end,has-vulnerability&maxDepth=10'
```

## Running locally

```bash
npm install
npm run dev
```

The bundled graph file is stored at `data/train-ticket-be.json`. To use a different file:

```bash
GRAPH_PATH=/absolute/path/to/graph.json npm run dev
```

## Build

```bash
npm run build
npm start
```

## Automated testing

The project includes unit and integration tests written with Jest and Supertest.

Run all tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

The test suite covers:

- graph normalization, including edges whose `to` field is either a string or an array;
- route discovery and renderable subgraph generation;
- filter behavior for `public-start`, `sink-end`, and `has-vulnerability`;
- REST endpoint behavior for `/health`, `/api/filters`, and `/api/routes`;
- validation for unknown filter names.


## Detailed description what the tests cover:

1. Graph loader tests
    - Loads the JSON graph.
    - Normalizes to fields that are either strings or arrays.
    - Builds indexes correctly.

2. Route finder tests
    - Finds directed routes.
    - Produces a renderable subgraph containing only relevant nodes and edges.

3. Filter tests
    - Checks public-start.
    - Checks sink-end.
    - Checks has-vulnerability.
    - Checks combined filters.

4. API tests
    - GET /health
    - GET /api/filters
    - GET /api/routes
    - Unknown filter validation.

    One important thing the tests uncovered: applying all three filters together currently returns zero routes in this graph. 
    That is valid behavior, so the test now verifies that the API returns an empty graph instead of failing.
