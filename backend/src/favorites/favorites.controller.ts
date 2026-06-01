import { Controller, Post, Delete, Get, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':materialId')
  @UseGuards(AuthGuard('jwt'))
  async addFavorite(@Param('materialId') materialId: string, @Req() req) {
    return this.favoritesService.addFavorite(req.user.id, materialId);
  }

  @Delete(':materialId')
  @UseGuards(AuthGuard('jwt'))
  async removeFavorite(@Param('materialId') materialId: string, @Req() req) {
    return this.favoritesService.removeFavorite(req.user.id, materialId);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getMyFavorites(@Req() req) {
    return this.favoritesService.getMyFavorites(req.user.id);
  }
}