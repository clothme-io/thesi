import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sanitizeFileName } from 'src/shared/storage/file-helpers';
import {
  FILE_STORAGE,
  type FileStoragePort,
  type StoredFileRef,
  type UploadableFile,
} from 'src/shared/storage/file-storage.port';
import type {
  UpdateBrandProfileDto,
  UpdateCreatorProfileDto,
} from './dto/profile.dto';
import {
  PROFILE_REPOSITORY,
  type BrandProfileData,
  type CreatorProfileImageRef,
  type CreatorProfileData,
  type ProfileRepository,
  type ProfileUser,
} from './profile.repository';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profiles: ProfileRepository,
    @Inject(FILE_STORAGE)
    private readonly storage: FileStoragePort,
  ) {}

  async getCurrent(
    userId: string,
  ): Promise<CreatorProfileData | BrandProfileData> {
    const user = await this.requireUser(userId);
    if (user.role === 'creator') {
      return (
        (await this.profiles.getCreatorProfile(userId)) ??
        defaultCreatorProfile(user)
      );
    }
    if (user.role === 'brand') {
      return (
        (await this.profiles.getBrandProfile(userId)) ??
        defaultBrandProfile(user)
      );
    }
    throw new ForbiddenException('This account does not have a public profile');
  }

  async updateCreator(
    userId: string,
    dto: UpdateCreatorProfileDto,
  ): Promise<CreatorProfileData> {
    const user = await this.requireUser(userId);
    this.requireRole(user, 'creator');
    return this.profiles.upsertCreatorProfile(userId, dto);
  }

  async uploadCreatorProfileImage(
    userId: string,
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
          size: number;
        }
      | undefined,
  ): Promise<CreatorProfileData> {
    const user = await this.requireUser(userId);
    this.requireRole(user, 'creator');
    this.assertProfileImage(file);

    const current =
      (await this.profiles.getCreatorProfile(userId)) ??
      (await this.profiles.upsertCreatorProfile(
        userId,
        defaultCreatorProfile(user),
      ));
    const key = `profiles/creators/${userId}/${randomUUID()}-${sanitizeFileName(
      file.originalname,
    )}`;
    const stored = await this.storage.upload(file as UploadableFile, key);
    const profileImageUrl = this.profileImageUrl(userId, stored);
    const saved = await this.profiles.setCreatorProfileImage(userId, {
      storageProvider: stored.provider,
      storageKey: stored.key,
      contentType: file.mimetype,
      profileImageUrl,
    });

    return saved ?? { ...current, profileImageUrl };
  }

  async getCreatorProfileImage(
    userId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const image = await this.profiles.getCreatorProfileImage(userId);
    if (!image) {
      throw new NotFoundException('Profile image not found');
    }
    return {
      buffer: await this.storage.read(toStoredFileRef(image)),
      contentType: image.contentType,
    };
  }

  async updateBrand(
    userId: string,
    dto: UpdateBrandProfileDto,
  ): Promise<BrandProfileData> {
    const user = await this.requireUser(userId);
    this.requireRole(user, 'brand');
    return this.profiles.upsertBrandProfile(userId, dto);
  }

  private async requireUser(userId: string): Promise<ProfileUser> {
    const user = await this.profiles.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    return user;
  }

  private requireRole(user: ProfileUser, role: 'creator' | 'brand'): void {
    if (user.role !== role) {
      throw new ForbiddenException(
        `${role === 'creator' ? 'Creator' : 'Brand'} profile access required`,
      );
    }
  }

  private assertProfileImage(
    file:
      | {
          mimetype: string;
          size: number;
        }
      | undefined,
  ): asserts file is {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  } {
    if (!file) {
      throw new BadRequestException('Profile image is required');
    }
    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Profile image must be a JPEG, PNG, WebP, or GIF',
      );
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      throw new BadRequestException('Profile image must be 5 MB or smaller');
    }
  }

  private profileImageUrl(userId: string, stored: StoredFileRef): string {
    return (
      stored.publicUrl ??
      `/v1/profile-images/creators/${encodeURIComponent(userId)}?v=${Date.now()}`
    );
  }
}

function toStoredFileRef(image: CreatorProfileImageRef): StoredFileRef {
  return {
    provider: image.storageProvider,
    key: image.storageKey,
  };
}

function defaultCreatorProfile(user: ProfileUser): CreatorProfileData {
  return {
    displayName: user.fullName,
    headline: 'UGC Creator',
    bio: '',
    location: '',
    website: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    niches: [],
    rateRange: '',
    turnaround: '3–5 business days',
    portfolioUrl: '',
    profileImageUrl: '',
    followerRange: '',
    tiktokFollowers: 0,
    instagramFollowers: 0,
    youtubeFollowers: 0,
    avgViews: 0,
    avgEngagementRate: 0,
    ugcPosts: [],
  };
}

function defaultBrandProfile(user: ProfileUser): BrandProfileData {
  return {
    companyName: user.companyName || user.fullName,
    tagline: 'Fashion & lifestyle brand',
    about: '',
    website: '',
    headquarters: '',
    industry: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    linkedin: '',
    companySize: '',
    typicalBudgetRange: '',
    primaryGoal: '',
    preferredCreatorNiches: [],
    preferredPlatforms: [],
  };
}
