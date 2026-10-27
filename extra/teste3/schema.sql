-- schema.sql

CREATE TABLE tb_usuario (
  id_usuario SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  nome_usuario VARCHAR(50) UNIQUE NOT NULL,
  senha VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  imagem_usuario VARCHAR(255),
  tipo VARCHAR(255) NOT NULL,
  create_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE TABLE tb_livro (
  id_livro SERIAL PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  autor VARCHAR(100) NOT NULL,
  id_categoria VARCHAR(255) NOT NULL,
  id_usuario INTEGER NOT NULL REFERENCES tb_usuario(id_usuario) ON DELETE CASCADE,
    url_capa VARCHAR(255) NOT NULL,
  exemplares INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  create_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tb_emprestimo (
  id_emprestimo SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES tb_usuario(id_usuario) ON DELETE CASCADE,
  id_livro INTEGER NOT NULL REFERENCES tb_filme(id_filme) ON DELETE CASCADE,
  data_emprestimo TIMESTAMPTZ DEFAULT NOW(),
  data_prevista_devolucao TIMESTAMPTZ DEFAULT NOW(),
  data_devolucao TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  create_at TIMESTAMPTZ DEFAULT NOW()
);



