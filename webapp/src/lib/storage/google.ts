import { Storage } from '@google-cloud/storage';

import StorageProvider from './provider';
import { createLogger } from 'utils/logger';

const log = createLogger('webapp:storage:google');

class GoogleStorageProvider extends StorageProvider {
	#storageClient: any;

	constructor() {
		super();
		const options: any = { projectId: process.env.PROJECT_ID };
		if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
			options['keyFilename'] = process.env.GOOGLE_APPLICATION_CREDENTIALS;
		}
		this.#storageClient = new Storage(options);
	}

	async init() {
		// this.createBucket();
	}

	async createBucket(bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME, options = {}) {
		try {
			const [bucket] = await this.#storageClient.createBucket(bucketName, {
				location: process.env.GCS_BUCKET_LOCATION,
				autoclass: {
					enabled: true,
					terminalStorageClass: 'NEARLINE'
				},
				...options
			});
			log.info(`GCS Bucket ${bucket.name} created.`);
			return bucket;
		} catch (e) {
			if (e.code === 409) {
				return log.warn(`Warning when creating GCS bucket: ${e.message}`);
			}
			log.error(`Failed to create GCS bucket: ${e.message}`);
			throw e;
		}
	}

	//Note: local file/assets just have an internal buffer, so we can probably remove this and use uploadBuffer everywhere
	async uploadLocalFile(filename, uploadedFile, contentType, isPublic = false): Promise<any> {
		log.info('Uploading file %s', filename);
		const file = this.#storageClient
			.bucket(
				isPublic === true
					? process.env.NEXT_PUBLIC_GCS_BUCKET_NAME
					: process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_PRIVATE
			)
			.file(filename);
		try {
			await file.save(uploadedFile.data, {
				metadata: {
					contentType
				}
			});
			log.info('File uploaded successfully.');
			if (isPublic) {
				await file.makePublic();
			}
		} catch (err) {
			log.error('File upload error:', err);
			throw err;
		}
	}

	async cloneFile(
		sourceFilename: string,
		destinationFilename: string,
		isPublic = false
	): Promise<any> {
		log.info('Cloning file from %s to %s', sourceFilename, destinationFilename);
		const bucket = this.#storageClient.bucket(
			isPublic === true
				? process.env.NEXT_PUBLIC_GCS_BUCKET_NAME
				: process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_PRIVATE
		);
		const sourceFile = bucket.file(sourceFilename);
		const destinationFile = bucket.file(destinationFilename);

		try {
			await sourceFile.copy(destinationFile);
			log.info('File cloned successfully from %s to %s', sourceFilename, destinationFilename);

			// Optionally make the cloned file public if needed
			if (isPublic) {
				await destinationFile.makePublic();
			}

			return destinationFile;
		} catch (err) {
			log.error('File clone error:', err);
			throw err;
		}
	}

	async uploadBuffer(
		filename: string,
		content: Buffer,
		contentType: string,
		isPublic = false
	): Promise<any> {
		log.info('Uploading buffer to file %s', filename);
		const file = this.#storageClient
			.bucket(
				isPublic === true
					? process.env.NEXT_PUBLIC_GCS_BUCKET_NAME
					: process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_PRIVATE
			)
			.file(filename);
		try {
			await file.save(content, {
				metadata: {
					contentType
				}
			});
			log.info('Buffer uploaded successfully.');
			if (isPublic) {
				await file.makePublic();
			}
		} catch (err) {
			log.error('Buffer upload error:', err);
			throw err;
		}
	}

	async deleteFile(filename: string, isPublic = false): Promise<any> {
		log.info('Deleting file %s', filename);
		const file = this.#storageClient
			.bucket(
				isPublic === true
					? process.env.NEXT_PUBLIC_GCS_BUCKET_NAME
					: process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_PRIVATE
			)
			.file(filename);
		await file.delete({});
	}

	getBasePath(isPublic = true) {
		return `https://storage.googleapis.com/${
			isPublic
				? process.env.NEXT_PUBLIC_GCS_BUCKET_NAME
				: process.env.NEXT_PUBLIC_GCS_BUCKET_NAME_PRIVATE
		}`;
	}
}

export default new GoogleStorageProvider();
