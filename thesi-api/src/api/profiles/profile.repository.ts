import type {
  UpdateBrandProfileDto,
  UpdateCreatorProfileDto,
} from './dto/profile.dto';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export type ProfileUser = {
  id: string;
  role: string;
  fullName: string;
  companyName: string | null;
};

export type CreatorProfileData = UpdateCreatorProfileDto;
export type BrandProfileData = UpdateBrandProfileDto;

export interface ProfileRepository {
  getUser(userId: string): Promise<ProfileUser | null>;
  getCreatorProfile(userId: string): Promise<CreatorProfileData | null>;
  getBrandProfile(userId: string): Promise<BrandProfileData | null>;
  upsertCreatorProfile(
    userId: string,
    profile: CreatorProfileData,
  ): Promise<CreatorProfileData>;
  upsertBrandProfile(
    userId: string,
    profile: BrandProfileData,
  ): Promise<BrandProfileData>;
}
