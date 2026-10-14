import * as ecs from '@8thwall/ecs'

const PRESETS = ['pular', 'girar', 'flutuar', 'balancar', 'pulsar', 'tremer']

ecs.registerComponent({
  name: 'animar',
  schema: {
    intensidade: ecs.f32,    // 0.5 = discreto, 1 = padrão, 2 = exagerado
    velocidade: ecs.f32,     // 0.5 = lento, 1 = padrão, 2 = rápido
    elasticidade: ecs.f32,   // 0 = mecânico, 0.5 = padrão, 1 = cartunesco
  },
  schemaDefaults: {
    intensidade: 1,
    velocidade: 1,
    elasticidade: 0.5,
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    const p0 = ecs.math.vec3.zero()
    const s0 = {x: 1, y: 1, z: 1}
    let timers: any[] = []
    let indice = -1

    const guardar = () => {
      world.transform.getLocalPosition(eid, p0)
      const s = ecs.Scale.get(world, eid)
      s0.x = s.x; s0.y = s.y; s0.z = s.z
    }

    const limpar = () => {
      timers.forEach(t => clearTimeout(t))
      timers = []
      try { ecs.PositionAnimation.remove(world, eid) } catch (e) {}
      try { ecs.ScaleAnimation.remove(world, eid) } catch (e) {}
      try { ecs.RotateAnimation.remove(world, eid) } catch (e) {}
      world.transform.setLocalPosition(eid, p0)
      ecs.Scale.set(world, eid, {x: s0.x, y: s0.y, z: s0.z})
    }

    const depois = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)) }

    // ---- blocos básicos ----

    const mover = (de: number, para: number, dur: number,
                   easeIn: boolean, easeOut: boolean) => {
      ecs.PositionAnimation.set(world, eid, {
        duration: dur, loop: false,
        fromX: p0.x, fromY: p0.y + de, fromZ: p0.z,
        toX: p0.x, toY: p0.y + para, toZ: p0.z,
        easeIn, easeOut, easingFunction: 'Quadratic',
      })
    }

    // squash & stretch: k é o fator vertical; a largura compensa, mantendo volume
    const esticar = (de: number, para: number, dur: number) => {
      const lx = (k: number) => 1 + (1 - k) * 0.5
      ecs.ScaleAnimation.set(world, eid, {
        duration: dur, loop: false,
        fromX: s0.x * lx(de), fromY: s0.y * de, fromZ: s0.z * lx(de),
        toX: s0.x * lx(para), toY: s0.y * para, toZ: s0.z * lx(para),
        easeIn: true, easeOut: true, easingFunction: 'Quadratic',
      })
    }

    const girarY = (de: number, para: number, dur: number,
                    easeIn: boolean, easeOut: boolean) => {
      ecs.RotateAnimation.set(world, eid, {
        duration: dur, loop: false, fromY: de, toY: para,
        easeIn, easeOut, easingFunction: 'Quadratic',
      })
    }

    const girarZ = (de: number, para: number, dur: number,
                    easeIn: boolean, easeOut: boolean) => {
      ecs.RotateAnimation.set(world, eid, {
        duration: dur, loop: false, fromZ: de, toZ: para,
        easeIn, easeOut, easingFunction: 'Quadratic',
      })
    }

    // ---- presets: cada um toca uma vez e volta ao repouso ----

    const tocar = (preset: string) => {
      const {intensidade: I, velocidade: V, elasticidade: E} = schemaAttribute.get(eid)
      const T = 1 / Math.max(V, 0.1)   // multiplicador de tempo
      const sq = 0.06 * E              // deformação máxima: 6% com elasticidade 1

      if (preset === 'flutuar') {
        // sobe, paira e desce
        const h = 0.12 * I
        mover(0, h, 1200 * T, true, true)
        depois(1200 * T, () => mover(h, h * 0.55, 1100 * T, true, true))
        depois(2300 * T, () => mover(h * 0.55, h, 1100 * T, true, true))
        depois(3400 * T, () => mover(h, 0, 1200 * T, true, true))

      } else if (preset === 'tremer') {
        // vibra algumas vezes e assenta
        const a = 0.015 * I
        let t = 0
        for (let i = 0; i < 14; i++) {
          const alvo = i % 2 === 0 ? a : -a
          const de = i === 0 ? 0 : (i % 2 === 0 ? -a : a)
          depois(t, () => mover(de, alvo, 70 * T, false, false))
          t += 70 * T
        }
        depois(t, () => mover(-a, 0, 120 * T, true, true))

      } else if (preset === 'pulsar') {
        // infla e volta, duas vezes
        const k = 1 + 0.08 * I
        esticar(1, k, 450 * T)
        depois(450 * T, () => esticar(k, 1, 450 * T))
        depois(1000 * T, () => esticar(1, k, 450 * T))
        depois(1450 * T, () => esticar(k, 1, 450 * T))

      } else if (preset === 'girar') {
        // impulso, giro solto e frenagem suave
        girarY(0, 120, 1200 * T, true, false)
        depois(1200 * T, () => girarY(120, 420, 1400 * T, false, false))
        depois(2600 * T, () => girarY(420, 540, 1300 * T, false, true))

      } else if (preset === 'balancar') {
        // pêndulo que perde força
        const a = 12 * I
        girarZ(0, -a, 500 * T, true, true)
        depois(500 * T, () => girarZ(-a, a * 0.8, 800 * T, true, true))
        depois(1300 * T, () => girarZ(a * 0.8, -a * 0.5, 800 * T, true, true))
        depois(2100 * T, () => girarZ(-a * 0.5, a * 0.25, 700 * T, true, true))
        depois(2800 * T, () => girarZ(a * 0.25, 0, 600 * T, true, true))

      } else if (preset === 'pular') {
        const h = 0.35 * I
        // 1. antecipação: agacha antes de subir
        if (sq > 0) esticar(1, 1 - sq, 260 * T)
        mover(0, -0.02 * I, 260 * T, true, true)

        // 2. impulso: estica e desacelera no topo
        depois(260 * T, () => {
          mover(-0.02 * I, h, 420 * T, false, true)
          if (sq > 0) esticar(1 + sq, 1, 420 * T)
        })

        // 3. queda: acelera
        depois(680 * T, () => {
          mover(h, 0, 300 * T, true, false)
          if (sq > 0) esticar(1, 1 + sq * 0.6, 300 * T)
        })

        // 4. pouso: absorve o impacto
        depois(980 * T, () => { if (sq > 0) esticar(1 + sq * 0.6, 1 - sq * 1.2, 110 * T) })

        // 5. assenta, passando um pouco do ponto
        depois(1090 * T, () => { if (sq > 0) esticar(1 - sq * 1.2, 1 + sq * 0.3, 180 * T) })
        depois(1270 * T, () => { if (sq > 0) esticar(1 + sq * 0.3, 1, 140 * T) })
      }
    }

    defineState('pronto')
      .initial()
      .onEnter(guardar)
      .listen(world.events.globalId, 'anim-next', () => {
        limpar()
        indice = (indice + 1) % PRESETS.length
        const preset = PRESETS[indice]
        world.events.dispatch(world.events.globalId, 'anim-name', {nome: preset} as any)
        tocar(preset)
      })
      .listen(world.events.globalId, 'anim-stop', limpar)
  },
})