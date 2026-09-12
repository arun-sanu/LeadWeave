import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shapes for the settings routes — the raw handler value, no envelope.
 * Decorated properties avoid named utility types: emitDecoratorMetadata wraps a named type in a
 * runtime guard whose other arm can never execute, leaving an uncoverable branch.
 */

export class SettingsGeneralDto {
  @ApiProperty({
    description: 'The advertised base URL (BASE_URL), the same value the startup banner and ingress URLs use.',
    example: 'https://wa.example.com',
  })
  apiBaseUrl!: string;

  @ApiProperty({
    description:
      'Always true: the engine auto-reconnects on a transient disconnect and there is no global off ' +
      'switch — reconnection is bounded per session by RECONNECT_MAX_ATTEMPTS.',
    example: true,
  })
  autoReconnect!: boolean;

  @ApiProperty({ description: 'Whether database query logging is on.', example: false })
  debugMode!: boolean;
}

export class SettingsApiDto {
  @ApiProperty({ description: 'Requests allowed per window.', example: 100 })
  rateLimit!: number;

  @ApiProperty({ description: 'Window length in milliseconds.', example: 60000 })
  rateLimitWindow!: number;

  @ApiProperty({ description: 'Whether Swagger is actually served — off by default in production.', example: false })
  enableDocs!: boolean;
}

export class SettingsNotificationsDto {
  @ApiProperty({ example: false }) emailEnabled!: boolean;
  @ApiProperty({ example: '' }) notificationEmail!: string;
  @ApiProperty({ example: true }) webhookAlerts!: boolean;
}

export class SettingsPacingDto {
  @ApiProperty({ description: 'Whether the outbound send pacing governor is enabled.', example: true })
  enabled!: boolean;

  @ApiProperty({
    description: 'Daily send allowance by session age in days.',
    example: [20, 40, 80, 160, 320, 640, 1000],
  })
  warmupSchedule!: number[];

  @ApiProperty({
    description: 'Daily cold reachout allowance by session age in days.',
    example: [5, 10, 20, 40, 60, 80, 100],
  })
  coldSchedule!: number[];

  @ApiProperty({ description: 'Consecutive send failures that trip the breaker.', example: 5 })
  breakerThreshold!: number;

  @ApiProperty({ description: 'Cooldown duration in milliseconds for tripped breaker.', example: 900000 })
  breakerCooldownMs!: number;

  @ApiProperty({ description: 'Whether human typing simulation is enabled before sends.', example: true })
  simulateTyping!: boolean;

  @ApiProperty({ description: 'Upper bound in milliseconds on the humanising typing pause.', example: 5000 })
  simulateTypingMaxMs!: number;
}

export class SettingsResponseDto {
  @ApiProperty({ type: SettingsGeneralDto })
  general!: SettingsGeneralDto;

  @ApiProperty({ type: SettingsApiDto })
  api!: SettingsApiDto;

  @ApiProperty({ type: SettingsNotificationsDto })
  notifications!: SettingsNotificationsDto;

  @ApiProperty({ type: SettingsPacingDto })
  pacing!: SettingsPacingDto;
}
