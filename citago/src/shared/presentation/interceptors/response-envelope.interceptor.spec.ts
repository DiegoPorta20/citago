import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { buildPage } from '../../application/pagination.js';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor();
  const context = {} as ExecutionContext;

  const run = (value: unknown) => {
    const handler: CallHandler = { handle: () => of(value) };

    return firstValueFrom(interceptor.intercept(context, handler));
  };

  it('wraps a single resource in { data, meta }', async () => {
    await expect(run({ id: 'client-1', name: 'Ana' })).resolves.toEqual({
      data: { id: 'client-1', name: 'Ana' },
      meta: {},
    });
  });

  it('unwraps a page into data plus pagination meta', async () => {
    const page = buildPage([{ id: 'a' }, { id: 'b' }], 42, {
      page: 2,
      limit: 20,
    });

    await expect(run(page)).resolves.toEqual({
      data: [{ id: 'a' }, { id: 'b' }],
      meta: { page: 2, limit: 20, total: 42, totalPages: 3 },
    });
  });

  it('wraps a plain array without inventing pagination meta', async () => {
    await expect(run([1, 2, 3])).resolves.toEqual({
      data: [1, 2, 3],
      meta: {},
    });
  });

  it('leaves an empty response untouched so 204 stays empty', async () => {
    await expect(run(undefined)).resolves.toBeUndefined();
  });

  it('wraps null as data null', async () => {
    await expect(run(null)).resolves.toEqual({ data: null, meta: {} });
  });
});
