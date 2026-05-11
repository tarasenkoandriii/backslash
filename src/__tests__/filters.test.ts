import path from 'node:path';
import { filterRegistry } from '../filters';
import { buildIndex, loadGraphFromFile } from '../graphLoader';
import { findRoutes } from '../routeFinder';

describe('route filters', () => {
  const graphPath = path.resolve(__dirname, '../../data/train-ticket-be.json');
  const index = buildIndex(loadGraphFromFile(graphPath));

  test('lists the assignment filters', () => {
    expect(filterRegistry.list().map((filter) => filter.name).sort()).toEqual([
      'has-vulnerability',
      'public-start',
      'sink-end',
    ]);
  });

  test('filters routes that start in a public service', () => {
    const routes = filterRegistry.apply(findRoutes(index, { maxDepth: 4 }), index, ['public-start']);

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => index.nodeById.get(route.nodeIds[0])?.publicExposed === true)).toBe(true);
  });

  test('filters routes ending in a sink', () => {
    const routes = filterRegistry.apply(findRoutes(index, { maxDepth: 4 }), index, ['sink-end']);

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => route.nodeIds.at(-1) === 'prod-postgresdb')).toBe(true);
  });

  test('combines sink and vulnerability filters with AND semantics', () => {
    const routes = filterRegistry.apply(findRoutes(index, { maxDepth: 4 }), index, [
      'sink-end',
      'has-vulnerability',
    ]);

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => route.nodeIds.at(-1) === 'prod-postgresdb')).toBe(true);
    expect(routes.every((route) => route.nodeIds.some((nodeId) => (index.nodeById.get(nodeId)?.vulnerabilities?.length ?? 0) > 0))).toBe(true);
  });

  test('can legitimately return zero routes when all filters are applied', () => {
    const routes = filterRegistry.apply(findRoutes(index, { maxDepth: 8 }), index, [
      'public-start',
      'sink-end',
      'has-vulnerability',
    ]);

    expect(routes).toHaveLength(0);
  });
});
