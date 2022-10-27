import type { Task } from '@prisma/client';
import { format } from 'date-fns';
import type { ImageOptions } from 'jspdf';
import { join } from 'path';
import testLayout from '../layouts/test';
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
  dataOpts: any = {}, // TODO: any ??
): Promise<void> => {
  try {
    const doc = await initDoc(opts);

    /**
     * Base options for adding images with jsPDF
     */
    const baseImageOptions: Omit<ImageOptions, 'imageData'> = {
      x: doc.margin.left,
      y: doc.offset.top,
      width: doc.width - doc.margin.left - doc.margin.right,
      height: doc.height - doc.offset.top - doc.offset.bottom,
    };

    // eslint-disable-next-line no-restricted-syntax
    for (const figure of layout) {
      // eslint-disable-next-line no-await-in-loop
      await addPage();

      // eslint-disable-next-line no-await-in-loop
      const figParams = await figure(opts, dataOpts);

      if (isFigureTable(figParams)) {
        // eslint-disable-next-line no-await-in-loop
        await addTable(doc, figParams.data, figParams.params);
      } else {
        // Creating figure
        const fig = createVegaView(
          createVegaLSpec(figParams.type, figParams.data, {
            width: baseImageOptions.width,
            height: baseImageOptions.height,
            ...figParams.params,
          }),
        );
        // Adding figure to pdf
        // eslint-disable-next-line no-await-in-loop
        await addVega(doc, fig, baseImageOptions);
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
  const targets = task.targets.filter((email) => email !== '');
  if (targets.length <= 0) {
    return { success: false, content: "Targets can't be null" };
  }

  const today = new Date();
  // reporting_ezMESURE_6eaa7170-4e56-11eb-8139-2d9f91b04e27_07-10-2022.pdf
  const filename = `reporting_ezMESURE_${normaliseFilename(task.name)}_${format(today, 'dd-MM-yyyy')}.pdf`;
  const period = calcPeriod(today, task.recurrence);

  await generatePdfWithVega(
    testLayout, // TODO: use task layout. define layout as JSON
    {
      name: task.name,
      path: join(rootPath, outDir, filename),
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

  // TODO : email

  if (writeHistory) {
    await addTaskHistory(task.id, { type: 'generation', message: `Rapport "${filename}" généré par ${origin}` });
  }

  return {
    success: true,
    content: {},
  };
};

export const a = 1;
