import * as ecs from '@8thwall/ecs'

const OBJECT_PLACED_EVENT = 'object-placed'

ecs.registerComponent({
  name: 'tap-to-place',
  schema: {
    prefab: 'eid',
    facingOffset: 'f32',
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    let placedEid: any = null

    defineState('initial').initial().listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
      if (!e.data.worldPosition) {
        return
      }
      const pos = e.data.worldPosition

      // a entidade pode ter sido apagada pelo reset: valida antes de usar
      let entity: any = null
      if (placedEid !== null) {
        try {
          entity = world.getEntity(placedEid)
          // força um acesso real para detectar entidade morta
          ecs.Position.get(world, placedEid)
        } catch (err) {
          entity = null
          placedEid = null
        }
      }

      if (entity === null) {
        placedEid = world.createEntity(schemaAttribute.get(eid).prefab)
        entity = world.getEntity(placedEid)
      }

      entity.setLocalPosition(pos)

      const cam = ecs.Position.get(world, world.camera.getActiveEid())
      const {facingOffset} = schemaAttribute.get(eid)
      const yaw = Math.atan2(cam.x - pos.x, cam.z - pos.z) + facingOffset * (Math.PI / 180)
      entity.set(ecs.Quaternion, ecs.math.quat.yRadians(yaw))

      world.events.dispatch(world.events.globalId, OBJECT_PLACED_EVENT)
    })
  },
})

export {OBJECT_PLACED_EVENT}