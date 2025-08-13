// Configuração inicial de cores
let cores = ['#e57373', '#5a9bd4', '#f4d06f', '#98dfaf', '#c1a3e7'];
let indice = 0;
let tempoDeTroca = 10000;
let ultimoTempo = 0;
let corAtual;
let pesoTraco = 10;
let fundo = (250, 250, 245);
let posAnterior = null;
let posAtual = null;

// Variáveis para controle da mão aberta
let modoMaoAberta = false;
let corAnterior;
let pesoAnterior;

// Interface para MediaPipe Landmark Tracking
let myHandLandmarker;
let myPoseLandmarker;
let myFaceLandmarker;
let handLandmarks;
let poseLandmarks;
let faceLandmarks;
let myCapture;
let lastVideoTime = -1;

// Configurações de rastreamento
const trackingConfig = {
  doAcquireHandLandmarks: true,
  doAcquirePoseLandmarks: false,
  doAcquireFaceLandmarks: false,
  doAcquireFaceMetrics: false,
  poseModelLiteOrFull: "lite",
  cpuOrGpuString: "GPU",
  maxNumHands: 1,
  maxNumPoses: 1,
  maxNumFaces: 1
};

// Função de pré-carregamento
async function preload() {
  const mediapipe_module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js');
  
  HandLandmarker = mediapipe_module.HandLandmarker;
  PoseLandmarker = mediapipe_module.PoseLandmarker;
  FaceLandmarker = mediapipe_module.FaceLandmarker;
  FilesetResolver = mediapipe_module.FilesetResolver;
  
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  if (trackingConfig.doAcquireHandLandmarks){
    myHandLandmarker = await HandLandmarker.createFromOptions(vision, {
      numHands: trackingConfig.maxNumHands,
      runningMode: "VIDEO",
      baseOptions: {
        delegate: trackingConfig.cpuOrGpuString,
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      },
    });
  }
}

// Função para previsão contínua
async function predictWebcam() {
  let startTimeMs = performance.now();
  if (lastVideoTime !== myCapture.elt.currentTime) {
    if (trackingConfig.doAcquireHandLandmarks && myHandLandmarker) {
      handLandmarks = myHandLandmarker.detectForVideo(myCapture.elt, startTimeMs);
    }
    lastVideoTime = myCapture.elt.currentTime;
  }
  window.requestAnimationFrame(predictWebcam);
}

//------------------------------------------
function setup() {
  // Canvas com 100vw usando a largura da janela
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.style('width', '100vw'); // Força 100% da largura
  canvas.style('height', '100vh'); // Altura total
  canvas.style('display', 'block'); // Remove margens
  canvas.style('position', 'fixed'); // Fixa na tela
  canvas.style('top', '0');
  canvas.style('left', '0');
  
  background(fundo); // Fundo inicial
  
  myCapture = createCapture(VIDEO);
  myCapture.size(320, 240);
  myCapture.hide();

  alterarCor();
  predictWebcam();
}

function draw() {
  // Atualiza cor periodicamente
  let agora = millis();
  if (agora - ultimoTempo >= tempoDeTroca) {
    indice = (indice + 1) % cores.length;
    alterarCor();
    ultimoTempo = agora;
  }

  // Processamento de mãos
  if (trackingConfig.doAcquireHandLandmarks && 
      handLandmarks && 
      handLandmarks.landmarks &&
      handLandmarks.landmarks.length > 0) {
    
    let joints = handLandmarks.landmarks[0];
    
    // Detecção de mão aberta
    if (joints.length >= 21 && joints[0] && joints[9] && joints[12]) {
      let dx = joints[0].x - joints[9].x;
      let dy = joints[0].y - joints[9].y;
      let distBase = Math.sqrt(dx*dx + dy*dy);
      
      dx = joints[0].x - joints[12].x;
      dy = joints[0].y - joints[12].y;
      let distPonta = Math.sqrt(dx*dx + dy*dy);
      
      let razao = distPonta / distBase;
      
      if (razao > 1.5) {
        if (!modoMaoAberta) {
          corAnterior = corAtual;
          pesoAnterior = pesoTraco;
          modoMaoAberta = true;
        }
        corAtual = [fundo, fundo, fundo];
        pesoTraco = 250;
      } else {
        if (modoMaoAberta) {
          corAtual = corAnterior;
          pesoTraco = pesoAnterior;
          modoMaoAberta = false;
        }
      }
    }
    
    // Desenho com dedo indicador
    if (joints[8]) {
      let x = width - (joints[8].x * width);
      let y = joints[8].y * height;
      
      if (posAnterior === null) {
        posAnterior = {x: x, y: y};
      } else {
        posAnterior = posAtual;
      }
      posAtual = {x: x, y: y};
      
      stroke(corAtual);
      strokeWeight(pesoTraco);
      strokeCap(ROUND);
      
      if (posAnterior && posAtual) {
        line(posAnterior.x, posAnterior.y, posAtual.x, posAtual.y);
      }
    }
  } else {
    posAnterior = null;
    if (modoMaoAberta) {
      corAtual = corAnterior;
      pesoTraco = pesoAnterior;
      modoMaoAberta = false;
    }
  }
}

function alterarCor() {
  if (!modoMaoAberta) {
    corAtual = cores[indice];
  }
}

//------------------------------------------
function keyPressed() {
  switch(key) {
    case 'c': // Limpa o canvas
      background(fundo);
      break;
    case 'e': // Modo borracha
      corAtual = [fundo, fundo, fundo];
      break;
  }
}

function windowResized() {
  // Atualiza o canvas mantendo 100vw
  resizeCanvas(windowWidth, windowHeight);
}