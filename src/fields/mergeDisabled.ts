/**
 * Form-level disabling (`<Form disabled>` or a pending submit) wins over a
 * consumer `disabled={false}`; a consumer `disabled` still disables on its own.
 */
export const mergeDisabled = (consumer: boolean | undefined, form: boolean | undefined): boolean =>
  // Boolean OR, not a nullish fallback: either source disabling is enough, and `??` would
  // let a consumer `disabled={false}` mask the form's lock.
  Boolean(consumer) || Boolean(form)
