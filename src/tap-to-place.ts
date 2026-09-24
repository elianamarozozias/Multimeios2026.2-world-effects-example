import * as ecs from '@8thwall/ecs'

const OBJECT_PLACED_EVENT = 'object-placed'

ecs.registerComponent({
  name: 'tap-to-place',
  schema: {
    prefab: 'eid',
    facingOffset: 'f32',
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    defineState('initial').initial().listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
      if (!e.data.worldPosition) {
        return
      }
      const pos = e.data.worldPosition
      const newEid = world.createEntity(schemaAttribute.get(eid).prefab)
      const newEntity = world.getEntity(newEid)
      newEntity.setLocalPosition(pos)

      const cam = ecs.Position.get(world, world.camera.getActiveEid())
      const {facingOffset} = schemaAttribute.get(eid)
      const yaw = Math.atan2(cam.x - pos.x, cam.z - pos.z) + facingOffset * (Math.PI / 180)
      newEntity.set(ecs.Quaternion, ecs.math.quat.yRadians(yaw))

      world.events.dispatch(eid, OBJECT_PLACED_EVENT)
    })
  },
})

export {OBJECT_PLACED_EVENT}