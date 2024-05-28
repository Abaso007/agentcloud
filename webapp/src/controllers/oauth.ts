'use strict';

import getAirbyteApi, { AirbyteApiType } from 'airbyte/api';
import debug from 'debug';
import createAccount from 'lib/account/create';
import { ObjectId } from 'mongodb';
import { OAUTH_PROVIDER, OAuthStrategy } from 'struct/oauth';

import { Account, addAccount, getAccountByOAuthOrEmail, setAccountOauth } from '../db/account';
import { addOrg } from '../db/org';
import { addTeam } from '../db/team';
const log = debug('webapp:oauth');

//To reduce some boilerplace in the router, allows us to just loop and create handlers for each service
import { Strategy as GitHubStrategy } from 'passport-github';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as HubspotStrategy } from 'passport-hubspot-oauth2';
import { Strategy as StripeStrategy } from 'passport-stripe';
export const OAUTH_STRATEGIES: OAuthStrategy[] = [
	{ strategy: GitHubStrategy, env: 'GITHUB', callback: githubCallback, path: '/auth/github/callback', extra: { scope: ['user:email'] } },
	{ strategy: GoogleStrategy, env: 'GOOGLE', callback: googleCallback, path: '/auth/google/callback', extra: { /* N/A */ } },
	{ strategy: StripeStrategy, env: 'STRIPE', callback: stripeCallback, path: '/auth/stripe/callback', extra: { /* N/A */ } },
	{ strategy: HubspotStrategy, env: 'HUBSPOT', callback: hubspotCallback, path: '/auth/hubspot/callback', extra: { /* N/A */ } },
];

export async function githubCallback(accessToken, refreshToken, profile, done) {
	log(`githubCallback profile: ${JSON.stringify(profile, null, '\t')}`);
	const emails = await fetch('https://api.github.com/user/emails', {
		headers: {
			'User-Agent': 'Agentcloud',
			'Authorization': `token ${accessToken}`,
		}
	}).then(res => res.json());
	const primaryEmail = emails.find(email => (email.primary && email.verified)).email;
	profile.provider = OAUTH_PROVIDER.GITHUB;
	profile.email = primaryEmail;
	const account: Account = await getAccountByOAuthOrEmail(profile.id, profile.provider, profile.email);
	log('githubCallback account', account);
	await createUpdateAccountOauth(account, profile.displayName, profile.email, profile.provider, profile.id);	
	done(null, profile);
}

export async function googleCallback(accessToken, refreshToken, profile, done) {
	log(`googleCallback profile: ${JSON.stringify(profile, null, '\t')}`);
	const verifiedEmail = profile.emails.find(e => e.verified === true).value;
	profile.provider = OAUTH_PROVIDER.GOOGLE;
	profile.email = verifiedEmail;
	const account: Account = await getAccountByOAuthOrEmail(profile.id, profile.provider, profile.email);
	log('googleCallback account', account);
	await createUpdateAccountOauth(account, profile.displayName, verifiedEmail, profile.provider, profile.id);
	done(null, profile);
}

export async function stripeCallback(accessToken, refreshToken, profile, done) {
	log(`stripeCallback profile: ${JSON.stringify(profile, null, '\t')}`);
	done(null, profile);
}

export async function hubspotCallback(accessToken, refreshToken, profile, done) {
	log(`hubspotCallback profile: ${JSON.stringify(profile, null, '\t')}`);
	done(null, profile);
}

export async function serializeHandler(user, done) {
	log('serializeHandler user', user);
	done(null, { oauthId: user.id, provider: user.provider });
}

export async function deserializeHandler(obj, done) {
	log('deserializeHandler obj', obj);
	const { oauthId, provider } = obj;
    // Use provider information to retrieve the user e.g.
	const account: Account = await getAccountByOAuthOrEmail(oauthId, provider, null);
	if (account) {
		const accountObj = {
			_id: account._id.toString(),
			name: account.name,
			email: account.email,
			orgs: account.orgs,
			currentOrg: account.currentOrg,
			currentTeam: account.currentTeam,
			token: account.token,
			stripe: account.stripe,
			oauth: account.oauth,
		};
		return done(null, accountObj);
	}
	done(null, null);
}

async function createUpdateAccountOauth(account, email, name, provider, profileId) {
	if (!account) {
		await createAccount(email, name || email, null, 'TEAM_MEMBER', false, provider as OAUTH_PROVIDER, profileId);
	} else {
		//existing account, check if it has the oauth ID else update it
		if (!account.oauth || !account.oauth[provider]) {
			await setAccountOauth(account._id, profileId, provider);
		}
	}
}

