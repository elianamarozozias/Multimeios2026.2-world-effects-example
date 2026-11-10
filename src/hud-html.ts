import * as ecs from '@8thwall/ecs'
import {Logo} from './logo'
import {OBJECT_PLACED_EVENT, OBJECT_RESET_EVENT} from './tap-to-place'

const logoQuery = ecs.defineQuery([Logo])
// todas as entidades que têm um modelo 3D, inclusive as de dentro do prefab
const modeloQuery = ecs.defineQuery([ecs.GltfModel])

// ─────────────────────────────────────────────────────────────
//  IDENTIDADE VISUAL — igual para todos os projetos do laboratório.
//  O que muda de grupo para grupo (texto da instrução e áudio)
//  fica no inspector, não aqui.
// ─────────────────────────────────────────────────────────────
const IMG = {
  mover: encodeURI('assets/Mover2.png'),
  escalar: encodeURI('assets/Escalar2.png'),
  rotacionar: encodeURI('assets/Rotacionar2.png'),
  lafda: encodeURI('assets/lafda branco.png'),
  uff: encodeURI('assets/simbolo uff.png'),
}

const COR = '#3F1240'          // roxo dos cartões e botões
const COR_RESET = '#F00'       // vermelho do botão Reposicionar
const TEXTO_CARREGANDO = 'Carregando...'
const TEXTO_BOTAO = 'Reposicionar'

// tempo que o HUD espera para a cena terminar de montar o prefab
const ESPERA_CENA = 1500
// limite para não travar a experiência se algo der errado
const LIMITE_CARREGAMENTO = 30000

// ícones dos botões redondos (desenhados aqui, não precisam de imagem)
const ICONE_PLAY = `<svg viewBox="0 0 24 24" width="55%" height="55%" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/><path d="M14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>`
const ICONE_STOP = `<svg viewBox="0 0 24 24" width="45%" height="45%" fill="#fff"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`
const ICONE_TROCAR = `<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>`
const ICONE_PIN = `<svg viewBox="0 0 24 24" width="55%" height="55%" fill="#fff"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>`

const CSS = `
  #hud * { box-sizing: border-box; }
  #hud { position: fixed; inset: 0; z-index: 10; pointer-events: none; font-family: sans-serif; }
  #hud .escondido { display: none !important; }

  #hud-loading { position: absolute; inset: 0; background: #000; color: #fff; pointer-events: none;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    font-size: clamp(16px, 4.5vw, 24px); }
  #hud-barra { width: min(70vw, 320px); height: 6px; border-radius: 3px;
    background: rgba(255,255,255,.25); overflow: hidden; }
  #hud-barra div { height: 100%; width: 0%; background: #fff; transition: width .3s linear; }

  #hud-gestos { position: absolute; left: 50%; transform: translateX(-50%);
    top: max(14px, env(safe-area-inset-top)); display: flex; gap: 3vw; }
  #hud-gestos .gesto { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  #hud-gestos .ic { width: clamp(56px, 16vw, 90px); aspect-ratio: 1; background: #fff; border-radius: 14px;
    display: flex; align-items: center; justify-content: center; overflow: hidden; }
  #hud-gestos .ic img { width: 100%; height: 100%; object-fit: contain; }
  #hud-gestos span { color: #fff; font-size: clamp(12px, 3.5vw, 18px); text-shadow: 0 1px 3px #000; }

  #hud-instrucao { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(92vw, 520px); background: ${COR}; border-radius: 18px; padding: 14px 16px;
    display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; }
  #hud-instrucao img { width: clamp(44px, 13vw, 70px); }
  #hud-instrucao p { margin: 0; text-align: center; font-size: clamp(13px, 3.8vw, 18px); line-height: 1.25; color: #fff; }
  #hud-instrucao b { grid-column: 1 / -1; text-align: center; font-weight: 400; color: #fff;
    font-size: clamp(15px, 4.4vw, 22px); }

  #hud-reset { position: absolute; pointer-events: auto; touch-action: manipulation;
    right: max(16px, env(safe-area-inset-right)); bottom: max(20px, env(safe-area-inset-bottom));
    background: ${COR_RESET}; color: #fff; border: none; border-radius: 14px;
    font-size: clamp(14px, 4vw, 20px); padding: clamp(10px, 3vw, 16px) clamp(16px, 5vw, 26px); }

  /* barra de botões redondos: áudio, trocar artefato e anotações.
     é uma linha flex, então eles se acomodam sozinhos conforme aparecem */
  #hud-acoes { position: absolute; display: flex; gap: clamp(8px, 2.5vw, 14px);
    left: max(16px, env(safe-area-inset-left));
    bottom: max(20px, env(safe-area-inset-bottom)); }
  #hud-acoes button { pointer-events: auto; touch-action: manipulation;
    width: clamp(52px, 14vw, 72px); aspect-ratio: 1; border-radius: 50%; border: none; padding: 0;
    background: ${COR}; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,.4); }
  #hud-acoes button.off { opacity: .45; }

  /* cartão das anotações clicáveis */
  #hud-nota { position: absolute; left: 50%; transform: translateX(-50%);
    bottom: calc(max(20px, env(safe-area-inset-bottom)) + clamp(66px, 18vw, 92px));
    width: min(92vw, 520px); max-height: 45vh; overflow-y: auto;
    background: ${COR}; color: #fff; border-radius: 18px; padding: 16px 18px;
    pointer-events: auto; box-shadow: 0 4px 16px rgba(0,0,0,.45); }
  #hud-nota h3 { margin: 0 30px 6px 0; font-size: clamp(15px, 4.2vw, 20px); font-weight: 600; }
  #hud-nota p { margin: 0; font-size: clamp(13px, 3.6vw, 17px); line-height: 1.4; }
  #hud-nota-fechar { position: absolute; top: 6px; right: 8px; background: none; border: none;
    color: #fff; font-size: clamp(22px, 6vw, 28px); line-height: 1; padding: 4px 10px;
    pointer-events: auto; touch-action: manipulation; }
`

// liga um botão do HTML a uma função, funcionando em Android e iPhone
const ligarBotao = (botao: HTMLElement, acao: () => void) => {
  let ultimoToque = 0
  const clicou = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    const agora = Date.now()
    if (agora - ultimoToque < 400) return // evita disparar 2x no mesmo toque
    ultimoToque = agora
    acao()
  }
  botao.addEventListener('pointerdown', (e) => e.stopPropagation())
  botao.addEventListener('touchstart', (e) => e.stopPropagation())
  botao.addEventListener('pointerup', clicou)
  botao.addEventListener('touchend', clicou)
  botao.addEventListener('click', clicou)
}

ecs.registerComponent({
  name: 'hud-html',
  schema: {
    // ⬇️ preenchidos no inspector, não no código
    instrucao: ecs.string,   // frase do cartão inicial
    audio: ecs.string,       // caminho do áudio; deixe vazio se não tiver
  },
  schemaDefaults: {
    instrucao: 'Clique em uma zona plana para inserir o artefato 3D',
    audio: 'assets/audio.mp3',
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    const {instrucao} = schemaAttribute.get(eid)

    // ---------- monta o HTML ----------
    let style = document.getElementById('hud-style')
    if (!style) {
      style = document.createElement('style')
      style.id = 'hud-style'
      document.head.appendChild(style)
    }
    style.textContent = CSS // sempre atualiza o CSS

    document.getElementById('hud')?.remove()
    const hud = document.createElement('div')
    hud.id = 'hud'
    hud.innerHTML = `
      <div id="hud-loading">
        <span>${TEXTO_CARREGANDO}</span>
        <div id="hud-barra"><div></div></div>
      </div>

      <div id="hud-gestos" class="escondido">
        <div class="gesto"><div class="ic"><img src="${IMG.mover}"></div><span>Mover</span></div>
        <div class="gesto"><div class="ic"><img src="${IMG.escalar}"></div><span>Escalar</span></div>
        <div class="gesto"><div class="ic"><img src="${IMG.rotacionar}"></div><span>Rotacionar</span></div>
      </div>

      <div id="hud-instrucao" class="escondido">
        <img src="${IMG.lafda}">
        <p>${instrucao || ''}</p>
        <img src="${IMG.uff}">
        <b>OK</b>
      </div>

      <div id="hud-nota" class="escondido">
        <button id="hud-nota-fechar">&times;</button>
        <h3 id="hud-nota-titulo"></h3>
        <p id="hud-nota-texto"></p>
      </div>

      <div id="hud-acoes">
        <button id="hud-audio" class="escondido">${ICONE_PLAY}</button>
        <button id="hud-trocar" class="escondido">${ICONE_TROCAR}</button>
        <button id="hud-notas" class="escondido">${ICONE_PIN}</button>
      </div>

      <button id="hud-reset" class="escondido">${TEXTO_BOTAO}</button>
    `
    document.body.appendChild(hud)

    const el = (id: string) => hud.querySelector('#' + id) as HTMLElement
    const mostrar = (id: string) => el(id).classList.remove('escondido')
    const esconder = (id: string) => el(id).classList.add('escondido')
    const barra = hud.querySelector('#hud-barra div') as HTMLElement

    // ---------- carregamento ----------
    // o aluno não precisa listar nada: o HUD pergunta à cena quais modelos 3D
    // existem (inclusive dentro do prefab) e baixa cada um. A tela só sai
    // quando TODOS os downloads que ele mesmo iniciou terminarem.
    let realidadePronta = false
    let liberado = false
    let pedidos = 0
    let concluidos = 0
    let cenaEstavel = 0          // ciclos seguidos sem achar modelo novo
    const inicio = Date.now()
    const jaBaixados = new Set<string>()

    const atualizarBarra = () => {
      if (liberado) return
      const pct = pedidos === 0 ? 5 : Math.round((concluidos / pedidos) * 90)
      barra.style.width = `${Math.max(5, pct)}%`
    }

    // procura modelos novos na cena e baixa os que ainda não foram buscados
    const buscarModelos = () => {
      let novos = 0
      modeloQuery(world).forEach((e) => {
        try {
          const dados: any = ecs.GltfModel.get(world, e)
          const url = dados && dados.url
          if (!url || jaBaixados.has(url)) return
          jaBaixados.add(url)
          pedidos += 1
          novos += 1
          fetch(encodeURI(url))
            .then((r) => r.blob())
            .catch((err) => console.log('[HUD] erro baixando', url, err))
            .then(() => {
              concluidos += 1
              atualizarBarra()
            })
        } catch (err) {}
      })
      if (novos > 0) {
        cenaEstavel = 0
        console.log(`[HUD] achou ${novos} modelo(s), total ${pedidos}`)
      } else {
        cenaEstavel += 1
      }
    }

    const liberar = (motivo: string) => {
      if (liberado) return
      liberado = true
      clearInterval(vigia)
      barra.style.width = '100%'
      console.log(`[HUD] ${motivo} — ${Date.now() - inicio}ms, ${concluidos}/${pedidos} modelos`)
      world.events.dispatch(eid, 'tudo-pronto')
    }

    const vigia = setInterval(() => {
      buscarModelos()
      atualizarBarra()

      if (Date.now() - inicio > LIMITE_CARREGAMENTO) {
        liberar('tempo limite')
        return
      }

      // libera quando: realidade pronta, a cena parou de criar modelos novos,
      // e todos os downloads terminaram
      const cenaPronta = cenaEstavel >= Math.round(ESPERA_CENA / 200)
      const tudoBaixado = pedidos > 0 && concluidos >= pedidos
      if (realidadePronta && cenaPronta && tudoBaixado) {
        liberar('tudo carregado')
      }
    }, 200)

    // ---------- áudio (Web Audio API) ----------
    // o elemento <audio> precisa de permissão a cada play, e isso falha quando
    // o play não sai direto de um toque. O AudioContext é destravado uma vez
    // no primeiro toque e depois toca quando quiser, sem pedir mais nada.
    const caminhoAudio = (schemaAttribute.get(eid).audio || '').trim()
    const botaoAudio = el('hud-audio')

    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx = AC ? new AC() : null
    let buffer: AudioBuffer | null = null
    let fonte: AudioBufferSourceNode | null = null
    let tocando = false
    let pendente = false   // pediram para tocar antes do arquivo ficar pronto

    const pararAudio = () => {
      if (fonte) {
        try { fonte.stop() } catch (e) {}
        fonte = null
      }
      pendente = false
      tocando = false
      botaoAudio.innerHTML = ICONE_PLAY
    }

    const tocarAudio = () => {
      if (!ctx) return
      // na primeira execução o arquivo ainda pode estar baixando:
      // marca o pedido e toca assim que ele ficar pronto
      if (!buffer) { pendente = true; return }
      pararAudio()
      fonte = ctx.createBufferSource()
      fonte.buffer = buffer
      fonte.connect(ctx.destination)
      fonte.onended = () => { if (tocando) pararAudio() }
      fonte.start(0)
      tocando = true
      botaoAudio.innerHTML = ICONE_STOP
    }

    // baixa e decodifica o arquivo uma vez
    if (ctx && caminhoAudio) {
      fetch(encodeURI(caminhoAudio))
        .then((r) => r.arrayBuffer())
        .then((dados) => ctx.decodeAudioData(dados))
        .then((b) => {
          buffer = b
          console.log('[HUD] áudio pronto')
          if (pendente) { pendente = false; tocarAudio() }
        })
        .catch((err) => console.log('[HUD] erro carregando áudio:', err))
    }

    // destrava o contexto no primeiro toque da tela — vale para a sessão toda
    const destravar = () => {
      if (!ctx) return
      if (ctx.state === 'suspended') ctx.resume()
      document.removeEventListener('touchstart', destravar)
      document.removeEventListener('pointerdown', destravar)
    }
    document.addEventListener('touchstart', destravar)
    document.addEventListener('pointerdown', destravar)

    ligarBotao(botaoAudio, () => {
      if (tocando || pendente) pararAudio()
      else tocarAudio()
    })

    // ---------- troca de artefato ----------
    // cada GLB dentro do prefab leva o componente 'alternar-objeto' com sua
    // ordem (1, 2, 3...). Eles se anunciam ao nascer e o HUD conta quantos são:
    // o botão só aparece quando há mais de um.
    let totalObjetos = 1
    let objetoAtual = 1

    world.events.addListener(world.events.globalId, 'objeto-registrado', (e: any) => {
      const o = Math.round(e.data?.ordem || 1)
      if (o > totalObjetos) {
        totalObjetos = o
        console.log(`[HUD] ${totalObjetos} artefato(s) no prefab`)
      }
    })

    ligarBotao(el('hud-trocar'), () => {
      if (totalObjetos < 2) return
      esconder('hud-nota')   // a anotação aberta é do artefato anterior
      objetoAtual = (objetoAtual % totalObjetos) + 1
      world.events.dispatch(world.events.globalId, 'trocar-objeto', {indice: objetoAtual} as any)
    })

    // ---------- anotações clicáveis ----------
    // pontos marcados no modelo levam o componente 'Anotacao'. Eles se anunciam
    // ao nascer; o botão de pin aparece se houver ao menos um e liga/desliga
    // todos de uma vez, porque às vezes os pontos atrapalham a visualização.
    let temAnotacoes = false
    let anotacoesVisiveis = true
    const botaoNotas = el('hud-notas')

    world.events.addListener(world.events.globalId, 'anotacao-registrada', () => {
      if (!temAnotacoes) {
        temAnotacoes = true
        console.log('[HUD] anotações encontradas')
      }
    })

    world.events.addListener(world.events.globalId, 'abrir-anotacao', (e: any) => {
      el('hud-nota-titulo').textContent = e.data?.titulo || ''
      el('hud-nota-texto').textContent = e.data?.texto || ''
      mostrar('hud-nota')
    })

    ligarBotao(el('hud-nota-fechar'), () => esconder('hud-nota'))

    const aplicarAnotacoes = () => {
      botaoNotas.classList.toggle('off', !anotacoesVisiveis)
      if (!anotacoesVisiveis) esconder('hud-nota')
      world.events.dispatch(
        world.events.globalId, 'anotacoes-visiveis', {visivel: anotacoesVisiveis} as any
      )
    }

    ligarBotao(botaoNotas, () => {
      anotacoesVisiveis = !anotacoesVisiveis
      aplicarAnotacoes()
    })

    // ---------- botão Reposicionar ----------
    ligarBotao(el('hud-reset'), () => {
      console.log('[HUD] reposicionar clicado')
      world.events.dispatch(world.events.globalId, 'hud-reset-click')
    })

    // ---------- estados ----------
    // 1) carregando: espera a realidade e o download dos modelos
    defineState('carregando')
      .initial()
      .listen(world.events.globalId, ecs.events.REALITY_READY, () => {
        realidadePronta = true
      })
      .onEvent('tudo-pronto', 'instrucao')

    // 2) instrução no meio; some com qualquer toque
    //    (volta pra cá depois de cada Reposicionar)
    defineState('instrucao')
      .onEnter(() => {
        pararAudio()
        objetoAtual = 1
        anotacoesVisiveis = true
        aplicarAnotacoes()
        esconder('hud-loading')
        esconder('hud-gestos')
        esconder('hud-reset')
        esconder('hud-audio')
        esconder('hud-trocar')
        esconder('hud-notas')
        esconder('hud-nota')
        mostrar('hud-instrucao')
      })
      .listen(world.events.globalId, ecs.input.SCREEN_TOUCH_START, () => {
        esconder('hud-instrucao')
        destravar()
      })
      .onEvent(OBJECT_PLACED_EVENT, 'colocado', {target: world.events.globalId})

    // 3) objeto colocado: gestos, reposicionar, áudio, troca e anotações
    defineState('colocado')
      .onEnter(() => {
        esconder('hud-loading')
        esconder('hud-instrucao')
        mostrar('hud-gestos')
        mostrar('hud-reset')
        if (ctx) {
          mostrar('hud-audio')
          tocarAudio()
        }
        // cada botão só aparece se o projeto tiver aquilo
        if (totalObjetos > 1) mostrar('hud-trocar')
        if (temAnotacoes) mostrar('hud-notas')
      })
      .onEvent('hud-reset-click', 'resetando', {target: world.events.globalId})

    // 4) resetando: o 3D afunda e some em 1s, depois o card de instrução volta
    defineState('resetando')
      .wait(1000, 'instrucao')
      .onEnter(() => {
        pararAudio()
        esconder('hud-reset')
        esconder('hud-gestos')
        esconder('hud-audio')
        esconder('hud-trocar')
        esconder('hud-notas')
        esconder('hud-nota')
        const tempVector = ecs.math.vec3.zero()
        logoQuery(world).forEach((e) => {
          world.transform.getLocalPosition(e, tempVector)
          ecs.PositionAnimation.set(world, e, {
            duration: 1000,
            loop: false,
            fromX: tempVector.x,
            fromY: tempVector.y,
            fromZ: tempVector.z,
            toX: tempVector.x,
            toY: -4,
            toZ: tempVector.z,
            easeIn: true,
            easingFunction: 'Quadratic',
          })
        })
      })
      .onExit(() => {
        logoQuery(world).forEach((e) => {
          ecs.PositionAnimation.remove(world, e)
          world.transform.setLocalPosition(e, {x: 0, y: -100, z: 0})
        })
        world.events.dispatch(world.events.globalId, OBJECT_RESET_EVENT)
      })
  },
  remove: () => {
    document.getElementById('hud')?.remove()
    document.getElementById('hud-style')?.remove()
  },
})