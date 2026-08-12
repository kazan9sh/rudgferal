'use client'

import clsx from 'clsx'
import { useContext, useEffect, useState } from 'react'
import { CheckboxContext } from './CheckboxProvider'

type PresetType = 'single' | 'aoe' | 'all'

type CheckboxValue = {
  id: string
  checked: boolean
  radio?: string | null
}

type Preset = {
  id: string
  label: string
  values: CheckboxValue[]
}

const singleTargetPresets: Preset[] = [
  {
    id: 'dotc-raid',
    label: 'Друид-хищник - рейд',
    values: [
      { id: 'Druid of the Claw', checked: true, radio: 'hero talents' },
      { id: 'Wildstalker', checked: false, radio: 'hero talents' },
      { id: 'Feral Frenzy', checked: true },
      { id: 'Focused Frenzy', checked: false, radio: 'frenzy choice' },
      { id: 'Frantic Frenzy', checked: true, radio: 'frenzy choice' },
      { id: 'Convoke the Spirits', checked: true, radio: 'Convoke' },
      { id: 'Incarnation', checked: false, radio: 'Convoke' },
      { id: 'Lunar Inspiration', checked: false, radio: 'Chomp' },
      { id: 'Chomp', checked: false, radio: 'Chomp' },
      { id: "Apex Predator's Craving", checked: false },
      { id: 'Sudden Ambush', checked: true },
      { id: 'Shadowmeld', checked: false },
    ],
  },
  {
    id: 'wildstalker-raid',
    label: 'Сталкер - рейд',
    values: [
      { id: 'Druid of the Claw', checked: false, radio: 'hero talents' },
      { id: 'Wildstalker', checked: true, radio: 'hero talents' },
      { id: 'Feral Frenzy', checked: true },
      { id: 'Focused Frenzy', checked: true, radio: 'frenzy choice' },
      { id: 'Frantic Frenzy', checked: false, radio: 'frenzy choice' },
      { id: 'Convoke the Spirits', checked: true, radio: 'Convoke' },
      { id: 'Incarnation', checked: false, radio: 'Convoke' },
      { id: 'Lunar Inspiration', checked: true, radio: 'Chomp' },
      { id: 'Chomp', checked: false, radio: 'Chomp' },
      { id: "Apex Predator's Craving", checked: true },
      { id: 'Sudden Ambush', checked: false },
      { id: 'Shadowmeld', checked: false },
    ],
  },
]

const aoePresets: Preset[] = [
  {
    id: 'dotc-mplus',
    label: 'Друид-хищник - M+',
    values: [
      { id: 'Druid of the Claw AOE', checked: true, radio: 'hero talents AOE' },
      { id: 'Wildstalker AOE', checked: false, radio: 'hero talents AOE' },
      { id: 'Double Clawed Rake AOE', checked: false },
      { id: 'Wild Slashes AOE', checked: true },
      { id: 'Infected Wounds AOE', checked: false },
      { id: 'Feral Frenzy AOE', checked: true },
      { id: 'Focused Frenzy AOE', checked: false, radio: 'frenzy choice AOE' },
      { id: 'Frantic Frenzy AOE', checked: true, radio: 'frenzy choice AOE' },
      { id: 'Convoke the Spirits AOE', checked: true, radio: 'Convoke AOE' },
      { id: 'Incarnation AOE', checked: false, radio: 'Convoke AOE' },
      { id: 'Lunar Inspiration AOE', checked: false },
      { id: "Apex Predator's Craving AOE", checked: true },
      { id: 'Rampant Ferocity AOE', checked: true },
      { id: 'Shadowmeld AOE', checked: false },
      { id: 'Primal Wrath AOE', checked: true },
      { id: 'Sudden Ambush AOE', checked: false },
    ],
  },
  {
    id: 'wildstalker-mplus',
    label: 'Сталкер - M+',
    values: [
      { id: 'Druid of the Claw AOE', checked: false, radio: 'hero talents AOE' },
      { id: 'Wildstalker AOE', checked: true, radio: 'hero talents AOE' },
      { id: 'Double Clawed Rake AOE', checked: false },
      { id: 'Wild Slashes AOE', checked: false },
      { id: 'Infected Wounds AOE', checked: true },
      { id: 'Feral Frenzy AOE', checked: true },
      { id: 'Focused Frenzy AOE', checked: false, radio: 'frenzy choice AOE' },
      { id: 'Frantic Frenzy AOE', checked: true, radio: 'frenzy choice AOE' },
      { id: 'Convoke the Spirits AOE', checked: true, radio: 'Convoke AOE' },
      { id: 'Incarnation AOE', checked: false, radio: 'Convoke AOE' },
      { id: 'Lunar Inspiration AOE', checked: false },
      { id: "Apex Predator's Craving AOE", checked: true },
      { id: 'Rampant Ferocity AOE', checked: true },
      { id: 'Shadowmeld AOE', checked: false },
      { id: 'Primal Wrath AOE', checked: true },
      { id: 'Sudden Ambush AOE', checked: true },
    ],
  },
]

const singleTargetMode: CheckboxValue[] = [
  { id: 'Single Target Rotation', checked: true, radio: 'rotation mode' },
  { id: 'AOE Rotation', checked: false, radio: 'rotation mode' },
]

const aoeMode: CheckboxValue[] = [
  { id: 'Single Target Rotation', checked: false, radio: 'rotation mode' },
  { id: 'AOE Rotation', checked: true, radio: 'rotation mode' },
]

const allPresets: Preset[] = [
  {
    ...singleTargetPresets[0],
    values: [...singleTargetMode, ...singleTargetPresets[0].values],
  },
  {
    ...singleTargetPresets[1],
    values: [...singleTargetMode, ...singleTargetPresets[1].values],
  },
  {
    ...aoePresets[0],
    values: [...aoeMode, ...aoePresets[0].values],
  },
  {
    ...aoePresets[1],
    values: [...aoeMode, ...aoePresets[1].values],
  },
]

const presetsByType: Record<PresetType, Preset[]> = {
  single: singleTargetPresets,
  aoe: aoePresets,
  all: allPresets,
}

export default function RotationPresetPicker({ type = 'single' }: { type?: PresetType }) {
  const { updateCheckboxes } = useContext(CheckboxContext)
  const presets = presetsByType[type]
  const gridClass = type === 'all' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'
  const [selectedPresetId, setSelectedPresetId] = useState(presets[0].id)

  const pushPreset = (preset: Preset) => {
    updateCheckboxes(
      preset.values.map(({ id, checked, radio = null }) => ({
        id,
        checked,
        radioGroup: radio,
      }))
    )
  }

  const applyPreset = (preset: Preset) => {
    pushPreset(preset)
    setSelectedPresetId(preset.id)
  }

  // Pushes the default preset into the checkbox store on mount. Only the external
  // store is touched here — the highlighted button comes from useState's initial value.
  useEffect(() => {
    pushPreset(presetsByType[type][0])
  }, [type])

  return (
    <div className="not-prose my-4">
      <div
        className={clsx(
          'grid gap-px overflow-hidden rounded-md bg-gray-200 text-sm font-semibold dark:bg-gray-700',
          gridClass
        )}
      >
        {presets.map((preset) => {
          const active = selectedPresetId === preset.id

          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => applyPreset(preset)}
              className={clsx(
                'min-h-12 px-3 py-2 text-center transition-colors',
                active
                  ? 'bg-main text-white'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
