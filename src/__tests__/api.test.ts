import path from 'node:path';
import request from 'supertest';
import { createApp } from '../app';
import { buildIndex, loadGraphFromFile } from '../graphLoader';

const graphPath = path.resolve(__dirname, '../../data/train-ticket-be.json');
const app = createApp(buildIndex(loadGraphFromFile(graphPath)));

describe('REST API', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /api/filters exposes available filters', async () => {
    const res = await request(app).get('/api/filters').expect(200);
    expect(res.body.filters.map((filter: { name: string }) => filter.name).sort()).toEqual([
      'has-vulnerability',
      'public-start',
      'sink-end',
    ]);
  });

  test('GET /api/routes can combine sink and vulnerability filters', async () => {
    const res = await request(app)
      .get('/api/routes')
      .query({ filters: 'sink-end,has-vulnerability', maxDepth: 4 })
      .expect(200);

    expect(res.body.meta.appliedFilters).toEqual(['sink-end', 'has-vulnerability']);
    expect(res.body.meta.routeCount).toBeGreaterThan(0);
    expect(res.body.nodes.some((node: { id: string }) => node.id === 'prod-postgresdb')).toBe(true);
    expect(res.body.routes.every((route: { nodeIds: string[] }) => route.nodeIds.at(-1) === 'prod-postgresdb')).toBe(true);
  });

  test('GET /api/routes returns an empty graph when all filters match no route', async () => {
    const res = await request(app)
      .get('/api/routes')
      .query({ filters: 'public-start,sink-end,has-vulnerability', maxDepth: 8 })
      .expect(200);

    expect(res.body.meta.appliedFilters).toEqual(['public-start', 'sink-end', 'has-vulnerability']);
    expect(res.body.meta.routeCount).toBe(0);
    expect(res.body.nodes).toEqual([]);
    expect(res.body.edges).toEqual([]);
    expect(res.body.routes).toEqual([]);
  });

  test('GET /api/routes rejects unknown filters', async () => {
    const res = await request(app).get('/api/routes').query({ filters: 'does-not-exist' }).expect(400);
    expect(res.body.error).toContain('Unknown filter');
  });
});
