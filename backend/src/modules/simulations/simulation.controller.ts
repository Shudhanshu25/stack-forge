import { idempotencyKeyOf } from '../../http/idempotency.js';
import type { Request, Response } from 'express';
import type {
  AdviceRequest,
  DecisionsRequest,
  ScenarioRequest,
  SimulationStartRequest,
} from '@stackforge/shared';
import { AppError } from '../../errors.js';
import type { ReportService } from '../reports/report.service.js';
import { authOf } from '../../http/authenticate.js';
import { sendContract } from '../../http/validate.js';
import type { JobService } from './job.service.js';
import type { SimulationService } from './simulation.service.js';

type IdParams = { id: string };

export class SimulationController {
  constructor(
    private readonly simulations: SimulationService,
    private readonly jobs: JobService,
    private readonly reports: ReportService,
  ) {}

  analytics = async (req: Request<IdParams>, res: Response) => {
    const analytics = await this.simulations.analytics(
      authOf(req).userId,
      req.params.id,
      req.id as string,
    );
    sendContract(res, 200, 'simulation-analytics.schema.json', analytics);
  };

  scenario = async (req: Request<IdParams>, res: Response) => {
    const comparison = await this.simulations.scenario(
      authOf(req).userId,
      req.params.id,
      req.body as ScenarioRequest,
      req.id as string,
    );
    sendContract(res, 200, 'scenario-comparison.schema.json', comparison);
  };

  report = async (req: Request<IdParams>, res: Response) => {
    const format = String(req.query.format ?? 'json');
    if (format !== 'json' && format !== 'csv' && format !== 'pdf') {
      throw new AppError(400, 'VALIDATION_ERROR', 'format must be json, csv or pdf');
    }
    const report = await this.reports.build(
      authOf(req).userId,
      req.params.id,
      format,
      req.id as string,
    );
    res.status(200).type(report.contentType).attachment(report.filename).send(report.body);
  };

  start = async (req: Request<IdParams>, res: Response) => {
    const sim = await this.simulations.start(
      authOf(req).userId,
      req.params.id,
      req.body as SimulationStartRequest,
      req.id as string,
    );
    sendContract(res, 201, 'simulation.schema.json', sim);
  };

  listForStartup = async (req: Request<IdParams>, res: Response) => {
    const simulations = await this.simulations.listForStartup(authOf(req).userId, req.params.id);
    sendContract(res, 200, 'simulation-list-response.schema.json', { simulations });
  };

  get = async (req: Request<IdParams>, res: Response) => {
    const sim = await this.simulations.get(authOf(req).userId, req.params.id);
    sendContract(res, 200, 'simulation.schema.json', sim);
  };

  turns = async (req: Request<IdParams>, res: Response) => {
    const turns = await this.simulations.turns(authOf(req).userId, req.params.id);
    sendContract(res, 200, 'turn-list-response.schema.json', { turns });
  };

  preview = async (req: Request<IdParams>, res: Response) => {
    const { decisions } = req.body as DecisionsRequest;
    const preview = await this.simulations.preview(
      authOf(req).userId,
      req.params.id,
      decisions,
      req.id as string,
    );
    sendContract(res, 200, 'decision-preview.schema.json', preview);
  };

  playTurn = async (req: Request<IdParams>, res: Response) => {
    const { decisions } = req.body as DecisionsRequest;
    const { job, replayed } = await this.jobs.enqueueTurn(
      authOf(req).userId,
      req.params.id,
      decisions,
      idempotencyKeyOf(req),
    );
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    sendContract(res, 202, 'simulation-job.schema.json', job);
  };

  advise = async (req: Request<IdParams>, res: Response) => {
    const advice = await this.simulations.advise(
      authOf(req).userId,
      req.params.id,
      req.body as AdviceRequest,
      req.id as string,
    );
    sendContract(res, 200, 'ai-advice.schema.json', advice);
  };

  getJob = async (req: Request<IdParams>, res: Response) => {
    const job = await this.jobs.get(authOf(req).userId, req.params.id);
    sendContract(res, 200, 'simulation-job.schema.json', job);
  };

  cancelJob = async (req: Request<IdParams>, res: Response) => {
    const job = await this.jobs.cancel(authOf(req).userId, req.params.id);
    sendContract(res, 202, 'simulation-job.schema.json', job);
  };
}
