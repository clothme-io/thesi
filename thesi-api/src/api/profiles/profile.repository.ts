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

export type CreatorProfileImageData = {
  storageProvider: 'local' | 'bunny';
  storageKey: string;
  contentType: string;
  profileImageUrl: string;
};

export type CreatorProfileImageRef = {
  storageProvider: 'local' | 'bunny';
  storageKey: string;
  contentType: string;
};

export type BrandLogoData = {
  storageProvider: 'local' | 'bunny';
  storageKey: string;
  contentType: string;
  logoUrl: string;
};

export type BrandLogoRef = {
  storageProvider: 'local' | 'bunny';
  storageKey: string;
  contentType: string;
};

export interface ProfileRepository {
  getUser(userId: string): Promise<ProfileUser | null>;
  getCreatorProfile(userId: string): Promise<CreatorProfileData | null>;
  getCreatorProfileImage(
    userId: string,
  ): Promise<CreatorProfileImageRef | null>;
  getBrandProfile(userId: string): Promise<BrandProfileData | null>;
  getBrandLogo(userId: string): Promise<BrandLogoRef | null>;
  upsertCreatorProfile(
    userId: string,
    profile: CreatorProfileData,
  ): Promise<CreatorProfileData>;
  setCreatorProfileImage(
    userId: string,
    image: CreatorProfileImageData,
  ): Promise<CreatorProfileData | null>;
  upsertBrandProfile(
    userId: string,
    profile: BrandProfileData,
  ): Promise<BrandProfileData>;
  setBrandLogo(
    userId: string,
    image: BrandLogoData,
  ): Promise<BrandProfileData | null>;
}
