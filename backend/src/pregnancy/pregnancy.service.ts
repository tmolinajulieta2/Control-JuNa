import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FamilySpace } from './pregnancy.schema';

@Injectable()
export class PregnancyService {
  constructor(
    @InjectModel(FamilySpace.name)
    private readonly familyModel: Model<FamilySpace>,
  ) {}

  async getByFamilyCode(familyCode: string) {
    const code = familyCode.toUpperCase().trim();
    let space = await this.familyModel.findOne({ familyCode: code }).exec();
    if (!space) {
      space = await this.familyModel.create({
        familyCode: code,
        pregnancy: { fum: new Date().toISOString().slice(0, 10), babyName: 'Nuestro Bebé' },
        appointments: [],
        studies: [],
        notes: [],
        reminders: [],
      });
    }
    return space;
  }

  async syncFamilyData(familyCode: string, payload: Partial<FamilySpace>) {
    const code = familyCode.toUpperCase().trim();
    return this.familyModel
      .findOneAndUpdate(
        { familyCode: code },
        { $set: payload },
        { new: true, upsert: true },
      )
      .exec();
  }

  async addStudyComment(
    familyCode: string,
    studyId: string,
    comment: { id: string; author: string; text: string; date: string },
  ) {
    const code = familyCode.toUpperCase().trim();
    return this.familyModel
      .findOneAndUpdate(
        { familyCode: code, 'studies.id': studyId },
        { $push: { 'studies.$.comments': comment } },
        { new: true },
      )
      .exec();
  }
}