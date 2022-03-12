<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { nameCell } from '$lib/cells'
  import { cells } from '$lib/store'

  export let row: number
  export let col: number
  export let resumeEdit: boolean
  export let autofocus = false

  $: name = nameCell(col, row)
  $: cell = cells.get(name)

  let dirty = false
  let focused = false
  $: text = !dirty && !focused ? $cell : resumeEdit ? cells.getValue(name) : ''
  const reset = () => {
    text = cells.getValue(name)
    dirty = false
  }

  const dispatch = createEventDispatcher()
  const dispatchDone = () => dispatch('done')

  const submit = () => {
    if (dirty) {
      cells.next(name, text)
      reset()
    }
    dispatchDone()
  }
  const cancel = () => {
    reset()
    dispatchDone()
  }

  const onInput = () => (dirty = true)

  const onKeydown = (e: KeyboardEvent) => {
    let { key } = e
    if (key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      submit()
      return
    }
    if (key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancel()
      return
    }
  }

  const onFocus = () => (focused = true)
  const onBlur = () => {
    focused = false
    submit()
  }

  // Circumvent a11y-autofocus warning.
  const autofocusProps = autofocus ? { autofocus: true } : {}
</script>

<input
  type="text"
  class="w-full min-h-full text-black bg-white"
  {name}
  {...autofocusProps}
  bind:value={text}
  on:keydown={onKeydown}
  on:input|capture={onInput}
  on:focus={onFocus}
  on:blur={onBlur}
/>
