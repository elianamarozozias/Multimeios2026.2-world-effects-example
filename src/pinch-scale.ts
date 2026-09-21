import * as ecs from '@8thwall/ecs'

ecs.registerComponent({
  name: 'pinch-scale',
  schema: {
    minScale: ecs.f32,
    maxScale: ecs.f32,
    rotateDirection: ecs.f32, // 1 ou -1, caso o giro fique invertido
  },
  schemaDefaults: {
    minScale: 0.3,
    maxScale: 3,
    rotateDirection: 1,
  },
  stateMachine: ({world, eid, schemaAttribute}) => {
    let baseScale = 1
    let q0 = {x: 0, y: 0, z: 0, w: 1}
    let yaw = 0
    let dragging = false
    let grabOffset: {x: number, z: number} | null = null
    let lastAngle: number | null = null
    let startDist: number | null = null
    let startScale = 1

    const alive = () => {
      try { return ecs.Position.has(world, eid) } catch { return false }
    }

    const applyYaw = () => {
      const ay = Math.sin(yaw / 2)
      const aw = Math.cos(yaw / 2)
      world.setQuaternion(
        eid,
        aw * q0.x + ay * q0.z,
        aw * q0.y + ay * q0.w,
        aw * q0.z - ay * q0.x,
        aw * q0.w - ay * q0.y,
      )
    }

    const groundHit = (clientX: number, clientY: number, planeY: number) => {
      const three = (world as any).three
      const cam = three.activeCamera
      const rect = three.renderer.domElement.getBoundingClientRect()
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((clientY - rect.top) / rect.height) * 2 + 1
      const V = cam.position.constructor
      const origin = new V().setFromMatrixPosition(cam.matrixWorld)
      const dir = new V(nx, ny, 0.5).unproject(cam).sub(origin).normalize()
      if (Math.abs(dir.y) < 1e-4) return null
      const t = (planeY - origin.y) / dir.y
      if (t < 0) return null
      return {x: origin.x + dir.x * t, z: origin.z + dir.z * t}
    }

    const onMove = (ev: TouchEvent) => {
      if (!alive()) return cleanup()

      // um dedo: mover
      if (ev.touches.length === 1 && dragging) {
        const t = ev.touches[0]
        const p = ecs.Position.get(world, eid)
        const hit = groundHit(t.clientX, t.clientY, p.y)
        if (!hit) return
        if (!grabOffset) {
          grabOffset = {x: p.x - hit.x, z: p.z - hit.z}
          return
        }
        world.setPosition(eid, hit.x + grabOffset.x, p.y, hit.z + grabOffset.z)
      }

      // dois dedos: girar + escalar
      else if (ev.touches.length === 2) {
        dragging = false
        const a = ev.touches[0]
        const b = ev.touches[1]
        const dx = b.clientX - a.clientX
        const dy = b.clientY - a.clientY

        // rotação: ângulo entre os dedos
        const angle = Math.atan2(dy, dx)
        if (lastAngle !== null) {
          let d = angle - lastAngle
          if (d > Math.PI) d -= 2 * Math.PI
          if (d < -Math.PI) d += 2 * Math.PI
          yaw -= d * schemaAttribute.get(eid).rotateDirection
          applyYaw()
        }
        lastAngle = angle

        // escala: distância entre os dedos
        const dist = Math.hypot(dx, dy)
        if (startDist === null) {
          startDist = dist
          startScale = ecs.Scale.get(world, eid).x
        } else if (startDist > 0) {
          const {minScale, maxScale} = schemaAttribute.get(eid)
          const s = Math.min(
            baseScale * maxScale,
            Math.max(baseScale * minScale, startScale * (dist / startDist))
          )
          world.setScale(eid, s, s, s)
        }
      }
    }

    const onEnd = (ev: TouchEvent) => {
      if (ev.touches.length < 2) {
        lastAngle = null
        startDist = null
      }
      if (ev.touches.length === 0) {
        dragging = false
        grabOffset = null
      }
    }

    const cleanup = () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }

    ecs.defineState('idle')
      .initial()
      .onEnter(() => {
        baseScale = ecs.Scale.get(world, eid).x
        const q = ecs.Quaternion.get(world, eid)
        q0 = {x: q.x, y: q.y, z: q.z, w: q.w}
        window.addEventListener('touchmove', onMove, {passive: true})
        window.addEventListener('touchend', onEnd, {passive: true})
        window.addEventListener('touchcancel', onEnd, {passive: true})
      })
      .onExit(cleanup)

      // arrastar só vale se o dedo começou em cima do objeto
      .listen(eid, ecs.input.SCREEN_TOUCH_START, () => {
        dragging = true
        grabOffset = null
      })
  },
})