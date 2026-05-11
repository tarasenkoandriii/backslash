import cors from 'cors';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { filterRegistry } from './filters';
import { findRoutes, graphForRoutes } from './routeFinder';
import { GraphIndex } from './types';

const QuerySchema = z.object({
  filters: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  maxDepth: z.coerce.number().int().min(1).max(50).optional(),
});

function parseFilterNames(value?: string): string[] {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  const status = message.startsWith('Unknown filter') ? 400 : 500;
  res.status(status).json({ error: message });
}

export function createApp(index: GraphIndex) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/graph', (_req, res) => {
    res.json({ nodes: index.graph.nodes, edges: index.graph.edges });
  });

  app.get('/api/filters', (_req, res) => {
    res.json({ filters: filterRegistry.list().map(({ name, description }) => ({ name, description })) });
  });

  app.get('/api/routes', (req: Request, res: Response) => {
    try {
      const query = QuerySchema.parse(req.query);
      const appliedFilters = parseFilterNames(query.filters);
      const allRoutes = findRoutes(index, { start: query.start, end: query.end, maxDepth: query.maxDepth });
      const routes = filterRegistry.apply(allRoutes, index, appliedFilters);
      const graph = graphForRoutes(index, routes);

      res.json({
        ...graph,
        routes,
        meta: {
          availableFilters: filterRegistry.list().map((filter) => filter.name),
          appliedFilters,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          routeCount: routes.length,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  return app;
}
