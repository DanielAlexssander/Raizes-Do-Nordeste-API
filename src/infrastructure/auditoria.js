const prisma = require('./database');

async function registrarLog({ acao, entidade, entidadeId, usuarioId, detalhes, ip }) {
  await prisma.logAuditoria.create({
    data: { acao, entidade, entidadeId, usuarioId, detalhes, ip }
  });
}

module.exports = { registrarLog };
