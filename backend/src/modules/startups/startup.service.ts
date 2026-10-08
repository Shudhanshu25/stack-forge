import mongoose, { isValidObjectId } from 'mongoose';
import type {
  Location,
  LocationProfile,
  Startup,
  StartupConfiguration,
  StartupCreateRequest,
  StartupUpdateRequest,
} from '@stackforge/shared';
import { check } from '../../contracts.js';
import { AppError, notFound } from '../../errors.js';
import { AdviceModel } from '../simulations/advice.model.js';
import { JobModel } from '../simulations/job.model.js';
import { SimulationModel } from '../simulations/simulation.model.js';
import { TurnModel } from '../simulations/turn.model.js';
import { LocationService } from '../locations/location.service.js';
import { StartupModel, toStartupDto, type StartupDoc } from './startup.model.js';
import type { TemplateCatalog } from './templates.js';

type EconomicsInput = Pick<
  StartupCreateRequest,
  'industry' | 'businessModel' | 'difficulty' | 'initialCapital' | 'initialPrice' | 'marketSize'
>;

/**
 * Startup CRUD. Every query is scoped to the owner; another user's startup is reported as not
 * found so its existence is not revealed.
 */
export class StartupService {
  constructor(
    private readonly templates: TemplateCatalog,
    private readonly locations: LocationService,
  ) {}

  /**
   * Snapshots the industry template, difficulty preset and event catalog into the startup's
   * configuration, so a simulation replays identically even after the data files change.
   */
  private snapshot(
    input: EconomicsInput,
    locationProfile: LocationProfile | undefined,
  ): StartupConfiguration {
    const template = this.templates.get(input.industry);
    return {
      industry: input.industry,
      businessModel: input.businessModel,
      difficulty: input.difficulty,
      initialCapital: input.initialCapital,
      initialPrice: input.initialPrice,
      marketSize: input.marketSize,
      templateVersion: template.templateVersion,
      parameters: structuredClone(template.parameters),
      difficultyModifiers: structuredClone(this.templates.difficultyPresets[input.difficulty]),
      eventsVersion: this.templates.eventCatalog.eventsVersion,
      events: structuredClone(this.templates.eventCatalog.events),
      ...(locationProfile ? { locationProfile: structuredClone(locationProfile) } : {}),
    };
  }

  private assertValid(configuration: StartupConfiguration): StartupConfiguration {
    const issues = check('startup-configuration.schema.json', configuration);
    if (issues)
      throw new AppError(500, 'CONTRACT_VIOLATION', 'Invalid startup configuration', issues);
    return configuration;
  }

  private async findOwned(ownerId: string, id: string): Promise<StartupDoc> {
    if (!isValidObjectId(id)) throw notFound('Startup');
    const doc = await StartupModel.findOne({ _id: id, ownerId });
    if (!doc) throw notFound('Startup');
    return doc;
  }

  async list(ownerId: string): Promise<Startup[]> {
    const docs = await StartupModel.find({ ownerId }).sort({ createdAt: -1 });
    return docs.map(toStartupDto);
  }

  async get(ownerId: string, id: string): Promise<Startup> {
    return toStartupDto(await this.findOwned(ownerId, id));
  }

  async create(ownerId: string, input: StartupCreateRequest): Promise<Startup> {
    const profile = await this.locations.profile(input.location);
    const doc = await StartupModel.create({
      ownerId,
      name: input.name.trim(),
      product: input.product,
      location: LocationService.normalized(input.location, profile),
      configuration: this.assertValid(this.snapshot(input, profile)),
    });
    return toStartupDto(doc);
  }

  async update(ownerId: string, id: string, patch: StartupUpdateRequest): Promise<Startup> {
    const doc = await this.findOwned(ownerId, id);
    const current = doc.configuration as StartupConfiguration;
    const merged: EconomicsInput = {
      industry: patch.industry ?? current.industry,
      businessModel: patch.businessModel ?? current.businessModel,
      difficulty: patch.difficulty ?? current.difficulty,
      initialCapital: patch.initialCapital ?? current.initialCapital,
      initialPrice: patch.initialPrice ?? current.initialPrice,
      marketSize: patch.marketSize ?? current.marketSize,
    };
    // Re-snapshot only when the template or preset changes, so existing parameters stay stable.
    // Simulations keep their own snapshot, so edits never affect a game in progress.
    const resnapshot =
      merged.industry !== current.industry || merged.difficulty !== current.difficulty;
    let profile = current.locationProfile;
    if (patch.location) {
      // Location is part of the economics a simulation starts from, so it is fixed from then on.
      if (await SimulationModel.exists({ startupId: doc._id, ownerId })) {
        throw new AppError(
          409,
          'LOCATION_LOCKED',
          'The location cannot change once a simulation has started',
        );
      }
      profile = await this.locations.profile(patch.location);
      doc.location = LocationService.normalized(patch.location, profile) as Location;
    }
    doc.configuration = this.assertValid(
      resnapshot
        ? this.snapshot(merged, profile)
        : { ...current, ...merged, ...(profile ? { locationProfile: profile } : {}) },
    );
    if (patch.name !== undefined) doc.name = patch.name.trim();
    if (patch.product !== undefined) doc.product = patch.product;
    doc.markModified('configuration');
    await doc.save();
    return toStartupDto(doc);
  }

  /** Deletes the startup with its simulations, turns and jobs, unless a turn is in flight. */
  async remove(ownerId: string, id: string): Promise<void> {
    if (!isValidObjectId(id)) throw notFound('Startup');
    if (!(await StartupModel.exists({ _id: id, ownerId }))) throw notFound('Startup');
    const simulationIds = (
      await SimulationModel.find({ startupId: id, ownerId }).select('_id')
    ).map((s) => s._id);
    if (
      await JobModel.exists({
        simulationId: mongoose.trusted({ $in: simulationIds }),
        activeLock: true,
      })
    ) {
      throw new AppError(409, 'TURN_IN_PROGRESS', 'Wait for the running turn to finish first');
    }
    await TurnModel.deleteMany({ simulationId: mongoose.trusted({ $in: simulationIds }) });
    await JobModel.deleteMany({ simulationId: mongoose.trusted({ $in: simulationIds }) });
    await AdviceModel.deleteMany({ simulationId: mongoose.trusted({ $in: simulationIds }) });
    await SimulationModel.deleteMany({ _id: mongoose.trusted({ $in: simulationIds }) });
    await StartupModel.deleteOne({ _id: id, ownerId });
  }
}
