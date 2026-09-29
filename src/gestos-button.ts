import * as ecs from '@8thwall/ecs'
import {OBJECT_PLACED_EVENT, OBJECT_RESET_EVENT} from './tap-to-place'

ecs.registerComponent({
  name: 'gestos-button',
  stateMachine: ({world, entity, defineState}) => {
    defineState('nothing-placed')
      .initial()
      .onEnter(() => entity.hide())
      .onExit(() => entity.show())
      .onEvent(OBJECT_PLACED_EVENT, 'placed', {target: world.events.globalId})

    defineState('placed')
      .onEvent(OBJECT_RESET_EVENT, 'nothing-placed', {target: world.events.globalId})
  },
})