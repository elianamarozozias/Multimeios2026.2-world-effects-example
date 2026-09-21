import * as ecs from '@8thwall/ecs'

const OBJECT_PLACED_EVENT = 'object-placed'
const OBJECT_RESET_EVENT = 'object-reset'

ecs.registerComponent({
  name: 'tap-to-place',
  schema: {
    prefab: 'eid',
    resetButton: 'eid',   // botão de UI que apaga o objeto
    facingOffset: 'f32',  // graus extras, caso o modelo nasça de costas
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    const {resetButton} = schemaAttribute.get(eid)
    const reset = ecs.defineTrigger()
    let placedEid: any = null

    defineState('ready')
      .initial()
      .listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
        const pos = e.data.worldPosition
        if (!pos) return

        const newEid = world.createEntity(schemaAttribute.get(eid).prefab)
        const newEntity = world.getEntity(newEid)
        newEntity.setLocalPosition(pos)

        // vira o objeto de frente para a câmera
        const cam = ecs.Position.get(world, world.camera.getActiveEid())
        const {facingOffset} = schemaAttribute.get(eid)
        const yaw = Math.atan2(cam.x - pos.x, cam.z - pos.z) + facingOffset * (Math.PI / 180)
        newEntity.set(ecs.Quaternion, ecs.math.quat.yRadians(yaw))

        placedEid = newEid
        world.events.dispatch(eid, OBJECT_PLACED_EVENT)
      })
      .onEvent(OBJECT_PLACED_EVENT, 'placed')

    defineState('placed')
      .listen(resetButton, ecs.input.UI_CLICK, () => reset.trigger())
      .onTrigger(reset, 'ready')
      .onExit(() => {
        if (placedEid) world.deleteEntity(placedEid)
        placedEid = null
        world.events.dispatch(eid, OBJECT_RESET_EVENT)
      })
  },
})

export {
  OBJECT_PLACED_EVENT,
  OBJECT_RESET_EVENT,
}