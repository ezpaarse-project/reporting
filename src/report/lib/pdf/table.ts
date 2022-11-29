import autoTable, { type UserOptions } from 'jspdf-autotable';
import { merge } from 'lodash';
import type { PDFReport } from '.';
import logger from '../logger';

export type TableParams = {
  title: string,
  dataKey?: string,
  maxLength?: number;
  maxHeight?: number;
} & Omit<UserOptions, 'body' | 'didParseCell' | 'willDrawCell' | 'didDrawCell' | 'didDrawPage'>;

/**
 * Add table to PDF
 *
 * @param doc The PDF report
 * @param data The data
 * @param spec The params given to jspdf-autotable
 */
export const addTableToPDF = async (
  doc: PDFReport,
  data: Record<string, any[]> | any[],
  spec: TableParams,
): Promise<void> => {
  if (!Array.isArray(data)) {
    if (!spec.dataKey) {
      throw new Error('data is not iterable, and no "dataKey" is present');
    }
    // eslint-disable-next-line no-param-reassign
    data = data[spec.dataKey];
  }

  const {
    maxLength, maxHeight, title, ...params
  } = spec;
  const fontSize = 10;

  // Limit data if needed
  const tableData = [...data];
  if (maxLength != null && maxLength > 0 && tableData.length > maxLength) {
    tableData.length = maxLength;
  }

  if (maxHeight != null && maxHeight > 0) {
    // default height of a cell is 29
    // Removing title, header & some space
    const maxTableHeight = maxHeight - (1.5 * fontSize) - (2 * 29);
    const maxCells = Math.ceil(maxTableHeight / 29);
    if (tableData.length > maxCells) {
      logger.warn(`[pdf] Reducing table length from ${tableData.length} to ${maxCells} because table won't fit in slot.`);
      tableData.length = maxCells;
    }
  }

  const options = merge({
    margin: {
      right: doc.margin.right,
      left: doc.margin.left,
      bottom: doc.offset.bottom,
      top: doc.offset.top + 2 * fontSize,
    },
    styles: {
      overflow: 'ellipsize',
      minCellWidth: 100,
    },
    rowPageBreak: 'avoid',
  }, params);

  const y = +(options.startY ?? 0) || options.margin.top;

  // Table title
  doc.pdf
    .setFont('Roboto', 'bold')
    .setFontSize(fontSize)
    // TODO[feat]: handlebars
    .text(title, options.margin.left, y - 0.5 * fontSize);

  // Print table
  autoTable(doc.pdf, {
    ...options,
    body: tableData,
  });
};
