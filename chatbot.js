const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set } = require('firebase/database');

// Configurações (mantidas as mesmas)
const INACTIVITY_TIME = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;
const userTimers = new Map();

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

// Funções auxiliares (mantidas)
const verificarDiretorioSessao = () => {
  const dir = path.join(__dirname, 'sessions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
};

const logout = () => {
  const sessionPath = path.join(__dirname, 'sessions');
  if (fs.existsSync(sessionPath)) {
    fs.rmdirSync(sessionPath, { recursive: true });
    console.log('Sessão removida com sucesso.');
  }
};

// Função principal modificada
const iniciarBot = async () => {
  verificarDiretorioSessao();
  
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
  });

  // Gerenciamento de temporizadores (mantido)
  const resetTimer = (userId) => {
    if (userTimers.has(userId)) clearTimeout(userTimers.get(userId));
    
    const newTimer = setTimeout(async () => {
      try {
        await client.sendMessage(
          userId,
          '📋 Por favor, avalie sua experiência:\n' +
          'https://docs.google.com/forms/d/e/1FAIpQLSc_fW8W4uKwUeJeOtv97c3u8hrdUH1xgsij83lQQtFXk6aIkw/viewform\n\n' +
          'Digite "menu" para reiniciar!'
        );
        userTimers.delete(userId);
      } catch (error) {
        console.error('Erro ao enviar formulário:', error);
      }
    }, INACTIVITY_TIME);

    userTimers.set(userId, newTimer);
  };

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
  });

  client.on('message', async msg => {
    if (!msg.from.endsWith('@c.us')) return;

    resetTimer(msg.from);

    // Obter informações do contato automaticamente
    const contact = await msg.getContact();
    const nome = contact.pushname || contact.name || 'Cliente';
    const telefone = msg.from.split('@')[0];

    // Cadastro simplificado
    if (msg.body.trim() === 'Olá Léa Tecidos, gostaria de me cadastrar.') {
      try {
        // Salvar no Firebase
        const clientesRef = ref(database, 'clientes');
        const novoCadastroRef = push(clientesRef);
        await set(novoCadastroRef, {
          nome,
          telefone,
          dataCadastro: new Date().toISOString()
        });

        // Confirmação
        await client.sendMessage(msg.from,
          `✅ *Cadastro automático realizado!* ✅\n\n` +
          `👤 Nome: ${nome}\n` +
          `📱 Número: ${telefone}\n\n` +
          `Obrigado por se cadastrar na Léa Tecidos!`
        );

      } catch (error) {
        console.error('Erro no cadastro:', error);
        await client.sendMessage(msg.from,
          '❌ *Erro no cadastro automático!* ❌\n\n' +
          'Por favor, entre em contato com nosso atendimento.'
        );
      }
      return;
    }

    // Lógica do menu (mantida)
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
    }

    // Respostas do menu (mantidas)
    const responses = {
      '1': '🧵 *ITENS À VENDA* 🧵\n\n' +
           '- Tecido para sofá: *R$ 30/m²*\n' +
           '- Tecido para cama: *R$ 40/m²*\n' +
           '- Cortinas personalizadas: *R$ 25/m²*',
      // ... (outras respostas)
    };

    if (responses[msg.body]) {
      await client.sendMessage(msg.from, responses[msg.body]);
    }
  });

  client.initialize();
};

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