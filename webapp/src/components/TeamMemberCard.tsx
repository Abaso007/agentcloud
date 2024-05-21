import * as API from '@api';
import { PencilIcon,TrashIcon } from '@heroicons/react/20/solid';
import InviteForm from 'components/InviteForm';
import { useAccountContext } from 'context/account';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Permissions from 'permissions/permissions';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

export default function TeamMemberCard({ team, member, callback }) {

	const [accountContext]: any = useAccountContext();
	const { csrf, permissions } = accountContext as any;
	const router = useRouter();
	const { resourceSlug } = router.query;

	async function deleteMember(e) {
		e.preventDefault();
		await API.deleteFromTeam({resourceSlug, _csrf: csrf, memberId: member._id}, () => {
			toast.success(`Team member ${member.name} removed`);
			callback && callback();
		}, (res) => {
			toast.error(res);
		}, null);
	}

	const isOwner = member?._id?.toString() === (team && team[0].ownerId?.toString());

	return (
		<div className='p-4 max-w-sm bg-white rounded-lg border border-gray-200 shadow-md'>
			<p className='mb-2 font-bold tracking-tight text-gray-900 flex space-x-4'>
				<span>{member.name}</span>
				{permissions.get(Permissions.EDIT_TEAM_MEMBER) && <Link href={`/${resourceSlug}/team/${member._id}/edit`}>
					<PencilIcon className='h-5 w-5 text-gray-400 dark:text-white' aria-hidden='true' />
				</Link>}
			</p>
			<p className='mb-3 font-normal text-sm text-gray-700'>{member.email}</p>
			<div className='flex space-x-4 space-between w-full relative'>
				<span className={`px-3 py-1 text-sm font-semibold text-white rounded-full ${isOwner || member.emailVerified ? 'bg-green-500' : 'bg-yellow-500'}`}>
					{isOwner || member.emailVerified ? 'Active' : 'Pending'}
				</span>
				{team && !isOwner && permissions.get(Permissions.REMOVE_TEAM_MEMBER) && <button type='button' onClick={deleteMember}
					className='rounded-full bg-indigo-600 p-1 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 absolute right-0 h-full'
				>
					<TrashIcon className='h-5 w-5' aria-hidden='true' />
					<span className='tooltip z-100'>
						<span className='tooltiptext capitalize !w-[120px] !-ml-[60px]'>
							Edit permissions
						</span>
					</span>
				</button>}
			</div>
		</div>
	);

};
