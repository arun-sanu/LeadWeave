import { Controller, Post, HttpCode, HttpStatus, Req, Res, Body, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentApiKey, Public } from './decorators/auth.decorators';
import { ApiKey } from './entities/api-key.entity';
import { ValidateApiKeyResponseDto, CreateSessionDto } from './dto';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

@ApiTags('auth')
@Controller('auth')
export class AuthValidateController {
  constructor(
    private readonly authService: AuthService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an API key or active session cookie' })
  @ApiHeader({ name: 'X-API-Key', required: false, description: 'API key to validate' })
  @ApiResponse({ status: 200, description: 'API key or session is valid', type: ValidateApiKeyResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key / session' })
  validate(
    @CurrentApiKey() apiKey?: ApiKey,
    @Req() req?: Request,
  ): { valid: boolean; role?: string; companyId?: string; userId?: string } {
    if (!apiKey) {
      return { valid: false };
    }
    const user = (req as unknown as { user?: { role?: string; companyId?: string; id?: string } })?.user;
    const role = user?.role || apiKey.role;
    const companyId = user?.companyId || (apiKey as ApiKey & { companyId?: string })?.companyId;
    const userId = user?.id || (apiKey as ApiKey & { userId?: string })?.userId;
    return { valid: true, role, companyId, userId };
  }

  @Public()
  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create an HTTP-only authenticated cookie session' })
  @ApiBody({ type: CreateSessionDto, required: false })
  @ApiResponse({ status: 200, description: 'Session created and cookie set', type: ValidateApiKeyResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ valid: boolean; role?: string; companyId?: string; userId?: string }> {
    const rawApiKey = dto?.apiKey || (req.headers['x-api-key'] as string);
    const authHeader = req.headers['authorization'];
    const rawToken = dto?.token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined);

    const isSecure = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    if (rawToken && this.supabaseService?.isEnabled?.()) {
      const user = await this.supabaseService.verifyToken(rawToken);
      if (user) {
        res.cookie('leadweave_token', rawToken, cookieOptions);
        res.clearCookie('leadweave_api_key', { path: '/' });

        // Auto-pair instance with user's company in Supabase
        if (user.companyId) {
          const os = require('os');
          const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || `lw-node-${os.hostname()}`;
          void this.supabaseService.pairInstanceWithCompany(instanceId, user.companyId);
        }

        return { valid: true, role: user.role || 'viewer', companyId: user.companyId, userId: user.id };
      }
    }

    if (rawApiKey) {
      const clientIp = req.ip || (req.socket?.remoteAddress ?? '127.0.0.1');
      try {
        const apiKey = await this.authService.validateApiKey(rawApiKey, clientIp);
        if (apiKey) {
          res.cookie('leadweave_api_key', rawApiKey, cookieOptions);
          res.clearCookie('leadweave_token', { path: '/' });
          return { valid: true, role: apiKey.role };
        }
      } catch (err) {
        throw new UnauthorizedException((err as Error).message || 'Invalid API Key');
      }
    }

    throw new UnauthorizedException('Valid API key or Token is required');
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the HTTP-only authenticated cookie session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  logout(@Res({ passthrough: true }) res: Response): { success: boolean } {
    res.clearCookie('leadweave_token', { path: '/' });
    res.clearCookie('leadweave_api_key', { path: '/' });
    return { success: true };
  }
}
