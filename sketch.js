//-------------------------------
// Configurações iniciais
//-------------------------------
const cores = ['#e57373', '#5a9bd4', '#f4d06f', '#98dfaf', '#c1a3e7'];
let indiceCor = 0;
const tempoDeTroca = 10000; // 10 segundos
let ultimoTempo = 0;

const fundo = [250, 250, 245]; // fundo como array RGB
let corAtual = cores[0];
let pesoTraco = 10;
const pesoBorracha = 400;
const parametrosUrl = new URLSearchParams(window.location.search);
const debugAtivo = parametrosUrl.get('debug') === '1';
const perfilDiagnostico = parametrosUrl.get('perfil') === 'experimental'
  ? 'experimental'
  : 'original';

// Controle de posição para desenho
let posAtual = null;
let ultimaAmostraX = 0;
let ultimaAmostraY = 0;
let ultimoTempoAmostra = 0;

// Controle de processamento da inferência
let versaoLandmarks = 0;
let versaoProcessada = 0;

// Perfis A/B de precisão; baseline preserva os defaults do MediaPipe.
const perfilPrecisaoAtivo = perfilDiagnostico === 'experimental'
  ? 'experimental'
  : 'baseline';
const resolucaoCameraAtiva = '640x480';
const perfisPrecisao = {
  baseline: {},
  experimental: {
    minHandDetectionConfidence: 0.7,
    minHandPresenceConfidence: 0.7,
    minTrackingConfidence: 0.7
  },
  detectionConfidence: { minHandDetectionConfidence: 0.7 },
  presenceConfidence: { minHandPresenceConfidence: 0.7 },
  trackingConfidence: { minTrackingConfidence: 0.7 }
};

// Diagnóstico opcional de desempenho
const janelaDiagnosticoMs = 10000;
let diagnosticoMedicaoAtiva = false;
let diagnosticoInicio = 0;
let diagnosticoFramesRenderizados = 0;
let diagnosticoFramesVideo = 0;
let diagnosticoInferencias = 0;
let diagnosticoFramesProcessados = 0;
let diagnosticoPerdasRastreamento = 0;
let diagnosticoDuracoesInferencia = [];
let diagnosticoRastreamentoAtivo = false;
let diagnosticoResumoEmitido = false;
let diagnosticoLandmarksAnteriores = null;
let diagnosticoDeslocamentosLandmarks = { 5: [], 6: [], 7: [], 8: [] };
let diagnosticoDeslocamentosSuavizados = [];
let painelDiagnostico = null;
let diagnosticoResultado = null;

// Controle independente das formas de apagar
let borrachaGestualAtiva = false;
let borrachaManualAtiva = false;

//-------------------------------
// MediaPipe Landmarkers
//-------------------------------
let myHandLandmarker;
let myCapture;
let handLandmarks = null;
let previsaoAtiva = true;
let ultimoFrameVideo = -1;

// Configurações de rastreamento
const trackingConfig = {
  doAcquireHandLandmarks: true,
  cpuOrGpuString: "GPU",
  maxNumHands: 1
};

//-------------------------------
// Preload MediaPipe
//-------------------------------
async function preload() {
  try {
    const mediapipe_module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const { HandLandmarker, FilesetResolver } = mediapipe_module;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    if (trackingConfig.doAcquireHandLandmarks) {
      const opcoesPrecisao = perfisPrecisao[perfilPrecisaoAtivo];
      myHandLandmarker = await HandLandmarker.createFromOptions(vision, {
        numHands: trackingConfig.maxNumHands,
        runningMode: "VIDEO",
        ...opcoesPrecisao,
        baseOptions: {
          delegate: trackingConfig.cpuOrGpuString,
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        }
      });
    }
  } catch (error) {
    previsaoAtiva = false;
    console.error('[Free Fingers] Falha ao inicializar o MediaPipe.', error);
  }
}

//-------------------------------
// Webcam Prediction
//-------------------------------
function predictWebcam() {
  if (!previsaoAtiva) return;

  agendarPorFrameDeVideo(myCapture?.elt);
}

function agendarPorFrameDeVideo(video) {
  if (!video || video.readyState < 2) {
    if (previsaoAtiva) window.requestAnimationFrame(predictWebcam);
    return;
  }

  if (typeof video.requestVideoFrameCallback === 'function') {
    video.requestVideoFrameCallback((tempo, metadata) => {
      if (!previsaoAtiva) return;
      const identificadorFrame = metadata.presentedFrames ?? metadata.mediaTime;
      if (identificadorFrame !== ultimoFrameVideo) {
        ultimoFrameVideo = identificadorFrame;
        if (diagnosticoMedicaoAtiva) diagnosticoFramesVideo += 1;
        executarInferencia(video, tempo, metadata.mediaTime);
      }
      agendarPorFrameDeVideo(video);
    });
    return;
  }

  const agora = performance.now();
  if (ultimoFrameVideo !== video.currentTime) {
    ultimoFrameVideo = video.currentTime;
    if (diagnosticoMedicaoAtiva) diagnosticoFramesVideo += 1;
    executarInferencia(video, agora, video.currentTime);
  }
  if (previsaoAtiva) window.requestAnimationFrame(predictWebcam);
}

function executarInferencia(video, tempo, identificadorFrame) {
  if (!myHandLandmarker || !trackingConfig.doAcquireHandLandmarks ||
      identificadorFrame === undefined) return;

  try {
    const inicioInferencia = performance.now();
    handLandmarks = myHandLandmarker.detectForVideo(video, tempo);
    const duracaoInferencia = performance.now() - inicioInferencia;
    if (diagnosticoMedicaoAtiva) {
      registrarInferencia(duracaoInferencia, handLandmarks);
    }
    versaoLandmarks += 1;
  } catch (error) {
    previsaoAtiva = false;
    handLandmarks = null;
    versaoLandmarks += 1;
    console.error('[Free Fingers] Falha durante a inferência.', error);
  }
}

//-------------------------------
// Setup Canvas e Webcam
//-------------------------------
function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.style('display', 'block');
  canvas.style('position', 'fixed');
  canvas.style('top', '0');
  canvas.style('left', '0');

  canvas.style('background', `rgb(${fundo.join(', ')})`);
  clear();

  myCapture = createCapture(obterConfiguracaoCamera());
  myCapture.size(320, 240);
  myCapture.hide();

  corAtual = cores[indiceCor];

  if (debugAtivo) criarPainelDiagnostico();

  predictWebcam();
}

function obterConfiguracaoCamera() {
  if (resolucaoCameraAtiva === '1280x720') {
    return {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: false
    };
  }

  return VIDEO;
}

//-------------------------------
// Função Draw
//-------------------------------
function draw() {
  if (diagnosticoMedicaoAtiva) registrarFrameRenderizado();
  atualizarCor();
  processarMaoEDesenhar();
}

function iniciarDiagnostico() {
  if (diagnosticoMedicaoAtiva && diagnosticoInicio === 0) {
    diagnosticoInicio = performance.now();
  }
}

function registrarFrameRenderizado() {
  iniciarDiagnostico();
  diagnosticoFramesRenderizados += 1;
  finalizarDiagnosticoSeNecessario();
}

function registrarInferencia(duracao, resultado) {
  iniciarDiagnostico();
  diagnosticoInferencias += 1;
  diagnosticoDuracoesInferencia.push(duracao);
  registrarMovimentoLandmarks(resultado);

  const rastreouMao = resultado?.landmarks?.length > 0;
  if (diagnosticoRastreamentoAtivo && !rastreouMao) {
    diagnosticoPerdasRastreamento += 1;
  }
  diagnosticoRastreamentoAtivo = rastreouMao;
}

function registrarMovimentoLandmarks(resultado) {
  const joints = resultado?.landmarks?.[0];
  if (!joints) {
    diagnosticoLandmarksAnteriores = null;
    return;
  }

  const landmarksAtuais = {};
  for (const indice of [5, 6, 7, 8]) {
    const landmark = joints[indice];
    if (!landmark) continue;
    landmarksAtuais[indice] = { x: landmark.x, y: landmark.y };
    const anterior = diagnosticoLandmarksAnteriores?.[indice];
    if (anterior) {
      diagnosticoDeslocamentosLandmarks[indice].push(
        Math.hypot(landmark.x - anterior.x, landmark.y - anterior.y)
      );
    }
  }
  diagnosticoLandmarksAnteriores = landmarksAtuais;
}

function percentil(valores, proporcao) {
  if (valores.length === 0) return null;
  const ordenados = valores.slice().sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil(ordenados.length * proporcao) - 1);
  return Number(ordenados[Math.max(0, indice)].toFixed(5));
}

function resumoDeslocamentos(valores) {
  if (valores.length === 0) return null;
  const soma = valores.reduce((total, valor) => total + valor, 0);
  return {
    mediaNormalizada: Number((soma / valores.length).toFixed(5)),
    p95Normalizado: percentil(valores, 0.95)
  };
}

function obterConfiguracaoVideoReal() {
  const track = myCapture?.elt?.srcObject?.getVideoTracks?.()[0];
  return track?.getSettings?.() ?? null;
}

function finalizarDiagnosticoSeNecessario() {
  if (diagnosticoResumoEmitido || diagnosticoInicio === 0) return;

  const duracaoJanela = performance.now() - diagnosticoInicio;
  if (duracaoJanela < janelaDiagnosticoMs) return;

  diagnosticoResumoEmitido = true;
  const duracoesOrdenadas = diagnosticoDuracoesInferencia.slice().sort((a, b) => a - b);
  const somaDuracoes = duracoesOrdenadas.reduce((soma, duracao) => soma + duracao, 0);
  const indiceP95 = Math.max(0, Math.ceil(duracoesOrdenadas.length * 0.95) - 1);
  const duracaoSegundos = duracaoJanela / 1000;
  const resolucaoReal = obterConfiguracaoVideoReal();

  diagnosticoResultado = {
    perfilPrecisao: perfilPrecisaoAtivo,
    resolucaoSolicitada: resolucaoCameraAtiva,
    resolucaoReal: resolucaoReal
      ? `${resolucaoReal.width}x${resolucaoReal.height}`
      : null,
    parametrosPrecisao: perfisPrecisao[perfilPrecisaoAtivo],
    janelaSegundos: Number(duracaoSegundos.toFixed(2)),
    fpsRenderizacao: Number((diagnosticoFramesRenderizados / duracaoSegundos).toFixed(2)),
    fpsVideoObservado: Number((diagnosticoFramesVideo / duracaoSegundos).toFixed(2)),
    inferenciasPorSegundo: Number((diagnosticoInferencias / duracaoSegundos).toFixed(2)),
    modoSincronizacao: 'frame-video',
    duracaoMediaInferenciaMs: diagnosticoInferencias > 0
      ? Number((somaDuracoes / diagnosticoInferencias).toFixed(2))
      : null,
    p95InferenciaMs: duracoesOrdenadas.length > 0
      ? Number(duracoesOrdenadas[indiceP95].toFixed(2))
      : null,
    deslocamentoLandmarks: {
      5: resumoDeslocamentos(diagnosticoDeslocamentosLandmarks[5]),
      6: resumoDeslocamentos(diagnosticoDeslocamentosLandmarks[6]),
      7: resumoDeslocamentos(diagnosticoDeslocamentosLandmarks[7]),
      8: resumoDeslocamentos(diagnosticoDeslocamentosLandmarks[8])
    },
    estabilidadeIndicadorParado: resumoDeslocamentos(diagnosticoDeslocamentosLandmarks[8]),
    deslocamentoSuavizadoPx: resumoDeslocamentos(diagnosticoDeslocamentosSuavizados),
    framesProcessados: diagnosticoFramesProcessados,
    perdasRastreamento: diagnosticoPerdasRastreamento
  };

  diagnosticoMedicaoAtiva = false;
  console.info('[Free Fingers] Diagnóstico de desempenho', diagnosticoResultado);
  atualizarPainelDiagnostico();
}

function zerarDiagnostico() {
  diagnosticoInicio = performance.now();
  diagnosticoFramesRenderizados = 0;
  diagnosticoFramesVideo = 0;
  diagnosticoInferencias = 0;
  diagnosticoFramesProcessados = 0;
  diagnosticoPerdasRastreamento = 0;
  diagnosticoDuracoesInferencia = [];
  diagnosticoRastreamentoAtivo = false;
  diagnosticoResumoEmitido = false;
  diagnosticoLandmarksAnteriores = null;
  diagnosticoDeslocamentosLandmarks = { 5: [], 6: [], 7: [], 8: [] };
  diagnosticoDeslocamentosSuavizados = [];
  diagnosticoResultado = null;
  diagnosticoMedicaoAtiva = true;
  atualizarPainelDiagnostico('Medição em andamento...');
}

function criarPainelDiagnostico() {
  painelDiagnostico = document.createElement('aside');
  painelDiagnostico.className = 'debug-panel';
  painelDiagnostico.innerHTML = `
    <div class="debug-panel__header">
      <strong>Diagnóstico</strong>
      <span>debug=1</span>
    </div>
    <label for="debug-profile">Configuração</label>
    <select id="debug-profile">
      <option value="original"${perfilDiagnostico === 'original' ? ' selected' : ''}>Original</option>
      <option value="experimental"${perfilDiagnostico === 'experimental' ? ' selected' : ''}>Experimental</option>
    </select>
    <div class="debug-panel__actions">
      <button id="debug-measure" type="button">Medir 10 s</button>
      <button id="debug-copy" type="button" disabled>Copiar</button>
    </div>
    <pre id="debug-results">Aguardando medição.</pre>
  `;
  document.body.appendChild(painelDiagnostico);

  painelDiagnostico.querySelector('#debug-profile').addEventListener('change', (event) => {
    const url = new URL(window.location.href);
    url.searchParams.set('debug', '1');
    url.searchParams.set('perfil', event.target.value);
    window.location.href = url.toString();
  });
  painelDiagnostico.querySelector('#debug-measure').addEventListener('click', zerarDiagnostico);
  painelDiagnostico.querySelector('#debug-copy').addEventListener('click', copiarDiagnostico);
}

function atualizarPainelDiagnostico(mensagem) {
  if (!painelDiagnostico) return;
  const resultados = painelDiagnostico.querySelector('#debug-results');
  const copiar = painelDiagnostico.querySelector('#debug-copy');
  resultados.textContent = mensagem || (diagnosticoResultado
    ? JSON.stringify(diagnosticoResultado, null, 2)
    : 'Aguardando medição.');
  copiar.disabled = !diagnosticoResultado;
}

async function copiarDiagnostico() {
  if (!diagnosticoResultado) return;
  const texto = JSON.stringify(diagnosticoResultado, null, 2);
  try {
    await navigator.clipboard.writeText(texto);
  } catch (error) {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

//-------------------------------
// Atualiza cor periodicamente
//-------------------------------
function atualizarCor() {
  if (millis() - ultimoTempo >= tempoDeTroca) {
    indiceCor = (indiceCor + 1) % cores.length;
    if (!borrachaAtiva()) corAtual = cores[indiceCor];
    ultimoTempo = millis();
  }
}

//-------------------------------
// Processa landmarks da mão e desenha
//-------------------------------
function processarMaoEDesenhar() {
  if (versaoProcessada === versaoLandmarks) return;
  versaoProcessada = versaoLandmarks;
  if (diagnosticoMedicaoAtiva) diagnosticoFramesProcessados += 1;

  if (handLandmarks?.landmarks?.length > 0) {
    const joints = handLandmarks.landmarks[0];

    detectarMaoAberta(joints);
    desenharComIndicador(joints);
  } else {
    resetarPosicao();
    borrachaGestualAtiva = false;
  }
}

//-------------------------------
// Detecta mão aberta
//-------------------------------
function detectarMaoAberta(joints) {
  if (joints.length >= 21 && joints[0] && joints[9] && joints[12]) {
    const distBase = distanciaAoQuadrado(joints[0], joints[9]);
    const distPonta = distanciaAoQuadrado(joints[0], joints[12]);
    const razaoQuadrada = distPonta / distBase;

    borrachaGestualAtiva = razaoQuadrada > 2.25;
  }
}

//-------------------------------
// Desenha com dedo indicador
//-------------------------------
function desenharComIndicador(joints) {
  const indicador = joints[8];
  if (!indicador) {
    resetarPosicao();
    return;
  }

  const x = width - (indicador.x * width);
  const y = indicador.y * height;

  if (!posAtual) {
    posAtual = { x, y };
    ultimaAmostraX = x;
    ultimaAmostraY = y;
    ultimoTempoAmostra = performance.now();
    return;
  }

  const agora = performance.now();
  const deltaTempo = Math.max(agora - ultimoTempoAmostra, 1);
  const distanciaAmostra = Math.hypot(x - ultimaAmostraX, y - ultimaAmostraY);
  const limiteSalto = Math.max(120, Math.max(width, height) * 0.25);

  if (distanciaAmostra > limiteSalto) {
    posAtual.x = x;
    posAtual.y = y;
    ultimaAmostraX = x;
    ultimaAmostraY = y;
    ultimoTempoAmostra = agora;
    return;
  }

  // Suaviza mais em baixa velocidade e responde mais rápido em movimentos bruscos.
  const deltaSegundos = Math.max(deltaTempo / 1000, 0.001);
  const escalaTela = Math.max(width, height, 1);
  const velocidadeNormalizada = (distanciaAmostra / escalaTela) / deltaSegundos;
  const fatorSuavizacao = Math.min(0.85, Math.max(0.2, 0.2 + velocidadeNormalizada / 2));
  const anteriorX = posAtual.x;
  const anteriorY = posAtual.y;
  posAtual.x += (x - posAtual.x) * fatorSuavizacao;
  posAtual.y += (y - posAtual.y) * fatorSuavizacao;

  if (diagnosticoMedicaoAtiva) {
    diagnosticoDeslocamentosSuavizados.push(
      Math.hypot(posAtual.x - anteriorX, posAtual.y - anteriorY)
    );
  }

  ultimaAmostraX = x;
  ultimaAmostraY = y;
  ultimoTempoAmostra = agora;

  if (Math.hypot(posAtual.x - anteriorX, posAtual.y - anteriorY) < 0.5) return;

  drawingContext.globalCompositeOperation = borrachaAtiva()
    ? 'destination-out'
    : 'source-over';
  stroke(corAtual);
  strokeWeight(borrachaAtiva() ? pesoBorracha : pesoTraco);
  strokeCap(ROUND);

  line(anteriorX, anteriorY, posAtual.x, posAtual.y);
  drawingContext.globalCompositeOperation = 'source-over';
}

//-------------------------------
// Funções utilitárias
//-------------------------------
function distanciaAoQuadrado(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function resetarPosicao() {
  posAtual = null;
  ultimaAmostraX = 0;
  ultimaAmostraY = 0;
  ultimoTempoAmostra = 0;
}

function borrachaAtiva() {
  return borrachaGestualAtiva || borrachaManualAtiva;
}

function alternarBorrachaManual() {
  borrachaManualAtiva = !borrachaManualAtiva;
}

//-------------------------------
// Teclas de controle
//-------------------------------
function keyPressed() {
  if (key === 'c') {
    clear();
    resetarPosicao();
  }
  if (key === 'e') {
    alternarBorrachaManual();
  }
}

//-------------------------------
// Redimensionamento de canvas
//-------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
