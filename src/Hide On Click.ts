import * as ecs from '@8thwall/ecs'


ecs.registerComponent({
  name: 'Hide On Click',
  schema: {},
  stateMachine: ({world, eid}) => {
    ecs.defineState('default')
      .initial()
      .listen(world.events.globalId, ecs.input.SCREEN_TOUCH_START, () => {
        ecs.Hidden.set(world, eid)
      })
  },
})
