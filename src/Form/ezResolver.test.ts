import { set, type Field, type FieldValues, type ResolverOptions } from 'react-hook-form'
import { z } from 'zod'
import { ezResolver } from './ezResolver'
import { normalizeRules, type FieldRules } from '../rules'

type Rules = Partial<Field['_f']>

/** Builds ResolverOptions the way hookform's getResolverOptions does: nested by path. */
function options(fields: Record<string, Rules>, names = Object.keys(fields)): ResolverOptions<FieldValues> {
  const nested: FieldValues = {}
  for (const [name, f] of Object.entries(fields)) {
    set(nested, name, { name, ref: { name }, mount: true, ...f })
  }
  return { fields: nested, names, shouldUseNativeValidation: false }
}

const rules = <T,>(r: FieldRules<T>, label?: string): Rules => normalizeRules(r, label)

async function run(
  schema: z.ZodType<unknown, FieldValues>,
  values: FieldValues,
  fields: Record<string, Rules>,
  names?: string[],
) {
  return ezResolver(schema)(values, undefined, options(fields, names))
}

const email = z.object({ email: z.email() })
const text = z.object({ nick: z.string() })

describe('ezResolver', () => {
  it("returns zod's parsed output unchanged when nothing fails", async () => {
    const schema = z.object({ age: z.coerce.number() })
    const result = await run(schema, { age: '42' }, { age: rules({ min: 18 }, 'Age') })
    expect(result.errors).toEqual({})
    expect(result.values).toEqual({ age: 42 })
  })

  it('reports required on every empty value, with the label in the default message', async () => {
    for (const empty of [undefined, null, '', false, []]) {
      const result = await run(z.object({ tos: z.unknown() }), { tos: empty }, { tos: rules({ required: true }, 'Terms') })
      expect(result.errors).toEqual({ tos: { type: 'required', message: 'Terms is required.' } })
      expect(result.values).toEqual({})
    }
  })

  it('runs validate even when the value is empty or false, like hookform', async () => {
    const schema = z.object({ v: z.unknown() })
    const optIn = rules<unknown>({ validate: (v) => v === true || 'You must opt in' }, 'Opt in')
    expect((await run(schema, { v: false }, { v: optIn })).errors).toEqual({ v: { type: 'validate', message: 'You must opt in' } })
    expect((await run(schema, { v: '' }, { v: optIn })).errors).toEqual({ v: { type: 'validate', message: 'You must opt in' } })
    expect((await run(schema, { v: true }, { v: optIn })).errors).toEqual({})
  })

  it('fails required on false and on empty, but skips minLength on an empty string', async () => {
    const schema = z.object({ v: z.unknown() })
    expect((await run(schema, { v: false }, { v: rules({ required: true }, 'Terms') })).errors).toEqual({
      v: { type: 'required', message: 'Terms is required.' },
    })
    expect((await run(schema, { v: '' }, { v: rules({ minLength: 3 }, 'Nick') })).errors).toEqual({})
  })

  it('skips the other rules when the value is empty and not required', async () => {
    const result = await run(text, { nick: '' }, { nick: rules({ minLength: 3, pattern: /^x$/ }, 'Nickname') })
    expect(result.errors).toEqual({})
  })

  it('uses a string required as the custom message', async () => {
    const result = await run(text, { nick: '' }, { nick: rules({ required: 'Say something!' }) })
    expect(result.errors).toEqual({ nick: { type: 'required', message: 'Say something!' } })
  })

  it('checks rules in hookform order and reports the first failure', async () => {
    const result = await run(text, { nick: 'abc' }, { nick: rules({ maxLength: 2, pattern: /^\d+$/ }, 'Nickname') })
    expect(result.errors).toEqual({ nick: { type: 'maxLength', message: 'Nickname must be at most 2 characters.' } })
  })

  it('compares min/max numerically when both sides are numbers, else as strings', async () => {
    const schema = z.object({ age: z.string(), day: z.string() })
    const age = (value: string, r: FieldRules) => run(schema, { age: value, day: '' }, { age: rules(r, 'Age') })
    expect((await age('5', { min: 18 })).errors).toEqual({ age: { type: 'min', message: 'Age must be at least 18.' } })
    expect((await age('100', { max: { value: 99, message: 'Nobody is that old' } })).errors).toEqual({
      age: { type: 'max', message: 'Nobody is that old' },
    })
    expect((await age('20', { min: '3' })).errors).toEqual({})
    const day = await run(schema, { age: '', day: '2020-01-01' }, { day: rules({ min: '2021-01-01' }, 'Day') })
    expect(day.errors).toEqual({ day: { type: 'min', message: 'Day must be at least 2021-01-01.' } })
  })

  it('derives minLength/maxLength messages from the label and honours overrides', async () => {
    const short = await run(text, { nick: 'ab' }, { nick: rules({ minLength: 3 }, 'Nickname') })
    expect(short.errors).toEqual({ nick: { type: 'minLength', message: 'Nickname must be at least 3 characters.' } })
    const long = await run(text, { nick: 'abcdefghijklmnop' }, { nick: rules({ maxLength: { value: 12, message: 'Too long!' } }) })
    expect(long.errors).toEqual({ nick: { type: 'maxLength', message: 'Too long!' } })
  })

  it('resets lastIndex on global regexes so a pattern keeps failing on repeated runs', async () => {
    const fields = { nick: rules({ pattern: /^[a-z]+$/g }, 'Nickname') }
    for (let i = 0; i < 3; i++) {
      expect((await run(text, { nick: 'ABC' }, fields)).errors).toEqual({ nick: { type: 'pattern', message: 'Nickname is invalid.' } })
    }
    expect((await run(text, { nick: 'abc' }, fields)).errors).toEqual({})
  })

  it('runs validate functions: string is the message, false uses the default, true/undefined pass, async is awaited', async () => {
    const user = z.object({ user: z.string() })
    const check = (value: string, r: FieldRules<string>) => run(user, { user: value }, { user: rules(r, 'Username') })
    expect((await check('admin', { validate: (v) => v !== 'admin' || 'Reserved' })).errors).toEqual({
      user: { type: 'validate', message: 'Reserved' },
    })
    expect((await check('x', { validate: () => false })).errors).toEqual({ user: { type: 'validate', message: 'Username is invalid.' } })
    expect((await check('x', { validate: () => true })).errors).toEqual({})
    expect((await check('x', { validate: () => undefined })).errors).toEqual({})
    expect((await check('x', { validate: async () => 'Later' })).errors).toEqual({ user: { type: 'validate', message: 'Later' } })
  })

  it('runs a validate record in key order and reports the first failing key', async () => {
    const result = await run(text, { nick: 'root' }, {
      nick: rules({ validate: { notEmpty: (v) => v !== '', notRoot: (v) => v !== 'root' || 'No root', short: () => false } }, 'Nickname'),
    })
    expect(result.errors).toEqual({ nick: { type: 'notRoot', message: 'No root' } })
  })

  it('hands validate the whole form values', async () => {
    const schema = z.object({ a: z.string(), b: z.string() })
    const result = await run(schema, { a: '1', b: '2' }, { b: rules({ validate: (v, all) => v === all.a || 'Must match a' }) })
    expect(result.errors).toEqual({ b: { type: 'validate', message: 'Must match a' } })
  })

  it("replaces zod's error with the rule error for the same field", async () => {
    const result = await run(email, { email: '' }, { email: rules({ required: true }, 'Email') })
    expect(result.errors).toEqual({ email: { type: 'required', message: 'Email is required.' } })
    expect(result.values).toEqual({})
  })

  it("keeps zod's error when no rule fails", async () => {
    const result = await run(email, { email: 'nope' }, { email: rules({ required: true }, 'Email') })
    expect(result.errors).toMatchObject({ email: { message: 'Invalid email address' } })
  })

  it('only checks rules for the names being validated but still returns the full errors object', async () => {
    const schema = z.object({ email: z.email(), nick: z.string() })
    const fields = { email: rules({ required: true }, 'Email'), nick: rules({ required: true }, 'Nickname') }
    const result = await run(schema, { email: '', nick: '' }, fields, ['nick'])
    expect(result.errors).toMatchObject({
      nick: { type: 'required', message: 'Nickname is required.' },
      email: { message: 'Invalid email address' },
    })
  })

  it('reads nested field rules by path', async () => {
    const schema = z.object({ address: z.object({ street: z.string() }) })
    const result = await run(schema, { address: { street: '' } }, { 'address.street': rules({ required: true }, 'Street') })
    expect(result.errors).toEqual({ address: { street: { type: 'required', message: 'Street is required.' } } })
  })

  it('applies minLength/maxLength/pattern to string values only, like hookform', async () => {
    const schema = z.object({ v: z.unknown() })
    const check = (value: unknown, r: FieldRules) => run(schema, { v: value }, { v: rules(r, 'Value') })
    expect((await check(123, { pattern: /^[a-z]+$/ })).errors).toEqual({})
    expect((await check(['a'], { minLength: 3 })).errors).toEqual({})
    expect((await check({ a: 1 }, { maxLength: 2 })).errors).toEqual({})
    expect((await check('123', { pattern: /^[a-z]+$/ })).errors).toEqual({ v: { type: 'pattern', message: 'Value is invalid.' } })
    expect((await check('ab', { minLength: 3 })).errors).toEqual({ v: { type: 'minLength', message: 'Value must be at least 3 characters.' } })
    expect((await check('abc', { maxLength: 2 })).errors).toEqual({ v: { type: 'maxLength', message: 'Value must be at most 2 characters.' } })
  })

  it('skips fields that are not mounted', async () => {
    const result = await run(text, { nick: '' }, { nick: { ...rules({ required: true }, 'Nickname'), mount: false } })
    expect(result.errors).toEqual({})
  })

  it("accepts bare hookform rules from a consumer's own useController", async () => {
    const result = await run(text, { nick: '' }, { nick: { required: true } })
    expect(result.errors).toEqual({ nick: { type: 'required', message: 'This field is required.' } })
  })
})
