const { Router } = require('express');
const prisma = require('../../infrastructure/database');
const { autenticar } = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');

const router = Router();

/**
 * @swagger
 * /fidelidade/saldo:
 *   get:
 *     tags: [Fidelidade]
 *     summary: Consultar saldo de pontos do usuário
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Saldo de pontos
 */
router.get('/saldo', autenticar, async (req, res, next) => {
  try {
    const fidelidade = await prisma.fidelidade.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!fidelidade) return res.json({ pontos: 0, consentimento: false });
    res.json({ pontos: fidelidade.pontos, consentimento: fidelidade.consentimento });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /fidelidade/consentimento:
 *   post:
 *     tags: [Fidelidade]
 *     summary: Registrar consentimento para programa de fidelidade
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [consentimento]
 *             properties:
 *               consentimento: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Consentimento registrado
 */
router.post('/consentimento', autenticar, async (req, res, next) => {
  try {
    const { consentimento } = req.body;
    if (consentimento === undefined) throw new AppError(400, 'CAMPO_OBRIGATORIO', 'consentimento é obrigatório.');

    const fidelidade = await prisma.fidelidade.upsert({
      where: { usuarioId: req.usuario.id },
      update: { consentimento },
      create: { usuarioId: req.usuario.id, consentimento, pontos: 0 }
    });
    res.json({ message: 'Consentimento registrado.', consentimento: fidelidade.consentimento });
  } catch (e) { next(e); }
});

module.exports = router;
