import path from 'node:path';
import { buildIndex, loadGraphFromFile, normalizeGraph } from '../graphLoader';

describe('graph loader', () => {
  test('normalizes array and string edge targets', () => {
    const graph = normalizeGraph({
      nodes: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      edges: [
        { from: 'a', to: ['b', 'c'] },
        { from: 'b', to: 'c' },
      ],
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });

  test('loads the supplied Train Ticket graph and builds indexes', () => {
    const graphPath = path.resolve(__dirname, '../../data/train-ticket-be.json');
    const index = buildIndex(loadGraphFromFile(graphPath));

    expect(index.nodeById.get('frontend')?.publicExposed).toBe(true);
    expect(index.nodeById.get('prod-postgresdb')?.kind).toBe('rds');
    expect(index.outgoing.get('auth-service')?.some((edge) => edge.target === 'prod-postgresdb')).toBe(true);
  });
});
