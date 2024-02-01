'use strict';

import * as API from '@api';
import {
	InformationCircleIcon,
} from '@heroicons/react/20/solid';
import getConnectors from 'airbyte/getconnectors';
import ButtonSpinner from 'components/ButtonSpinner';
import DropZone from 'components/DropZone';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import Select from 'react-tailwindcss-select';
import { toast } from 'react-toastify';
import { DatasourceScheduleType } from 'struct/schedule';
import SelectClassNames from 'styles/SelectClassNames';

import { useAccountContext } from '../context/account';
const TailwindForm = dynamic(() => import('components/rjsf'), {
	ssr: false,
});
import validator from '@rjsf/validator-ajv8';
const DynamicForm = dynamic(() => import('components/DynamicForm'), {
	ssr: false,
});
import { getSubmitButtonOptions,RJSFSchema, SubmitButtonProps } from '@rjsf/utils';
import { StreamsList } from 'components/DatasourceStream';

const stepList = [
	{ id: 'Step 1', name: 'Select datasource type', href: '#', steps: [0] },
	{ id: 'Step 2', name: 'Connect datasource', href: '#', steps: [1, 2] },
	{ id: 'Step 3', name: 'Sync configuration', href: '#', steps: [3] },
	{ id: 'Step 4', name: 'Chunking & Embedding options', href: '#', steps: [4] },
];
// @ts-ignore
const DatasourceScheduleForm = dynamic(() => import('components/DatasourceScheduleForm'), {
	loading: () => <p className='markdown-content'>Loading...</p>,
	ssr: false,
});

export default function CreateDatasourceForm({ agent = {}, credentials = [], tools=[], groups=[], editing, compact=false, callback, fetchAgentFormData }
	: { agent?: any, credentials?: any[], tools?: any[], groups?: any[], editing?: boolean, compact?: boolean, callback?: Function, fetchAgentFormData?: Function }) { //TODO: fix any types

	const [step, setStep] = useState(0);
	const [accountContext]: any = useAccountContext();
	const { account, csrf, teamName } = accountContext as any;
	const router = useRouter();
	const { resourceSlug } = router.query;
	const [error, setError] = useState();
	const [files, setFiles] = useState(null);
	const [datasourceName, setDatasourceName] = useState('');
	const [timeUnit, setTimeUnit] = useState('');
	const [units, setUnits] = useState('');
	const [cronExpression, setCronExpression] = useState('');
	const [cronTimezone, setCronTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
	const [scheduleType, setScheduleType] = useState(DatasourceScheduleType.MANUAL);
	const [datasourceId, setDatasourceId] = useState(null);
	const [discoveredSchema, setDiscoveredSchema] = useState(null);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const SubmitButton = (props: SubmitButtonProps) => {
		const { uiSchema } = props;
		const { norender } = getSubmitButtonOptions(uiSchema);
		if (norender) {
			return null;
		}
		return (
			<button
				disabled={submitting}
				type='submit'
				className='w-full rounded-md disabled:bg-slate-400 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
			>
				{submitting && <ButtonSpinner />}
				{submitting ? 'Testing connection...' : 'Submit'}
			</button>
		);
	};

	const [spec, setSpec] = useState(null);
	async function getSpecification(sourceDefinitionId: string) {
		API.getSpecification({
			sourceDefinitionId,
			resourceSlug,
		}, setSpec, setError, null);
		setLoading(false);
	}

	const [connectors, setConnectors] = useState([]);
	const [connector, setConnector] = useState(null);
	useEffect(() => {
		getConnectors()
			.then(json => setConnectors(json))
			.catch(e => {
				toast.error('Failed to fetch source connector list');
				setConnectors([]);
			});
	}, []);
	const connectorOptions = connectors ? Object.keys(connectors)
		.filter(key => connectors[key]?.connector_type === 'source')
		.map(key => ({
		  value: connectors[key]?.definitionId,
		  label: connectors[key]?.name_oss || 'test',
		  icon: connectors[key]?.iconUrl_oss,
		})) : [];

	async function datasourcePost(e) {
		setSubmitting(true);
		try {
			if (editing) {
				// await API.editAgent(agentState._id, body, () => {
				// 	toast.success('Agent Updated');
				// }, setError, null);
			} else {
				if (step === 2) {
					const body = {
						sourceConfig: e.formData,
						_csrf: csrf,
						connectorId: connector.value,
						connectorName: connector.label,
						resourceSlug,
						datasourceName,
						scheduleType,
						timeUnit,
						units,
						cronExpression,
						cronTimezone,
					};
					//step 2, getting schema and testing connection
					const stagedDatasource: any = await API.testDatasource(body, () => {
						// nothing to toast here	
					}, (res) => {
						toast.error(res);
					}, compact ? null : router);
					setDatasourceId(stagedDatasource.datasourceId);
					setDiscoveredSchema(stagedDatasource.discoveredSchema);
					setStep(3);
					// callback && addedDatasource && callback(addedDatasource._id);
				} else {
					//step 3, saving datasource
					e.preventDefault();
					const streams = Array.from(e.target.elements)
						.filter(x => x['checked'] === true)
						.filter(x => !x['dataset']['parent'])
						.map(x => x['name']);
					const selectedFieldsMap = Array.from(e.target.elements)
						.filter(x => x['checked'] === true)
						.filter(x => x['dataset']['parent'])
						.reduce((acc, x) => {
							acc[x['dataset']['parent']] = (acc[x['dataset']['parent']]||[]).concat([x['name']]);
							return acc;
						}, {});
					const body = {
						_csrf: csrf,
						datasourceId: datasourceId,
						resourceSlug,
						selectedFieldsMap,
						streams,
						scheduleType,
						timeUnit,
						units,
						cronExpression,
						cronTimezone,
					};
					const addedDatasource: any = await API.addDatasource(body, () => {
						toast.success('Added datasource');
					}, (res) => {
						toast.error(res);
					}, compact ? null : router);
					// callback && addedDatasource && callback(addedDatasource._id);
				}
			}
		} finally {
			setSubmitting(false);
		}
	}

	function getStepSection(_step) {
		//TODO: make steps enum
		switch (_step) {
			case 0:
				return <div className='flex justify-evenly space-x-4 mt-20 w-2/3 mx-auto'>
					<div className='flex flex-col items-center space-y-2'>
						<button 
							className='rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
							onClick={() => setStep(1)}
						>
							File Upload
						</button>
						<div className='text-sm'>
							Upload a file from your computer.
						</div>
					</div>
					<div className='flex flex-col items-center space-y-2'>
						<button 
							className='rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600'
							onClick={() => setStep(2)}
						>
							Data Connection
						</button>
						<div className='text-sm'>
							Sync data from external systems e.g. Google Sheets, Confluence.
						</div>
					</div>
				</div>;			
			case 1:
				return <DropZone files={files} setFiles={setFiles} />;
			case 2:
				return <span className='flex'>
					<div className='w-full sm:w-1/3 m-auto'>
						<Select
							isClearable
							isSearchable
							loading={connectorOptions.length === 0}
							primaryColor={'indigo'}
							classNames={SelectClassNames}
							value={connector}
							onChange={(v: any) => {
								setLoading(v != null);
								setConnector(v);
								if (v) {
									getSpecification(v.value);
								} else {
									setSpec(null);
								}
							}}
							options={connectorOptions}
							formatOptionLabel={(data: any) => {
								return (<li
									className={`block transition duration-200 px-2 py-2 cursor-pointer select-none truncate rounded hover:bg-blue-100 hover:text-blue-500 	${
										data.isSelected
											? 'bg-blue-100 text-blue-500'
											: 'dark:text-white'
									}`}
								>
									<span>
										{data.icon && <img
											src={data.icon}
											loading='lazy'
											className='inline-flex me-2 w-4 h-4'
										/>}
										{data.label}
									</span>
								</li>);
							}}
						/>
		
						{loading
							? <div className='flex justify-center my-4'>
								<ButtonSpinner size={24} />
							</div>
							: spec?.schema && <>
								<div className='sm:col-span-12 my-3'>
									<label htmlFor='name' className='block text-sm font-medium leading-6 text-gray-900 dark:text-slate-400 mt-2'>
										Datasource Name<span className='text-red-700'> *</span>
									</label>
									<div>
										<input
											required
											type='text'
											name='name'
											id='name'
											onChange={(e) => setDatasourceName(e.target.value)}
											value={datasourceName}
											className='block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-slate-800 dark:ring-slate-600 dark:text-white'
										/>
									</div>
									<DatasourceScheduleForm
										scheduleType={scheduleType}
										setScheduleType={setScheduleType}
										timeUnit={timeUnit}
										setTimeUnit={setTimeUnit}
										units={units}
										setUnits={setUnits}
										cronExpression={cronExpression}
										setCronExpression={setCronExpression}
										cronTimezone={cronTimezone}
										setCronTimezone={setCronTimezone}
									/>
								</div>
								<TailwindForm
									schema={spec.schema.connectionSpecification}
									templates={{ ButtonTemplates: { SubmitButton } }}
									validator={validator}
									onSubmit={datasourcePost}
									transformErrors={(errors) => {
										return errors.filter(e => e.name !== 'pattern'); //filter datetime pattern 
									}}
									noHtml5Validate
								>
									<button
										disabled={submitting}
										type='submit'
										className='w-full rounded-md disabled:bg-slate-400 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
									>
										{submitting && <ButtonSpinner />}
										{submitting ? 'Testing connection...' : 'Submit'}
									</button>
								</TailwindForm>
							</>}
		
					</div>
				</span>;
			case 3:
				return discoveredSchema && <div>
					<StreamsList
						streams={discoveredSchema.catalog.streams}
					/>
					<button
						onClick={() => setStep(4)}
						disabled={submitting}
						type='submit'
						className='rounded-md disabled:bg-slate-400 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
					>
						Continue
					</button>
				</div>;
			case 4:
				return discoveredSchema && <form onSubmit={datasourcePost}>
					<div className='hidden'>
						<StreamsList
							streams={discoveredSchema.catalog.streams}
						/>
					</div>
					<button
						disabled={submitting}
						type='submit'
						className='rounded-md disabled:bg-slate-400 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
					>
						{submitting && <ButtonSpinner />}
						{submitting ? 'Saving...' : 'Submit'}
					</button>
				</form>;
			default:
				return null;
		}
	}

	return (<div className='m-4'>

		<nav aria-label='Progress' className='mb-10'>
			<ol role='list' className='space-y-4 md:flex md:space-x-8 md:space-y-0'>
				{stepList.map((stepData, si) => (
					<li key={stepData.name} className='md:flex-1 cursor-pointer'>
						{step > stepData.steps[stepData.steps.length-1] ? (
							<a
								href={stepData.href}
								className='group flex flex-col border-l-4 border-indigo-600 py-2 pl-4 hover:border-indigo-800 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4'
							>
								<span className='text-sm font-medium text-indigo-600 group-hover:text-indigo-800'>{stepData.id}</span>
								<span className='text-sm font-medium'>{stepData.name}</span>
							</a>
						) : stepData.steps.includes(step) ? (
							<a
								href={stepData.href}
								className='flex flex-col border-l-4 border-indigo-600 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4'
								aria-current='step'
							>
								<span className='text-sm font-medium text-indigo-600'>{stepData.id}</span>
								<span className='text-sm font-medium'>{stepData.name}</span>
							</a>
						) : (
							<a
								href={stepData.href}
								className='group flex flex-col border-l-4 border-gray-200 py-2 pl-4 hover:border-gray-300 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4'
							>
								<span className='text-sm font-medium text-gray-500 group-hover:text-gray-700'>{stepData.id}</span>
								<span className='text-sm font-medium'>{stepData.name}</span>
							</a>
						)}
					</li>
				))}
			</ol>
		</nav>

		{getStepSection(step)}

	</div>);

}
