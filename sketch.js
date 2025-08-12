// Configuração inicial de cores
let cores = ['#FF5733', '#33FF57', '#3357FF', '#F4D03F', '#9B59B6']; // Array de cores pré-definidas
let indice = 0; // Índice para controlar a cor atual
let tempoDeTroca = 10000; // Intervalo de tempo para trocar cores (10 segundos)
let ultimoTempo = 0; // Registro do último tempo de troca
let corAtual; // Armazena a cor atual do pincel
let pesoTraco = 10; // Espessura inicial do traço
let fundo = 255; // Valor RGB para cor de fundo (branco)
let fundoPontilhado; // Imagem de fundo com padrão pontilhado
let posAnterior = null; // Posição anterior do dedo
let posAtual = null; // Posição atual do dedo

// Variáveis para controle da mão aberta
let modoMaoAberta = false;
let corAnterior;
let pesoAnterior;

// Interface para MediaPipe Landmark Tracking
let myHandLandmarker; // Detector de landmarks das mãos
let myPoseLandmarker; // Detector de landmarks do corpo
let myFaceLandmarker; // Detector de landmarks do rosto
let handLandmarks; // Dados dos landmarks das mãos
let poseLandmarks; // Dados dos landmarks do corpo
let faceLandmarks; // Dados dos landmarks do rosto
let myCapture; // Objeto de captura de vídeo
let lastVideoTime = -1; // Último tempo de vídeo processado

// Configurações de rastreamento
const trackingConfig = {
  doAcquireHandLandmarks: true,   // Ativar detecção de mãos
  doAcquirePoseLandmarks: false,  // Ativar detecção de poses corporais
  doAcquireFaceLandmarks: false,  // Ativar detecção de rostos
  doAcquireFaceMetrics: false,    // Ativar métricas faciais
  poseModelLiteOrFull: "lite",    // Modelo leve para pose
  cpuOrGpuString: "GPU",          // Usar GPU para processamento
  maxNumHands: 1,                 // Máximo de mãos detectadas
  maxNumPoses: 1,                 // Máximo de poses detectadas
  maxNumFaces: 1                  // Máximo de rostos detectados
};

//------------------------------------------
// Função de pré-carregamento dos recursos do MediaPipe
async function preload() {
  const mediapipe_module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js');
  
  // Importa classes necessárias
  HandLandmarker = mediapipe_module.HandLandmarker;
  PoseLandmarker = mediapipe_module.PoseLandmarker;
  FaceLandmarker = mediapipe_module.FaceLandmarker;
  FilesetResolver = mediapipe_module.FilesetResolver;
  
  // Resolve dependências do MediaPipe
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  // Inicializa detector de mãos se ativado na configuração
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

//------------------------------------------
// Função para previsão contínua via webcam
async function predictWebcam() {
  let startTimeMs = performance.now();
  // Verifica se há novo frame de vídeo
  if (lastVideoTime !== myCapture.elt.currentTime) {
    // Detecta landmarks das mãos se ativado
    if (trackingConfig.doAcquireHandLandmarks && myHandLandmarker) {
      handLandmarks = myHandLandmarker.detectForVideo(myCapture.elt, startTimeMs);
    }
    lastVideoTime = myCapture.elt.currentTime;
  }
  // Chama recursivamente para próxima previsão
  window.requestAnimationFrame(predictWebcam);
}

//------------------------------------------
// Configuração inicial do sketch
function setup() {
  createCanvas(windowWidth, windowHeight); // Cria canvas com tamanho da janela
  myCapture = createCapture(VIDEO); // Inicia captura de vídeo
  myCapture.size(320, 240); // Define tamanho do vídeo
  myCapture.hide(); // Esconde o elemento de vídeo
  
  criarFundoPontilhado(); // Cria fundo pontilhado
  alterarCor(); // Seleciona cor inicial
  predictWebcam(); // Inicia detecção contínua
}

// Loop principal de desenho
function draw() {
  // Atualiza cor a cada 10 segundos
  let agora = millis();
  if (agora - ultimoTempo >= tempoDeTroca) {
    indice = (indice + 1) % cores.length; // Avança para próxima cor
    alterarCor(); // Aplica nova cor
    ultimoTempo = agora; // Atualiza registro de tempo
  }

  // Verifica detecção de mãos
  if (trackingConfig.doAcquireHandLandmarks && 
      handLandmarks && 
      handLandmarks.landmarks &&
      handLandmarks.landmarks.length > 0) {
    
    let joints = handLandmarks.landmarks[0]; // Pontos da primeira mão detectada
    
    // Detecção de mão aberta usando distância pulso-dedos
    if (joints.length >= 21 && joints[0] && joints[9] && joints[12]) {
      // Calcula distância pulso-base dos dedos
      let dx = joints[0].x - joints[9].x;
      let dy = joints[0].y - joints[9].y;
      let distBase = Math.sqrt(dx*dx + dy*dy);
      
      // Calcula distância pulso-ponta do dedo médio
      dx = joints[0].x - joints[12].x;
      dy = joints[0].y - joints[12].y;
      let distPonta = Math.sqrt(dx*dx + dy*dy);
      
      // Razão que indica mão aberta (ponta longe do pulso)
      let razao = distPonta / distBase;
      
      // Verifica se a mão está aberta (razão > 1.5)
      if (razao > 1.5) {
        if (!modoMaoAberta) {
          // Salva estado atual antes de mudar para borracha
          corAnterior = corAtual;
          pesoAnterior = pesoTraco;
          modoMaoAberta = true;
        }
        // Configura como borracha grande
        corAtual = [fundo, fundo, fundo];
        pesoTraco = 100;
      } else {
        if (modoMaoAberta) {
          // Restaura estado anterior
          corAtual = corAnterior;
          pesoTraco = pesoAnterior;
          modoMaoAberta = false;
        }
      }
    }
    
    // Continua com o desenho usando o dedo indicador
    if (joints[8]) { // Ponto da ponta do dedo indicador (landmark 8)
      // Converte coordenadas normalizadas para pixels (espelha horizontalmente)
      let x = width - (joints[8].x * width);
      let y = joints[8].y * height;
      
      // Atualiza posições para criar traço contínuo
      if (posAnterior === null) {
        posAnterior = {x: x, y: y}; // Primeira detecção
      } else {
        posAnterior = posAtual; // Avança posição anterior
      }
      posAtual = {x: x, y: y}; // Atualiza posição atual
      
      // Configura estilo do traço
      stroke(corAtual); // Define cor
      strokeWeight(pesoTraco); // Define espessura
      strokeCap(ROUND); // Define ponta arredondada
      
      // Desenha linha entre posições
      if (posAnterior && posAtual) {
        line(posAnterior.x, posAnterior.y, posAtual.x, posAtual.y);
      }
    }
  } else {
    posAnterior = null; // Reseta se nenhuma mão detectada
    // Se sair da detecção e estava em modo mão aberta, restaura
    if (modoMaoAberta) {
      corAtual = corAnterior;
      pesoTraco = pesoAnterior;
      modoMaoAberta = false;
    }
  }
}

// Função para atualizar a cor atual do pincel
function alterarCor() {
  if (!modoMaoAberta) { // Só troca cor se não estiver em modo mão aberta
    corAtual = cores[indice]; // Seleciona cor do array
  }
}

//------------------------------------------
// Função para criar fundo pontilhado
function criarFundoPontilhado() {
  let buffer = createGraphics(width, height); // Cria buffer gráfico
  buffer.background(fundo); // Preenche com cor de fundo
  
  const espacamento = 20; // Distância entre pontos
  const tamanhoPonto = 1.3; // Diâmetro dos pontos
  const tomCinza = 120; // Cor dos pontos (cinza)
  
  buffer.noStroke(); // Sem contorno
  buffer.fill(tomCinza); // Preenchimento cinza
  
  // Gera grid de pontos
  for (let x = espacamento/2; x < width; x += espacamento) {
    for (let y = espacamento/2; y < height; y += espacamento) {
      buffer.circle(x, y, tamanhoPonto); // Desenha cada ponto
    }
  }
  
  fundoPontilhado = buffer.get(); // Salva como imagem
  background(fundoPontilhado); // Aplica como fundo
}

// Função para tratar teclas pressionadas
function keyPressed() {
  switch(key) {
    case 'c': // Limpa o canvas
      background(fundoPontilhado);
      break;
    case 'e': // Modo borracha (usa cor de fundo)
      corAtual = [fundo, fundo, fundo];
      break;
    case '1': // Preto
      corAtual = '#000000';
      break;
    case '2': // Vermelho
      corAtual = '#FF0000';
      break;
    case '3': // Verde
      corAtual = '#00FF00';
      break;
    case '4': // Azul
      corAtual = '#0000FF';
      break;
    case '+': // Aumenta espessura
      pesoTraco = min(pesoTraco + 5, 50); // Limite máximo 50
      break;
    case '-': // Diminui espessura
      pesoTraco = max(pesoTraco - 5, 5); // Limite mínimo 5
      break;
    case 's': // Salva a imagem
      saveCanvas('meu_desenho', 'png');
      break;
  }
}

// Função para redimensionar o canvas com a janela
function windowResized() {
  resizeCanvas(windowWidth, windowHeight); // Ajusta tamanho do canvas
  criarFundoPontilhado(); // Recria fundo pontilhado
}