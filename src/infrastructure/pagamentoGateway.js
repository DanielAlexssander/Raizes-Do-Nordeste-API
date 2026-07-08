const { v4: uuidv4 } = require('uuid');

/**
 * Simula gateway de pagamento externo.
 * Retorna aprovado ~70% das vezes, recusado ~30%.
 */
function processarPagamentoMock(valor, formaPagamento) {
  const aprovado = Math.random() < 0.7;
  return {
    transacaoId: uuidv4(),
    status: aprovado ? 'APROVADO' : 'RECUSADO',
    valor,
    formaPagamento,
    mensagem: aprovado ? 'Pagamento aprovado com sucesso' : 'Pagamento recusado pelo emissor',
    processadoEm: new Date().toISOString()
  };
}

module.exports = { processarPagamentoMock };
