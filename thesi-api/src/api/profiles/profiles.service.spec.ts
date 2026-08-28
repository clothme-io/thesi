import { ForbiddenException } from '@nestjs/common';
import type {
  BrandProfileData,
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

  async getBrandProfile() {
    return this.brand;
  }

  async upsertCreatorProfile(_userId: string, profile: CreatorProfileData) {
    this.creator = profile;
    return profile;
  }

  async upsertBrandProfile(_userId: string, profile: BrandProfileData) {
    this.brand = profile;
    return profile;
  }
}

describe('ProfilesService', () => {
  let repository: FakeProfileRepository;
  let service: ProfilesService;

  beforeEach(() => {
    repository = new FakeProfileRepository();
    service = new ProfilesService(repository);
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
});
