<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  interface $$Events {
    submit: CustomEvent<string>
    done: CustomEvent<never>
  }

  export let defaultText = ''
  export let autofocus = false

  let text = ''
  $: text = defaultText
  const reset = () => (text = defaultText)

  const dispatch = createEventDispatcher()
  const dispatchSubmit = () => dispatch('submit', text)
  const dispatchDone = () => dispatch('done')

  const submit = () => {
    if (text !== defaultText) {
      dispatchSubmit()
      reset()
    }
    dispatchDone()
  }
  const cancel = () => {
    reset()
    dispatchDone()
  }

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

  // Circumvent a11y-autofocus warning.
  const autofocusProps = autofocus ? { autofocus: true } : {}
</script>

<input
  type="text"
  class="w-full min-h-full text-black bg-white"
  {...autofocusProps}
  bind:value={text}
  on:keydown={onKeydown}
  on:blur={submit}
  {...$$restProps}
/>
