import { Injectable } from '@nestjs/common';
import { v7 as uuidV7 } from 'uuid';

import { IdGenerator } from '../application/ports/id-generator.port.js';

/**
 * UUIDv7 identifiers: time-ordered, so InnoDB primary keys stay compact
 * instead of fragmenting the way random v4 values do.
 */
@Injectable()
export class UuidV7IdGenerator extends IdGenerator {
  generate(): string {
    return uuidV7();
  }
}
