import * as ecs from '@8thwall/ecs'

// ─────────────────────────────────────────────────────────────
//  AJUSTE FINO DO ARRASTO (mover o objeto com um dedo)
//  Mexa aqui se o movimento ficar rápido, lento ou tremido.
// ─────────────────────────────────────────────────────────────

// Quanto o objeto anda em relação ao dedo.
// 1 = acompanha o dedo | 0.7 = mais lento e controlado | 1.3 = mais solto
const SENSIBILIDADE = 1.3

// Quanto o objeto persegue o dedo a cada quadro.
// 0.3 = padrão | 0.15 = bem suave e arrastado | 1 = sem suavização
const SUAVIDADE = 1

// Pixels que o dedo precisa andar antes do arrasto começar.
// Serve para o objeto não sair do lugar com um toque parado.
// 8 = padrão | 15 = exige um movimento mais claro
const ZONA_MORTA = 4

// ─────────────────────────────────────────────────────────────

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
    let arrastoAtivo = false
    let toqueInicial: {x: number, y: number} | null = null
    let ultimoToque: {x: number, y: number} | null = null
    let alvo: {x: number, z: number} | null = null
    let lastAngle: number | null = null
    let startDist: number | null = null
    let startScale = 1
    let animando = false

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

    // converte o quanto o dedo andou na tela em quanto o objeto deve andar no
    // chão. Ao contrário do raio-até-o-plano, isto não depende de onde no
    // objeto o dedo tocou: a sensibilidade é a mesma na base e no topo.
    const deslocamento = (dxPix: number, dyPix: number) => {
      const three = (world as any).three
      const cam = three.activeCamera
      const rect = three.renderer.domElement.getBoundingClientRect()
      const e = cam.matrixWorld.elements

      // eixos da câmera projetados no plano horizontal
      let rx = e[0]; let rz = e[2]
      const rl = Math.hypot(rx, rz) || 1
      rx /= rl; rz /= rl

      let fx = -e[8]; let fz = -e[10]
      const fl = Math.hypot(fx, fz) || 1
      fx /= fl; fz /= fl

      // metros por pixel na distância em que o objeto está
      const p = ecs.Position.get(world, eid)
      const dist = Math.hypot(p.x - e[12], p.y - e[13], p.z - e[14]) || 1
      const fov = ((cam.fov || 60) * Math.PI) / 180
      const porPixel = (2 * dist * Math.tan(fov / 2)) / (rect.height || 1)
      const k = porPixel * SENSIBILIDADE

      return {
        x: (rx * dxPix - fx * dyPix) * k,
        z: (rz * dxPix - fz * dyPix) * k,
      }
    }

    // o objeto persegue o alvo aos poucos, em vez de saltar para ele
    const seguirAlvo = () => {
      if (!alvo || !alive()) { animando = false; return }
      const p = ecs.Position.get(world, eid)
      world.setPosition(
        eid,
        p.x + (alvo.x - p.x) * SUAVIDADE,
        p.y,
        p.z + (alvo.z - p.z) * SUAVIDADE,
      )
      requestAnimationFrame(seguirAlvo)
    }

    const onMove = (ev: TouchEvent) => {
      if (!alive()) return cleanup()

      // um dedo: mover
      if (ev.touches.length === 1 && dragging) {
        const t = ev.touches[0]

        if (!toqueInicial) {
          toqueInicial = {x: t.clientX, y: t.clientY}
          ultimoToque = {x: t.clientX, y: t.clientY}
          return
        }

        // zona morta: só começa a arrastar depois de andar alguns pixels
        if (!arrastoAtivo) {
          const d = Math.hypot(t.clientX - toqueInicial.x, t.clientY - toqueInicial.y)
          if (d < ZONA_MORTA) return
          arrastoAtivo = true
          ultimoToque = {x: t.clientX, y: t.clientY}
          const p0 = ecs.Position.get(world, eid)
          alvo = {x: p0.x, z: p0.z}
        }

        const dxPix = t.clientX - (ultimoToque as any).x
        const dyPix = t.clientY - (ultimoToque as any).y
        ultimoToque = {x: t.clientX, y: t.clientY}

        const d = deslocamento(dxPix, dyPix)
        if (!alvo) {
          const p0 = ecs.Position.get(world, eid)
          alvo = {x: p0.x, z: p0.z}
        }
        alvo = {x: alvo.x + d.x, z: alvo.z + d.z}
        if (!animando) { animando = true; requestAnimationFrame(seguirAlvo) }
      }

      // dois dedos: girar + escalar
      else if (ev.touches.length === 2) {
        dragging = false
        arrastoAtivo = false
        alvo = null
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
        arrastoAtivo = false
        toqueInicial = null
        ultimoToque = null
        alvo = null
      }
    }

    const cleanup = () => {
      animando = false
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
        arrastoAtivo = false
        toqueInicial = null
        ultimoToque = null
      })
  },
})