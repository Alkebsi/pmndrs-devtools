import { describe, expect, it } from 'vitest'
import { walkSchema } from '../src/schema.ts'

describe('walkSchema', () => {
  it('flattens folders and infers field kinds', () => {
    const { fields, initial } = walkSchema({
      Settings: {
        width: { value: 10, min: 0, max: 100 },
        enabled: true,
        color: '#ff0000',
      },
    })
    expect(fields.map((field) => field.kind)).toEqual([
      'number',
      'boolean',
      'color',
    ])
    expect(initial).toEqual({
      Settings: { width: 10, enabled: true, color: '#ff0000' },
    })
  })
})
