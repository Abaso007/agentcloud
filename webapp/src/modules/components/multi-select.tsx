import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon, ChevronDown, PlusCircleIcon, WandSparkles, XCircle, XIcon } from 'lucide-react';
import * as React from 'react';
import cn from 'utils/cn';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator
} from './ui/command';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Separator } from './ui/separator';

/**
 * Variants for the multi-selecent to handle different styles.
 * Uses class-variance-authority (cva) to define different styles based on "variant" prop.
 */
const multiSelectVariants = cva(
	'm-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300',
	{
		variants: {
			variant: {
				default: 'border-foreground/10 text-foreground bg-card hover:bg-card/80',
				secondary:
					'border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80',
				destructive:
					'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
				inverted: 'inverted'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
);

/**
 * Props for MultiSelect component
 */
interface MultiSelectProps
	extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'>,
		VariantProps<typeof multiSelectVariants> {
	/**
	 * An array of option objects to be displayed in the multi-select component.
	 * Each option object has a label, value, and an optional icon.
	 */
	options: {
		/** The text to display for the option. */
		label: string;
		/** The unique value associated with the option. */
		value: string;
		/** Optional icon component to display alongside the option. */
		icon?: React.ComponentType<{ className?: string }>;
	}[];

	/**
	 * Callback function triggered when the selected values change.
	 * Receives an array of the new selected values.
	 */
	onValueChange: (value: string[]) => void;

	/** The default selected values when the component mounts. */
	defaultValue?: string[];

	/**
	 * Placeholder text to be displayed when no values are selected.
	 * Optional, defaults to "Select options".
	 */
	placeholder?: React.ReactNode;

	/**
	 * Animation duration in seconds for the visual effects (e.g., bouncing badges).
	 * Optional, defaults to 0 (no animation).
	 */
	animation?: number;

	/**
	 * Maximum number of items to display. Extra selected items will be summarized.
	 * Optional, defaults to 3.
	 */
	maxCount?: number;

	/**
	 * The modality of the popover. When set to true, interaction with outside elements
	 * will be disabled and only popover content will be visible to screen readers.
	 * Optional, defaults to false.
	 */
	modalPopover?: boolean;

	/**
	 * If true, renders the multi-select component as a child of another component.
	 * Optional, defaults to false.
	 */
	asChild?: boolean;

	/**
	 * Additional class names to apply custom styles to the multi-select component.
	 * Optional, can be used to add custom styles.
	 */
	className?: string;

	/**
	 * Callback function triggered when the "New" option is selected.
	 */
	newCallback?: () => void;

	/**
	 * Label to be displayed when the "New" option is selected.
	 */
	newLabel?: string;

	/**
	 * The selected values when the component mounts.
	 */
	value?: { label: string; value: string }[] | string[] | null;
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
	(
		{
			options,
			onValueChange,
			variant,
			defaultValue = [],
			value,
			placeholder = 'Select options',
			animation = 0,
			maxCount = 3,
			modalPopover = false,
			asChild = false,
			className,
			newCallback,
			newLabel,
			...props
		},
		ref
	) => {
		const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
		const [hasSelection, setHasSelection] = React.useState(false);

		React.useEffect(() => {
			if (value) {
				const newValues = value.map(v => {
					// Handle both object and string cases
					if (typeof v === 'string') {
						return v;
					}
					return (v as { value: string }).value;
				});
				setSelectedValues(newValues);
				setHasSelection(newValues.length > 0);
			}
		}, [value, options]);

		const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
		const [isAnimating, setIsAnimating] = React.useState(false);

		const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				setIsPopoverOpen(true);
			} else if (event.key === 'Backspace' && !event.currentTarget.value) {
				const newSelectedValues = [...selectedValues];
				newSelectedValues.pop();
				setSelectedValues(newSelectedValues);
				onValueChange(newSelectedValues);
			}
		};

		const toggleOption = (option: string) => {
			const newSelectedValues = selectedValues?.includes(option)
				? selectedValues?.filter(value => value !== option)
				: [...selectedValues, option];
			setSelectedValues(newSelectedValues);
			onValueChange(newSelectedValues);
		};

		const handleClear = () => {
			setSelectedValues([]);
			onValueChange([]);
		};

		const handleTogglePopover = () => {
			setIsPopoverOpen(prev => !prev);
		};

		const clearExtraOptions = () => {
			const newSelectedValues = selectedValues?.slice(0, maxCount);
			setSelectedValues(newSelectedValues);
			onValueChange(newSelectedValues);
		};

		const toggleAll = () => {
			if (selectedValues?.length === options.length) {
				handleClear();
			} else {
				const allValues = options.map(option => option.value);
				setSelectedValues(allValues);
				onValueChange(allValues);
			}
		};

		return (
			<Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} modal={modalPopover}>
				<PopoverTrigger asChild>
					<Button
						ref={ref}
						{...props}
						onClick={handleTogglePopover}
						className={cn(
							'flex w-full p-1 rounded-md border min-h-10 h-auto items-center justify-between bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto',
							className
						)}>
						{hasSelection ? (
							<div className='flex justify-between items-center w-full'>
								<div className='flex flex-wrap items-center'>
									{selectedValues?.slice(0, maxCount).map(value => {
										const option = options?.find(o => o.value === value);
										const IconComponent = option?.icon;
										return (
											<Badge
												key={value}
												className={cn(
													isAnimating ? 'animate-bounce' : '',
													multiSelectVariants({ variant })
												)}
												style={{ animationDuration: `${animation}s` }}>
												{IconComponent && <IconComponent className='h-4 w-4 mr-2' />}
												{option?.label}
												<XCircle
													className='ml-2 h-4 w-4 cursor-pointer'
													onClick={event => {
														event.stopPropagation();
														toggleOption(value);
													}}
												/>
											</Badge>
										);
									})}
									{selectedValues?.length > maxCount && (
										<Badge
											className={cn(
												'bg-transparent text-foreground border-foreground/1 hover:bg-transparent',
												isAnimating ? 'animate-bounce' : '',
												multiSelectVariants({ variant })
											)}
											style={{ animationDuration: `${animation}s` }}>
											{`+ ${selectedValues?.length - maxCount} more`}
											<XCircle
												className='ml-2 h-4 w-4 cursor-pointer'
												onClick={event => {
													event.stopPropagation();
													clearExtraOptions();
												}}
											/>
										</Badge>
									)}
								</div>

								<div className='flex items-center justify-between'>
									<XIcon
										className='h-4 mx-2 cursor-pointer text-muted-foreground'
										onClick={event => {
											event.stopPropagation();
											handleClear();
										}}
									/>
									<Separator orientation='vertical' className='flex min-h-6 h-full' />
									<ChevronDown className='h-4 mx-2 cursor-pointer text-muted-foreground' />
								</div>
							</div>
						) : (
							<div className='flex items-center justify-between w-full mx-auto'>
								<span className='text-sm text-muted-foreground mx-3'>{placeholder}</span>
								<ChevronDown className='h-4 cursor-pointer text-muted-foreground mx-2' />
							</div>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className={cn(
						'p-0 min-w-[var(--radix-popover-trigger-width)] w-full pointer-events-auto z-[99999]',
						'[&]:pointer-events-auto',
						'[&>*]:pointer-events-auto',
						'[&_input]:pointer-events-auto'
					)}
					align='start'
					onEscapeKeyDown={() => setIsPopoverOpen(false)}
					style={{
						zIndex: 99999,
						position: 'fixed'
					}}>
					<Command className='z-[9999]'>
						{/* <CommandInput placeholder='Search...' onKeyDown={handleInputKeyDown} /> */}
						<CommandList
							className='max-h-[150px] overflow-y-auto'
							style={{ overflowY: 'auto' }}
							onWheel={e => {
								e.preventDefault();
								e.stopPropagation();
								const target = e.currentTarget;
								const scrollAmount = e.deltaY;
								target.scrollTop += scrollAmount;
							}}
							onTouchMove={e => {
								e.preventDefault();
								e.stopPropagation();
							}}>
							<CommandEmpty>No results found.</CommandEmpty>
							<CommandGroup>
								{newCallback && newLabel && (
									<CommandItem key='new' onSelect={newCallback}>
										<div className='flex items-center w-full'>
											<PlusCircleIcon className='h-4 w-4 mr-2' />
											<span>{newLabel}</span>
										</div>
									</CommandItem>
								)}
								<CommandItem key='all' onSelect={toggleAll} className='cursor-pointer'>
									<div
										className={cn(
											'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
											selectedValues?.length === options?.length
												? 'bg-primary text-primary-foreground'
												: 'opacity-50 [&_svg]:invisible'
										)}>
										<CheckIcon className='h-4 w-4' />
									</div>
									<span>(Select All)</span>
								</CommandItem>

								{options?.map(option => {
									const isSelected = selectedValues?.includes(option.value);
									return (
										<CommandItem
											key={option.value}
											onSelect={() => toggleOption(option.value)}
											className='cursor-pointer'>
											<div
												className={cn(
													'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
													isSelected
														? 'bg-primary text-primary-foreground'
														: 'opacity-50 [&_svg]:invisible'
												)}>
												<CheckIcon className='h-4 w-4' />
											</div>
											{option.icon && (
												<option.icon className='mr-2 h-4 w-4 text-muted-foreground' />
											)}
											<span>{option.label}</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
							<CommandSeparator />
							<CommandGroup>
								<div className='flex items-center justify-between'>
									{selectedValues?.length > 0 && (
										<>
											<CommandItem
												onSelect={handleClear}
												className='flex-1 justify-center cursor-pointer'>
												Clear
											</CommandItem>
											<Separator orientation='vertical' className='flex min-h-6 h-full' />
										</>
									)}
									<CommandItem
										onSelect={() => setIsPopoverOpen(false)}
										className='flex-1 justify-center cursor-pointer max-w-full'>
										Close
									</CommandItem>
								</div>
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
				{animation > 0 && selectedValues?.length > 0 && (
					<WandSparkles
						className={cn(
							'cursor-pointer my-2 text-foreground bg-background w-3 h-3',
							isAnimating ? '' : 'text-muted-foreground'
						)}
						onClick={() => setIsAnimating(!isAnimating)}
					/>
				)}
			</Popover>
		);
	}
);

MultiSelect.displayName = 'MultiSelect';
