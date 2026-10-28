
CREATE TABLE tb_usuario (
  id_usuario SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  nome_usuario VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  senha VARCHAR(100) NOT NULL,
  imagem_usuario VARCHAR(255),
  tipo VARCHAR(255) NOT NULL,
  create_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE TABLE tb_post (
  id_post SERIAL PRIMARY KEY,
   id_usuario INTEGER NOT NULL REFERENCES tb_usuario(id_usuario) ON DELETE CASCADE,
  id_post_pai INTEGER NOT NULL REFERENCES tb_post(id_post) ON DELETE CASCADE,
    texto VARCHAR(255) NOT NULL,
  url_imagem VARCHAR(255) ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  create_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tb_curtida (
  id_curtida SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES tb_usuario(id_usuario) ON DELETE CASCADE,
  id_post INTEGER NOT NULL REFERENCES tb_post(id_post) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  create_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id_usuario, id_post)
);

