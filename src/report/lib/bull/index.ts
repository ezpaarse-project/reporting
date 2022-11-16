import type { Task } from '@prisma/client';
import Queue, { type Job } from 'bull';
import { StatusCodes } from 'http-status-codes';
import { join } from 'path';
import { HTTPError } from '../../types/errors';
import config from '../config';
import logger from '../logger';

const { concurrence, ...redis } = config.get('redis');

export type GenerationData = {
  task: Task,
  origin: string,
  writeHistory?: boolean,
  debug?: boolean
};

const generationQueue = new Queue<GenerationData>('report generation', { redis });

generationQueue.on('failed', (job, err) => {
  if (job.attemptsMade === job.opts.attempts) {
    logger.error(`[bull] ${err.message}`);
  }
});

generationQueue.process(concurrence, join(__dirname, 'jobs/generateReport.ts'));

const queues = {
  generation: generationQueue,
};

export const queuesNames = Object.keys(queues);

type Queues = keyof typeof queues;

/**
 * Check if given name is a valid queue name
 *
 * @param name Given name
 *
 * @returns Given name is a valid queue name
 */
const isQueue = (name: string): name is Queues => queuesNames.includes(name);

/**
 * Add task to generation queue
 *
 * @param task The task
 * @param origin The origin of the generation (can be username, or method (auto, etc.))
 * @param writeHistory Should write generation in task history (also disable first level of debug)
 * @param debug Enable second level of debug
 *
 * @returns When task is placed in queue
 */
export const addTaskToQueue = (
  task: Task,
  origin: string,
  writeHistory = true,
  debug = false,
) => queues.generation.add({
  task, origin, writeHistory, debug,
});

/**
 * Format bull job
 *
 * @param job bull job
 *
 * @returns formated job
 */
const formatJob = async (job: Job<GenerationData>) => ({
  id: job.id,
  data: job.data,
  progress: job.progress(),
  added: new Date(job.timestamp),
  started: job.processedOn && new Date(job.processedOn),
  ended: job.finishedOn && new Date(job.finishedOn),
  attemps: job.attemptsMade + 1,
  status: await job.getState(),
});

/**
 * Pause the whole queue
 *
 * @param queue The queue name
 *
 * @throw If queue not found
 *
 * @returns When the queue is paused
 */
export const pauseQueue = (queue: string) => {
  if (!isQueue(queue)) {
    // TODO[refactor]: Not an HTTP Error at this point
    throw new HTTPError(`Queue "${queue}" not found`, StatusCodes.NOT_FOUND);
  }
  return queues[queue].pause();
};

/**
 * Resume the whole queue
 *
 * @param queue The queue name
 *
 * @throw If queue not found
 *
 * @returns When the queue is resumed
 */
export const resumeQueue = (queue: string) => {
  if (!isQueue(queue)) {
    // TODO[refactor]: Not an HTTP Error at this point
    throw new HTTPError(`Queue "${queue}" not found`, StatusCodes.NOT_FOUND);
  }
  return queues[queue].resume();
};

// TODO[feat]: pagination
/**
 * Get info about specific queue
 *
 * @param queue The queue name
 *
 * @throw If queue not found
 *
 * @returns The queue info
 */
export const getJobs = async (queue: string) => {
  if (!isQueue(queue)) {
    // TODO[refactor]: Not an HTTP Error at this point
    throw new HTTPError(`Queue "${queue}" not found`, StatusCodes.NOT_FOUND);
  }

  const rawJobs = await queues[queue].getJobs(['active', 'delayed', 'paused', 'waiting']);
  return {
    status: await queues[queue].isPaused() ? 'paused' : 'active',
    jobs: await Promise.all(rawJobs.map(formatJob)),
  };
};

/**
 * Get info about specific job
 *
 * @param queue The queue name
 * @param id The job id
 *
 * @throw If queue not found
 *
 * @returns The job info
 */
export const getJob = async (queue: string, id: string) => {
  if (!isQueue(queue)) {
    // TODO[refactor]: Not an HTTP Error at this point
    throw new HTTPError(`Queue "${queue}" not found`, StatusCodes.NOT_FOUND);
  }

  const job = await queues[queue].getJob(id);
  if (!job) {
    return null;
  }

  return formatJob(job);
};

/**
 * Retry job that failed
 *
 * @param queue The queue name
 * @param id The job id
 *
 * @throw If job wasn't failed
 * @throw If queue not found
 *
 * @returns The job info
 */
export const retryJob = async (queue: string, id: string) => {
  if (!isQueue(queue)) {
    // TODO[refactor]: Not an HTTP Error at this point
    throw new HTTPError(`Queue "${queue}" not found`, StatusCodes.NOT_FOUND);
  }

  const job = await queues[queue].getJob(id);
  if (!job) {
    return null;
  }

  await job.retry();

  return formatJob(job);
};