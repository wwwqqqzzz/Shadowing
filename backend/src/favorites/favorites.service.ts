import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favRepo: Repository<Favorite>,
  ) {}

  async addFavorite(userId: string, materialId: string) {
    const existing = await this.favRepo.findOne({
      where: { user: { id: userId }, material: { id: materialId } },
    });
    if (existing) throw new ConflictException('Already favorited');
    const fav = this.favRepo.create({
      user: { id: userId } as any,
      material: { id: materialId } as any,
    });
    return this.favRepo.save(fav);
  }

  async removeFavorite(userId: string, materialId: string) {
    const fav = await this.favRepo.findOne({
      where: { user: { id: userId }, material: { id: materialId } },
    });
    if (fav) await this.favRepo.remove(fav);
    return { success: true };
  }

  async getMyFavorites(userId: string) {
    const favs = await this.favRepo.find({
      where: { user: { id: userId } },
      relations: { material: true },
      order: { createdAt: 'DESC' },
    });
    return favs.map(f => f.material);
  }

  async isFavorited(userId: string, materialId: string): Promise<boolean> {
    const fav = await this.favRepo.findOne({
      where: { user: { id: userId }, material: { id: materialId } },
    });
    return !!fav;
  }

  async getFavoritedIds(userId: string, materialIds: string[]): Promise<Set<string>> {
    if (materialIds.length === 0) return new Set();
    const favs = await this.favRepo.find({
      where: materialIds.map(id => ({ user: { id: userId }, material: { id } })),
    });
    return new Set(favs.map(f => (f.material as any).id));
  }
}