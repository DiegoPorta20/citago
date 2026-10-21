import { Injectable } from '@nestjs/common';
import { v7 as uuidV7 } from 'uuid';

import { IdGenerator } from '../application/ports/id-generator.port.js';

@Injectable()
export class UuidV7IdGenerator extends IdGenerator {
  generate(): string {
    return uuidV7();
  }
}
