import { buildIndex, loadGraphFromFile } from './graphLoader';
import { createApp } from './app';

const graphPath = process.env.GRAPH_PATH ?? './data/train-ticket-be.json';
const port = Number(process.env.PORT ?? 3000);
const index = buildIndex(loadGraphFromFile(graphPath));
const app = createApp(index);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Train Ticket graph API listening on port ${port}`);
});
