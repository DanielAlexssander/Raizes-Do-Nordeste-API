const { Router } = require('express');
const prisma = require('../../infrastructure/database');
const { autenticar, autorizar } = require('../middlewares/auth');
const { registrarLog } = require('../../infrastructure/auditoria');
const { AppError } = require('../middlewares/errorHandler');

const router = Router();

/**
 * @swagger
 * /estoque:
 *   get:
 *     tags: [Estoque]
 *     summary: Consultar estoque por unidade
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: unidadeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estoque da unidade
 */
router.get('/', autenticar, async (req, res, next) => {
  try {
    const unidadeId = parseInt(req.query.unidadeId);
    if (!unidadeId) throw new AppError(400, 'CAMPO_OBRIGATORIO', 'unidadeId é obrigatório.');
    const data = await prisma.estoque.findMany({
      where: { unidadeId },
      include: { produto: { select: { id: true, nome: true, preco: true } } }
    });
    res.json({ data });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /estoque/movimentar:
 *   post:
 *     tags: [Estoque]
 *     summary: Movimentar estoque (entrada/saída)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unidadeId, produtoId, tipo, quantidade]
 *             properties:
 *               unidadeId: { type: integer, example: 1 }
 *               produtoId: { type: integer, example: 1 }
 *               tipo: { type: string, enum: [ENTRADA, SAIDA], example: "ENTRADA" }
 *               quantidade: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: Estoque atualizado
 *       409:
 *         description: Estoque insuficiente
 */
router.post('/movimentar', autenticar, autorizar('ADMIN', 'GERENTE', 'ATENDENTE'), async (req, res, next) => {
  try {
    const { unidadeId, produtoId, tipo, quantidade } = req.body;
    if (!unidadeId || !produtoId || !tipo || !quantidade) {
      throw new AppError(400, 'CAMPOS_OBRIGATORIOS', 'unidadeId, produtoId, tipo e quantidade são obrigatórios.');
    }
    if (!['ENTRADA', 'SAIDA'].includes(tipo)) throw new AppError(422, 'TIPO_INVALIDO', 'Tipo deve ser ENTRADA ou SAIDA.');
    if (typeof quantidade !== 'number' || quantidade <= 0) throw new AppError(422, 'QUANTIDADE_INVALIDA', 'Quantidade deve ser positiva.');

    let estoque = await prisma.estoque.findUnique({ where: { unidadeId_produtoId: { unidadeId, produtoId } } });

    if (!estoque) {
      if (tipo === 'SAIDA') throw new AppError(409, 'ESTOQUE_INSUFICIENTE', 'Não há estoque para este produto nesta unidade.');
      estoque = await prisma.estoque.create({ data: { unidadeId, produtoId, quantidade } });
    } else {
      const novaQtd = tipo === 'ENTRADA' ? estoque.quantidade + quantidade : estoque.quantidade - quantidade;
      if (novaQtd < 0) throw new AppError(409, 'ESTOQUE_INSUFICIENTE', 'Quantidade insuficiente em estoque.', [{ field: 'quantidade', issue: `Disponível: ${estoque.quantidade}` }]);
      estoque = await prisma.estoque.update({ where: { id: estoque.id }, data: { quantidade: novaQtd } });
    }

    await registrarLog({ acao: `ESTOQUE_${tipo}`, entidade: 'Estoque', entidadeId: estoque.id, usuarioId: req.usuario.id, detalhes: `Produto ${produtoId}, Qtd: ${quantidade}`, ip: req.ip });

    res.json(estoque);
  } catch (e) { next(e); }
});

module.exports = router;
