'use strict';

process.on('uncaughtException', console.error).on('unhandledRejection', console.error);

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import * as db from 'db/index';
import { migrate } from 'db/migrate';
import debug from 'debug';
import * as redis from 'lib/redis/redis';
import { Job } from 'bullmq';
import { Worker } from 'queue/bull';
import { createLogger } from 'utils/logger';
import { client as redisClient } from 'redis/redis';

const log = createLogger('sync-server:worker');

async function handleJob(job: Job) {
	log.info('Job received:', job.id, job.name, job.data);
	//NOTE: UNUSED CURRENTLY
	return;
}

async function main() {
	await db.connect();
	await migrate();
	const gracefulStop = () => {
		log.info('SIGINT SIGNAL RECEIVED');
		db.client().close();
		redis.close();
		process.exit(0);
	};
	process.on('SIGINT', gracefulStop);
	process.on('message', message => message === 'shutdown' && gracefulStop());
	if (typeof process.send === 'function') {
		log.info('SENT READY SIGNAL TO PM2');
		process.send('ready');
	}
	const worker = new Worker('vector_limit_check', handleJob, {
		connection: redisClient
	});
}

main();
