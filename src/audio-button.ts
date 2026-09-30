import * as ecs from '@8thwall/ecs'
import {OBJECT_PLACED_EVENT, OBJECT_RESET_EVENT} from './tap-to-place'

ecs.registerComponent({
  name: 'audio-button',
  schema: {},
  stateMachine: ({world, eid, entity, defineState}) => {
    const finished = ecs.defineTrigger()
    let el: HTMLAudioElement | null = null

    // acha o elemento de áudio cujo src bate com o arquivo deste componente
    const getEl = (): HTMLAudioElement | null => {
      if (el) return el
      let url = ''
      try {
        url = (ecs.Audio.get(world, eid) as any).url || ''
      } catch (e) {
        return null
      }
      const file = decodeURIComponent(url.split('?')[0].split('/').pop() || '')
      if (!file) return null

      const all = Array.from(document.querySelectorAll('audio')) as HTMLAudioElement[]
      el = all.find(a => decodeURIComponent(a.src.split('?')[0]).endsWith(file)) || null
      if (el) el.addEventListener('ended', () => finished.trigger())
      return el
    }

    const rewind = () => {
      const a = getEl()
      if (a) a.currentTime = 0
    }

    const stop = () => {
      ecs.Audio.mutate(world, eid, (a) => { a.paused = true })
      rewind()
    }

    defineState('nothing-placed')
      .initial()
      .onEnter(() => { entity.hide(); stop() })
      .onExit(() => entity.show())
      .onEvent(OBJECT_PLACED_EVENT, 'placed', {target: world.events.globalId})

    defineState('placed')
      .onEvent(ecs.input.UI_CLICK, 'playing')
      .onEvent(OBJECT_RESET_EVENT, 'nothing-placed', {target: world.events.globalId})

    defineState('playing')
      .onEnter(() => {
        rewind()
        ecs.Audio.mutate(world, eid, (a) => { a.paused = false })
      })
      .onExit(stop)
      .onTrigger(finished, 'placed')
      .onEvent(ecs.input.UI_CLICK, 'placed')
      .onEvent(OBJECT_RESET_EVENT, 'nothing-placed', {target: world.events.globalId})
  },
})