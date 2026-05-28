import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sentence } from './entities/sentence.entity';

@Injectable()
export class SentencesService {
  constructor(
    @InjectRepository(Sentence)
    private readonly sentenceRepo: Repository<Sentence>,
  ) {}

  async findById(id: string): Promise<Sentence | null> {
    return this.sentenceRepo.findOne({ where: { id } });
  }
}
