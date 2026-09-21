import * as ecs from '@8thwall/ecs'

ecs.registerComponent({
  name: 'pinch-scale',
  schema: {
    minScale: ecs.f32,  // multiplicador mínimo em relação ao tamanho original
    maxScale: ecs.f32,  // multiplicador máximo
  },
  schemaDefaults: {
    minScale: 0.3,
    maxScale: 3,
  },
  stateMachine: ({world, eid, schemaAttribute}) => {
    let baseScale = 1   // tamanho original do prefab
    let startScale = 1  // tamanho no início de cada pinça

    ecs.defineState('idle')
      .initial()
      .onEnter(() => {
        baseScale = ecs.Scale.get(world, eid).x
      })
      .listen(world.events.globalId, ecs.input.GESTURE_START, (e) => {
        if ((e.data as any).touchCount !== 2) return
        startScale = ecs.Scale.get(world, eid).x
      })
      .listen(world.events.globalId, ecs.input.GESTURE_MOVE, (e) => {
        const {touchCount, spread, startSpread} = e.data as any
        if (touchCount !== 2 || !startSpread) return

        const {minScale, maxScale} = schemaAttribute.get(eid)
        const s = Math.min(
          baseScale * maxScale,
          Math.max(baseScale * minScale, startScale * (spread / startSpread))
        )
        world.setScale(eid, s, s, s)
      })
  },
})




