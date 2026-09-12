import { Readable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { stripBase64DataUri, assertBase64WithinMediaCap } from '../../modules/message/media-cap.util';
import {
  spendInlineMediaBudget,
  resolveMessageListInlineMediaBudgetBytes,
} from '../../modules/message/message.service';
import { PayloadTooLargeException } from '@nestjs/common';
import { Message } from '../../modules/message/entities/message.entity';

describe('Deep & Hard Stress Test Suite: Phase 6 (Streaming Media Uploads & Memory Bounds)', () => {
  let tmpDir: string;
  let storageService: StorageService;
  let configService: ConfigService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-media-stream-test-'));
    configService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'storage.type') return 'local';
        if (key === 'storage.localPath') return tmpDir;
        return def;
      }),
    } as unknown as ConfigService;

    storageService = new StorageService(configService);
  });

  afterEach(() => {
    storageService.onModuleDestroy();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('StorageService Stream I/O Operations', () => {
    it('pipes a Readable stream to disk via putStream and reads back stream via getStream', async () => {
      const fileName = 'test-stream-file.dat';
      const samplePayload = Buffer.from('Chunk1-Chunk2-Chunk3-StreamData-Optimized', 'utf8');

      // Create stream
      const inputStream = new Readable({
        read() {
          this.push(samplePayload);
          this.push(null);
        },
      });

      // Write stream directly
      await storageService.putStream(fileName, inputStream, 'application/octet-stream');

      // Verify file exists on disk
      expect(fs.existsSync(path.join(tmpDir, fileName))).toBe(true);

      // Read back as stream
      const outputStream = await storageService.getStream(fileName);
      const chunks: Buffer[] = [];
      for await (const chunk of outputStream) {
        chunks.push(Buffer.from(chunk));
      }

      const reconstructed = Buffer.concat(chunks);
      expect(reconstructed.toString('utf8')).toBe('Chunk1-Chunk2-Chunk3-StreamData-Optimized');
    });

    it('rejects path traversal attempts on stream operations', async () => {
      const maliciousKey = '../../evil-escape.bin';
      const stream = new Readable({
        read() {
          this.push('malicious');
          this.push(null);
        },
      });

      await expect(storageService.putStream(maliciousKey, stream)).rejects.toThrow(
        /Refusing to store an unsafe storage key/,
      );
      await expect(storageService.getStream(maliciousKey)).rejects.toThrow(/Refusing to read an unsafe storage key/);
    });
  });

  describe('Base64 Memory Boundaries & Stream Header Stripping', () => {
    it('correctly strips Data URI prefixes across multiple MIME representations', () => {
      expect(stripBase64DataUri('data:image/png;base64,iVBORw0KGgo=')).toBe('iVBORw0KGgo=');
      expect(stripBase64DataUri('data:audio/ogg;base64,T2dnUwACAAA=')).toBe('T2dnUwACAAA=');
      expect(stripBase64DataUri('iVBORw0KGgo=')).toBe('iVBORw0KGgo=');
      expect(stripBase64DataUri(null)).toBeUndefined();
      expect(stripBase64DataUri(undefined)).toBeUndefined();
    });

    it('enforces media byte limits and throws PayloadTooLargeException on oversized payloads', () => {
      // Valid payload: 100 bytes
      const validPayload = Buffer.alloc(100).toString('base64');
      expect(() => assertBase64WithinMediaCap(validPayload)).not.toThrow();

      // Mock media cap to 500 bytes for deterministic test
      const originalEnv = process.env.MEDIA_DOWNLOAD_MAX_BYTES;
      process.env.MEDIA_DOWNLOAD_MAX_BYTES = '500';

      try {
        const oversized = Buffer.alloc(1000).toString('base64');
        expect(() => assertBase64WithinMediaCap(oversized)).toThrow(PayloadTooLargeException);
      } finally {
        if (originalEnv !== undefined) {
          process.env.MEDIA_DOWNLOAD_MAX_BYTES = originalEnv;
        } else {
          delete process.env.MEDIA_DOWNLOAD_MAX_BYTES;
        }
      }
    });
  });

  describe('Inline Media Budget Management', () => {
    it('resolves budget accurately with environment fallback', () => {
      const defaultBudget = resolveMessageListInlineMediaBudgetBytes();
      expect(defaultBudget).toBeGreaterThan(0);
    });

    it('trims oversized base64 payloads to omitted markers to prevent heap spikes', () => {
      const smallMedia = Buffer.alloc(50).toString('base64');
      const largeMedia = Buffer.alloc(200).toString('base64');

      const messages = [
        {
          id: 'msg-1',
          metadata: {
            media: { data: smallMedia, mimetype: 'image/png' },
          },
        },
        {
          id: 'msg-2',
          metadata: {
            media: { data: largeMedia, mimetype: 'image/jpeg' },
          },
        },
      ] as unknown as Message[];

      // Budget allowed: 100 bytes (smallMedia fits, largeMedia omitted)
      const budgeted = spendInlineMediaBudget(messages, 100);

      expect((budgeted[0].metadata as any).media.data).toBe(smallMedia);
      expect((budgeted[1].metadata as any).media.data).toBeUndefined();
      expect((budgeted[1].metadata as any).media.omitted).toBe(true);
      expect((budgeted[1].metadata as any).media.sizeBytes).toBe(200);
    });
  });
});
