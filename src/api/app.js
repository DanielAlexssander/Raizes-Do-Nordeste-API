const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());

// Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Raízes do Nordeste - API',
      version: '1.0.0',
      description: 'API REST para a rede de lanchonetes Raízes do Nordeste. Fluxo A: Pedido → Pagamento Mock → Status.'
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: ['./src/api/routes/*.js']
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas
app.use('/auth', require('./routes/auth'));
app.use('/unidades', require('./routes/unidades'));
app.use('/produtos', require('./routes/produtos'));
app.use('/estoque', require('./routes/estoque'));
app.use('/pedidos', require('./routes/pedidos'));
app.use('/pagamentos', require('./routes/pagamentos'));
app.use('/fidelidade', require('./routes/fidelidade'));

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', api: 'Raízes do Nordeste', version: '1.0.0' }));

// Error handler
app.use(errorHandler);

module.exports = app;
