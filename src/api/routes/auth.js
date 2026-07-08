const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../infrastructure/database');
const { registrarLog } = require('../../infrastructure/auditoria');
const { AppError } = require('../middlewares/errorHandler');
const { autenticar } = require('../middlewares/auth');

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Autenticar usuário e obter token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email: { type: string, example: "cliente@email.com" }
 *               senha: { type: string, example: "Senha@123" }
 *     responses:
 *       200:
 *         description: Login realizado
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) throw new AppError(400, 'CAMPOS_OBRIGATORIOS', 'Email e senha são obrigatórios.');

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.');
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, role: usuario.role, nome: usuario.nome },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    await registrarLog({ acao: 'LOGIN', entidade: 'Usuario', entidadeId: usuario.id, usuarioId: usuario.id, ip: req.ip });

    res.json({
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: usuario.id, nome: usuario.nome, perfil: usuario.role }
    });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /auth/registro:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar novo usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, senha]
 *             properties:
 *               nome: { type: string, example: "João Silva" }
 *               email: { type: string, example: "joao@email.com" }
 *               senha: { type: string, example: "Senha@123" }
 *               consentimentoLgpd: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Usuário criado
 *       409:
 *         description: Email já cadastrado
 */
router.post('/registro', async (req, res, next) => {
  try {
    const { nome, email, senha, consentimentoLgpd } = req.body;
    if (!nome || !email || !senha) throw new AppError(400, 'CAMPOS_OBRIGATORIOS', 'Nome, email e senha são obrigatórios.');

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) throw new AppError(409, 'EMAIL_DUPLICADO', 'Este e-mail já está cadastrado.');

    const hash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { nome, email, senha: hash, consentimentoLgpd: consentimentoLgpd || false }
    });

    res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role });
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /auth/perfil:
 *   get:
 *     tags: [Auth]
 *     summary: Obter dados do usuário autenticado
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dados do perfil
 */
router.get('/perfil', autenticar, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nome: true, email: true, role: true, createdAt: true }
    });
    res.json(usuario);
  } catch (e) { next(e); }
});

module.exports = router;
