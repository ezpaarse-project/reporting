import type Queue from 'bull';
import { endOfDay, isBefore, isSameDay } from 'date-fns';
import type { CronData } from '..';
import { getAllTasks } from '../../../models/tasks';
import { addTaskToQueue } from '../../bull';
import apm from '../../elastic/apm'; // Setup Elastic's APM for monitoring
import logger from '../../logger';
import { formatInterval } from '../../utils';
import { sendError } from './utils';

export default async (job: Queue.Job<CronData>) => {
  const start = new Date();
  logger.debug(`[cron] [${job.name}] Started`);

  const apmtrans = apm.startTransaction(job.name, 'cron');
  if (!apmtrans) {
    logger.warn(`[cron] [${job.name}] Can't start APM transaction`);
  }

  try {
    const tasks = await getAllTasks({ filter: { enabled: true } });
    // Getting end of today, to ignore hour of task's nextRun
    const today = endOfDay(start);

    const { length } = await Promise.all(
      tasks.map(
        async (task, i, arr) => {
          if (isSameDay(task.nextRun, today)) {
            await addTaskToQueue({ task, origin: 'daily-cron-job' });
          } else if (isBefore(task.nextRun, today)) {
            logger.warn(`[cron] [${job.name}] Task "${task.id}" have a "nextRun" before today. Skipping it.`);
          }
          await job.progress(i / arr.length);
        },
      ),
    );

    const dur = formatInterval({ start, end: new Date() });
    logger.info(`[cron] [${job.name}] Generated ${length} report(s) in ${dur}s`);
    apmtrans?.end('success');
  } catch (error) {
    const dur = formatInterval({ start, end: new Date() });
    logger.error(`[cron] Job ${job.name} failed in ${dur}s with error: ${(error as Error).message}`);
    apmtrans?.end('error');
    await sendError(error as Error, 'index', job.data.timer);
  }
};
