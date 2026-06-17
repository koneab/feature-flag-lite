import express from 'express';
import { createFlagRoutes } from './routes/flag.routes';
import { FlagController } from './controllers/flag.controller';
import { FlagService } from './services/flag.service';
import { InMemoryFlagRepository } from './repositories/in-memory-flag.repository';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found-handler';

const repository = new InMemoryFlagRepository();
const service = new FlagService(repository);
const controller = new FlagController(service);

const app = express();

app.use(express.json());
app.use(createFlagRoutes(controller));
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
