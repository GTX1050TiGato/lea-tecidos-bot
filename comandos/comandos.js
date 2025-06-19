
const fs = require('fs');
const path = require('path');
const { getDatabase, ref, push, set, get, remove } = require('firebase/database');
const { default: axios } = require('axios');




function verificarDiretorioSessao() {
  const dir = path.join(__dirname, 'sessions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}
// Adicione esta função no arquivo chatbot.js
function getChild(obj, key) {
  if (obj == null || typeof obj !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key];
  }
  for (const k in obj) {
    const val = getChild(obj[k], key);
    if (val != null) return val;
  }
  return null;
}

async function enviarPromocao() {
  let mensagemParaEnviar = null;

  try {
    // 1. Buscar promoções pendentes
    const response = await axios.get('https://lea-tecidos-api.vercel.app/promocoes_pendentes');
    const data = response.data;
    console.log('DEBUG API ➜', data);

      mensagemParaEnviar = getChild(data, 'mensagem');
    console.log('DEBUG mensagem encontrada ➜', mensagemParaEnviar);
    // 3. Se encontrou mensagem válida, apaga do Firebase
    if (mensagemParaEnviar) {
      const dbRef = ref(database, 'promocoes_pendentes');
      await remove(dbRef);
      console.log('✅ Promoções pendentes deletadas com sucesso');
    } else {
      console.log('🔍 Sem promoções pendentes');
    }
  } catch (err) {
    console.error('🔥 Erro ao buscar promoções:', err);
  }

 await remove(ref(getDatabase(), 'promocoes_pendentes'));

  globalThis.promoMessage = mensagemParaEnviar;
  return mensagemParaEnviar;
}



async function cadastrarCliente(database, telefone, nome, client, msg) {
  try {
    const clientesRef = ref(database, 'clientes');
    const snapshot = await get(clientesRef);

    let jaCadastrado = false;
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.telefone === telefone) {
        jaCadastrado = true;
      }
    });

    if (jaCadastrado) {
      await client.sendMessage(msg.from, '⚠️ Este número já está cadastrado. \n\nCaso queira deletar o cadastro, digite /deletar');
      return;
    }

    const novoCadastroRef = push(clientesRef);
    await set(novoCadastroRef, {
      nome,
      telefone,
      dataCadastro: new Date().toISOString()
    });

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
      'Por favor, entre em contato com nosso atendimento.\nTipo de erro: ' + error.message
    );
  }
}

async function deletarCliente(database, telefone, client, msg) {
  try {
    const clientesRef = ref(database, 'clientes');
    const snapshot = await get(clientesRef);
    let keyToDelete = null;

    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.telefone === telefone) {
        keyToDelete = childSnapshot.key;
      }
    });

    if (!keyToDelete) {
      await client.sendMessage(msg.from, '⚠️ Número não cadastrado.');
      return;
    }

    await remove(ref(database, `clientes/${keyToDelete}`));

    await client.sendMessage(msg.from, '✅ Cadastro deletado com sucesso.');
  } catch (error) {
    console.error('Erro ao deletar:', error);
    await client.sendMessage(msg.from,
      '❌ Erro ao deletar cadastro. Entre em contato com o atendimento. \nTipo de erro: ' + error.message
    );
  }
}


async function pegartelefone() {
  try {
    const database = getDatabase();
    const clientesRef = ref(database, 'clientes');
    const snapshot = await get(clientesRef);
    
    if (!snapshot.exists()) {
      console.log('Nenhum cliente cadastrado.');
      return { numerosLimpos: [], numerosIDs: [], totalClientes: 0 };
    }
    
    let numerosLimpos = [];
    let numerosIDs = [];
    const totalClientes = snapshot.size;
    
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.telefone) {
let numeroLimpo = data.telefone.replace(/\D/g, '');

// Remove o 5º dígito se o número tiver 11 dígitos (ex: 91992801361 → 9182801361)
if (numeroLimpo.length === 11) {
  numeroLimpo = numeroLimpo.slice(0, 3) + numeroLimpo.slice(4);
}

const numeroID = `55${numeroLimpo}@c.us`;
        
        numerosLimpos.push(numeroLimpo);
        numerosIDs.push(numeroID);
        
        // Opcional: log detalhado para depuração
        console.log(`Cliente ID: ${childSnapshot.key}`);
        console.log(`Telefone Original: ${data.telefone}`);
        console.log(`Telefone Limpo: ${numeroLimpo}`);
        console.log(`Número ID: ${numeroID}\n`);
        console.log('numeros ID:', numerosIDs);
      }
    });
    
    console.log(`Total de clientes processados: ${totalClientes}`);
    return { numerosLimpos, numerosIDs, totalClientes };
    
  } catch (error) {
    console.error('Erro ao buscar telefones:', error);
    throw error; // Propaga o erro para quem chamar a função
  }
}

async function mandarparacadastrados(client) {
  try {
      
    const mensagem = await enviarPromocao();
    if (!mensagem) {
      console.log('Nenhuma mensagem para enviar.');
    } else {
      const { numerosIDs } = await pegartelefone();
    console.log('numeros ID:', numerosIDs);

      for (const numeroID of numerosIDs) {

        await client.sendMessage(numeroID, mensagem);

      console.log(`Mensagem enviada para ${numeroID}`);
    }
  }
  } catch (error) {
    console.error('Falha no processo de envio:', error);
  }
}


module.exports = {
  verificarDiretorioSessao,
  cadastrarCliente,
  deletarCliente,
  enviarPromocao,
  pegartelefone,
  mandarparacadastrados
};