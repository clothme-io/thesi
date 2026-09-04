import { ForbiddenException } from '@nestjs/common';
import type {
  FileStoragePort,
  StoredFileRef,
  UploadableFile,
} from 'src/shared/storage/file-storage.port';
import type {
  BrandProfileData,
  CreatorProfileImageData,
  CreatorProfileImageRef,
  CreatorProfileData,
  ProfileRepository,
  ProfileUser,
} from './profile.repository';
import { ProfilesService } from './profiles.service';

class FakeProfileRepository implements ProfileRepository {
  user: ProfileUser | null = null;
  creator: CreatorProfileData | null = null;
  brand: BrandProfileData | null = null;

  async getUser() {
    return this.user;
  }

  async getCreatorProfile() {
    return this.creator;
  }

  async getCreatorProfileImage(): Promise<CreatorProfileImageRef | null> {
    return null;
  }

  async getBrandProfile() {
    return this.brand;
  }

  async upsertCreatorProfile(_userId: string, profile: CreatorProfileData) {
    this.creator = profile;
    return profile;
  }

  async setCreatorProfileImage(
    _userId: string,
    image: CreatorProfileImageData,
  ) {
    if (!this.creator) return null;
    this.creator = {
      ...this.creator,
      profileImageUrl: image.profileImageUrl,
    };
    return this.creator;
  }

  async upsertBrandProfile(_userId: string, profile: BrandProfileData) {
    this.brand = profile;
    return profile;
  }
}

class FakeFileStorage implements FileStoragePort {
  async upload(_file: UploadableFile, key: string): Promise<StoredFileRef> {
    return {
      provider: 'bunny',
      key,
      publicUrl: `https://cdn.example.com/${key}`,
    };
  }

  async read(): Promise<Buffer> {
    return Buffer.from('');
  }

  async delete(): Promise<void> {
    return undefined;
  }
}

describe('ProfilesService', () => {
  let repository: FakeProfileRepository;
  let service: ProfilesService;

  beforeEach(() => {
    repository = new FakeProfileRepository();
    service = new ProfilesService(repository, new FakeFileStorage());
  });

  it('returns creator defaults from the authenticated user before first save', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      fullName: 'Avery Creator',
      companyName: null,
    };

    await expect(service.getCurrent('creator-1')).resolves.toMatchObject({
      displayName: 'Avery Creator',
      headline: 'UGC Creator',
      niches: [],
      followerRange: '',
      tiktokFollowers: 0,
      ugcPosts: [],
    });
  });

  it('persists the authenticated brand profile', async () => {
    repository.user = {
      id: 'brand-1',
      role: 'brand',
      fullName: 'Brand Owner',
      companyName: 'Acme',
    };
    const profile: BrandProfileData = {
      companyName: 'Acme',
      tagline: 'Made responsibly',
      about: '',
      website: '',
      headquarters: '',
      industry: 'Fashion',
      instagram: '',
      tiktok: '',
      youtube: '',
      linkedin: '',
      companySize: '2–5',
      typicalBudgetRange: '$1k–$5k',
      primaryGoal: 'Find creators',
      preferredCreatorNiches: ['Fashion'],
      preferredPlatforms: ['Instagram'],
    };

    await expect(service.updateBrand('brand-1', profile)).resolves.toEqual(
      profile,
    );
    expect(repository.brand).toEqual(profile);
  });

  it('prevents a brand from writing a creator profile', async () => {
    repository.user = {
      id: 'brand-1',
      role: 'brand',
      fullName: 'Brand Owner',
      companyName: 'Acme',
    };

    await expect(
      service.updateCreator('brand-1', {
        displayName: 'Wrong role',
        headline: '',
        bio: '',
        location: '',
        website: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        niches: [],
        rateRange: '',
        turnaround: '',
        portfolioUrl: '',
        followerRange: '',
        tiktokFollowers: 0,
        instagramFollowers: 0,
        youtubeFollowers: 0,
        avgViews: 0,
        avgEngagementRate: 0,
        ugcPosts: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists follower range and self-reported stats on the creator profile', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      fullName: 'Avery Creator',
      companyName: null,
    };
    const profile = {
      displayName: 'Avery Creator',
      headline: 'UGC Creator',
      bio: '',
      location: 'US',
      website: '',
      instagram: '@avery',
      tiktok: '',
      youtube: '',
      niches: ['Fashion'],
      rateRange: '',
      turnaround: '3–5 business days',
      portfolioUrl: '',
      followerRange: '5k+',
      tiktokFollowers: 0,
      instagramFollowers: 6200,
      youtubeFollowers: 0,
      avgViews: 1400,
      avgEngagementRate: 4.1,
      ugcPosts: [
        {
          title: 'Fall lookbook',
          platform: 'Instagram',
          url: 'https://instagram.com/p/example',
          postedAt: '2026-08-01',
          views: 2200,
          likes: 180,
        },
      ],
    };

    await expect(service.updateCreator('creator-1', profile)).resolves.toEqual(
      profile,
    );
    expect(repository.creator).toEqual(profile);
  });

  it('uploads and stores a creator profile image', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      fullName: 'Avery Creator',
      companyName: null,
    };

    const saved = await service.uploadCreatorProfileImage('creator-1', {
      buffer: Buffer.from('image'),
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 5,
    });

    expect(saved.profileImageUrl).toContain('https://cdn.example.com/');
    expect(repository.creator?.profileImageUrl).toBe(saved.profileImageUrl);
  });
});
