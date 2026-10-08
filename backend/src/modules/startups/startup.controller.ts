import type { Request, Response } from 'express';
import type { StartupCreateRequest, StartupUpdateRequest } from '@stackforge/shared';
import { authOf } from '../../http/authenticate.js';
import { sendContract } from '../../http/validate.js';
import type { StartupService } from './startup.service.js';
import type { TemplateCatalog } from './templates.js';

type IdParams = { id: string };

export class StartupController {
  constructor(
    private readonly startups: StartupService,
    private readonly templates: TemplateCatalog,
  ) {}

  list = async (req: Request, res: Response) => {
    const startups = await this.startups.list(authOf(req).userId);
    sendContract(res, 200, 'startup-list-response.schema.json', { startups });
  };

  get = async (req: Request<IdParams>, res: Response) => {
    const startup = await this.startups.get(authOf(req).userId, req.params.id);
    sendContract(res, 200, 'startup.schema.json', startup);
  };

  create = async (req: Request, res: Response) => {
    const startup = await this.startups.create(
      authOf(req).userId,
      req.body as StartupCreateRequest,
    );
    sendContract(res, 201, 'startup.schema.json', startup);
  };

  update = async (req: Request<IdParams>, res: Response) => {
    const { userId } = authOf(req);
    const startup = await this.startups.update(
      userId,
      req.params.id,
      req.body as StartupUpdateRequest,
    );
    sendContract(res, 200, 'startup.schema.json', startup);
  };

  remove = async (req: Request<IdParams>, res: Response) => {
    await this.startups.remove(authOf(req).userId, req.params.id);
    res.status(204).end();
  };

  listTemplates = (_req: Request, res: Response) => {
    sendContract(res, 200, 'industry-template-list-response.schema.json', {
      templates: this.templates.list(),
    });
  };
}
