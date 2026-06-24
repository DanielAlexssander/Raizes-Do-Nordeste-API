const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('Senha@123', 10);

  // Usuarios
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@raizes.com' },
    update: {},
    create: { nome: 'Admin', email: 'admin@raizes.com', senha: senhaHash, role: 'ADMIN', consentimentoLgpd: true }
  });
  const gerente = await prisma.usuario.upsert({
    where: { email: 'gerente@raizes.com' },
    update: {},
    create: { nome: 'Gerente', email: 'gerente@raizes.com', senha: senhaHash, role: 'GERENTE', consentimentoLgpd: true }
  });
  const cliente = await prisma.usuario.upsert({
    where: { email: 'cliente@email.com' },
    update: {},
    create: { nome: 'Maria Cliente', email: 'cliente@email.com', senha: senhaHash, role: 'CLIENTE', consentimentoLgpd: true }
  });

  // Unidades
  const unidade1 = await prisma.unidade.upsert({
    where: { id: 1 },
    update: {},
    create: { nome: 'Raízes Centro', endereco: 'Rua Principal, 100 - Recife/PE' }
  });
  const unidade2 = await prisma.unidade.upsert({
    where: { id: 2 },
    update: {},
    create: { nome: 'Raízes Shopping', endereco: 'Shopping Nordeste, Loja 45 - Recife/PE' }
  });

  // Produtos
  const produtos = await Promise.all([
    prisma.produto.upsert({ where: { id: 1 }, update: {}, create: { nome: 'Acarajé', descricao: 'Acarajé tradicional baiano', preco: 15.90 } }),
    prisma.produto.upsert({ where: { id: 2 }, update: {}, create: { nome: 'Tapioca de Carne Seca', descricao: 'Tapioca recheada com carne seca e queijo', preco: 18.50 } }),
    prisma.produto.upsert({ where: { id: 3 }, update: {}, create: { nome: 'Caldo de Sururu', descricao: 'Caldo típico alagoano', preco: 22.00 } }),
    prisma.produto.upsert({ where: { id: 4 }, update: {}, create: { nome: 'Baião de Dois', descricao: 'Arroz com feijão verde, queijo e nata', preco: 29.90 } }),
    prisma.produto.upsert({ where: { id: 5 }, update: {}, create: { nome: 'Suco de Cajá', descricao: 'Suco natural de cajá', preco: 8.00 } }),
  ]);

  // Estoque
  for (const produto of produtos) {
    await prisma.estoque.upsert({
      where: { unidadeId_produtoId: { unidadeId: unidade1.id, produtoId: produto.id } },
      update: { quantidade: 50 },
      create: { unidadeId: unidade1.id, produtoId: produto.id, quantidade: 50 }
    });
    await prisma.estoque.upsert({
      where: { unidadeId_produtoId: { unidadeId: unidade2.id, produtoId: produto.id } },
      update: { quantidade: 30 },
      create: { unidadeId: unidade2.id, produtoId: produto.id, quantidade: 30 }
    });
  }

  // Fidelidade para cliente
  await prisma.fidelidade.upsert({
    where: { usuarioId: cliente.id },
    update: {},
    create: { usuarioId: cliente.id, pontos: 100, consentimento: true }
  });

  console.log('Seed executado com sucesso!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
