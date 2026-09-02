-- Habilita extensão para geração de UUID (caso queira usar uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================
-- 1. PRODUTORES / DONOS DOS GRUPOS (TENANTS)
-- ========================================================
CREATE TABLE IF NOT EXISTS produtores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    telegram_bot_token VARCHAR(255),
    telegram_chat_id VARCHAR(50),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 2. PLANOS DE ASSINATURA DISPONÍVEIS
-- ========================================================
CREATE TABLE IF NOT EXISTS planos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produtor_id UUID NOT NULL REFERENCES produtores(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL, -- Ex: VIP Mensal, VIP Vitalício
    preco_centavos INT NOT NULL, -- Ex: 9700 = R$ 97,00
    intervalo_dias INT NOT NULL DEFAULT 30, -- 30 para mensal, 0 para vitalício
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 3. ASSINANTES (COMPRADORES FINAIS)
-- ========================================================
-- Status possíveis: PENDENTE, ATIVO, CANCELADO, ATRASADO
CREATE TYPE status_assinante AS ENUM ('PENDENTE', 'ATIVO', 'CANCELADO', 'ATRASADO');

CREATE TABLE IF NOT EXISTS assinantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produtor_id UUID REFERENCES produtores(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    telegram_user_id BIGINT UNIQUE, -- ID numérico do usuário no Telegram
    telegram_username VARCHAR(100), -- @ do Telegram
    token_ativacao VARCHAR(64) UNIQUE NOT NULL, -- Token do deep link (/start TOKEN)
    status status_assinante NOT NULL DEFAULT 'PENDENTE',
    data_expiracao TIMESTAMP WITH TIME ZONE, -- Quando vence o acesso
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para acelerar busca por e-mail e por token no webhook e no bot
CREATE INDEX idx_assinantes_email ON assinantes(email);
CREATE INDEX idx_assinantes_token ON assinantes(token_ativacao);
CREATE INDEX idx_assinantes_telegram_id ON assinantes(telegram_user_id);

-- ========================================================
-- 4. TRANSAÇÕES FINANCEIRAS (PARA ALIMENTAR OS GRÁFICOS DO CRM)
-- ========================================================
CREATE TYPE metodo_pagamento AS ENUM ('PIX', 'CARTAO_CREDITO', 'BOLETO');
CREATE TYPE status_transacao AS ENUM ('PAGO', 'REEMBOLSADO', 'RECUSADO', 'CHARGEBACK');

CREATE TABLE IF NOT EXISTS transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assinante_id UUID NOT NULL REFERENCES assinantes(id) ON DELETE CASCADE,
    produtor_id UUID REFERENCES produtores(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES planos(id) ON DELETE SET NULL,
    transacao_gateway_id VARCHAR(150) UNIQUE, -- ID original da Kiwify/Hotmart/Mercado Pago
    valor_centavos INT NOT NULL,
    metodo metodo_pagamento NOT NULL,
    status status_transacao NOT NULL DEFAULT 'PAGO',
    pago_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transacoes_pago_em ON transacoes(pago_em);
CREATE INDEX idx_transacoes_status ON transacoes(status);

-- ========================================================
-- 5. HISTÓRICO DE ACESSOS (CHURN E RETENÇÃO)
-- ========================================================
CREATE TYPE tipo_evento_acesso AS ENUM ('ENTROU', 'SAIU', 'EXPULSO', 'RENOVADO');

CREATE TABLE IF NOT EXISTS historico_acessos (
    id BIGSERIAL PRIMARY KEY,
    assinante_id UUID NOT NULL REFERENCES assinantes(id) ON DELETE CASCADE,
    tipo tipo_evento_acesso NOT NULL,
    motivo VARCHAR(255), -- Ex: "Inadimplência Webhook", "Cancelamento Voluntário"
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);