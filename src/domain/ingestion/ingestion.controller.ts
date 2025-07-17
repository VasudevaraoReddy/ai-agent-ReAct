import { Controller, Get, Post } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Get('load-recommendations')
  async loadRecommendations() {
    return this.ingestionService.loadRecommendations();
  }

  @Get('create-indices')
  async createIndices() {
    return this.ingestionService.createIndices();
  }
}
