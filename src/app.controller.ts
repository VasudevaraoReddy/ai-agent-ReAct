import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { AppService } from './app.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('process-query')
  runWorkflow(
    @Body()
    body: {
      user_input: string;
      conversation_id: string;
      formData: any;
      userId: string;
      csp: string;
      userSelectedAgent: string;
    },
  ) {
    console.log('In Process query')
    return this.appService.runWorkflow({
      user_input: body.user_input,
      conversation_id: body.conversation_id,
      formData: body.formData,
      userId: body.userId,
      csp: body.csp,
      userSelectedAgent: body.userSelectedAgent,
    });
  }

  @Get('get-conversation/:userId/:conversationId')
  getConversation(
    @Param('userId') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.appService.getConversation(userId, conversationId);
  }

  @Get('conversations')
  listAllConversations() {
    return this.appService.listAllConversations();
  }

  @Get('terraform-records')
  getAllTerraformRecords() {
    const filePath = path.resolve(
      process.cwd(),
      'generated/terraform_records.json',
    );

    try {
      if (!fs.existsSync(filePath)) {
        return { message: 'No terraform records found.' };
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const records = JSON.parse(fileContent);

      return { count: records.length, records };
    } catch (err) {
      console.error('Error reading terraform records:', err);
      return {
        error: 'Failed to read terraform records',
        details: err.message,
      };
    }
  }
}
