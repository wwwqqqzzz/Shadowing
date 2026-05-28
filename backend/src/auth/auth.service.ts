import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Phase 1 mock login:
   * 微信 code → 固定测试 openid → 查找或创建用户 → 返回 JWT
   */
  async login(code: string) {
    // Phase 1 mock: 任意 code 都映射到同一个测试 openid
    const mockOpenid = 'mock_openid_001';

    let user = await this.userRepo.findOne({ where: { openid: mockOpenid } });
    if (!user) {
      user = this.userRepo.create({
        openid: mockOpenid,
        nickname: '测试用户',
      });
      user = await this.userRepo.save(user);
    }

    const payload = { sub: user.id, openid: user.openid };
    const token = this.jwtService.sign(payload);

    return { token, user };
  }
}
