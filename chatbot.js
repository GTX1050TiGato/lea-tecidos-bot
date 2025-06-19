const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set, get, child, remove } = require('firebase/database');
const {cadastrarCliente, verificarDiretorioSessao, deletarCliente, pegartelefone, mandarparacadastrados} = require('./comandos/comandos');
const axios = require('axios');




// Configurações (mantidas as mesmas)
const INACTIVITY_TIME = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;
const userTimers = new Map();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Configuração do Firebase (mantida a mesma)
const firebaseConfig = {
  apiKey: "AIzaSyAYCDuVgcRjarXTqOLG-WN4wESTKkMSbi4",
  authDomain: "lea-tecidos.firebaseapp.com",
  databaseURL: "https://lea-tecidos-default-rtdb.firebaseio.com",
  projectId: "lea-tecidos",
  storageBucket: "lea-tecidos.firebasestorage.app",
  messagingSenderId: "426614721178",
  appId: "1:426614721178:web:e6092b12bac66d3eceed23",
  measurementId: "G-4D4TV5TV7H"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Interface para comandos no terminal (mantida)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



const logout = () => {
  const sessionPath = path.join(__dirname, 'sessions');
  if (fs.existsSync(sessionPath)) {
    fs.rmdirSync(sessionPath, { recursive: true });
    console.log('Sessão removida com sucesso.');
  }
};


const iniciarBot = async () => {
  verificarDiretorioSessao();
  
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: '/usr/bin/google-chrome',
    headless: true
  }
});



  setInterval(() => {
    const now = Date.now();
    userTimers.forEach((timer, userId) => {
      if (timer._idleStart + INACTIVITY_TIME < now) {
        clearTimeout(timer);
        userTimers.delete(userId);
      }
    });
  }, CLEANUP_INTERVAL);

  // Eventos do WhatsApp
  client.on('qr', qr => qrcode.generate(qr, { small: true }));

  client.on('ready', () => {
    console.log('✅ Bot pronto para uso!');
    comandoTerminal(client);
setInterval(async () => {
  await pegartelefone();
  await mandarparacadastrados(client);
}, 5000);
  });
  
  client.on('message', async msg => {
    if (!msg.from.endsWith('@c.us')) return;

    // Obter informações do contato automaticamente
    const contact = await msg.getContact();
    const nome = contact.pushname || contact.name || 'Cliente';
    const telefoneBruto = msg.from.split('@')[0];
    const telefoneApenasNumeros = telefoneBruto.replace(/\D/g, '').replace(/^55/, '');

    let telefone = telefoneApenasNumeros.replace(/^(\d{2})(\d{4})(\d{4})$/,'($1) 9$2-$3');
    // -------------------------------------------------------------------------------------

    // --------funções de cadastro e deleção--------
    if (msg.body.trim().toLowerCase().startsWith('/cadastrar')) {
      await cadastrarCliente(database, telefone, nome, client, msg);
      return;
    }
    if (msg.body.trim().toLowerCase().startsWith('/deletar')) {
      await deletarCliente(database, telefone, client, msg);
      return;
    }
    // --------------------------------------------

    // Menu principal
    if (msg.body.match(/^(oi|olá|ola|menu)$/i)) {
      const menuMessage =
        '🏷️ *MENU PRINCIPAL* 🏷️\n\n' +
        '1️⃣ Ver itens à venda\n' +
        '2️⃣ Formulário de avaliação\n' +
        '3️⃣ Localização da loja\n' +
        '4️⃣ Redes sociais\n' +
        '5️⃣ Atendimento humano\n' +
        '6️⃣ Comunidade Léa Tecidos\n' +
        '7️⃣ Encerrar conversa\n\n' +
        'Digite o *número* da opção desejada:';

      await client.sendMessage(msg.from, menuMessage);
      return;
    }

 



// Função auxiliar para buscar mensagem em objetos JSON
function encontrarMensagem(obj) {
    if (!obj || typeof obj !== 'object') return null;
    
    // Verifica se existe uma propriedade 'mensagem' direta
    if (obj.mensagem && typeof obj.mensagem === 'string') {
        return obj.mensagem;
    }
    
    // Busca recursivamente em todas as propriedades do objeto
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'object') {
                const result = encontrarMensagem(value);
                if (result) return result;
            }
        }
    }
    
    return null;
}

// Função para buscar recursivamente 'mensagem' em objetos JSON
function encontrarMensagem(obj) {
    for (const key in obj) {
        if (key === 'mensagem') return obj[key];
        if (typeof obj[key] === 'object') {
            const result = encontrarMensagem(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

    // Respostas do menu
    const responses = {
      '1': '🧵 *Itens à venda* 🧵\n- Tecido para sofá: R$30/m²\n- Tecido para cama: R$40/m²',
      '2': '📝 Formulário de avaliação:\nhttps://docs.google.com/forms/d/e/1FAIpQLSeNE0IaNcQD2xgwyPAySfi2YiMaljgVAG81GPCw3xSML5cc5g/viewform?usp=dialog',
      '3': '📍 *Localização* 📍\nRua 13 de Maio, 80 - Campina\nhttps://maps.app.goo.gl/eJADyoJ4VDLobwZPA',
      '4': '🌐 *Redes Sociais* 🌐\nInstagram: @LeaTecidos\nFacebook: /LeaTecidos',
      '5': '📞 *Atendimento* 📞\nLeo: (91) 8241-0602\nRegina: (91) 8187-4800',
      '6': '👥 Entre na nossa comunidade:\nhttps://whatsapp.com/channel/0029Vb5gFwBJENy9UqVIUi1u',
      '7': '✅ Conversa encerrada. Digite "menu" a qualquer momento para reiniciar!'
      
    };

    if (responses[msg.body]) {
      await client.sendMessage(msg.from, responses[msg.body]);
      return;
    }
  });

  client.initialize();
  
}


// Sistema de comandos do terminal (mantido)
const comandoTerminal = (client) => {
  rl.question('\nComandos disponíveis:\n- "logout": Encerrar sessão\n- "sair": Finalizar bot\n\n> ', async (cmd) => {
    switch (cmd.toLowerCase()) {
      case 'logout':
        logout();
        await client.destroy();
        console.log('Reiniciando...');
        iniciarBot();
        break;
      case 'sair':
        rl.close();
        process.exit(0);
      default:
        console.log('Comando inválido');
        comandoTerminal(client);
    }
  });
};

iniciarBot().catch(err => {
  console.error('Erro inicial:', err);
  process.exit(1);
});

