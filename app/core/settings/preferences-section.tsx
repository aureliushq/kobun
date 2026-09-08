import type { ReactNode } from "react"
import { DateDisplay, EditorFont, EditorWidth } from "@/db/types"
import type { UserPreferenceValues } from "@/db/user-preference"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/ui/components/base/combobox"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/ui/components/base/select"
import { Switch } from "@/ui/components/base/switch"
import { usePreference } from "./use-preference"

/**
 * The locales Kobun offers by name.
 *
 * A starting point rather than a closed set: there is no standard enumeration
 * of locales the way there is of timezones, so somebody has to choose, and a
 * short list of the ones Kobun's writers actually use beats a list of every tag
 * BCP 47 can spell. The action accepts any well-formed tag, so widening this is
 * only ever a matter of adding a line.
 */
const LOCALES = [
	{ label: "English (United Kingdom)", value: "en-GB" },
	{ label: "English (United States)", value: "en-US" },
	{ label: "English (Australia)", value: "en-AU" },
	{ label: "English (India)", value: "en-IN" },
	{ label: "Deutsch", value: "de-DE" },
	{ label: "Español", value: "es-ES" },
	{ label: "Français", value: "fr-FR" },
	{ label: "Italiano", value: "it-IT" },
	{ label: "Nederlands", value: "nl-NL" },
	{ label: "Português (Brasil)", value: "pt-BR" },
	{ label: "Svenska", value: "sv-SE" },
	{ label: "Polski", value: "pl-PL" },
	{ label: "Türkçe", value: "tr-TR" },
	{ label: "Русский", value: "ru-RU" },
	{ label: "日本語", value: "ja-JP" },
	{ label: "한국어", value: "ko-KR" },
	{ label: "简体中文", value: "zh-CN" },
	{ label: "繁體中文", value: "zh-TW" },
]

/**
 * The label the timezone list opens with, standing in for the empty value.
 *
 * A sentinel among the zone names rather than a separate control, because
 * "no preference" is one of the choices a writer makes here and it belongs in
 * the same list as the rest. No IANA zone is spelt this way, so nothing
 * collides with it.
 */
const DEVICE_TIMEZONE = "Match my device"

const TIMEZONES = [DEVICE_TIMEZONE, ...Intl.supportedValuesOf("timeZone")]

function PreferenceRow({
	control,
	description,
	label,
}: {
	control: ReactNode
	description: string
	label: string
}) {
	return (
		<div className="flex items-center justify-between gap-6 py-3">
			<div className="grid gap-0.5">
				<span className="font-medium">{label}</span>
				<span className="text-muted-foreground">{description}</span>
			</div>
			<div className="w-56 shrink-0 justify-self-end text-right">{control}</div>
		</div>
	)
}

function SwitchPreference({
	description,
	label,
	name,
	value,
}: {
	description: string
	label: string
	name: "propertiesPanelOpen" | "sidebarOpen" | "wordCountVisible"
	value: boolean
}) {
	const preference = usePreference({
		decode: (raw) => raw === "true",
		name,
		value,
	})

	return (
		<PreferenceRow
			control={
				<Switch
					aria-label={label}
					checked={preference.value}
					onCheckedChange={preference.setValue}
				/>
			}
			description={description}
			label={label}
		/>
	)
}

function SelectPreference<TValue extends string>({
	description,
	label,
	name,
	options,
	value,
}: {
	description: string
	label: string
	name: "dateDisplay" | "editorFont" | "editorWidth"
	options: { label: string; value: TValue }[]
	value: TValue
}) {
	/** The list is the vocabulary, so recognising a value is finding it here. */
	const known = (raw: unknown) =>
		options.find((option) => option.value === raw)?.value

	const preference = usePreference({
		decode: (raw) => known(raw) ?? value,
		name,
		value,
	})

	return (
		<PreferenceRow
			control={
				<Select
					items={options}
					onValueChange={(next) => {
						const chosen = known(next)
						if (chosen) preference.setValue(chosen)
					}}
					value={preference.value}
				>
					<SelectTrigger aria-label={label} className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{options.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			}
			description={description}
			label={label}
		/>
	)
}

function LocalePreference({ value }: { value: string | null }) {
	const preference = usePreference<string | null>({
		decode: (raw) => (raw === "" ? null : raw),
		name: "locale",
		value,
	})

	return (
		<PreferenceRow
			control={
				<Select
					items={[{ label: "Match my browser", value: null }, ...LOCALES]}
					onValueChange={(next) =>
						preference.setValue(next === null ? null : String(next))
					}
					value={preference.value}
				>
					<SelectTrigger aria-label="Language" className="w-full">
						<SelectValue placeholder="Match my browser" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value={null}>
								<span className="text-muted-foreground">Match my browser</span>
							</SelectItem>
							{LOCALES.map((locale) => (
								<SelectItem key={locale.value} value={locale.value}>
									{locale.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			}
			description="How dates and numbers are spelt."
			label="Language"
		/>
	)
}

function TimezonePreference({ value }: { value: string | null }) {
	const preference = usePreference<string | null>({
		decode: (raw) => (raw === "" ? null : raw),
		name: "timezone",
		value,
	})

	return (
		<PreferenceRow
			control={
				<Combobox
					items={TIMEZONES}
					onValueChange={(next) =>
						preference.setValue(
							next === DEVICE_TIMEZONE || next === null ? null : String(next),
						)
					}
					value={preference.value ?? DEVICE_TIMEZONE}
				>
					{/* The input opens holding the current zone as its filter text, so
					    typing after a click would append to it and match nothing.
					    Selecting it on focus makes the first keystroke a search. */}
					<ComboboxInput
						aria-label="Timezone"
						onFocus={(event) => event.currentTarget.select()}
						placeholder={DEVICE_TIMEZONE}
					/>
					<ComboboxContent>
						<ComboboxEmpty>No timezone found.</ComboboxEmpty>
						<ComboboxList>
							{(item: string) => (
								<ComboboxItem key={item} value={item}>
									{item}
								</ComboboxItem>
							)}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			}
			description="The zone times are shown in, wherever the writer happens to be."
			label="Timezone"
		/>
	)
}

/**
 * The writer's own choices about how Kobun looks.
 *
 * Every one of them follows the writer across every Project and none of them
 * changes what a Commit writes — the test ADR-0010 draws the line with. What is
 * not here is as deliberate: theme stays a cookie so the first byte can paint
 * in it, and the editor's save target is still the editor's own until #143
 * moves it.
 *
 * Saved as they are changed rather than behind a Save button, matching the two
 * preference controls Kobun already had. There is nothing to lose by navigating
 * away, and nothing to press.
 */
export function PreferencesSection({
	preferences,
}: {
	preferences: UserPreferenceValues
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Preferences</CardTitle>
				<CardDescription>
					How Kobun looks for you, on every Project and every device. Changes
					save as you make them.
				</CardDescription>
			</CardHeader>
			<CardContent className="divide-y">
				<SwitchPreference
					description="Whether an item opens with its properties showing."
					label="Open the properties panel"
					name="propertiesPanelOpen"
					value={preferences.propertiesPanelOpen}
				/>
				<SwitchPreference
					description="Whether the editor counts words and characters as you write."
					label="Show the word count"
					name="wordCountVisible"
					value={preferences.wordCountVisible}
				/>
				<SwitchPreference
					description="Whether the sidebar starts expanded."
					label="Open the sidebar"
					name="sidebarOpen"
					value={preferences.sidebarOpen}
				/>
				<SelectPreference
					description="How wide the writing column is."
					label="Editor width"
					name="editorWidth"
					options={[
						{ label: "Narrow", value: EditorWidth.NARROW },
						{ label: "Normal", value: EditorWidth.NORMAL },
						{ label: "Wide", value: EditorWidth.WIDE },
					]}
					value={preferences.editorWidth}
				/>
				<SelectPreference
					description="The typeface prose is written in."
					label="Editor font"
					name="editorFont"
					options={[
						{ label: "Sans serif", value: EditorFont.SANS },
						{ label: "Serif", value: EditorFont.SERIF },
						{ label: "Monospace", value: EditorFont.MONO },
					]}
					value={preferences.editorFont}
				/>
				<SelectPreference
					description={'Either "3 months ago" or the date itself.'}
					label="Dates"
					name="dateDisplay"
					options={[
						{ label: "Relative", value: DateDisplay.RELATIVE },
						{ label: "Absolute", value: DateDisplay.ABSOLUTE },
					]}
					value={preferences.dateDisplay}
				/>
				<LocalePreference value={preferences.locale} />
				<TimezonePreference value={preferences.timezone} />
			</CardContent>
		</Card>
	)
}
