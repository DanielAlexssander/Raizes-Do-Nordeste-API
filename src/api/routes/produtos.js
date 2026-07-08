const { Router } = require('express');
const prisma = require('../../infrastructure/database');
const { autenticar, autorizar } = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');

const router = Router();

/**
 * @swagger
 * /produtos:
 *   get:
 *     tags: [Produtos]
 *     summary: Listar produtos
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista de produtos
 */
router.get('/', autenticar, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const [data, total] = await Promise.all([
      prisma.produto.findMany({ where: { ativo: true }, skip: (page - 1) * limit, take: limit }),
      prisma.produto.count({ where: { ativo: true } })
    ]);
    res.json({ data, page, limit, total });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /produtos:
 *   post:
 *     tags: [Produtos]
 *     summary: Criar produto
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, preco]
 *             properties:
 *               nome: { type: string, example: "Coxinha de Charque" }
 *               descricao: { type: string, example: "Coxinha recheada" }
 *               preco: { type: number, example: 12.50 }
 *     responses:
 *       201:
 *         description: Produto criado
 */
router.post('/', autenticar, autorizar('ADMIN', 'GERENTE'), async (req, res, next) => {
  try {
    const { nome, descricao, preco } = req.body;
    if (!nome || preco == null) throw new AppError(400, 'CAMPOS_OBRIGATORIOS', 'Nome e preço são obrigatórios.');
    if (typeof preco !== 'number' || preco <= 0) throw new AppError(422, 'VALOR_INVALIDO', 'Preço deve ser um número positivo.');
    const produto = await prisma.produto.create({ data: { nome, descricao, preco } });
    res.status(201).json(produto);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /produtos/{id}:
 *   get:
 *     tags: [Produtos]
 *     summary: Obter produto por ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dados do produto
 *       404:
 *         description: Produto não encontrado
 */
router.get('/:id', autenticar, async (req, res, next) => {
  try {
    const produto = await prisma.produto.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!produto) throw new AppError(404, 'NAO_ENCONTRADO', 'Produto não encontrado.');
    res.json(produto);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /produtos/{id}:
 *   put:
 *     tags: [Produtos]
 *     summary: Atualizar produto
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
 *             properties:
 *               nome: { type: string }
 *               descricao: { type: string }
 *               preco: { type: number }
 *               ativo: { type: boolean }
 *     responses:
 *       200:
 *         description: Produto atualizado
 */
router.put('/:id', autenticar, autorizar('ADMIN', 'GERENTE'), async (req, res, next) => {
  try {
    const { nome, descricao, preco, ativo } = req.body;
    const produto = await prisma.produto.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!produto) throw new AppError(404, 'NAO_ENCONTRADO', 'Produto não encontrado.');
    const atualizado = await prisma.produto.update({
      where: { id: produto.id },
      data: { ...(nome && { nome }), ...(descricao !== undefined && { descricao }), ...(preco && { preco }), ...(ativo !== undefined && { ativo }) }
    });
    res.json(atualizado);
  } catch (e) { next(e); }
});

module.exports = router;
