import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { PregnancyService } from './pregnancy.service';

@Controller('api/pregnancy')
export class PregnancyController {
  constructor(private readonly pregnancyService: PregnancyService) {}

  @Get(':familyCode')
  getFamilySpace(@Param('familyCode') familyCode: string) {
    return this.pregnancyService.getByFamilyCode(familyCode);
  }

  @Put(':familyCode')
  syncFamilySpace(
    @Param('familyCode') familyCode: string,
    @Body() body: any,
  ) {
    return this.pregnancyService.syncFamilyData(familyCode, body);
  }

  @Post(':familyCode/studies/:studyId/comments')
  addComment(
    @Param('familyCode') familyCode: string,
    @Param('studyId') studyId: string,
    @Body() comment: { id: string; author: string; text: string; date: string },
  ) {
    return this.pregnancyService.addStudyComment(familyCode, studyId, comment);
  }
}