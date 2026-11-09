// Portada: misma página, con la imagen y la dirección completas para la vista previa al compartir.
import { pagina } from './_pagina.js';
export const onRequestGet = ({ request, env }) => pagina(request, env);
