import { formatDuration, intervalToDuration } from 'date-fns';

type FormatDurationOptions = Parameters<typeof formatDuration>[1];

export const formatIntervalAsDuration = (
  interval: Interval,
  options?: FormatDurationOptions,
) => formatDuration(intervalToDuration(interval), options);

/**
 * Convert string to Base64
 *
 * @param str Base string to convert
 * @param encoding Specific encoding
 *
 * @returns Base64
 */
export const stringToB64 = (
  str: string,
  encoding: 'base64' | 'base64url' = 'base64',
) => Buffer.from(str).toString(encoding);

/**
 * Convert Base46 to string
 *
 * @param b64 Base base64 to convert
 * @param encoding Specific encoding
 *
 * @returns String
 */
export const b64ToString = (
  b64: string,
  encoding: 'base64' | 'base64url' = 'base64',
) => Buffer.from(b64, encoding).toString();
