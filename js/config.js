// ⚠️ Completá estos dos valores con los de tu proyecto de Supabase
// (Project Settings > API). Son claves PÚBLICAS: es normal que queden en el sitio.
// NUNCA pegues acá la clave "service_role".
export const CONFIG = {
  SUPABASE_URL: "https://esojxtjhzpkvfjvggxqv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzb2p4dGpoenBrdmZqdmdneHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMDMzMjEsImV4cCI6MjEwOTY3OTMyMX0.rxwnf8dvVJNxOUc4YOZtALtDopvm6p7khaXKyG-rS3o",
  MARCA: "Escala.app"
};
export const configurado = () => !!window.__SB_TEST__ || /^https:\/\/.+\.supabase\.co/.test(CONFIG.SUPABASE_URL) && CONFIG.SUPABASE_ANON_KEY.length > 40;
window.CONFIG_MARCA = {
      PAGO_ALIAS: 'mp-urbano',
      PAGO_CBU: '0000003100023563240267',
      SOPORTE_WSP: '5491153162392',
      EMAIL_CONTACTO: 'contacto@elite-urbano.com',
      TITULAR: 'Luis Varela',
      CUIT: '20-32960746-2',
      DOMINIO: '',
      DEMO_URL: 'https://escala-c22.pages.dev/t/lua-beauty',
      PLANES: { base: { link: '' }, pro: { link: '' }, api: { link: '' } }
    };
