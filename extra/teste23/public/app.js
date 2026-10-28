const $ = (id) => document.getElementById(id);
let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
let filtroAdmin = '';

function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

async function api(url, opcoes = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...opcoes.headers };
  if (token) headers.Authorization = 'Bearer ' + token;
  const resp = await fetch(url, { ...opcoes, headers });
  if (resp.status === 401 && token) sair();
  return resp;
}

function sair() {
  localStorage.clear();
  location.href = '/';
}

function limparErros() {
  document.querySelectorAll('.erro').forEach((el) => (el.textContent = ''));
}

function mensagem(texto) {
  $('feed').innerHTML = `<p class="mensagem">${esc(texto)}</p>`;
}

// ---------- TELA ----------
function atualizarTela() {
  const admin = usuario && usuario.tipo === 'administrador';
  $('nomeUsuario').textContent = usuario ? usuario.nome : '@StreamRedes';
  $('btnLogin').textContent = usuario ? 'Logout' : 'Login';
  $('btnVerPerfil').disabled = !!usuario && !admin;
  $('btnVerPerfil').classList.toggle('desabilitado', !admin);
  $('inputBusca').placeholder = usuario
    ? 'Digite o nome do administrador'
    : 'Digite o nome do administrador... ex: @maria';
  if (usuario && usuario.imagem_usuario) {
    $('fotoPerfil').src = 'uploads/perfil/' + usuario.imagem_usuario;
  }
}

// ---------- FEED ----------
async function carregarFeed() {
  const resp = await api('/api/posts' + (filtroAdmin ? '?administrador=' + encodeURIComponent(filtroAdmin) : ''));
  const posts = await resp.json();
  if (!resp.ok) return mensagem(posts.erro);
  if (posts.length === 0) return mensagem('Nenhum post encontrado.');

  $('feed').innerHTML = posts
    .map(
      (p) => `
      <div class="card" id="card-${p.id_post}">
        <img class="imagem-post" src="uploads/posts/${esc(p.url_imagem)}" alt="Post" />
        <div class="tooltip">Postado por: @${esc(p.administrador_usuario)}</div>
        <p class="texto">${esc(p.texto)}</p>
        <div class="acoes">
          <span class="coracao ${p.curtido_por_mim ? 'ativa' : ''}" data-id="${p.id_post}"></span>
          <span class="qtd-curtidas">${p.curtidas}</span>
          <button class="btn-comentarios" data-id="${p.id_post}">Comentários (${p.comentarios})</button>
        </div>
        <div class="comentarios oculto">
          <div class="lista-comentarios"></div>
          <input class="comentario-input" maxlength="255" placeholder="Escreva um comentário..." />
          <button class="btn-enviar" data-id="${p.id_post}">Enviar</button>
          <span class="erro"></span>
        </div>
      </div>`,
    )
    .join('');
}

async function carregarComentarios(id) {
  const resp = await api(`/api/posts/${id}/comentarios`);
  const lista = await resp.json();
  const card = $('card-' + id);
  card.querySelector('.lista-comentarios').innerHTML = lista
    .map((c) => `<p><b>@${esc(c.nome_usuario)}</b> ${esc(c.texto)}</p>`)
    .join('');
  card.querySelector('.btn-comentarios').textContent = `Comentários (${lista.length})`;
}

$('feed').addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  const card = e.target.closest('.card');

  // curtir / descurtir
  if (e.target.classList.contains('coracao')) {
    if (!usuario) return abrirModal();
    const resp = await api('/api/curtidas/' + id, { method: 'POST' });
    const dados = await resp.json();
    e.target.classList.toggle('ativa', dados.curtido);
    card.querySelector('.qtd-curtidas').textContent = dados.curtidas;
    if (!$('painelPerfil').classList.contains('oculto')) carregarPerfil();
  }

  // abrir / fechar comentários
  if (e.target.classList.contains('btn-comentarios')) {
    const area = card.querySelector('.comentarios');
    area.classList.toggle('oculto');
    if (!area.classList.contains('oculto')) carregarComentarios(id);
  }

  // enviar comentário
  if (e.target.classList.contains('btn-enviar')) {
    if (!usuario) return abrirModal();
    const input = card.querySelector('.comentario-input');
    const erro = card.querySelector('.erro');
    const texto = input.value.trim();
    erro.textContent = '';
    if (texto === '') {
      erro.textContent = 'Digite um comentário.';
      return;
    }
    const resp = await api(`/api/posts/${id}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    if (!resp.ok) {
      erro.textContent = (await resp.json()).erro;
      return;
    }
    input.value = '';
    carregarComentarios(id);
  }
});

function abrirModal() {
  limparErros();
  $('loginUsuario').value = '';
  $('loginSenha').value = '';
  $('modalLogin').classList.remove('oculto');
}

function fecharModal() {
  $('modalLogin').classList.add('oculto');
}

$('btnConfirmarLogin').addEventListener('click', async () => {
  limparErros();
  const nome_usuario = $('loginUsuario').value.trim();
  const senha = $('loginSenha').value;

  if (nome_usuario.length < 3) $('erroUsuario').textContent = 'O nome de usuário deve ter pelo menos 3 caracteres.';
  if (senha === '') $('erroSenha').textContent = 'A senha é obrigatória.';
  if (nome_usuario.length < 3 || senha === '') return;

  const resp = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome_usuario, senha }),
  });
  const dados = await resp.json();
  if (!resp.ok) {
    $('erroLogin').textContent = dados.erro;
    return;
  }

  localStorage.setItem('token', dados.token);
  localStorage.setItem('usuario', JSON.stringify(dados.usuario));
  usuario = dados.usuario;
  fecharModal();
  atualizarTela();
  carregarFeed();
});

$('btnCancelar').addEventListener('click', fecharModal);
$('fecharModal').addEventListener('click', fecharModal);
$('btnLogin').addEventListener('click', () => (usuario ? sair() : abrirModal()));

// ---------- BUSCA ----------
function buscar() {
  if (!usuario) return abrirModal();
  const termo = $('inputBusca').value.trim().replace('@', '');
  if (termo !== '' && termo.length < 3) return mensagem('Digite um nome válido, ex: maria.');
  filtroAdmin = termo;
  carregarFeed();
}

$('inputBusca').addEventListener('focus', () => {
  if (!usuario) abrirModal();
});
$('inputBusca').addEventListener('keydown', (e) => e.key === 'Enter' && buscar());
$('btnLupa').addEventListener('click', buscar);

// ---------- MENU LATERAL ----------
async function carregarPerfil() {
  const resp = await api('/api/perfil');
  const dados = await resp.json();
  $('totalCurtidas').textContent = dados.totalCurtidas;
  $('totalPosts').textContent = dados.totalPosts;
  $('listaPosts').innerHTML = dados.posts
    .map(
      (p) => `
      <div class="item">
        <span>${esc(p.texto.slice(0, 40))}</span>
        <img class="lixeira" data-id="${p.id_post}" src="uploads/icons/lixeira.svg" alt="Excluir" />
      </div>`,
    )
    .join('');
}

$('btnVerPerfil').addEventListener('click', async () => {
  if (!usuario) return abrirModal();
  if (usuario.tipo !== 'administrador') return;
  await carregarPerfil();
  $('painelPerfil').classList.remove('oculto');
});

$('btnSeusPosts').addEventListener('click', carregarPerfil);
$('fecharPainel').addEventListener('click', () => $('painelPerfil').classList.add('oculto'));

$('listaPosts').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('lixeira')) return;
  await api('/api/posts/' + e.target.dataset.id, { method: 'DELETE' });
  carregarPerfil();
  carregarFeed();
});

// ---------- CRIAR POST ----------
const fecharModalPost = () => $('modalPost').classList.add('oculto');
$('btnNovoPost').addEventListener('click', () => {
  limparErros();
  $('modalPost').classList.remove('oculto');
});
$('fecharModalPost').addEventListener('click', fecharModalPost);
$('btnCancelarPost').addEventListener('click', fecharModalPost);

$('campoImagem').addEventListener('change', () => {
  const arquivo = $('campoImagem').files[0];
  $('nomeArquivo').textContent = arquivo ? arquivo.name : 'Nenhum arquivo escolhido';
});

$('formPost').addEventListener('submit', async (e) => {
  e.preventDefault();
  limparErros();
  const texto = $('campoTexto').value.trim();
  const arquivo = $('campoImagem').files[0];

  if (texto === '') $('erroTexto').textContent = 'O texto é obrigatório.';
  if (!arquivo) $('erroImagem').textContent = 'A imagem é obrigatória.';
  else if (!/\.(jpe?g|png|gif|webp)$/i.test(arquivo.name)) {
    $('erroImagem').textContent = 'Formato inválido (use JPG, JPEG, PNG, GIF ou WEBP).';
  }
  if (document.querySelector('#formPost .erro:not(:empty)')) return;

  const formData = new FormData();
  formData.append('texto', texto);
  formData.append('url_imagem', arquivo);

  const resp = await api('/api/posts', { method: 'POST', body: formData });
  if (!resp.ok) {
    $('erroImagem').textContent = (await resp.json()).erro;
    return;
  }

  $('formPost').reset();
  $('nomeArquivo').textContent = 'Nenhum arquivo escolhido';
  fecharModalPost();
  carregarPerfil();
  carregarFeed();
});

// ---------- INÍCIO ----------
atualizarTela();
carregarFeed();
// atualiza sozinho, sem recarregar a página (pausa enquanto há comentários abertos)
setInterval(() => {
  if (!document.querySelector('.comentarios:not(.oculto)')) carregarFeed();
}, 5000);