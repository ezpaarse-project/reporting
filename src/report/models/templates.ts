import { Prisma } from '@prisma/client';
import Joi from 'joi';
import type { Fetchers } from '../lib/generators/fetchers';
import renderers, { type Renderers } from '../lib/generators/renderers';
import glob from '../lib/glob';
import { ArgumentError } from '../types/errors';
import { layoutSchema, NewLayout } from './layouts';

/**
 * Template is the report
 *
 *  This interface describe a template in a template file (not in a task's `template` property)
 */
export interface NewTemplate<
 R extends keyof Renderers,
 F extends keyof Fetchers,
> {
  /**
  * Layouts that compose the template
  *
  * @see {NewLayout} for more info
  */
  layouts: NewLayout<F>[]
  /**
  * Options passed to the fetcher.
  *
  * Overrided by layouts `fetchOptions`.
  * Overrided by default `fetchOptions`.
  *
  * @see {fetchers} For more info
  */
  fetchOptions?: NewLayout<F>['fetchOptions'],
  /**
  * Name of the renderer
  *
  * @see {renderers} For more info
  */
  renderer?: R,
  /**
  * Options passed to the renderer.
  *
  * Overrided by default `rendererOptions`.
  *
  * @see {renderers} For more info
  */
  renderOptions?: |
  Omit<GeneratorParam<Renderers, R>, 'layouts' | 'pdf'> &
  { pdf: Omit<GeneratorParam<Renderers, R>['pdf'], 'period'> },
}

export type AnyTemplate = NewTemplate<keyof Renderers, keyof Fetchers>;

export const templateSchema = Joi.object<AnyTemplate>({
  layouts: Joi.array().items(layoutSchema).required(),
  fetchOptions: Joi.object(),
  renderer: Joi.string().allow(...Object.keys(renderers)),
  renderOptions: Joi.object(),
});

/**
 * Check if input data is a template file
 *
 * @param data The input data
 * @returns `true` if valid
 *
 * @throws If not valid
 */
export const isNewTemplate = (data: unknown): data is AnyTemplate => {
  const validation = templateSchema.validate(data, {});
  if (validation.error != null) {
    throw new ArgumentError(`Template is not valid: ${validation.error.message}`);
  }
  return true;
};

/**
* The interface describe options allowed in Task's
*/
export interface NewTemplateDB<F extends keyof Fetchers> {
  /**
  * Base template file
  */
  extends: string
  /**
  * Options passed to the fetcher.
  *
  * Overrided by layouts `fetchOptions`.
  * Overrided by function `fetchOptions`.
  *
  * @see {fetchers} For more info
  */
  fetchOptions?: NewLayout<F>['fetchOptions'],
  /**
  * Additional layouts
  *
  * @see {NewLayout} for more info
  */
  inserts?: (NewLayout<F> & { at: number })[]
}

export type AnyTemplateDB = NewTemplateDB<keyof Fetchers>;

const templateDBSchema = Joi.object<AnyTemplateDB>({
  extends: Joi.string().required(),
  fetchOptions: Joi.object(),
  inserts: Joi.array().items(
    layoutSchema.append({
      at: Joi.number(),
    }),
  ),
});

/**
 * Check if input data is a task's template
 *
 * @param data The input data
 * @returns `true` if valid
 *
 * @throws If not valid
 */
export const isNewTemplateDB = (data: unknown): data is AnyTemplateDB => {
  const validation = templateDBSchema.validate(data, {});
  if (validation.error != null) {
    throw new ArgumentError(`Template is not valid: ${validation.error.message}`);
  }
  return true;
};
