import * as ecs from '@8thwall/ecs'

// animações que o aluno configura no inspector do GLB.
// Look At e Follow ficam de fora de propósito: são comportamentos contínuos
// que brigam com os gestos de girar e arrastar.
const COMPONENTES = [
  'PositionAnimation',
  'ScaleAnimation',
  'RotateAnimation',
  'CustomPropertyAnimation',
  'CustomVec3Animation',
]

const CAMPOS = [
  'autoFrom', 'fromX', 'fromY', 'fromZ', 'toX', 'toY', 'toZ',
  'shortestPath', 'duration', 'loop', 'reverse',
  'easeIn', 'easeOut', 'easingFunction', 'target',
  'property', 'component', 'from', 'to',
]

ecs.registerComponent({
  name: 'animar',
  schema: {},
  stateMachine: ({world, eid, defineState}) => {
    const config: {[nome: string]: any} = {}

    const p0 = {x: 0, y: 0, z: 0}
    const s0 = {x: 1, y: 1, z: 1}

    try {
      world.transform.getLocalPosition(eid, p0 as any)
      const s = ecs.Scale.get(world, eid)
      s0.x = s.x; s0.y = s.y; s0.z = s.z
    } catch (e) {}

    // guarda o que o aluno configurou e tira a animação do objeto,
    // para ela não tocar durante a tela de carregamento
    const capturar = () => {
      COMPONENTES.forEach((nome) => {
        const C = (ecs as any)[nome]
        try {
          const atual = C.get(world, eid)
          if (!atual) return
          const copia: any = {}
          CAMPOS.forEach((campo) => {
            if (atual[campo] !== undefined) copia[campo] = atual[campo]
          })
          config[nome] = copia
          C.remove(world, eid)
        } catch (e) {}
      })
    }

    const restaurar = () => {
      try {
        world.transform.setLocalPosition(eid, p0)
        ecs.Scale.set(world, eid, {x: s0.x, y: s0.y, z: s0.z})
        ecs.Quaternion.set(world, eid, {x: 0, y: 0, z: 0, w: 1})
      } catch (e) {}
    }

    capturar()
    restaurar()

    const tocar = () => {
      COMPONENTES.forEach((nome) => {
        if (!config[nome]) return
        try { (ecs as any)[nome].set(world, eid, config[nome]) } catch (e) {}
      })
    }

    // rede de segurança enquanto o objeto ainda está fora de vista
    const vigia = setInterval(() => { capturar(); restaurar() }, 100)
    const pararVigia = () => clearInterval(vigia)
    setTimeout(pararVigia, 4000)

    // espera o objeto ser inserido na cena para soltar as animações
    defineState('esperando')
      .initial()
      .onEvent('object-placed', 'animando', {target: world.events.globalId})

    defineState('animando')
      .onEnter(() => { pararVigia(); restaurar(); tocar() })
  },
})