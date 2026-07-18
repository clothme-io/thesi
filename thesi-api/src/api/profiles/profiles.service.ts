import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  UpdateBrandProfileDto,
  UpdateCreatorProfileDto,
} from './dto/profile.dto';
import {
  PROFILE_REPOSITORY,
  type BrandProfileData,
  type CreatorProfileData,
  type ProfileRepository,
  type ProfileUser,
} from './profile.repository';

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profiles: ProfileRepository,
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
