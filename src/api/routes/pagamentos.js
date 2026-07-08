const { Router } = require('express');
const prisma = require('../../infrastructure/database');
const { autenticar } = require('../middlewares/auth');
const { registrarLog } = require('../../infrastructure/auditoria');
const { processarPagamentoMock } = require('../../infrastructure/pagamentoGateway');
const { AppError } = require('../middlewares/errorHandler');

const router = Router();

/**
 * @swagger
 * /pagamentos:
 *   post:
 *     tags: [Pagamentos]
 *     summary: Solicitar pagamento mock para pedido
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pedidoId, formaPagamento]
 *             properties:
 *               pedidoId: { type: integer, example: 1 }
 *               formaPagamento: { type: string, example: "PIX" }
 *     responses:
 *       200:
 *         description: Resultado do pagamento
 *       404:
 *         description: Pedido não encontrado
 *       409:
 *         description: Pagamento já processado
 */
router.post('/', autenticar, async (req, res, next) => {
  try {
    const { pedidoId, formaPagamento } = req.body;
    if (!pedidoId || !formaPagamento) throw new AppError(400, 'CAMPOS_OBRIGATORIOS', 'pedidoId e formaPagamento são obrigatórios.');

    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new AppError(404, 'NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (pedido.status !== 'AGUARDANDO_PAGAMENTO') throw new AppError(409, 'OPERACAO_INVALIDA', 'Este pedido não está aguardando pagamento.');

    // Verificar se já existe pagamento
    const pagExistente = await prisma.pagamento.findUnique({ where: { pedidoId } });
    if (pagExistente && pagExistente.status !== 'PENDENTE') throw new AppError(409, 'PAGAMENTO_JA_PROCESSADO', 'Já existe pagamento processado para este pedido.');

    // Chamar gateway mock
    const resultado = processarPagamentoMock(pedido.total, formaPagamento);

    // Registrar pagamento
    const pagamento = pagExistente
      ? await prisma.pagamento.update({ where: { id: pagExistente.id }, data: { status: resultado.status, transacaoId: resultado.transacaoId, mensagem: resultado.mensagem } })
      : await prisma.pagamento.create({ data: { pedidoId, valor: pedido.total, status: resultado.status, transacaoId: resultado.transacaoId, mensagem: resultado.mensagem } });

    // Atualizar status do pedido
    const novoStatus = resultado.status === 'APROVADO' ? 'PAGO' : 'PAGAMENTO_RECUSADO';
    await prisma.pedido.update({ where: { id: pedidoId }, data: { status: novoStatus } });

    await registrarLog({ acao: `PAGAMENTO_${resultado.status}`, entidade: 'Pagamento', entidadeId: pagamento.id, usuarioId: req.usuario.id, detalhes: `Pedido ${pedidoId}, Valor: ${pedido.total}, Forma: ${formaPagamento}`, ip: req.ip });

    res.json({
      pagamentoId: pagamento.id,
      pedidoId,
      status: resultado.status,
      transacaoId: resultado.transacaoId,
      valor: pedido.total,
      mensagem: resultado.mensagem,
      statusPedido: novoStatus,
      processadoEm: resultado.processadoEm
    });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /pagamentos/{pedidoId}:
 *   get:
 *     tags: [Pagamentos]
 *     summary: Consultar status de pagamento por pedido
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: pedidoId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status do pagamento
 */
router.get('/:pedidoId', autenticar, async (req, res, next) => {
  try {
    const pagamento = await prisma.pagamento.findUnique({ where: { pedidoId: parseInt(req.params.pedidoId) } });
    if (!pagamento) throw new AppError(404, 'NAO_ENCONTRADO', 'Pagamento não encontrado para este pedido.');
    res.json(pagamento);
  } catch (e) { next(e); }
});

module.exports = router;
