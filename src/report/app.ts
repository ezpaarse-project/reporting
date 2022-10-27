import express from 'express';
import { StatusCodes } from 'http-status-codes';
import swaggerUi from 'swagger-ui-express';
import './lib/datefns'; // Should be first because it setup default options before using it in any module
import logger from './lib/logger';
import formatMiddleware from './middlewares/format';
import loggerMiddleware from './middlewares/logger';
import openapi from './openapi.json';
import tasksRouter from './routes/tasks';

const app = express();
const port = 8080;

app.use(express.json(), loggerMiddleware, formatMiddleware);

app.use('/tasks', tasksRouter);

app.use('/doc/openapi.json', (_req, res) => res.json(openapi));
app.use('/doc', swaggerUi.serve, swaggerUi.setup(openapi));

app.get('/ping', (_req, res) => {
  res.sendStatus(StatusCodes.NO_CONTENT);
});

/**
 * 404 Fallback
 */
app.use('*', (req, res) => {
  res.sendJson(null, 404);
});

app.listen(port, () => {
  logger.info(`[http] Service listening on port ${port}`);
});

export default app;
