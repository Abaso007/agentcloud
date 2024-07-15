'use strict';

import * as API from '@api';
import { Dialog, Menu, Transition } from '@headlessui/react';
import {
	BellIcon,
} from '@heroicons/react/24/outline';
import { Notification } from 'components/Notification';
import { useNotificationContext } from 'context/notifications';
import { useRouter } from 'next/router';
import { Fragment, useState } from 'react';

import { useAccountContext } from '../context/account';

export default function NotificationBell() {

	const router = useRouter();
	const { resourceSlug } = router.query;
	const [accountContext]: any = useAccountContext();
	const { csrf } = accountContext as any;
	const [notificationContext, refreshNotificationContext]: any = useNotificationContext();
	const [more, setMore] = useState(false);
	async function markSeen(notificationId) {
		await API.markNotificationsSeen({ //TODO: batch multiple
			_csrf: csrf,
			resourceSlug,
			notificationIds: [notificationId],
		}, async () => {
			await new Promise(res => setTimeout(res, 400));
			await refreshNotificationContext();
		}, null, null);
	}

	return <Menu as='div' className='relative'>
		<Menu.Button className='-m-1.5 flex items-center'>
			<span className='sr-only'>View notifications</span>
			<BellIcon className='h-6 w-6' aria-hidden='true' />
			{notificationContext?.length > 0 && <div className='relative -mt-4 -ms-1 inline-flex'>
				<span className='bg-red-500 rounded-full w-2 h-2' />
			</div>}
		</Menu.Button>
		<Transition
			as={Fragment}
			enter='transition ease-out duration-100'
			enterFrom='transform opacity-0 scale-95'
			enterTo='transform opacity-100 scale-100'
			leave='transition ease-in duration-75'
			leaveFrom='transform opacity-100 scale-100'
			leaveTo='transform opacity-0 scale-95'
		>
			<Menu.Items className='absolute right-0 z-10 mt-2.5 origin-top-right rounded-md bg-white dark:bg-slate-800 py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none max-h-[500px] overflow-y-auto overflow-x-hidden min-w-[290px]'>
				{notificationContext?.length > 0
					?  notificationContext
						.slice(0, more ? null : 3)
						.map((n, ni) => (<Notification markSeen={markSeen} key={n._id} {...n} index={ni} />))
					: <p className='text-center'>No notifications.</p>}
			</Menu.Items>
		</Transition>
	</Menu>;
}
