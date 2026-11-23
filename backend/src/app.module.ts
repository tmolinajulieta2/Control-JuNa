import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PregnancyController } from './pregnancy/pregnancy.controller';
import { PregnancyService } from './pregnancy/pregnancy.service';
import { FamilySpace, FamilySpaceSchema } from './pregnancy/pregnancy.schema';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/dulce_espera',
    ),
    MongooseModule.forFeature([
      { name: FamilySpace.name, schema: FamilySpaceSchema },
    ]),
  ],
  controllers: [AppController, PregnancyController],
  providers: [AppService, PregnancyService],
})
export class AppModule {}