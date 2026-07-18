import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CREATORS_DIRECTORY_REPOSITORY,
  type CreatorDirectoryProfile,
  type CreatorsDirectoryRepository,
  type DirectoryUser,
} from './creators-directory.repository';

@Injectable()
export class CreatorsService {
  constructor(
    @Inject(CREATORS_DIRECTORY_REPOSITORY)
    private readonly creators: CreatorsDirectoryRepository,
  ) {}

  async list(userId: string): Promise<{ creators: CreatorDirectoryProfile[] }> {
    await this.requireBrand(userId);
    const creators = await this.creators.listCreators();
    return { creators };
  }

  async get(
    userId: string,
    creatorId: string,
  ): Promise<CreatorDirectoryProfile> {
    await this.requireBrand(userId);
    const creator = await this.creators.getCreator(creatorId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }
    return creator;
  }

  async listFavorites(
    userId: string,
  ): Promise<{ favoriteCreatorIds: string[] }> {
    await this.requireBrand(userId);
    const favoriteCreatorIds = await this.creators.listFavoriteIds(userId);
    return { favoriteCreatorIds };
  }

  async addFavorite(
    userId: string,
    creatorId: string,
  ): Promise<{ favoriteCreatorIds: string[] }> {
    await this.requireBrand(userId);
    if (!(await this.creators.creatorExists(creatorId))) {
      throw new NotFoundException('Creator not found');
    }
    await this.creators.addFavorite(userId, creatorId);
    return this.listFavorites(userId);
  }

  async removeFavorite(
    userId: string,
    creatorId: string,
  ): Promise<{ favoriteCreatorIds: string[] }> {
    await this.requireBrand(userId);
    await this.creators.removeFavorite(userId, creatorId);
    return this.listFavorites(userId);
  }

  private async requireBrand(userId: string): Promise<DirectoryUser> {
    const user = await this.creators.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    if (user.role !== 'brand') {
      throw new ForbiddenException(
        'Brand account required for the creators directory',
      );
    }
    return user;
  }
}
