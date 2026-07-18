import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FileStoragePort,
  StoredFileRef,
  UploadableFile,
} from './file-storage.port';

@Injectable()
export class LocalFileStorage implements FileStoragePort {
  private readonly logger = new Logger(LocalFileStorage.name);
  private readonly rootDir: string;

  constructor(config: ConfigService) {
    this.rootDir = path.resolve(
      config.get<string>('FILE_STORAGE_DIR') || './.data/uploads',
    );
  }

  async upload(file: UploadableFile, key: string): Promise<StoredFileRef> {
    const absolute = path.join(this.rootDir, key);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, file.buffer);
    return { provider: 'local', key };
  }

  async read(ref: StoredFileRef): Promise<Buffer> {
    return readFile(path.join(this.rootDir, ref.key));
  }

  async delete(ref: StoredFileRef): Promise<void> {
    try {
      await unlink(path.join(this.rootDir, ref.key));
    } catch (error) {
      this.logger.warn(
        `Could not delete local file ${ref.key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

@Injectable()
export class BunnyFileStorage implements FileStoragePort {
  private readonly logger = new Logger(BunnyFileStorage.name);

  constructor(private readonly config: ConfigService) {}

  async upload(file: UploadableFile, key: string): Promise<StoredFileRef> {
    const accessKey = this.config.get<string>('BUNNY_API_KEY');
    const region = this.config.get<string>('BUNNY_STORAGE_REGION');
    const storageZone = this.config.get<string>('BUNNY_THESI_STORAGE_ZONE_NAME');
    const pullZone =
      this.config.get<string>('BUNNY_THESI_PULL_ZONE') ??
      'clothme-thesi-pull-zone.b-cdn.net';

    if (!accessKey || !region || !storageZone) {
      throw new Error(
        'Bunny storage is not configured (BUNNY_API_KEY / BUNNY_STORAGE_REGION / BUNNY_THESI_STORAGE_ZONE_NAME)',
      );
    }

    const cleanRegion = region.includes('storage.bunnycdn.com')
      ? region
      : `${region}.storage.bunnycdn.com`;
    const zoneName = storageZone.includes('.')
      ? storageZone.split('.')[0]!
      : storageZone;
    const uploadUrl = `https://${cleanRegion}/${zoneName}/${key}`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: accessKey,
        'Content-Type': 'application/octet-stream',
      },
      body: file.buffer as unknown as BodyInit,
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`BunnyCDN upload failed ${response.status}: ${errText}`);
      throw new Error('Failed to upload file to storage');
    }

    return {
      provider: 'bunny',
      key,
      publicUrl: `https://${pullZone}/${key}`,
    };
  }

  async read(ref: StoredFileRef): Promise<Buffer> {
    if (ref.publicUrl) {
      const response = await fetch(ref.publicUrl);
      if (!response.ok) {
        throw new Error('Failed to download file from storage');
      }
      return Buffer.from(await response.arrayBuffer());
    }

    const pullZone =
      this.config.get<string>('BUNNY_THESI_PULL_ZONE') ??
      'clothme-thesi-pull-zone.b-cdn.net';
    const response = await fetch(`https://${pullZone}/${ref.key}`);
    if (!response.ok) {
      throw new Error('Failed to download file from storage');
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(ref: StoredFileRef): Promise<void> {
    const accessKey = this.config.get<string>('BUNNY_API_KEY');
    const region = this.config.get<string>('BUNNY_STORAGE_REGION');
    const storageZone = this.config.get<string>('BUNNY_THESI_STORAGE_ZONE_NAME');
    if (!accessKey || !region || !storageZone) return;

    const cleanRegion = region.includes('storage.bunnycdn.com')
      ? region
      : `${region}.storage.bunnycdn.com`;
    const zoneName = storageZone.includes('.')
      ? storageZone.split('.')[0]!
      : storageZone;

    try {
      await fetch(`https://${cleanRegion}/${zoneName}/${ref.key}`, {
        method: 'DELETE',
        headers: { AccessKey: accessKey },
      });
    } catch (error) {
      this.logger.warn(
        `Could not delete bunny file ${ref.key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

@Injectable()
export class ConfigurableFileStorage implements FileStoragePort {
  private readonly impl: FileStoragePort;

  constructor(config: ConfigService) {
    const accessKey = config.get<string>('BUNNY_API_KEY');
    const region = config.get<string>('BUNNY_STORAGE_REGION');
    const storageZone = config.get<string>('BUNNY_THESI_STORAGE_ZONE_NAME');
    this.impl =
      accessKey && region && storageZone
        ? new BunnyFileStorage(config)
        : new LocalFileStorage(config);
  }

  upload(file: UploadableFile, key: string) {
    return this.impl.upload(file, key);
  }

  read(ref: StoredFileRef) {
    return this.impl.read(ref);
  }

  delete(ref: StoredFileRef) {
    return this.impl.delete(ref);
  }
}
