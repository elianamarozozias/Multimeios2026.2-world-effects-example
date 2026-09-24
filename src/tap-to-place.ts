import * as ecs from '@8thwall/ecs'

const OBJECT_PLACED_EVENT = 'object-placed'
const OBJECT_RESET_EVENT = 'object-reset'

const PARKING_SPOT = {x: 0, y: -100, z: 0}
const WARMUP_SPOT = {x: 0, y: 0, z: -1.5}   // à frente da câmera, durante o loading

ecs.registerComponent({
  name: 'tap-to-place',
  schema: {
    prefab: 'eid',
    facingOffset: 'f32',
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    let placedEid: any = null
    let isPlaced = false

    const createParked = (spot) => {
      const newEid = world.createEntity(schemaAttribute.get(eid).prefab)
      world.getEntity(newEid).setLocalPosition(spot)
      return newEid
    }

    // nasce visível: o GPU renderiza e compila shader durante a tela de loading
    placedEid = createParked(WARMUP_SPOT)

    defineState('warmup')
      .initial()
      .onEvent(ecs.events.REALITY_READY, 'initial', {target: world.events.globalId})
      .onExit(() => {
        // realidade pronta: esconde o objeto já aquecido
        world.getEntity(placedEid).setLocalPosition(PARKING_SPOT)
      })

    defineState('initial')
      .listen(world.events.globalId, OBJECT_RESET_EVENT, () => {
        isPlaced = false
      })
      .listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
        if (!e.data.worldPosition) {
          return
        }
        const pos = e.data.worldPosition

        let alive = false
        if (placedEid !== null) {
          try {
            ecs.Position.get(world, placedEid)
            alive = true
          } catch (err) {
            placedEid = null
            isPlaced = false
          }
        }

        if (alive && isPlaced) {
          return
        }

        if (!alive) {
          placedEid = createParked(PARKING_SPOT)
        }

        const entity = world.getEntity(placedEid)
        entity.setLocalPosition(pos)

        const cam = ecs.Position.get(world, world.camera.getActiveEid())
        const {facingOffset} = schemaAttribute.get(eid)
        const yaw = Math.atan2(cam.x - pos.x, cam.z - pos.z) + facingOffset * (Math.PI / 180)
        entity.set(ecs.Quaternion, ecs.math.quat.yRadians(yaw))

        isPlaced = true
        world.events.dispatch(world.events.globalId, OBJECT_PLACED_EVENT)
      })
  },
})

export {OBJECT_PLACED_EVENT, OBJECT_RESET_EVENT}