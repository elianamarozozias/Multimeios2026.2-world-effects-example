import * as ecs from '@8thwall/ecs'
import {Logo} from './logo'
import {OBJECT_PLACED_EVENT, OBJECT_RESET_EVENT} from './tap-to-place'

const logoQuery = ecs.defineQuery([Logo])

// ⬇️ TROCAR pelos caminhos das imagens deste projeto (como aparecem em src/assets)
const IMG = {
  mover: encodeURI('assets/Mover2.png'),
  escalar: encodeURI('assets/Escalar2.png'),
  rotacionar: encodeURI('assets/Rotacionar2.png'),
  lafda: encodeURI('assets/lafda branco.png'),
  uff: encodeURI('assets/simbolo uff.png'),
}

// ⬇️ TROCAR pelos textos deste projeto
const TEXTO_INSTRUCAO = 'Clique em uma zona plana para inserir o artefato 3D'
const TEXTO_BOTAO = 'Reposicionar'

// ícones do botão de áudio (desenhados aqui, não precisam de imagem)
const ICONE_PLAY = `<svg viewBox="0 0 24 24" width="55%" height="55%" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/><path d="M14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>`
const ICONE_STOP = `<svg viewBox="0 0 24 24" width="45%" height="45%" fill="#fff"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`

const CSS = `
  #hud * { box-sizing: border-box; }
  #hud { position: fixed; inset: 0; z-index: 10; pointer-events: none; font-family: sans-serif; }
  #hud .escondido { display: none !important; }

  #hud-loading { position: absolute; inset: 0; background: #000; color: #fff; pointer-events: none;
    display: flex; align-items: center; justify-content: center; font-size: clamp(16px, 4.5vw, 24px); }

  #hud-gestos { position: absolute; left: 50%; transform: translateX(-50%);
    top: max(14px, env(safe-area-inset-top)); display: flex; gap: 3vw; }
  #hud-gestos .gesto { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  #hud-gestos .ic { width: clamp(56px, 16vw, 90px); aspect-ratio: 1; background: #fff; border-radius: 14px;
    display: flex; align-items: center; justify-content: center; overflow: hidden; }
  #hud-gestos .ic img { width: 100%; height: 100%; object-fit: contain; }
  #hud-gestos span { color: #fff; font-size: clamp(12px, 3.5vw, 18px); text-shadow: 0 1px 3px #000; }

  #hud-instrucao { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(92vw, 520px); background: #3F1240; border-radius: 18px; padding: 14px 16px;
    display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; }
  #hud-instrucao img { width: clamp(44px, 13vw, 70px); }
  #hud-instrucao p { margin: 0; text-align: center; font-size: clamp(13px, 3.8vw, 18px); line-height: 1.25; color: #fff; }
  #hud-instrucao b { grid-column: 1 / -1; text-align: center; font-weight: 400; color: #fff;
    font-size: clamp(15px, 4.4vw, 22px); }

  #hud-reset { position: absolute; pointer-events: auto; touch-action: manipulation;
    right: max(16px, env(safe-area-inset-right)); bottom: max(20px, env(safe-area-inset-bottom));
    background: #F00; color: #fff; border: none; border-radius: 14px;
    font-size: clamp(14px, 4vw, 20px); padding: clamp(10px, 3vw, 16px) clamp(16px, 5vw, 26px); }

  #hud-audio { position: absolute; pointer-events: auto; touch-action: manipulation;
    left: max(16px, env(safe-area-inset-left)); bottom: max(20px, env(safe-area-inset-bottom));
    width: clamp(52px, 14vw, 72px); aspect-ratio: 1; border-radius: 50%; border: none; padding: 0;
    background: #3F1240; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,.4); }
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
  // ⬇️ campo que aparece no painel do editor: o aluno digita o caminho do áudio aqui
  schema: {
    audio: ecs.string,
  },
  schemaDefaults: {
    audio: 'assets/audio.mp3',
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
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
      <div id="hud-loading">Carregando...</div>

      <div id="hud-gestos" class="escondido">
        <div class="gesto"><div class="ic"><img src="${IMG.mover}"></div><span>Mover</span></div>
        <div class="gesto"><div class="ic"><img src="${IMG.escalar}"></div><span>Escalar</span></div>
        <div class="gesto"><div class="ic"><img src="${IMG.rotacionar}"></div><span>Rotacionar</span></div>
      </div>

      <div id="hud-instrucao" class="escondido">
        <img src="${IMG.lafda}">
        <p>${TEXTO_INSTRUCAO}</p>
        <img src="${IMG.uff}">
        <b>OK</b>
      </div>

      <button id="hud-audio" class="escondido">${ICONE_PLAY}</button>
      <button id="hud-reset" class="escondido">${TEXTO_BOTAO}</button>
    `
    document.body.appendChild(hud)

    const el = (id: string) => hud.querySelector('#' + id) as HTMLElement
    const mostrar = (id: string) => el(id).classList.remove('escondido')
    const esconder = (id: string) => el(id).classList.add('escondido')

    // seguro: se em 8s não liberou, tira o loading da frente (iPhone)
    setTimeout(() => esconder('hud-loading'), 8000)

    // ---------- áudio ----------
    const caminhoAudio = (schemaAttribute.get(eid).audio || '').trim()
    const audio = caminhoAudio ? new Audio(encodeURI(caminhoAudio)) : null
    if (audio) audio.preload = 'auto'
    const botaoAudio = el('hud-audio')
    let audioLiberado = false

    const pararAudio = () => {
      if (!audio) return
      audio.pause()
      audio.currentTime = 0
      botaoAudio.innerHTML = ICONE_PLAY
    }

    const tocarAudio = () => {
      if (!audio) return
      audio.volume = 1
      audio.currentTime = 0
      audio.play()
        .then(() => { audioLiberado = true })
        .catch((err) => {
          console.log('[HUD] não tocou o áudio:', err)
          // o destravamento pode ainda estar em andamento; tenta de novo
          setTimeout(() => { audio.play().catch(() => {}) }, 200)
        })
      botaoAudio.innerHTML = ICONE_STOP
    }

    if (audio) audio.addEventListener('ended', pararAudio)

    // destrava o áudio em qualquer toque da tela (exigência do iPhone).
    // o volume vai a zero antes do play para não escapar nenhum som.
    const liberarAudio = () => {
      if (!audio || audioLiberado) return
      audio.volume = 0
      audio.play().then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.volume = 1
        audioLiberado = true
      }).catch(() => { audio.volume = 1 })
    }

    // tenta destravar no primeiro toque, aconteça onde acontecer
    const destravarNoPrimeiroToque = () => {
      liberarAudio()
      if (audioLiberado) {
        document.removeEventListener('touchstart', destravarNoPrimeiroToque)
        document.removeEventListener('pointerdown', destravarNoPrimeiroToque)
      }
    }
    document.addEventListener('touchstart', destravarNoPrimeiroToque)
    document.addEventListener('pointerdown', destravarNoPrimeiroToque)

    // o play() fica direto no toque, que é o que o iPhone exige pra liberar som
    ligarBotao(botaoAudio, () => {
      if (!audio) return
      if (audio.paused) tocarAudio()
      else pararAudio()
    })

    // ---------- botão Reposicionar ----------
    ligarBotao(el('hud-reset'), () => {
      console.log('[HUD] reposicionar clicado')
      world.events.dispatch(world.events.globalId, 'hud-reset-click')
    })

    // ---------- estados ----------
    // 1) carregando
    defineState('carregando')
      .initial()
      .onEvent(ecs.events.REALITY_READY, 'instrucao', {target: world.events.globalId})

    // 2) instrução no meio; some com qualquer toque
    //    (volta pra cá depois de cada Reposicionar)
    defineState('instrucao')
      .onEnter(() => {
        pararAudio()
        esconder('hud-loading')
        esconder('hud-gestos')
        esconder('hud-reset')
        esconder('hud-audio')
        mostrar('hud-instrucao')
      })
      .listen(world.events.globalId, ecs.input.SCREEN_TOUCH_START, () => {
        esconder('hud-instrucao')
        liberarAudio()
      })
      .onEvent(OBJECT_PLACED_EVENT, 'colocado', {target: world.events.globalId})

    // 3) objeto colocado: gestos + reposicionar + áudio
    //    o som começa junto com a inserção do objeto
    defineState('colocado')
      .onEnter(() => {
        esconder('hud-loading')
        esconder('hud-instrucao')
        mostrar('hud-gestos')
        mostrar('hud-reset')
        if (audio) {
          mostrar('hud-audio')
          tocarAudio()
        }
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
    document.querySelectorAll('#hud audio').forEach((a: any) => a.pause())
    document.getElementById('hud')?.remove()
    document.getElementById('hud-style')?.remove()
  },
})