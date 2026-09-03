-- Habilita extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================
-- 1. PRODUTORES / CLIENTES SAAS (TENANTS)
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
-- 2. PLANOS DE ACESSO
-- ========================================================
CREATE TABLE IF NOT EXISTS planos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produtor_id UUID NOT NULL REFERENCES produtores(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    preco_centavos INT NOT NULL,
    intervalo_dias INT NOT NULL DEFAULT 30, -- 0 para vitalício
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_planos_produtor ON planos(produtor_id);

-- ========================================================
-- 3. ASSINANTES / COMPRADORES FINAIS
-- ========================================================
CREATE TYPE status_assinante AS ENUM ('PENDENTE', 'ATIVO', 'CANCELADO', 'ATRASADO');

CREATE TABLE IF NOT EXISTS assinantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produtor_id UUID NOT NULL REFERENCES produtores(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    telegram_user_id BIGINT,
    telegram_username VARCHAR(100),
    token_ativacao VARCHAR(64) UNIQUE NOT NULL,
    status status_assinante NOT NULL DEFAULT 'PENDENTE',
    data_expiracao TIMESTAMP WITH TIME ZONE,
    
    -- Métricas de Engajamento e Rastreamento Analítico
    ultima_mensagem_em TIMESTAMP WITH TIME ZONE,
    total_mensagens_enviadas INT DEFAULT 0,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_produtor_assinante_email UNIQUE(produtor_id, email),
    CONSTRAINT uq_produtor_telegram_user UNIQUE(produtor_id, telegram_user_id)
);

CREATE INDEX idx_assinantes_produtor_status ON assinantes(produtor_id, status);
CREATE INDEX idx_assinantes_token ON assinantes(token_ativacao);
CREATE INDEX idx_assinantes_telegram_id ON assinantes(telegram_user_id);
CREATE INDEX idx_assinantes_utm_source ON assinantes(produtor_id, utm_source);

-- ========================================================
-- 4. TRANSAÇÕES FINANCEIRAS & RÉGUA DE COBRANÇA
-- ========================================================
CREATE TYPE metodo_pagamento AS ENUM ('PIX', 'CARTAO_CREDITO', 'BOLETO');
CREATE TYPE status_transacao AS ENUM ('PENDENTE', 'PAGO', 'REEMBOLSADO', 'RECUSADO', 'CHARGEBACK', 'EXPIRADO');

CREATE TABLE IF NOT EXISTS transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produtor_id UUID NOT NULL REFERENCES produtores(id) ON DELETE CASCADE,
    assinante_id UUID NOT NULL REFERENCES assinantes(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES planos(id) ON DELETE SET NULL,
    transacao_gateway_id VARCHAR(150) UNIQUE,
    valor_centavos INT NOT NULL,
    metodo metodo_pagamento NOT NULL,
    status status_transacao NOT NULL DEFAULT 'PENDENTE',
    
    -- Campos para Recuperação de Pix / Carrinho Abandonado
    pix_copia_cola TEXT,
    pix_expira_em TIMESTAMP WITH TIME ZONE,
    notificacoes_cobranca_enviadas INT DEFAULT 0,
    
    pago_em TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transacoes_produtor_status ON transacoes(produtor_id, status);
CREATE INDEX idx_transacoes_pix_pendente ON transacoes(status, pix_expira_em) WHERE status = 'PENDENTE';

-- ========================================================
-- 5. ATIVIDADE CONSOLIDADA NO TELEGRAM (GRÁFICOS TEMPORAIS)
-- ========================================================
CREATE TABLE IF NOT EXISTS atividade_diaria_telegram (
    id BIGSERIAL PRIMARY KEY,
    produtor_id UUID NOT NULL REFERENCES produtores(id) ON DELETE CASCADE,
    assinante_id UUID NOT NULL REFERENCES assinantes(id) ON DELETE CASCADE,
    data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    quantidade_mensagens INT DEFAULT 1,

    CONSTRAINT uq_assinante_dia UNIQUE(assinante_id, data_registro)
);

CREATE INDEX idx_atividade_produtor_data ON atividade_diaria_telegram(produtor_id, data_registro);

-- ========================================================
-- 6. HISTÓRICO DE ACESSOS (CHURN & AUDITORIA)
-- ========================================================
CREATE TYPE tipo_evento_acesso AS ENUM ('ENTROU', 'SAIU', 'EXPULSO', 'RENOVADO');

CREATE TABLE IF NOT EXISTS historico_acessos (
    id BIGSERIAL PRIMARY KEY,
    produtor_id UUID NOT NULL REFERENCES produtores(id) ON DELETE CASCADE,
    assinante_id UUID NOT NULL REFERENCES assinantes(id) ON DELETE CASCADE,
    tipo tipo_evento_acesso NOT NULL,
    motivo VARCHAR(255),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_historico_produtor_tipo ON historico_acessos(produtor_id, tipo);

-- Logs do Bot
CREATE TYPE tipo_operacao_bot AS ENUM (
    'CONVITE_GERADO',
    'MEMBRO_ENTROU',
    'MEMBRO_EXPULSO',
    'MEMBRO_AVISADO',
    'MENSAGEM_FIXADA'
);

CREATE TABLE IF NOT EXISTS log_operacoes_bot (
    id BIGSERIAL PRIMARY KEY,
    produtor_id UUID REFERENCES produtores(id) ON DELETE CASCADE,
    assinante_id UUID REFERENCES assinantes(id) ON DELETE SET NULL,
    tipo tipo_operacao_bot NOT NULL,
    detalhes VARCHAR(255),
    executado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operacoes_semana ON log_operacoes_bot(produtor_id, executado_em);