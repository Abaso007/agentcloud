import * as API from '@api';
import AvatarUploader from 'components/AvatarUploader';
import CreateDatasourceModal from 'components/CreateDatasourceModal';
import CreateModelModal from 'components/CreateModelModal';
import CreateToolModal from 'components/modal/CreateToolModal';
import CreateVariableModal from 'components/variables/CreateVariableModal';
import AutocompleteDropdown from 'components/variables/VariableDropdown';
import { useAccountContext } from 'context/account';
import { AgentDataReturnType, AgentsDataReturnType } from 'controllers/agent';
import useAutocompleteDropdown from 'hooks/useAutoCompleteDropdown';
import { BookText, ChevronDown, CircleUserRound, Cpu, Database } from 'lucide-react';
import { MultiSelect } from 'modules/components/multi-select';
import { Button } from 'modules/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from 'modules/components/ui/dropdown-menu';
import { Input } from 'modules/components/ui/input';
import { Label } from 'modules/components/ui/label';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from 'modules/components/ui/sheet';
import { Textarea } from 'modules/components/ui/textarea';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Agent } from 'struct/agent';
import { ModelEmbeddingLength, ModelType } from 'struct/model';
import { ToolType } from 'struct/tool';

export const AgentSheet = ({
	selectedAgentTools,
	selectedAgent,
	openEditSheet,
	setOpenEditSheet,
	agentId,
	editing,
	callback,
	agentsExist
}: {
	selectedAgentTools?: any;
	selectedAgent?: Agent;
	openEditSheet: boolean;
	setOpenEditSheet: (open: boolean) => void;
	agentId?: string;
	editing?: boolean;
	callback?: (addedAgentId: string, body: any) => void;
	agentsExist?: boolean;
}) => {
	async function fetchToolFormData() {
		await API.getTools({ resourceSlug }, dispatch, setError, router);
	}

	const [accountContext]: any = useAccountContext();
	const router = useRouter();
	const { resourceSlug } = router.query;
	const [cloneState, setCloneState] = useState<AgentDataReturnType>(null);
	const [error, setError] = useState();
	const [state, dispatch] = useState<AgentsDataReturnType>();

	const { models, tools, variables } = state || {};

	const { csrf } = accountContext as any;
	const [modalOpen, setModalOpen]: any = useState<string>();
	const [callbackKey, setCallbackKey] = useState(null);
	const [allowDelegation, setAllowDelegation] = useState(
		selectedAgent?.allowDelegation || cloneState?.agent?.allowDelegation
	);
	const [verbose, setVerbose] = useState(selectedAgent?.verbose || cloneState?.agent?.verbose);
	const [icon, setIcon] = useState(selectedAgent?.icon || cloneState?.agent?.icon);
	const [agentState, setAgent] = useState<Partial<AgentDataReturnType['agent']>>(
		selectedAgent || cloneState?.agent || {}
	);
	const modelId = agentState?.modelId;
	const functionModelId = agentState?.functionModelId;

	const [backstory, setBackstory] = useState<string>(
		selectedAgent?.backstory || cloneState?.agent?.backstory || ''
	);
	const [goal, setGoal] = useState<string>(selectedAgent?.goal || cloneState?.agent?.goal || '');
	const [role, setRole] = useState<string>(selectedAgent?.role || cloneState?.agent?.role || '');

	const [currentInput, setCurrentInput] = useState<string>();

	const [backstorySelectedVariables, setBackstorySelectedVariables] = useState<string[]>([]);
	const [goalSelectedVariables, setGoalSelectedVariables] = useState<string[]>([]);
	const [roleSelectedVariables, setRoleSelectedVariables] = useState<string[]>([]);

	const backstoryVariableOptions = variables?.map(v => ({
		label: v.name,
		value: v._id.toString()
	}));

	const goalVariableOptions = variables?.map(v => ({ label: v.name, value: v._id.toString() }));
	const roleVariableOptions = variables?.map(v => ({ label: v.name, value: v._id.toString() }));

	const autocompleteBackstory = useAutocompleteDropdown({
		value: backstory,
		options: backstoryVariableOptions,
		setValue: setBackstory,
		setSelectedVariables: setBackstorySelectedVariables,
		setModalOpen,
		initialState: variables,
		setCurrentInput,
		fetchFormData: fetchAgentFormData
	});

	const autocompleteGoal = useAutocompleteDropdown({
		value: goal,
		options: goalVariableOptions,
		setValue: setGoal,
		setSelectedVariables: setGoalSelectedVariables,
		setModalOpen,
		initialState: variables,
		setCurrentInput,
		fetchFormData: fetchAgentFormData
	});

	const autocompleteRole = useAutocompleteDropdown({
		value: role,
		options: roleVariableOptions,
		setValue: setRole,
		setSelectedVariables: setRoleSelectedVariables,
		setModalOpen,
		initialState: variables,
		setCurrentInput,
		fetchFormData: fetchAgentFormData
	});

	const getInitialTools = (acc, tid) => {
		if (!tools) {
			return acc;
		}
		const foundTool = tools.find(t => t._id === tid);
		if (!foundTool) {
			return acc;
		}

		const toolVal = {
			label: foundTool.name,
			value: foundTool._id.toString()
		};

		if ((foundTool?.type as ToolType) !== ToolType.RAG_TOOL) {
			acc.initialTools.push(toolVal);
		} else {
			acc.initialDatasources.push(toolVal);
		}
		return acc;
	};

	useEffect(() => {
		setAgent(cloneState?.agent);
		setIcon(cloneState?.agent?.icon);
		setBackstory(cloneState?.agent?.backstory);
		setGoal(cloneState?.agent?.goal);
		setRole(cloneState?.agent?.role);
		setAllowDelegation(cloneState?.agent?.allowDelegation);
		setVerbose(cloneState?.agent?.verbose);

		const { initialTools, initialDatasources } = (cloneState?.agent?.toolIds || []).reduce(
			getInitialTools,
			{
				initialTools: [],
				initialDatasources: []
			}
		);
		setToolState(initialTools.length > 0 ? initialTools.map(t => t.value) : []);
		if (models && models.length > 0 && !modelId) {
			setAgent({
				...agentState,
				modelId: models.find(m => !ModelEmbeddingLength[m.model])?._id,
				functionModelId: models.find(m => !ModelEmbeddingLength[m.model])?._id
			});
		}

		setDatasourceState(initialDatasources.length > 0 ? initialDatasources.map(d => d.value) : []);
	}, [cloneState?.agent?._id]);

	const { initialTools, initialDatasources } = (cloneState?.agent?.toolIds || []).reduce(
		getInitialTools,
		{
			initialTools: [],
			initialDatasources: []
		}
	);

	const [toolState, setToolState] = useState<string[]>(() => {
		if (selectedAgentTools) {
			const formattedTools = selectedAgentTools
				.filter(tool => tool.type !== ToolType.RAG_TOOL)
				.map(tool => tool._id.toString());
			return formattedTools.length > 0 ? formattedTools : [];
		}
		return initialTools.length > 0 ? initialTools.map(t => t.value) : [];
	});

	const [datasourceState, setDatasourceState] = useState<string[]>(() => {
		if (selectedAgentTools) {
			const formattedDatasources = selectedAgentTools
				.filter(tool => tool.type === ToolType.RAG_TOOL)
				.map(tool => tool._id.toString());
			return formattedDatasources.length > 0 ? formattedDatasources : [];
		}
		return initialDatasources.length > 0 ? initialDatasources.map(d => d.value) : [];
	});

	useEffect(() => {
		if (models && models.length > 0 && !modelId) {
			setAgent({
				...agentState,
				modelId: models.find(m => !ModelEmbeddingLength[m.model])?._id,
				functionModelId: models.find(m => !ModelEmbeddingLength[m.model])?._id
			});
		}
	}, []);

	useEffect(() => {
		if (editing && agentId) {
			fetchEditData(agentId);
		}
	}, [editing, agentId]);

	useEffect(() => {
		if (selectedAgent) {
			setAgent(selectedAgent);
			setIcon(selectedAgent.icon);
			setBackstory(selectedAgent.backstory);
			setGoal(selectedAgent.goal);
			setRole(selectedAgent.role);
			setAllowDelegation(selectedAgent.allowDelegation);
			setVerbose(selectedAgent.verbose);

			if (selectedAgentTools) {
				const { initialTools, initialDatasources } = selectedAgentTools.reduce(
					(acc, tool) => {
						const toolValue = tool._id.toString();
						if (tool.type !== ToolType.RAG_TOOL) {
							acc.initialTools.push(toolValue);
						} else {
							acc.initialDatasources.push(toolValue);
						}
						return acc;
					},
					{ initialTools: [], initialDatasources: [] }
				);
				setToolState(initialTools.length > 0 ? initialTools : []);
				setDatasourceState(initialDatasources.length > 0 ? initialDatasources : []);
			}
		}
	}, [selectedAgent, selectedAgentTools]);

	async function agentPost(e) {
		e.preventDefault();
		e.stopPropagation();

		const body: any = {
			_csrf: csrf,
			resourceSlug,
			name: e.target.name.value,
			modelId,
			functionModelId,
			allowDelegation: allowDelegation === true,
			verbose: verbose === true,
			role: e.target.role.value,
			goal: e.target.goal.value,
			backstory: e.target.backstory.value,
			toolIds: [...toolState, ...datasourceState],
			iconId: icon?.id,
			variableIds:
				Array.from(
					new Set([
						...roleSelectedVariables,
						...goalSelectedVariables,
						...backstorySelectedVariables
					])
				) || [],
			cloning: cloneState?.agent && editing
		};

		posthog.capture(editing ? 'updateAgent' : 'createAgent', {
			name: e.target.name.value,
			tools: toolState.length,
			datasources: datasourceState.length,
			modelId,
			functionModelId
		});

		if (editing) {
			try {
				await API.editAgent(
					agentState._id,
					body,
					() => {
						toast.success('Agent Updated');
						setOpenEditSheet(false);
						// Reset all form state
						setToolState([]);
						setDatasourceState([]);
						setBackstory('');
						setGoal('');
						setRole('');
						setIcon(null);
						setAllowDelegation(false);
						setVerbose(false);
						// Refresh agent list
						fetchAgentFormData();
						callback && callback(agentState._id.toString(), body);
					},
					res => {
						toast.error(res);
					},
					null
				);
			} catch (error) {}
		} else {
			try {
				const addedAgent: any = await API.addAgent(
					body,
					() => {},
					res => {
						toast.error(res);
					},
					router
				);

				toast.success('Added new agent');
				setOpenEditSheet(false);
				// Reset all form state
				setToolState([]);
				setDatasourceState([]);
				setBackstory('');
				setGoal('');
				setRole('');
				setIcon(null);
				setAllowDelegation(false);
				setVerbose(false);
				// Refresh agent list
				fetchAgentFormData();
				callback && addedAgent && callback(addedAgent._id, body);
			} catch (error) {
				console.log('API call failed with error:', error);
			}
		}
	}

	const modelCallback = async addedModelId => {
		(await fetchAgentFormData) && fetchAgentFormData();
		setModalOpen(false);
		setAgent(oldAgent => {
			return {
				...oldAgent,
				[callbackKey as any]: addedModelId
			};
		});
		setCallbackKey(null);
	};

	async function createDatasourceCallback(createdDatasource) {
		(await fetchAgentFormData) && fetchAgentFormData();
		setDatasourceState([createdDatasource.datasourceId]);
		setModalOpen(false);
	}

	const toolCallback = async (addedToolId, body) => {
		await fetchAgentFormData();
		await fetchToolFormData();
		setModalOpen(false);

		const newTool = {
			label: body.name,
			value: addedToolId.toString()
		};

		setToolState(prevTools => {
			const existingTools = Array.isArray(prevTools) ? prevTools : [];
			const newTools = [...existingTools, newTool.value];
			return newTools;
		});
	};

	const iconCallback = async addedIcon => {
		(await fetchAgentFormData) && fetchAgentFormData();
		setModalOpen(false);
		setIcon({ id: addedIcon?._id, ...addedIcon });
	};

	const handleNewVariableCreation = (newVariable: { label: string; value: string }) => {
		switch (currentInput) {
			case 'backstory':
				autocompleteBackstory.handleNewVariableCreation(newVariable);
				break;
			case 'goal':
				autocompleteGoal.handleNewVariableCreation(newVariable);
				break;
			case 'role':
				autocompleteRole.handleNewVariableCreation(newVariable);
				break;
			default:
				break;
		}
	};

	let modal;
	switch (modalOpen) {
		case 'model':
			modal = (
				<CreateModelModal
					open={modalOpen !== false}
					setOpen={setModalOpen}
					callback={modelCallback}
					modelFilter='llm'
					modelTypeFilters={[
						ModelType.GROQ,
						ModelType.OPENAI,
						ModelType.OLLAMA,
						ModelType.ANTHROPIC,
						ModelType.GOOGLE_VERTEX,
						ModelType.GOOGLE_AI
					]}
				/>
			);
			break;
		case 'datasource':
			modal = (
				<CreateDatasourceModal
					open={modalOpen !== false}
					setOpen={setModalOpen}
					callback={createDatasourceCallback}
					initialStep={0}
				/>
			);
			break;
		case 'tool':
			modal = (
				<CreateToolModal
					open={modalOpen !== false}
					setOpen={setModalOpen}
					callback={toolCallback}
				/>
			);
			break;
		case 'variable':
			modal = (
				<CreateVariableModal
					open={modalOpen !== false}
					setOpen={setModalOpen}
					callback={handleNewVariableCreation}
				/>
			);
			break;
		default:
			modal = null;
			break;
	}

	async function fetchAgentFormData() {
		await API.getAgents({ resourceSlug }, dispatch, setError, router);
	}

	async function fetchEditData(agentId) {
		await API.getAgent({ resourceSlug, agentId }, setCloneState, setError, router);
	}

	useEffect(() => {
		fetchAgentFormData();
	}, []);

	useEffect(() => {
		if (agentId) {
			fetchEditData(agentId);
		}
	}, []);

	// Cleanup effect to reset pointer events when component unmounts
	useEffect(() => {
		return () => {
			document.body.style.pointerEvents = 'auto';
			document.body.style.cursor = 'auto';
			document.body.style.overflow = 'visible';
		};
	}, []);

	function showPreview(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = e => {
				const previewImage = document.getElementById('preview-image') as HTMLImageElement;
				if (previewImage && e.target?.result) {
					previewImage.src = e.target.result as string;
				}
			};
			reader.readAsDataURL(file);
		}
	}

	return (
		<Sheet
			open={openEditSheet}
			onOpenChange={open => {
				setOpenEditSheet(open);

				// Reset form state when sheet closes
				if (!open) {
					setToolState([]);
					setDatasourceState([]);
					setBackstory('');
					setGoal('');
					setRole('');
					setIcon(null);
					setAllowDelegation(false);
					setVerbose(false);

					// Reset body styles when sheet closes
					document.body.style.pointerEvents = 'auto';
					document.body.style.overflow = 'visible';
					document.body.style.cursor = 'auto';
				}
			}}>
			{modal}
			{!agentsExist && (
				<SheetTrigger className='font-medium border-0 w-full mt-4'>
					<div className='w-full flex flex-col items-center justify-center bg-gray-100 p-6 rounded-lg'>
						<div className='flex items-center justify-center mb-4'>
							<div className='bg-background w-12 h-12 flex items-center justify-center rounded-full'>
								<CircleUserRound />
							</div>
						</div>
						<div className='flex flex-col items-center gap-2'>
							<p className='font-medium'>+ Create Agent</p>
							<p className='text-gray-500 text-center w-3/5'>
								Think of it as a virtual helper that manages important chats and replies in your app
							</p>
						</div>
					</div>
				</SheetTrigger>
			)}

			<SheetContent
				size='md'
				className='text-foreground overflow-y-auto max-h-screen'
				style={{
					pointerEvents: 'auto'
				}}
				onPointerDownOutside={() => {
					document.body.style.pointerEvents = 'auto';
				}}
				onEscapeKeyDown={() => {
					document.body.style.pointerEvents = 'auto';
				}}>
				<SheetHeader>
					<SheetTitle>
						<div className='flex items-center gap-2'>
							<BookText width={15} />
							<p className='font-medium text-gray-900 text-sm'>
								{editing ? 'Edit Agent' : 'New Agent'}
							</p>
						</div>
					</SheetTitle>
					<div className='border-t border-gray-200 py-3 px-1'>
						<form onSubmit={agentPost}>
							<section className='pb-3 flex flex-col gap-4'>
								<div className='flex justify-between gap-2'>
									<AvatarUploader
										existingAvatar={icon}
										callback={iconCallback}
										isDialogOpen={modalOpen === 'avatar'}
										setIsDialogOpen={setModalOpen}
									/>
									<div className='flex flex-col gap-2 justify-center'>
										<p className='bg-gray-100 text-gray-500 rounded-sm p-2 text-sm'>
											Leave blank to auto-generate a profile photo based on the name.
										</p>
										<p className='text-gray-500 text-sm'>Max file size : 1 MB</p>
									</div>
								</div>

								<div className='grid w-full items-center gap-1.5'>
									<Label className='text-gray-900 font-medium' htmlFor='name'>
										Name
									</Label>
									<Input
										className='bg-gray-50 border border-gray-300'
										type='text'
										id='name'
										placeholder='Agent Name'
										defaultValue={selectedAgent?.name || ''}
										name='name'
									/>
								</div>

								<div className='bg-gray-100 p-4 rounded-lg flex flex-col gap-2'>
									<div>
										<h4 className='text-sm text-foreground font-medium'>
											Help Your Agent Work Smarter
										</h4>
										<p className='text-sm text-gray-600'>
											Equip your agent with essential tools and data to perform tasks effectively.
											The right setup ensures accurate results and informed decisions.
										</p>
									</div>

									<div className='flex flex-col gap-4 text-xs'>
										<MultiSelect
											className='bg-white mt-4'
											placeholder={
												<div className='flex items-center gap-2'>
													<Database className='h-4 w-4' />
													<p>Tools</p>
												</div>
											}
											newCallback={() => setModalOpen('tool')}
											newLabel='New Tool'
											options={tools
												?.filter(t => (t?.type as ToolType) !== ToolType.RAG_TOOL)
												.map(t => ({
													label: t.name,
													value: t._id.toString()
												}))}
											onValueChange={values => {
												const formattedValues = Array.isArray(values) ? values : [];
												setToolState(formattedValues);
											}}
											value={toolState}
										/>

										<MultiSelect
											className='bg-white'
											placeholder={
												<div className='flex items-center gap-2'>
													<Database className='h-4 w-4' />
													<p>Connections</p>
												</div>
											}
											newCallback={() => setModalOpen('datasource')}
											newLabel='New Connection'
											options={tools
												?.filter(t => (t?.type as ToolType) === ToolType.RAG_TOOL)
												.map(t => ({
													label: t.name,
													value: t._id.toString()
												}))}
											onValueChange={values => {
												const formattedValues = Array.isArray(values) ? values : [];
												setDatasourceState(formattedValues);
											}}
											value={datasourceState}
										/>
									</div>
								</div>

								<div className='grid w-full items-center gap-1.5 relative'>
									<Label className='text-gray-900 font-medium' htmlFor='role'>
										Role
									</Label>
									<Textarea
										name='role'
										ref={autocompleteRole.inputRef}
										className='bg-gray-50 border border-gray-300'
										id='role'
										placeholder='e.g. Data Analyst'
										rows={3}
										value={autocompleteRole.text || selectedAgent?.role || role}
										onChange={autocompleteRole.handleChange}
										onKeyDown={autocompleteRole.handleKeyDown}
									/>
									{autocompleteRole.showDropdown && autocompleteRole.filteredOptions.length > 0 && (
										<AutocompleteDropdown
											closeDropdown={autocompleteRole.closeDropdown}
											options={autocompleteRole.filteredOptions}
											highlightedIndex={autocompleteRole.highlightedIndex}
											dropdownPosition={autocompleteRole.dropdownPosition}
											handleOptionSelect={autocompleteRole.handleOptionSelect}
										/>
									)}

									<div className='flex gap-2 items-center text-xs'>
										<p>Suggestions:</p>
										<div className='flex items-center gap-2'>
											<p
												className='text-gray-900 py-1 px-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors'
												onClick={() => setRole('Technical Support')}>
												Technical Support
											</p>
											<p
												className='text-gray-900 py-1 px-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors'
												onClick={() => setRole('Code Helper')}>
												Code Helper
											</p>
											<p
												className='text-gray-900 py-1 px-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors'
												onClick={() => setRole('API Integrator')}>
												API Integrator
											</p>
										</div>
									</div>
								</div>

								<div className='grid w-full items-center gap-1.5 relative'>
									<Label className='text-gray-900 font-medium' htmlFor='goal'>
										Goal
									</Label>
									<Textarea
										name='goal'
										ref={autocompleteGoal.inputRef}
										id='goal'
										className='resize-none h-20 bg-gray-50 border-gray-300'
										placeholder='Extract actionable insights'
										value={autocompleteGoal.text || selectedAgent?.goal || goal}
										onChange={autocompleteGoal.handleChange}
										onKeyDown={autocompleteGoal.handleKeyDown}
									/>
									{autocompleteGoal.showDropdown && autocompleteGoal.filteredOptions.length > 0 && (
										<AutocompleteDropdown
											closeDropdown={autocompleteGoal.closeDropdown}
											options={autocompleteGoal.filteredOptions}
											highlightedIndex={autocompleteGoal.highlightedIndex}
											dropdownPosition={autocompleteGoal.dropdownPosition}
											handleOptionSelect={autocompleteGoal.handleOptionSelect}
										/>
									)}
								</div>

								<div className='grid w-full items-center gap-1.5 relative'>
									<Label className='text-gray-900 font-medium' htmlFor='backstory'>
										Backstory
									</Label>
									<Textarea
										name='backstory'
										ref={autocompleteBackstory.inputRef}
										id='backstory'
										className='resize-none h-28 bg-gray-50 border-gray-300'
										placeholder="e.g. You're a data analyst at a large company. You're responsible for analyzing data and providing insights to the business. You're currently working on a project to analyze the performance of our marketing campaigns."
										value={autocompleteBackstory.text || selectedAgent?.backstory || backstory}
										onChange={autocompleteBackstory.handleChange}
										onKeyDown={autocompleteBackstory.handleKeyDown}
									/>
									{autocompleteBackstory.showDropdown &&
										autocompleteBackstory.filteredOptions.length > 0 && (
											<AutocompleteDropdown
												closeDropdown={autocompleteBackstory.closeDropdown}
												options={autocompleteBackstory.filteredOptions}
												highlightedIndex={autocompleteBackstory.highlightedIndex}
												dropdownPosition={autocompleteBackstory.dropdownPosition}
												handleOptionSelect={autocompleteBackstory.handleOptionSelect}
											/>
										)}
								</div>

								<div className='grid w-full items-center gap-1.5'>
									<Label className='text-gray-900 font-medium' htmlFor='model'>
										Model
									</Label>
									<DropdownMenu>
										<DropdownMenuTrigger className='bg-background border border-gray-300 flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg'>
											<div className='flex items-center gap-2'>
												<Cpu width={15} />
												<p className='text-sm text-gray-900'>
													{models?.find(m => m._id === modelId)?.name || 'Select Model'}
												</p>
											</div>
											<ChevronDown width={25} color='#6B7280' />
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											{models?.map(model => (
												<DropdownMenuItem
													key={model._id.toString()}
													onClick={() =>
														setAgent(oldAgent => ({
															...oldAgent,
															modelId: model._id
														}))
													}>
													{model.name}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</section>

							<section className='border-t border-gray-200 pt-4 flex justify-between sticky bottom-0 bg-white text-sm'>
								<Button
									onClick={() => setOpenEditSheet(false)}
									className='text-foreground hover:bg-transparent hover:text-foreground p-0 border border-gray-200 py-2.5 px-5 bg-white'>
									Cancel
								</Button>
								<Button
									type='submit'
									className='bg-gradient-to-r from-[#4F46E5] to-[#612D89] text-white font-medium text-sm py-2'>
									{editing ? 'Update' : 'Save'}
								</Button>
							</section>
						</form>
					</div>
				</SheetHeader>
			</SheetContent>
		</Sheet>
	);
};
