import type { Task } from '@prisma/client';
import { format } from 'date-fns';
import { mkdir, writeFile } from 'fs/promises';
import { merge } from 'lodash';
import { join } from 'path';
import config from '../lib/config';
import {
  addPage,
  deleteDoc,
  initDoc,
  renderDoc,
  type PDFReportOptions
} from '../lib/pdf';
import { addTable } from '../lib/pdf/table';
import { calcPeriod } from '../lib/recurrence';
import {
  addVega,
  createVegaLSpec,
  createVegaView,
  isFigureTable,
  type LayoutVegaFigure
} from '../lib/vega';
import { addTaskHistory } from './tasks';

const rootPath = config.get('rootPath');
const { outDir } = config.get('pdf');

// TODO[feat]: Md for text
// TODO[feat]: Metrics type

/**
 * Put filename in lowercase & remove chars that can cause issues.
 *
 * @param filename The original filename
 *
 * @returns The normalized filename
 */
const normaliseFilename = (filename: string): string => filename.toLowerCase().replace(/[/ .]/g, '-');

/**
 * Generate PDF report with Vega
 *
 * @param layout The layout of the report
 * @param opts The options passed to the PDF Document
 * @param dataOpts Data options (usually filters and elastic inde)
 */
const generatePdfWithVega = async (
  layout: LayoutVegaFigure,
  opts: PDFReportOptions,
  dataOpts: any = {},
): Promise<void> => {
  try {
    const doc = await initDoc(opts);

    const viewport = {
      x: doc.margin.left,
      y: doc.offset.top,
      width: doc.width - doc.margin.left - doc.margin.right,
      height: doc.height - doc.offset.top - doc.offset.bottom,
    };

    const slots = [
      {
        x: viewport.x,
        y: viewport.y,
        width: (viewport.width / 2) - (doc.margin.left / 2),
        height: (viewport.height / 2) - (doc.margin.top / 2),
      },
      {
        x: viewport.x + viewport.width / 2 + (doc.margin.left / 2),
        y: viewport.y,
        width: (viewport.width / 2) - (doc.margin.left / 2),
        height: (viewport.height / 2) - (doc.margin.top / 2),
      },
      {
        x: viewport.x,
        y: viewport.y + viewport.height / 2 + (doc.margin.top / 2),
        width: (viewport.width / 2) - (doc.margin.left / 2),
        height: (viewport.height / 2) - (doc.margin.top / 2),
      },
      {
        x: viewport.x + viewport.width / 2 + (doc.margin.left / 2),
        y: viewport.y + viewport.height / 2 + (doc.margin.top / 2),
        width: (viewport.width / 2) - (doc.margin.left / 2),
        height: (viewport.height / 2) - (doc.margin.top / 2),
      },
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const page of layout) {
      // eslint-disable-next-line no-await-in-loop
      await addPage();

      // eslint-disable-next-line no-await-in-loop
      let figures = await page(opts, dataOpts);
      if (!Array.isArray(figures)) figures = [figures];

      const figuresCount = Math.min(figures.length, slots.length);

      for (let i = 0; i < figuresCount; i += 1) {
        const figure = figures[i];
        const slot = { ...slots[i] };

        // If only one figure, take whole viewport
        if (figuresCount === 1) {
          slot.width = viewport.width;
          slot.height = viewport.height;
        }

        // If no second row, take whole height
        if (figuresCount <= slots.length - 2) {
          slot.height = viewport.height;
        }

        // If in penultimate slot and last figure, take whole remaining space
        if (i === slots.length - 2 && i === figuresCount - 1) {
          slot.width += slots[i + 1].width;
          slot.height += slots[i + 1].height;
        }

        if (isFigureTable(figure)) {
          // Print table
          const margin: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>> = {};
          figure.params.tableWidth = slot.width;

          if (slot.x !== viewport.x) {
            margin.left = slot.x;
          }

          if (slot.y !== viewport.y) {
            figure.params.startY = slot.y;
          }

          figure.params.maxHeight = slot.height;

          // eslint-disable-next-line no-await-in-loop
          await addTable(doc, figure.data, merge(figure.params, { margin }));
        } else {
          // Creating Vega view
          const view = createVegaView(
            createVegaLSpec(figure.type, figure.data, {
              ...figure.params,
              width: slot.width,
              height: slot.height,
            }),
          );
          // Adding view to pdf
          // eslint-disable-next-line no-await-in-loop
          await addVega(doc, view, slot);
        }
      }
    }

    await renderDoc();
  } catch (error) {
    await deleteDoc();
    throw error;
  }
};

/**
 * Generate report
 *
 * @param task The task to generate
 * @param origin The origin of the generation (can be username, or method (auto, etc.))
 * @param writeHistory Should write generation in task history
 *
 * @returns ...
 */
export const generateReport = async (task: Task, origin: string, writeHistory = true) => {
  const today = new Date();
  const todayStr = format(today, 'yyyy/yyyy-MM');
  const basePath = join(rootPath, outDir, todayStr, '/');
  // TODO[feat]: unique id to avoid file overriding
  const filename = `reporting_ezMESURE_${normaliseFilename(task.name)}`;

  let result: any = {
    success: true,
    detail: {
      task: task.id,
      files: {
        detail: `${todayStr}/${filename}.json`,
      },
    },
  };

  await mkdir(basePath, { recursive: true });

  try {
    const targets = task.targets.filter((email) => email !== '');
    if (targets.length <= 0) {
      throw new Error("Targets can't be null");
    }

    const period = calcPeriod(new Date(2021, 9, 31, 12), task.recurrence);
    // const period = calcPeriod(today, task.recurrence);
    // TODO[feat]: define layout as JSON. Use JOI
    let baseLayout = [];
    if (typeof task.layout === 'object' && (task.layout as any).extends) {
      baseLayout = (await import(`../layouts/${(task.layout as any).extends}`)).default;
    }

    await generatePdfWithVega(
      baseLayout,
      {
        name: task.name,
        path: join(basePath, `${filename}.pdf`),
        period,
      },
      {
        index: 'bibcnrs-*-2021',
        filters: {
          must_not: [
            {
              match_phrase: {
                mime: {
                  query: 'XLS',
                },
              },
            },
            {
              match_phrase: {
                mime: {
                  query: 'DOC',
                },
              },
            },
            {
              match_phrase: {
                mime: {
                  query: 'MISC',
                },
              },
            },
            {
              match_phrase: {
                index_name: {
                  query: 'bibcnrs-insb-dcm00',
                },
              },
            },
            {
              match_phrase: {
                index_name: {
                  query: 'bibcnrs-insb-dcm30',
                },
              },
            },
            {
              match_phrase: {
                index_name: {
                  query: 'bibcnrs-insb-dcm10',
                },
              },
            },
            {
              match_phrase: {
                index_name: {
                  query: 'bibcnrs-insb-anonyme',
                },
              },
            },
          ],
        },
      },
    );

    if (writeHistory) {
      await addTaskHistory(task.id, { type: 'generation-success', message: `Rapport "${todayStr}/${filename}" généré par ${origin}` });
    }

    result = merge(
      result,
      {
        detail: {
          files: { report: `${todayStr}/${filename}.pdf` },
          writedTo: targets,
          period,
        },
      },
    );
  } catch (error) {
    if (writeHistory) {
      await addTaskHistory(task.id, { type: 'generation-error', message: `Rapport "${todayStr}/${filename}" non généré par ${origin} suite à une erreur` });
    }

    result = merge(
      result,
      {
        success: false,
        detail: {
          error: (error as Error).message,
        },
      },
    );
  }
  await writeFile(join(basePath, `${filename}.json`), JSON.stringify(result), 'utf-8');
  return result;
};
