# gatekeeper-platform

Este repositório contém os serviços que compõem o Gatekeeper Platform.

## Documentação das Rotas

Abaixo estão listadas as rotas configuradas na aplicação (encontradas em `src/routes`), com o detalhamento dos payloads JSON que cada uma espera receber e o que retornam.

### 1. Webhook de Pagamentos
**Endpoint:** `POST /webhooks/payment`

Esta rota é responsável por receber eventos do gateway de pagamento, como aprovação de cobranças, criação e cancelamento de assinaturas.

**JSON Esperado (Request Body):**
```json
{
  "event": "charge.paid", 
  "email": "usuario@exemplo.com",
  "utm_source": "instagram",    // Opcional
  "utm_medium": "stories",      // Opcional
  "utm_campaign": "lancamento"  // Opcional
}
```
*Observação: Os valores válidos para o campo `event` tratados atualmente são `charge.paid`, `subscription.created`, `subscription.canceled` e `charge.refunded`.*

**Retornos Possíveis:**
- **Status 200** (Quando o pagamento é aprovado/assinatura criada):
```json
{
  "success": true,
  "activation_url": "https://t.me/BotName?start=token_gerado"
}
```
- **Status 200** (Quando a assinatura é cancelada e o membro é expulso do grupo com sucesso):
```json
{
  "success": true,
  "message": "Usuário expulso com sucesso"
}
```
- **Status 400** (Quando o e-mail não é enviado):
```json
{
  "error": "E-mail obrigatório"
}
```
- **Status 400** (Quando o evento enviado não é suportado):
```json
{
  "error": "Evento não suportado"
}
```
- **Status 404** (Quando tentam cancelar um usuário inexistente):
```json
{
  "error": "Assinante não localizado"
}
```
- **Status 500** (Erro ao tentar expulsar o membro no Telegram):
```json
{
  "error": "Falha ao expulsar membro do grupo"
}
```

---

### 2. Analytics / Dashboard
**Endpoint:** `GET http://localhost:3000/api/analytics/dashboard`

Esta rota retorna as métricas consolidadas dos assinantes, agrupamento de canais de tráfego (UTMs) e uma lista de usuários em risco (inativos há mais de 10 dias).

**JSON Esperado:** Nenhum (Requisição GET).

**JSON Retornado (Exemplo):**
```json
{
  "metrics": {
    "totalSubscribers": 0,
    "activeMembers": 0,
    "pendingActivations": 0,
    "membersAtRiskCount": 0,
    "activationRate": 0
  },
  "trafficSources": {

  },
  "membersAtRiskList": []
}
```