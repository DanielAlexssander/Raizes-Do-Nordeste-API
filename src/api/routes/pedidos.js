const { Router } = require('express');
const prisma = require('../../infrastructure/database');
const { autenticar, autorizar } = require('../middlewares/auth');
const { registrarLog } = require('../../infrastructure/auditoria');
const { AppError } = require('../middlewares/errorHandler');

const router = Router();
const CANAIS_VALIDOS = ['APP', 'TOTEM', 'BALCAO', 'PICKUP', 'WEB'];

/**
 * @swagger
 * /pedidos:
 *   post:
 *     tags: [Pedidos]
 *     summary: Criar pedido
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unidadeId, canalPedido, itens]
 *             properties:
 *               unidadeId: { type: integer, example: 1 }
 *               canalPedido: { type: string, enum: [APP, TOTEM, BALCAO, PICKUP, WEB], example: "APP" }
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     produtoId: { type: integer, example: 1 }
 *                     quantidade: { type: integer, example: 2 }
 *     responses:
 *       201:
 *         description: Pedido criado
 *       409:
 *         description: Estoque insuficiente
 */
router.post('/', autenticar, async (req, res, next) => {
  try {
    const { unidadeId, canalPedido, itens } = req.body;

    // Validações
    if (!canalPedido) throw new AppError(400, 'CAMPO_OBRIGATORIO', 'canalPedido é obrigatório.', [{ field: 'canalPedido', issue: 'Campo ausente' }]);
    if (!CANAIS_VALIDOS.includes(canalPedido)) throw new AppError(422, 'CANAL_INVALIDO', `canalPedido inválido. Valores aceitos: ${CANAIS_VALIDOS.join(', ')}`, [{ field: 'canalPedido', issue: 'Valor inválido' }]);
    if (!unidadeId) throw new AppError(400, 'CAMPO_OBRIGATORIO', 'unidadeId é obrigatório.');
    if (!itens || !Array.isArray(itens) || itens.length === 0) throw new AppError(400, 'CAMPO_OBRIGATORIO', 'itens é obrigatório e deve conter ao menos um item.');

    // Validar unidade
    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade) throw new AppError(404, 'NAO_ENCONTRADO', 'Unidade não encontrada.');

    // Validar produtos e estoque
    let total = 0;
    const itensProcessados = [];
    for (const item of itens) {
      if (!item.produtoId || !item.quantidade || item.quantidade <= 0) {
        throw new AppError(422, 'ITEM_INVALIDO', 'Cada item deve ter produtoId e quantidade positiva.');
      }
      const produto = await prisma.produto.findUnique({ where: { id: item.produtoId } });
      if (!produto) throw new AppError(404, 'NAO_ENCONTRADO', `Produto ${item.produtoId} não encontrado.`);

      const estoque = await prisma.estoque.findUnique({ where: { unidadeId_produtoId: { unidadeId, produtoId: item.produtoId } } });
      if (!estoque || estoque.quantidade < item.quantidade) {
        throw new AppError(409, 'ESTOQUE_INSUFICIENTE', 'Não há quantidade suficiente para um ou mais itens.', [{ field: `itens[${itensProcessados.length}].quantidade`, issue: `Disponível: ${estoque?.quantidade || 0}` }]);
      }

      itensProcessados.push({ produtoId: item.produtoId, quantidade: item.quantidade, precoUnitario: produto.preco });
      total += produto.preco * item.quantidade;
    }

    // Criar pedido em transação
    const pedido = await prisma.$transaction(async (tx) => {
      const p = await tx.pedido.create({
        data: {
          usuarioId: req.usuario.id,
          unidadeId,
          canalPedido,
          total: Math.round(total * 100) / 100,
          itens: { create: itensProcessados }
        },
        include: { itens: true }
      });

      // Decrementar estoque
      for (const item of itensProcessados) {
        await tx.estoque.update({
          where: { unidadeId_produtoId: { unidadeId, produtoId: item.produtoId } },
          data: { quantidade: { decrement: item.quantidade } }
        });
      }

      return p;
    });

    await registrarLog({ acao: 'PEDIDO_CRIADO', entidade: 'Pedido', entidadeId: pedido.id, usuarioId: req.usuario.id, detalhes: `Canal: ${canalPedido}, Total: ${pedido.total}`, ip: req.ip });

    res.status(201).json({
      pedidoId: pedido.id,
      status: pedido.status,
      total: pedido.total,
      canalPedido: pedido.canalPedido,
      itens: pedido.itens.map(i => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
      createdAt: pedido.createdAt
    });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /pedidos:
 *   get:
 *     tags: [Pedidos]
 *     summary: Listar pedidos (com filtro por canal)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: canalPedido
 *         schema: { type: string, enum: [APP, TOTEM, BALCAO, PICKUP, WEB] }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista de pedidos
 */
router.get('/', autenticar, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const where = {};

    if (req.query.canalPedido) {
      if (!CANAIS_VALIDOS.includes(req.query.canalPedido)) throw new AppError(422, 'CANAL_INVALIDO', 'canalPedido inválido para filtro.');
      where.canalPedido = req.query.canalPedido;
    }
    if (req.query.status) where.status = req.query.status;

    // Clientes veem apenas seus pedidos
    if (req.usuario.role === 'CLIENTE') where.usuarioId = req.usuario.id;

    const [data, total] = await Promise.all([
      prisma.pedido.findMany({ where, skip: (page - 1) * limit, take: limit, include: { itens: true }, orderBy: { createdAt: 'desc' } }),
      prisma.pedido.count({ where })
    ]);
    res.json({ data, page, limit, total });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /pedidos/{id}:
 *   get:
 *     tags: [Pedidos]
 *     summary: Obter pedido por ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dados do pedido
 */
router.get('/:id', autenticar, async (req, res, next) => {
  try {
    const pedido = await prisma.pedido.findUnique({ where: { id: parseInt(req.params.id) }, include: { itens: true, pagamento: true } });
    if (!pedido) throw new AppError(404, 'NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (req.usuario.role === 'CLIENTE' && pedido.usuarioId !== req.usuario.id) throw new AppError(403, 'SEM_PERMISSAO', 'Sem permissão.');
    res.json(pedido);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /pedidos/{id}/status:
 *   patch:
 *     tags: [Pedidos]
 *     summary: Atualizar status do pedido
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [EM_PREPARO, PRONTO, ENTREGUE, CANCELADO] }
 *     responses:
 *       200:
 *         description: Status atualizado
 */
router.patch('/:id/status', autenticar, autorizar('ADMIN', 'GERENTE', 'ATENDENTE', 'COZINHA'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) throw new AppError(400, 'CAMPO_OBRIGATORIO', 'status é obrigatório.');

    const pedido = await prisma.pedido.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!pedido) throw new AppError(404, 'NAO_ENCONTRADO', 'Pedido não encontrado.');

    const atualizado = await prisma.pedido.update({ where: { id: pedido.id }, data: { status } });

    await registrarLog({ acao: 'STATUS_ALTERADO', entidade: 'Pedido', entidadeId: pedido.id, usuarioId: req.usuario.id, detalhes: `${pedido.status} -> ${status}`, ip: req.ip });

    res.json(atualizado);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /pedidos/{id}/cancelar:
 *   patch:
 *     tags: [Pedidos]
 *     summary: Cancelar pedido
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pedido cancelado
 */
router.patch('/:id/cancelar', autenticar, async (req, res, next) => {
  try {
    const pedido = await prisma.pedido.findUnique({ where: { id: parseInt(req.params.id) }, include: { itens: true } });
    if (!pedido) throw new AppError(404, 'NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (req.usuario.role === 'CLIENTE' && pedido.usuarioId !== req.usuario.id) throw new AppError(403, 'SEM_PERMISSAO', 'Sem permissão.');
    if (['ENTREGUE', 'CANCELADO'].includes(pedido.status)) throw new AppError(409, 'OPERACAO_INVALIDA', 'Pedido não pode ser cancelado neste status.');

    // Devolver estoque
    await prisma.$transaction(async (tx) => {
      for (const item of pedido.itens) {
        await tx.estoque.update({
          where: { unidadeId_produtoId: { unidadeId: pedido.unidadeId, produtoId: item.produtoId } },
          data: { quantidade: { increment: item.quantidade } }
        });
      }
      await tx.pedido.update({ where: { id: pedido.id }, data: { status: 'CANCELADO' } });
    });

    await registrarLog({ acao: 'PEDIDO_CANCELADO', entidade: 'Pedido', entidadeId: pedido.id, usuarioId: req.usuario.id, ip: req.ip });

    res.json({ message: 'Pedido cancelado com sucesso.', pedidoId: pedido.id, status: 'CANCELADO' });
  } catch (e) { next(e); }
});

module.exports = router;
