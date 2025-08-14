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

// Controle de posição para desenho
let posAnterior = null;
let posAtual = null;

// Controle de mão aberta
let modoMaoAberta = false;
let corAnterior;
let pesoAnterior;

//-------------------------------
// MediaPipe Landmarkers
//-------------------------------
let myHandLandmarker;
let myCapture;
let lastVideoTime = -1;
let handLandmarks = null;

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
  const mediapipe_module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js');
  const { HandLandmarker, FilesetResolver } = mediapipe_module;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  if (trackingConfig.doAcquireHandLandmarks) {
    myHandLandmarker = await HandLandmarker.createFromOptions(vision, {
      numHands: trackingConfig.maxNumHands,
      runningMode: "VIDEO",
      baseOptions: {
        delegate: trackingConfig.cpuOrGpuString,
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
      }
    });
  }
}

//-------------------------------
// Webcam Prediction
//-------------------------------
async function predictWebcam() {
  const startTimeMs = performance.now();

  if (lastVideoTime !== myCapture.elt.currentTime) {
    if (trackingConfig.doAcquireHandLandmarks && myHandLandmarker) {
      handLandmarks = myHandLandmarker.detectForVideo(myCapture.elt, startTimeMs);
    }
    lastVideoTime = myCapture.elt.currentTime;
  }

  window.requestAnimationFrame(predictWebcam);
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

  background(fundo);

  myCapture = createCapture(VIDEO);
  myCapture.size(320, 240);
  myCapture.hide();

  corAtual = cores[indiceCor];

  predictWebcam();
}

//-------------------------------
// Função Draw
//-------------------------------
function draw() {
  atualizarCor();
  processarMaoEDesenhar();
}

//-------------------------------
// Atualiza cor periodicamente
//-------------------------------
function atualizarCor() {
  if (millis() - ultimoTempo >= tempoDeTroca) {
    indiceCor = (indiceCor + 1) % cores.length;
    if (!modoMaoAberta) corAtual = cores[indiceCor];
    ultimoTempo = millis();
  }
}

//-------------------------------
// Processa landmarks da mão e desenha
//-------------------------------
function processarMaoEDesenhar() {
  if (handLandmarks?.landmarks?.length > 0) {
    const joints = handLandmarks.landmarks[0];

    detectarMaoAberta(joints);
    desenharComIndicador(joints);
  } else {
    posAnterior = null;
    if (modoMaoAberta) restaurarCorEPeso();
  }
}

//-------------------------------
// Detecta mão aberta
//-------------------------------
function detectarMaoAberta(joints) {
  if (joints.length >= 21 && joints[0] && joints[9] && joints[12]) {
    const distBase = distEntre(joints[0], joints[9]);
    const distPonta = distEntre(joints[0], joints[12]);
    const razao = distPonta / distBase;

    if (razao > 1.5 && !modoMaoAberta) {
      // Ativa modo mão aberta
      corAnterior = corAtual;
      pesoAnterior = pesoTraco;
      corAtual = fundo;
      pesoTraco = 250;
      modoMaoAberta = true;
    } else if (razao <= 1.5 && modoMaoAberta) {
      restaurarCorEPeso();
    }
  }
}

//-------------------------------
// Desenha com dedo indicador
//-------------------------------
function desenharComIndicador(joints) {
  const indicador = joints[8];
  if (!indicador) return;

  const x = width - (indicador.x * width);
  const y = indicador.y * height;

  posAnterior = posAtual || { x, y };
  posAtual = { x, y };

  stroke(corAtual);
  strokeWeight(pesoTraco);
  strokeCap(ROUND);

  line(posAnterior.x, posAnterior.y, posAtual.x, posAtual.y);
}

//-------------------------------
// Funções utilitárias
//-------------------------------
function distEntre(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function restaurarCorEPeso() {
  corAtual = corAnterior;
  pesoTraco = pesoAnterior;
  modoMaoAberta = false;
}

//-------------------------------
// Teclas de controle
//-------------------------------
function keyPressed() {
  if (key === 'c') background(fundo);
  if (key === 'e') {
    corAnterior = corAtual;
    pesoAnterior = pesoTraco;
    corAtual = fundo;
    pesoTraco = 250;
    modoMaoAberta = true;
  }
}

//-------------------------------
// Redimensionamento de canvas
//-------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
