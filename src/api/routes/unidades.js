const { Router } = require('express');
const prisma = require('../../infrastructure/database');
const { autenticar, autorizar } = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');

const router = Router();

/**
 * @swagger
 * /unidades:
 *   get:
 *     tags: [Unidades]
 *     summary: Listar unidades
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
 *         description: Lista de unidades
 */
router.get('/', autenticar, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const [data, total] = await Promise.all([
      prisma.unidade.findMany({ skip: (page - 1) * limit, take: limit }),
      prisma.unidade.count()
    ]);
    res.json({ data, page, limit, total });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /unidades:
 *   post:
 *     tags: [Unidades]
 *     summary: Criar unidade
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, endereco]
 *             properties:
 *               nome: { type: string, example: "Raízes Boa Viagem" }
 *               endereco: { type: string, example: "Av. Boa Viagem, 500" }
 *     responses:
 *       201:
 *         description: Unidade criada
 */
router.post('/', autenticar, autorizar('ADMIN', 'GERENTE'), async (req, res, next) => {
  try {
    const { nome, endereco } = req.body;
    if (!nome || !endereco) throw new AppError(400, 'CAMPOS_OBRIGATORIOS', 'Nome e endereço são obrigatórios.');
    const unidade = await prisma.unidade.create({ data: { nome, endereco } });
    res.status(201).json(unidade);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /unidades/{id}:
 *   get:
 *     tags: [Unidades]
 *     summary: Obter unidade por ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dados da unidade
 *       404:
 *         description: Unidade não encontrada
 */
router.get('/:id', autenticar, async (req, res, next) => {
  try {
    const unidade = await prisma.unidade.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!unidade) throw new AppError(404, 'NAO_ENCONTRADO', 'Unidade não encontrada.');
    res.json(unidade);
  } catch (e) { next(e); }
});

module.exports = router;
