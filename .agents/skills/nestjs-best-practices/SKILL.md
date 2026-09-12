---
name: nestjs-best-practices
description: Core guidelines for creating and modifying NestJS 11 components in the LeadWeave/LeadWeave project. Use when generating or refactoring Modules, Controllers, Services, and DTOs.
---

# NestJS 11 Best Practices — LeadWeave

## When to invoke this skill

- When creating a new NestJS Module, Controller, or Service
- When adding new DTOs (Data Transfer Objects)
- When refactoring existing business logic
- When wiring up Dependency Injection

## Guidelines for LeadWeave

1. **Modules**: Every feature must have its own isolated module in `src/modules/<feature-name>/`.
2. **DTOs**: Always use `class-validator` and `class-transformer` for incoming payloads. All fields must be explicitly validated.
3. **Controllers**: Controllers should only handle routing, extracting parameters/bodies, and returning HTTP responses. Business logic must live in Services.
4. **Services**: Services must be decorated with `@Injectable()`. Use standard constructor-based Dependency Injection.
5. **Logging**: Use the built-in NestJS `Logger` class (e.g., `private readonly logger = new Logger(MyService.name);`) instead of `console.log`.
6. **Error Handling**: Throw appropriate `HttpException` subclasses (like `BadRequestException`, `NotFoundException`) from Services/Controllers so the global exception filter can catch them.

## Anti-Ban Rule Reminder

If the service handles messaging, ensure you inject the queue module to enforce rate-limiting and delays, as required by the LeadWeave Anti-Ban Protocols.

## OpenWA / LeadWeave Specific Architecture

1. **Engine Abstraction Layer (EAL):** Do not import `whatsapp-web.js` or `Baileys` directly into your business logic! Always inject and use the `IWhatsAppEngine` interface so the system remains client-agnostic.
2. **Real-Time Sync:** If your Service performs an action that the Dashboard needs to know about (like a session disconnecting or a new message arriving), you MUST broadcast an event via the `EventsGateway` (`src/modules/events/events.gateway.ts`).
3. **Plugins & Hooks:** If you are building extensible features, emit lifecycle events via the `HookManager` rather than hardcoding side-effects.
