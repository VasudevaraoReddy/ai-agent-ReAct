import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()  
  runWorkflow(@Body() body:   {
    user_input: string,
    conversation_id: string,
    formData:any,
    userId:string,
    csp:string
  }) {
    return this.appService.runWorkflow({
      user_input: body.user_input,
      conversation_id: body.conversation_id,
      formData: body.formData,
      userId: body.userId,
      csp: body.csp
    });
  }

  @Get('get-conversation/:userId/:conversationId')
  getConversation(@Param('userId') userId: string, @Param('conversationId') conversationId: string) {
    return this.appService.getConversation(userId, conversationId);
  }
}
