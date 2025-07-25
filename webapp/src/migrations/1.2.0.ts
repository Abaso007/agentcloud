import { createLogger } from 'utils/logger';

const log = createLogger('webapp:migration:1.2.0');

export default async function (db) {
	log.info('Updating apps collection with new properties');
	await db.collection('apps').updateMany(
		{},
		{
			$set: {
				memory: false,
				cache: false
			}
		}
	);
	log.info('Updating datasource collection with new properties');
	await db.collection('apps').updateMany(
		{},
		{
			$set: {
				recordCount: {}
			},
			$unset: {
				syncedCount: '',
				embeddedCount: ''
			}
		}
	);

	log.info('Making all non builtin tasks require human input');
	//NOTE: we don't use libs here e.g. SubscriptionPlan.RAW because that struct could change/not be importable anymore. all has to be encapsulated
	await db.collection('apps').updateMany(
		{
			'data.builtin': false
		},
		{
			$set: {
				requiresHumanInput: true,
				retriever_type: 'raw',
				retriever_config: {} //not required for raw
			}
		}
	);
}
