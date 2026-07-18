export const FILE_STORAGE = Symbol('FILE_STORAGE');

export type StoredFileRef = {
  provider: 'local' | 'bunny';
  key: string;
  publicUrl?: string;
};

export type UploadableFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export interface FileStoragePort {
  upload(file: UploadableFile, key: string): Promise<StoredFileRef>;
  read(ref: StoredFileRef): Promise<Buffer>;
  delete(ref: StoredFileRef): Promise<void>;
}
