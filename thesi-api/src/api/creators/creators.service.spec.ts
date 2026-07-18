import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type {
  CreatorDirectoryProfile,
  CreatorsDirectoryRepository,
  DirectoryUser,
} from './creators-directory.repository';
import { CreatorsService } from './creators.service';

class FakeCreatorsDirectoryRepository implements CreatorsDirectoryRepository {
  user: DirectoryUser | null = null;
  creators: CreatorDirectoryProfile[] = [];
  favorites = new Map<string, Set<string>>();

  async getUser() {
    return this.user;
  }

  async listCreators() {
    return this.creators;
  }

  async getCreator(creatorUserId: string) {
    return this.creators.find((creator) => creator.id === creatorUserId) ?? null;
  }

  async listFavoriteIds(brandUserId: string) {
    return [...(this.favorites.get(brandUserId) ?? new Set())];
  }

  async addFavorite(brandUserId: string, creatorUserId: string) {
    const set = this.favorites.get(brandUserId) ?? new Set<string>();
    set.add(creatorUserId);
    this.favorites.set(brandUserId, set);
  }

  async removeFavorite(brandUserId: string, creatorUserId: string) {
    this.favorites.get(brandUserId)?.delete(creatorUserId);
  }

  async creatorExists(creatorUserId: string) {
    return this.creators.some((creator) => creator.id === creatorUserId);
  }
}

describe('CreatorsService', () => {
  let repository: FakeCreatorsDirectoryRepository;
  let service: CreatorsService;

  beforeEach(() => {
    repository = new FakeCreatorsDirectoryRepository();
    service = new CreatorsService(repository);
    repository.creators = [sampleCreator('creator-1', 'Alex Rivera')];
  });

  it('lists creators for brands', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };

    await expect(service.list('brand-1')).resolves.toEqual({
      creators: [expect.objectContaining({ id: 'creator-1', name: 'Alex Rivera' })],
    });
  });

  it('blocks creators from the brand directory', async () => {
    repository.user = { id: 'creator-1', role: 'creator' };

    await expect(service.list('creator-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('toggles favorites for a brand', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };

    await expect(
      service.addFavorite('brand-1', 'creator-1'),
    ).resolves.toEqual({ favoriteCreatorIds: ['creator-1'] });

    await expect(
      service.removeFavorite('brand-1', 'creator-1'),
    ).resolves.toEqual({ favoriteCreatorIds: [] });
  });

  it('returns not found for unknown creators', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };

    await expect(service.get('brand-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function sampleCreator(id: string, name: string): CreatorDirectoryProfile {
  return {
    id,
    name,
    email: `${id}@creator.dev`,
    niches: ['Fitness'],
    location: 'US',
    platforms: ['TikTok'],
    followerRange: '10k+',
    bio: 'Bio',
    stats: {
      totalFollowers: 1000,
      avgViews: 2000,
      avgEngagementRate: 5,
      completedCampaigns: 1,
      responseRate: 90,
      platforms: [
        { platform: 'TikTok', followers: 1000, avgViews: 2000, engagementRate: 5 },
      ],
    },
    ugcPosts: [],
  };
}
