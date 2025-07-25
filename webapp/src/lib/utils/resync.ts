import { syncDatasourceApi } from 'controllers/datasource';
import { getAccountById } from 'db/account';
import { getAllDatasources } from 'db/datasource';
import { getOrgById } from 'db/org';
import { createLogger } from 'utils/logger';

const log = createLogger('webapp:utils:resync');

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

export async function resyncAllDatasources() {
	log.info('process.env.FORCE_RESYNC_ALL_DATASOURCES:', process.env.FORCE_RESYNC_ALL_DATASOURCES);

	if (process.env.FORCE_RESYNC_ALL_DATASOURCES?.toLowerCase() !== 'true') {
		return;
	}

	log.info('resyncing all datasources...');

	// Fetch all datasources in the system
	const allDatasources = await getAllDatasources({
		connectionId: {
			$ne: null
		}
	});

	for (const datasource of allDatasources) {
		// Fetch the organization by orgId
		const org = await getOrgById(datasource.orgId);
		if (!org) {
			log.info(`Org not found for datasource: ${datasource._id}`);
			continue;
		}

		// Fetch the owner account by org.ownerId
		const account = await getAccountById(org.ownerId);
		if (!account) {
			log.info(`Account not found for org: ${org._id}`);
			continue;
		}

		// Mock req, res, and next for syncDatasourceApi
		const mockReq = {
			params: {
				resourceSlug: datasource.teamId.toString(),
				datasourceId: datasource._id.toString()
			},
			body: {}
		};

		const mockRes = {
			locals: {
				subscription: org.stripe,
				matchingOrg: org,
				account: account
			}
		};

		const mockNext = () => {}; // No-operation next function

		// Sync the datasource
		try {
			await syncDatasourceApi(mockReq, mockRes, mockNext);
			log.info(`Successfully synced datasource: ${datasource._id}`);
		} catch (error) {
			log.error(`Failed to sync datasource: ${datasource._id}`, error);
		}
	}
}
