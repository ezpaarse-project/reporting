import config from 'config';
import type defaultConfig from '../config/default.json';

export type Config = typeof defaultConfig;
export default {
  util: config.util,
  // TODO: Include full path like `a.b.c.d`
  get: <K extends keyof Config>(property: K): Config[K] => config.get(property),
  has: <K extends keyof Config>(property: K): boolean => config.has(property),
};