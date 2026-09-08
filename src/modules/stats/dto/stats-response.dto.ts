import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shapes for the statistics routes — the raw handler value, no envelope.
 * Decorated properties avoid named utility types: emitDecoratorMetadata wraps a named type in a
 * runtime guard whose other arm can never execute, leaving an uncoverable branch.
 */

export class OverviewSessionsDto {
  @ApiProperty({ description: 'Sessions currently connected.', example: 2 })
  active!: number;

  @ApiProperty({ description: 'Sessions on record, connected or not.', example: 5 })
  total!: number;

  @ApiProperty({
    description: 'Session count per status value.',
    example: { ready: 2, disconnected: 3 },
    additionalProperties: { type: 'integer' },
  })
  byStatus!: { [status: string]: number };
}

export class OverviewTodayDto {
  @ApiProperty({ example: 12 }) sent!: number;
  @ApiProperty({ example: 34 }) received!: number;
}

export class OverviewMessagesDto {
  @ApiProperty({ description: 'All-time sent count.', example: 1024 })
  sent!: number;

  @ApiProperty({ description: 'All-time received count.', example: 2048 })
  received!: number;

  @ApiProperty({ description: 'Sends the gateway recorded as failed.', example: 3 })
  failed!: number;

  @ApiProperty({ type: OverviewTodayDto, description: "Today's counts, in the server's timezone." })
  today!: OverviewTodayDto;
}

export class OverviewStatsResponseDto {
  @ApiProperty({ type: OverviewSessionsDto })
  sessions!: OverviewSessionsDto;

  @ApiProperty({ type: OverviewMessagesDto })
  messages!: OverviewMessagesDto;
}

export class SessionStatsSessionDto {
  @ApiProperty({ example: '0a941dac-a965-45e7-b318-74ae8be134f0' }) id!: string;
  @ApiProperty({ example: 'primary' }) name!: string;
  @ApiProperty({ example: 'ready' }) status!: string;
}

export class SessionStatsMessagesDto {
  @ApiProperty({ example: 1024 }) sent!: number;
  @ApiProperty({ example: 2048 }) received!: number;
  @ApiProperty({ example: 46 }) today!: number;
  @ApiProperty({ example: 3 }) failed!: number;
}

export class SessionHourlyActivityDto {
  @ApiProperty({ description: 'Hour of day, 0-23.', example: 9 }) hour!: number;
  @ApiProperty({ example: 12 }) sent!: number;
  @ApiProperty({ example: 34 }) received!: number;
}

export class SessionStatsResponseDto {
  @ApiProperty({ type: SessionStatsSessionDto })
  session!: SessionStatsSessionDto;

  @ApiProperty({ type: SessionStatsMessagesDto })
  messages!: SessionStatsMessagesDto;

  @ApiProperty({ type: [SessionHourlyActivityDto] })
  hourlyActivity!: SessionHourlyActivityDto[];
}
