'use strict';

import { dynamicResponse } from '@dr';
import Permission from '@permission';
import getAirbyteApi, { AirbyteApiType } from 'airbyte/api';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import createAccount from 'lib/account/create';
import { ObjectId } from 'mongodb';
import Permissions from 'permissions/permissions';
import Roles from 'permissions/roles';
import { SubscriptionPlan } from 'struct/billing';

import { Account, changeAccountPassword, getAccountByEmail, getAccountById, setAccountPermissions, setCurrentTeam, setPlanDebug, verifyAccount } from '../db/account';
import { addVerification, getAndDeleteVerification,VerificationTypes } from '../db/verification';
import * as ses from '../lib/email/ses';

export async function accountData(req, res, _next) {
	return {
		team: res.locals.matchingTeam,
		csrf: req.csrfToken(),
	};
};

/**
 * GET /account
 * account page html
 */
export async function accountPage(app, req, res, next) {
	const data = await accountData(req, res, next);
	res.locals.data = { ...data, account: res.locals.account };
	return app.render(req, res, '/account');
}

/**
 * GET /billing
 * billing page html
 */
export async function billingPage(app, req, res, next) {
	const data = await accountData(req, res, next);
	res.locals.data = { ...data, account: res.locals.account };
	return app.render(req, res, '/billing');
}

/**
 * GET /account.json
 * account page json data
 */
export async function accountJson(req, res, next) {
	const data = await accountData(req, res, next);
	return res.json({ ...data, account: res.locals.account });
}

/**
 * @api {post} /forms/account/login Login
 * @apiName login
 * @apiGroup Account
 *
 * @apiParam {String} username Username of account.
 * @apiParam {String} password Password of account.
 */
export async function login(req, res) {

	const email = req.body.email.toLowerCase();
	const password = req.body.password;
	const account: Account = await getAccountByEmail(email);

	if (!account) {
		return dynamicResponse(req, res, 403, { error: 'Incorrect email or password' });
	}

	try {
		const passwordMatch = await bcrypt.compare(password, account.passwordHash);

		if (passwordMatch === true) {
			const token = await jwt.sign({ accountId: account._id }, process.env.JWT_SECRET); //jwt
			req.session.token = token; //jwt (cookie)
			return dynamicResponse(req, res, 302, { redirect: `/${account.currentTeam.toString()}/apps`, token });
		}
	} catch (e) {
		console.error(e);
		return dynamicResponse(req, res, 403, { error: 'Incorrect email or password' });
	}

	return dynamicResponse(req, res, 403, { error: 'Incorrect email or password' });

}

/**
 * POST /forms/account/register
 * regiser
 */
export async function register(req, res) {

	const email = req.body.email.toLowerCase();
	const name = req.body.name;
	const password = req.body.password;
	const checkoutSession = req.body.checkoutSession;

	if (!email || typeof email !== 'string' || email.length === 0 || !/^\S+@\S+\.\S+$/.test(email)
		|| !password || typeof password !== 'string' || password.length === 0
		|| (checkoutSession && (typeof checkoutSession !== 'string' || checkoutSession.length === 0))
		|| !name || typeof name !== 'string' || name.length === 0) {
		return dynamicResponse(req, res, 400, { error: 'Invalid inputs' });
	}

	const existingAccount: Account = await getAccountByEmail(email);
	if (existingAccount) {
		return dynamicResponse(req, res, 409, { error: 'Account already exists with this email' });
	}

	const { emailVerified } = await createAccount(email, name, password, checkoutSession);
	
	return dynamicResponse(req, res, 302, { redirect: emailVerified ? '/login?verifysuccess=true&noverify=1' : '/verify' });

}

/**
 * POST /forms/account/logout
 * logout
 */
export function logout(req, res) {
	req.session.destroy();
	return dynamicResponse(req, res, 302, { redirect: '/login' });
}

/**
 * POST /forms/account/requestchangepassword
 * send email with link to change password
 */
export async function requestChangePassword(req, res) {
	const { email } = req.body;
	if (!email || typeof email !== 'string' || email.length === 0 || !/^\S+@\S+\.\S+$/.test(email)) {
		return dynamicResponse(req, res, 400, { error: 'Invalid email' });
	}
	const foundAccount = await getAccountByEmail(email);
	if (foundAccount) {
		addVerification(foundAccount._id, VerificationTypes.CHANGE_PASSWORD)
			.then(verificationToken => {
				ses.sendEmail({
					from: process.env.FROM_EMAIL_ADDRESS,
					bcc: null,
					cc: null,
					replyTo: null,
					to: [email],
					subject: 'Password reset verification',
					body: `Somebody entered your email a password reset for agentcloud.

If this was you, click the link to reset your password: "${process.env.URL_APP}/changepassword?token=${verificationToken}"

If you didn't request a password reset, you can safely ignore this email.`,
				});
			});
	}
	return dynamicResponse(req, res, 302, { redirect: '/verify' });
}

/**
 * POST /forms/account/changepassword
 * change password with token from email
 */
export async function changePassword(req, res) {
	const { password, token } = req.body;
	if (!token || typeof token !== 'string') {
		return dynamicResponse(req, res, 400, { error: 'Invalid token' });
	}
	if (!password || typeof password !== 'string' || password.length === 0) {
		return dynamicResponse(req, res, 400, { error: 'Invalid inputs' });
	}
	const deletedVerification = await getAndDeleteVerification(token, VerificationTypes.CHANGE_PASSWORD);
	if (!deletedVerification || !deletedVerification.token) {
		return dynamicResponse(req, res, 400, { error: 'Invalid password reset token' });
	}
	const newPasswordHash = await bcrypt.hash(password, 12);
	await changeAccountPassword(deletedVerification.accountId, newPasswordHash);
	return dynamicResponse(req, res, 302, { redirect: '/login?changepassword=true' });
}

/**
 * POST /forms/account/verify
 * logout
 */
export async function verifyToken(req, res) {
	if (!req.body || !req.body.token || typeof req.body.token !== 'string') {
		return dynamicResponse(req, res, 400, { error: 'Invalid token' });
	}
	const deletedVerification = await getAndDeleteVerification(req.body.token, VerificationTypes.VERIFY_EMAIL);
	if (!deletedVerification || !deletedVerification.token) {
		return dynamicResponse(req, res, 400, { error: 'Invalid token' });
	}
	const foundAccount = await getAccountById(deletedVerification.accountId);
	if (!foundAccount.passwordHash) {
		const password = req.body.password;
		if (!password || typeof password !== 'string' || password.length === 0) {
			//Note: invite is invalidated at this point, but form is required so likelihood of legit issue is ~0
			return dynamicResponse(req, res, 400, { error: 'Invalid inputs' });
		}
		const newPasswordHash = await bcrypt.hash(password, 12);
		await changeAccountPassword(deletedVerification.accountId, newPasswordHash);
	}
	await verifyAccount(deletedVerification.accountId);
	return dynamicResponse(req, res, 302, { redirect: '/login?verifysuccess=true' });
}

/**
 * POST /forms/account/switchteam
 * switch teams
 */
export async function switchTeam(req, res, _next) {

	const { orgId, teamId, redirect } = req.body;
	if (!orgId || typeof orgId !== 'string'
		|| !teamId || typeof teamId !== 'string'
		|| (redirect && typeof redirect !== 'string')) {
		return dynamicResponse(req, res, 400, { error: 'Invalid inputs' });
	}

	const switchOrg = res.locals.account.orgs.find(o => o.id.toString() === orgId);
	const switchTeam = switchOrg && switchOrg.teams.find(t => t.id.toString() === teamId);
	if (!switchOrg || !switchTeam) {
		return dynamicResponse(req, res, 400, { error: 'Invalid inputs' });
	}

	await setCurrentTeam(res.locals.account._id, orgId, teamId);

	return res.json({});

}

export async function adminApi(req, res, next) {

	const { action } = req.body;

	if (Object.values(SubscriptionPlan).includes(action)) {
		setPlanDebug(res.locals.account._id, action);
	} else {
		const updatingPerms = new Permission(Roles.REGISTERED_USER.base64);
		updatingPerms.set(Permissions.ROOT, action === 'Root');
		setAccountPermissions(res.locals.account._id, updatingPerms);
	}

	return res.json({});

}
