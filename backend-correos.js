const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración del transporter usando la clave de aplicación
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'agrogestsistema@gmail.com',
    pass: 'vcqg cvkq jite dijk'
  }
});

app.post('/enviar-correo', async (req, res) => {
  const { to, subject, text, html } = req.body;

  try {
    const info = await transporter.sendMail({
      from: '"Agrogest Sistema" <agrogestsistema@gmail.com>',
      to,
      subject,
      text,
      html
    });
    console.log('Correo enviado: %s', info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error enviando correo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de correos corriendo en el puerto ${PORT}`);
  console.log(`Asegúrate de cambiar la IP en lib/correos.ts por tu IP de red local para que el celular se pueda conectar.`);
});
