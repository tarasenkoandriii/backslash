import { buildIndex, normalizeGraph } from '../graphLoader';
import { findRoutes, graphForRoutes } from '../routeFinder';

describe('route finder', () => {
  const index = buildIndex(normalizeGraph({
    nodes: [{ name: 'public' }, { name: 'service-a' }, { name: 'service-b' }, { name: 'db' }],
    edges: [
      { from: 'public', to: ['service-a', 'service-b'] },
      { from: 'service-a', to: 'db' },
      { from: 'service-b', to: 'db' },
    ],
  }));

  test('finds directed routes from a start node to an end node', () => {
    const routes = findRoutes(index, { start: 'public', end: 'db', maxDepth: 2 });

    expect(routes).toHaveLength(2);
    expect(routes.map((route) => route.nodeIds.join(' -> ')).sort()).toEqual([
      'public -> service-a -> db',
      'public -> service-b -> db',
    ]);
  });

  test('returns a renderable subgraph for routes', () => {
    const routes = findRoutes(index, { start: 'public', end: 'db', maxDepth: 2 });
    const graph = graphForRoutes(index, routes);

    expect(graph.nodes.map((node) => node?.id).sort()).toEqual(['db', 'public', 'service-a', 'service-b']);
    expect(graph.edges).toHaveLength(4);
  });
});
