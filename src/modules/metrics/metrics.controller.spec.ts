import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import type { Request } from 'express';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: { assertScrapeAuthorized: jest.Mock; render: jest.Mock };

  beforeEach(async () => {
    metricsService = {
      assertScrapeAuthorized: jest.fn(),
      render: jest.fn().mockResolvedValue('leadweave_up 1\n'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: metricsService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('delegates scrape authorization to MetricsService and returns rendered text', async () => {
    const req = {
      headers: { authorization: 'Bearer test-token' },
    } as unknown as Request;

    const result = await controller.scrape(req);

    expect(metricsService.assertScrapeAuthorized).toHaveBeenCalledWith('Bearer test-token');
    expect(metricsService.render).toHaveBeenCalledTimes(1);
    expect(result).toBe('leadweave_up 1\n');
  });

  it('passes undefined authorization header when header is missing', async () => {
    const req = {
      headers: {},
    } as unknown as Request;

    const result = await controller.scrape(req);

    expect(metricsService.assertScrapeAuthorized).toHaveBeenCalledWith(undefined);
    expect(result).toBe('leadweave_up 1\n');
  });
});
