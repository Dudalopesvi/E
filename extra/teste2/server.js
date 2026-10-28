const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  user: 'postgres',
  password: '.',
  host: 'localhost',
  port: 5432,
  database: 'streamRedes',
});

const PASTA = 'public/uploads/posts';
fs.mkdirSync(PASTA, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: PASTA,
    filename: (req, file, cb) =>
      cb(null, Date.now() + path.extname(file.originalname).toLowerCase()),
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext));
  },
});

// Sem isso, erro dentro de rota async derruba o servidor inteiro
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// { token: usuario } - fica na memória
const sessoes = {};

const pegarSessao = (req) =>
  sessoes[(req.headers.authorization || '').replace('Bearer ', '')];

function logado(req, res, next) {
  req.usuario = pegarSessao(req);
  if (!req.usuario) return res.status(401).json({ erro: 'Faça login' });
  next();
}

function soAdmin(req, res, next) {
  if (req.usuario.tipo !== 'administrador') {
    return res.status(403).json({ erro: 'Apenas administradores' });
  }
  next();
}

// ---------- LOGIN ----------
app.post('/api/login', wrap(async (req, res) => {
  const { nome_usuario, senha } = req.body;
  const r = await pool.query(
    `SELECT id_usuario, nome, nome_usuario, email, imagem_usuario, tipo
     FROM tb_usuario WHERE nome_usuario = $1 AND senha = $2`,
    [nome_usuario, senha],
  );
  if (r.rows.length === 0) {
    return res.status(401).json({ erro: 'Usuário não encontrado ou senha incorreta' });
  }
  const token = crypto.randomBytes(16).toString('hex');
  sessoes[token] = r.rows[0];
  res.json({ token, usuario: r.rows[0] });
}));

// ---------- POSTS ----------
// Todos os posts, ou só os de um administrador: ?administrador=bulma (precisa estar logado)
app.get('/api/posts', wrap(async (req, res) => {
  const usuario = pegarSessao(req);
  const params = [usuario ? usuario.id_usuario : null];
  let filtro = '';
  const busca = (req.query.administrador || '').trim().replace('@', '');

  if (busca) {
    if (!usuario) return res.status(401).json({ erro: 'Faça login' });
    const admin = await pool.query(
      `SELECT id_usuario FROM tb_usuario WHERE nome_usuario = $1 AND tipo = 'administrador'`,
      [busca],
    );
    if (admin.rows.length === 0) {
      return res.status(404).json({ erro: 'Administrador não encontrado' });
    }
    params.push(admin.rows[0].id_usuario);
    filtro = 'AND p.id_usuario = $2';
  }

  const r = await pool.query(
    `SELECT p.id_post, p.texto, p.url_imagem,
            u.nome_usuario AS administrador_usuario,
            (SELECT COUNT(*) FROM tb_curtida c WHERE c.id_post = p.id_post)::int AS curtidas,
            EXISTS (SELECT 1 FROM tb_curtida c
                    WHERE c.id_post = p.id_post AND c.id_usuario = $1::int) AS curtido_por_mim,
            (SELECT COUNT(*) FROM tb_post x WHERE x.id_post_pai = p.id_post AND x.id_post <> p.id_post)::int AS comentarios
     FROM tb_post p JOIN tb_usuario u ON u.id_usuario = p.id_usuario
     WHERE p.id_post_pai = p.id_post ${filtro}
     ORDER BY p.id_post DESC`,
    params,
  );
  res.json(r.rows);
}));

// Só administrador cria post. Campos: texto + url_imagem (arquivo)
app.post('/api/posts', logado, soAdmin, upload.single('url_imagem'), wrap(async (req, res) => {
  const texto = (req.body.texto || '').trim();
  if (!texto || !req.file) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      erro: 'Preencha o texto e uma imagem (JPG, JPEG, PNG, GIF ou WEBP)',
    });
  }
  const r = await pool.query(
    `WITH novo AS (SELECT nextval(pg_get_serial_sequence('tb_post', 'id_post')) AS id)
     INSERT INTO tb_post (id_post, id_post_pai, texto, url_imagem, id_usuario)
     SELECT id, id, $1, $2, $3 FROM novo RETURNING *`,
    [texto, req.file.filename, req.usuario.id_usuario],
  );
  res.status(201).json(r.rows[0]);
}));

// Só apaga post que é do administrador logado
app.delete('/api/posts/:id_post', logado, soAdmin, wrap(async (req, res) => {
  const r = await pool.query(
    'DELETE FROM tb_post WHERE id_post = $1 AND id_usuario = $2 AND id_post_pai = id_post',
    [req.params.id_post, req.usuario.id_usuario],
  );
  if (r.rowCount === 0) return res.status(404).json({ erro: 'Post não encontrado' });
  res.json({ ok: true });
}));

// ---------- CURTIDAS ----------
// Se já curtiu, remove a curtida; se não, adiciona
app.post('/api/curtidas/:id_post', logado, wrap(async (req, res) => {
  const { id_post } = req.params;
  const { id_usuario } = req.usuario;

  const existe = await pool.query(
    'SELECT 1 FROM tb_post WHERE id_post = $1 AND id_post_pai = id_post',
    [id_post],
  );
  if (existe.rows.length === 0) return res.status(404).json({ erro: 'Post não encontrado' });

  const del = await pool.query(
    'DELETE FROM tb_curtida WHERE id_usuario = $1 AND id_post = $2',
    [id_usuario, id_post],
  );
  const curtido = del.rowCount === 0;
  if (curtido) {
    await pool.query(
      'INSERT INTO tb_curtida (id_usuario, id_post) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id_usuario, id_post],
    );
  }

  const total = await pool.query(
    'SELECT COUNT(*)::int AS total FROM tb_curtida WHERE id_post = $1',
    [id_post],
  );
  res.json({ curtido, curtidas: total.rows[0].total });
}));

// ---------- COMENTÁRIOS ----------
// No seu schema id_post_pai é NOT NULL: post normal aponta para si mesmo (id_post_pai = id_post);
// comentário aponta para o post que ele responde.
app.get('/api/posts/:id_post/comentarios', wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT c.id_post AS id_comentario, c.texto, u.nome_usuario
     FROM tb_post c JOIN tb_usuario u ON u.id_usuario = c.id_usuario
     WHERE c.id_post_pai = $1 AND c.id_post <> c.id_post_pai ORDER BY c.id_post`,
    [req.params.id_post],
  );
  res.json(r.rows);
}));

app.post('/api/posts/:id_post/comentarios', logado, wrap(async (req, res) => {
  const texto = (req.body.texto || '').trim();
  if (!texto || texto.length > 255) {
    return res.status(400).json({ erro: 'O comentário precisa ter de 1 a 255 caracteres' });
  }
  const existe = await pool.query(
    'SELECT 1 FROM tb_post WHERE id_post = $1 AND id_post_pai = id_post',
    [req.params.id_post],
  );
  if (existe.rows.length === 0) return res.status(404).json({ erro: 'Post não encontrado' });

  await pool.query(
    'INSERT INTO tb_post (texto, id_usuario, id_post_pai) VALUES ($1, $2, $3)',
    [texto, req.usuario.id_usuario, req.params.id_post],
  );
  res.status(201).json({ ok: true });
}));

// ---------- PERFIL DO ADMINISTRADOR ----------
app.get('/api/perfil', logado, soAdmin, wrap(async (req, res) => {
  const posts = await pool.query(
    `SELECT p.id_post, p.texto, p.url_imagem,
            (SELECT COUNT(*) FROM tb_curtida c WHERE c.id_post = p.id_post)::int AS curtidas
     FROM tb_post p
     WHERE p.id_usuario = $1 AND p.id_post_pai = p.id_post
     ORDER BY p.id_post DESC`,
    [req.usuario.id_usuario],
  );
  const totalCurtidas = posts.rows.reduce((soma, p) => soma + p.curtidas, 0);
  res.json({
    usuario: req.usuario,
    totalPosts: posts.rows.length,
    totalCurtidas,
    posts: posts.rows,
  });
}));

// ---------- ERROS ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));