export interface UiNodeBase {
  id?: string
}

export type UiNode =
  | (UiNodeBase & {
      type: 'text'
      text: string
      tone?: 'normal' | 'muted' | 'accent'
    })
  | (UiNodeBase & {
      type: 'number'
      path: string
      label: string
      value: number
      min: number
      max: number
      step: number
    })
  | (UiNodeBase & {
      type: 'boolean'
      path: string
      label: string
      value: boolean
    })
  | (UiNodeBase & { type: 'color'; path: string; label: string; value: string })
  | (UiNodeBase & {
      type: 'metric'
      label: string
      value: string
      detail?: string
    })
  | (UiNodeBase & { type: 'stack'; children: UiNode[] })
