import * as ecs from '@8thwall/ecs'

// ─────────────────────────────────────────────────────────────
//  ANOTAÇÃO CLICÁVEL
//
//  Cria um ponto que, ao ser tocado, mostra um texto na tela.
//
//  Como usar:
//  1. Dentro do prefab, crie uma entidade com uma esfera pequena
//     (New Component > Mesh > Sphere), do tamanho de uma bolinha de gude
//  2. Na Hierarchy, arraste a esfera para DENTRO do GLB que ela explica,
//     e posicione em cima da parte do artefato que quer descrever
//  3. Adicione este componente nela e escreva o Título e o Texto
//
//  Repita para cada ponto. O botão de mostrar/ocultar as anotações
//  aparece sozinho na tela quando existe pelo menos uma.
//
//  Funciona igual com um ou vários artefatos 3D: se o GLB que contém a
//  esfera não é o que está em cena, a esfera se cala sozinha.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  AJUSTE FINO DO TOQUE
// ─────────────────────────────────────────────────────────────

// Tolerância em pixels ao redor do ponto. Como a esfera na tela é pequena,
// aceitar um toque "perto dela" é o que torna o alvo confortável no celular.
// 44 = padrão | 30 = exige mais precisão | 60 = bem permissivo
const RAIO_TOQUE = 44

// Se o dedo andar mais que isso entre encostar e soltar, foi arrasto
// (a pessoa estava movendo o objeto) e a anotação não abre.
const LIMITE_ARRASTO = 12

// até onde subir na hierarquia procurando um pai escondido
const LIMITE_PAIS = 20

// ─────────────────────────────────────────────────────────────
//  Disputa entre pontos próximos.
//  Todas as anotações da cena compartilham estas variáveis, então quando
//  duas estão perto uma da outra na tela, abre a que está mais perto do dedo
//  em vez de abrir as duas.
// ─────────────────────────────────────────────────────────────
let candidata: {dist: number, titulo: string, texto: string} | null = null
let resolvendo = false

const concorrer = (world: any, dist: number, titulo: string, texto: string) => {
  if (!candidata || dist < candidata.dist) candidata = {dist, titulo, texto}
  if (resolvendo) return
  resolvendo = true
  setTimeout(() => {
    resolvendo = false
    const c = candidata
    candidata = null
    if (!c) return
    world.events.dispatch(
      world.events.globalId, 'abrir-anotacao', {titulo: c.titulo, texto: c.texto} as any
    )
  }, 0)
}

ecs.registerComponent({
  // ⚠️ este nome precisa ser idêntico ao que aparece no inspector
  name: 'Anotacao',
  schema: {
    titulo: ecs.string,
    texto: ecs.string,
  },
  schemaDefaults: {
    titulo: 'Detalhe',
    texto: 'Escreva aqui a descrição desta parte do artefato.',
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    let inicio: {x: number, y: number} | null = null
    let multiToque = false

    // O toque próprio do 8th Wall erra quando a esfera está aninhada dentro
    // de um GLB. Então a gente não depende dele: projeta a posição real da
    // esfera na tela e vê se o dedo encostou perto. Isso funciona em qualquer
    // hierarquia e dá um alvo maior do que a bolinha, que ajuda no celular.
    const distanciaDoDedo = (x: number, y: number): number | null => {
      try {
        const three: any = (world as any).three
        const obj = three.entityToObject.get(eid)
        const cam = three.activeCamera
        if (!obj || !cam) return null

        const v = obj.position.clone()
        v.setFromMatrixPosition(obj.matrixWorld)
        v.project(cam)

        // atrás da câmera
        if (v.z < -1 || v.z > 1) return null

        const rect = three.renderer.domElement.getBoundingClientRect()
        const sx = rect.left + (v.x * 0.5 + 0.5) * rect.width
        const sy = rect.top + (-v.y * 0.5 + 0.5) * rect.height
        return Math.hypot(x - sx, y - sy)
      } catch (e) {
        return null
      }
    }

    // Se esta esfera, ou o GLB que a contém, ou qualquer pai acima estiver
    // escondido, o toque é ignorado. É isso que faz as anotações do artefato 2
    // ficarem mudas enquanto o artefato 1 está em cena, sem configurar nada.
    const estaEscondido = () => {
      let atual: any = eid
      for (let i = 0; i < LIMITE_PAIS; i += 1) {
        try {
          if (ecs.Hidden.has(world, atual)) return true
        } catch (e) {}

        let pai: any = null
        try { pai = world.getParent(atual) } catch (e) { pai = null }

        if (pai === null || pai === undefined || pai === atual) return false
        atual = pai
      }
      return false
    }

    const abrir = (dist: number) => {
      const {titulo, texto} = schemaAttribute.get(eid)
      concorrer(world, dist, titulo, texto)
    }

    const mostrarPonto = () => { try { ecs.Hidden.remove(world, eid) } catch (e) {} }
    const esconderPonto = () => { try { ecs.Hidden.set(world, eid) } catch (e) {} }

    // ---------- toque na tela ----------
    const naHud = (alvo: any) => {
      try { return !!(alvo && alvo.closest && alvo.closest('#hud')) } catch (e) { return false }
    }

    const onStart = (ev: TouchEvent) => {
      if (naHud(ev.target)) { inicio = null; return }
      multiToque = ev.touches.length > 1
      const t = ev.touches[0]
      inicio = t ? {x: t.clientX, y: t.clientY} : null
    }

    const onEnd = (ev: TouchEvent) => {
      const comeco = inicio
      inicio = null
      if (!comeco || multiToque) return
      if (ev.touches.length > 0) return          // ainda tem dedo na tela
      const t = ev.changedTouches && ev.changedTouches[0]
      if (!t) return
      if (Math.hypot(t.clientX - comeco.x, t.clientY - comeco.y) > LIMITE_ARRASTO) return
      if (estaEscondido()) return

      const d = distanciaDoDedo(t.clientX, t.clientY)
      if (d !== null && d <= RAIO_TOQUE) abrir(d)
    }

    // mouse, para testar no preview do computador
    const onDown = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch') return
      if (naHud(ev.target)) { inicio = null; return }
      multiToque = false
      inicio = {x: ev.clientX, y: ev.clientY}
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch') return
      const comeco = inicio
      inicio = null
      if (!comeco) return
      if (Math.hypot(ev.clientX - comeco.x, ev.clientY - comeco.y) > LIMITE_ARRASTO) return
      if (estaEscondido()) return

      const d = distanciaDoDedo(ev.clientX, ev.clientY)
      if (d !== null && d <= RAIO_TOQUE) abrir(d)
    }

    // avisa o HUD que existe, para o botão de anotações aparecer.
    // repete algumas vezes porque o HUD pode ainda não estar ouvindo
    // no instante em que o prefab nasce.
    const avisar = () => {
      world.events.dispatch(world.events.globalId, 'anotacao-registrada', {} as any)
    }
    avisar()
    setTimeout(avisar, 500)
    setTimeout(avisar, 1500)

    defineState('default')
      .initial()
      .onEnter(() => {
        window.addEventListener('touchstart', onStart, {passive: true})
        window.addEventListener('touchend', onEnd, {passive: true})
        window.addEventListener('touchcancel', onEnd, {passive: true})
        window.addEventListener('pointerdown', onDown, {passive: true})
        window.addEventListener('pointerup', onUp, {passive: true})
      })
      .onExit(() => {
        window.removeEventListener('touchstart', onStart)
        window.removeEventListener('touchend', onEnd)
        window.removeEventListener('touchcancel', onEnd)
        window.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointerup', onUp)
      })
      // rede de segurança: se o toque do próprio 8th Wall acertar a esfera,
      // vale também. Ganha quem estiver mais perto do dedo.
      .listen(eid, ecs.input.SCREEN_TOUCH_START, () => {
        if (estaEscondido()) return
        abrir(0)
      })
      // o botão do HUD liga e desliga todos os pontos de uma vez
      .listen(world.events.globalId, 'anotacoes-visiveis', (e) => {
        if ((e.data as any)?.visivel) mostrarPonto()
        else esconderPonto()
      })
  },
})