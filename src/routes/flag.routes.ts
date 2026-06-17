import { Router } from 'express';
import { FlagController } from '../controllers/flag.controller';

export function createFlagRoutes(controller: FlagController): Router {
  const router = Router();

  router.post('/flags', controller.createFlag);
  router.get('/flags', controller.listFlags);
  router.get('/flags/:key', controller.getFlag);
  router.patch('/flags/:key', controller.updateFlag);
  router.get('/flags/:key/evaluate', controller.evaluateFlag);

  return router;
}
