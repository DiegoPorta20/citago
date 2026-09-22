/**
 * The wire format for money: `"25"`, `"25.5"` or `"25.00"`.
 *
 * Every amount crosses the API as a decimal **string**. A JSON number is
 * rejected on purpose: `0.1 + 0.2` is not `0.3` in floating point, and a price
 * that cannot be added up exactly is not a price.
 */
export const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
