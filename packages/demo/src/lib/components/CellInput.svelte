<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'

  import { nameCell } from '$lib/cells'
  import { cells } from '$lib/store'

  export let row: number
  export let col: number
  export let resumeEdit: boolean

  const name = nameCell(col, row)

  let inputEl: HTMLInputElement
  let text = resumeEdit ? cells.getValue(name) : ''
  let done = false

  const dispatch = createEventDispatcher()
  const endEdit = () => dispatch('editend', { row, col })

  const commit = () => {
    if (done) return
    done = true
    cells.get(name).next(text)
    endEdit()
  }
  const discard = () => {
    done = true
    endEdit()
  }

  const onKeydown = (e: KeyboardEvent) => {
    let { key } = e
    if (key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      commit()
      return
    }
    if (key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      discard()
      return
    }
  }

  const onBlur = () => commit()

  onMount(() => {
    inputEl?.focus()
    return () => commit()
  })
</script>

<input
  type="text"
  class="absolute inset-0 text-black bg-white"
  {name}
  bind:this={inputEl}
  bind:value={text}
  on:keydown={onKeydown}
  on:blur={onBlur}
/>
