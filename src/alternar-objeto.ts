import * as ecs from '@8thwall/ecs'

// eventos trocados com o HUD
const PEDIR_TROCA = 'trocar-objeto'      // HUD -> objetos: mostre o de índice N
const REGISTRAR = 'objeto-registrado'    // objetos -> HUD: existo, minha ordem é N

ecs.registerComponent({
  name: 'alternar-objeto',
  schema: {
    // Ordem em que este objeto aparece: 1, 2, 3...
    // O de ordem 1 é o que nasce visível; os outros ficam escondidos.
    ordem: ecs.f32,
  },
  schemaDefaults: {
    ordem: 1,
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    const minhaOrdem = Math.max(1, Math.round(schemaAttribute.get(eid).ordem || 1))

    const mostrar = () => { try { ecs.Hidden.remove(world, eid) } catch (e) {} }
    const esconder = () => { try { ecs.Hidden.set(world, eid) } catch (e) {} }

    // avisa o HUD que existe, para ele saber quantos objetos há no prefab.
    // repete algumas vezes porque o HUD pode ainda não estar ouvindo
    // no instante em que o prefab nasce.
    const avisar = () => {
      world.events.dispatch(world.events.globalId, REGISTRAR, {ordem: minhaOrdem} as any)
    }
    avisar()
    setTimeout(avisar, 500)
    setTimeout(avisar, 1500)

    // só o primeiro nasce visível
    if (minhaOrdem !== 1) esconder()

    defineState('default')
      .initial()
      .listen(world.events.globalId, PEDIR_TROCA, (e) => {
        const alvo = Math.round((e.data as any)?.indice || 1)
        if (alvo === minhaOrdem) mostrar()
        else esconder()
      })
      // ao reposicionar, a experiência volta para o primeiro objeto
      .listen(world.events.globalId, 'object-reset', () => {
        if (minhaOrdem === 1) mostrar()
        else esconder()
      })
  },
})
