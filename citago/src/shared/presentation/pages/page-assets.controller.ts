import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { Public } from '../decorators/public.decorator.js';
import { PAGE_CSS } from './page-styles.js';
import { sendPage } from './send-page.js';

/** The stylesheet every hosted page links to (`pages.css`, next to the pages). */
@ApiExcludeController()
@Public()
@Controller('pages')
export class PageAssetsController {
  @Get('pages.css')
  styles(@Res() response: Response): void {
    sendPage(response, 'css', PAGE_CSS);
  }
}
