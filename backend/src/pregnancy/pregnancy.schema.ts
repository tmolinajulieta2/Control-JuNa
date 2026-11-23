import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class FamilySpace extends Document {
  @Prop({ required: true, unique: true, index: true })
  familyCode: string;

  @Prop({ type: Object, required: true })
  pregnancy: {
    fum: string;
    babyName: string;
  };

  @Prop({ type: Array, default: [] })
  appointments: any[];

  @Prop({ type: Array, default: [] })
  studies: any[];

  @Prop({ type: Array, default: [] })
  notes: any[];

  @Prop({ type: Array, default: [] })
  reminders: any[];
}

export const FamilySpaceSchema = SchemaFactory.createForClass(FamilySpace);