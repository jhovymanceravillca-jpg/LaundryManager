# Guion para la presentación

## Recorrido de una solicitud

Al registrar un pedido, React manda los IDs de cliente, prendas y servicios, cantidad, peso y fecha a `/api/orders`. Nginx recibe la petición y la reenvía a Express en VM2. Express valida la sesión y los datos, vuelve a leer los precios vigentes en MySQL VM3 y calcula los importes. Una transacción guarda cabecera, detalles e historial de estado. La respuesta JSON vuelve por Express y Nginx y React actualiza la pantalla.

Por ejemplo, para un pedido con tres camisas, el backend multiplica cantidad por precio histórico del servicio y conserva ese precio en el detalle. Un pago parcial se inserta en una transacción que bloquea el pedido y comprueba el saldo. Cuando la prenda está terminada, el personal registra a quien recibe y queda trazabilidad de entrega.

## Componentes y disponibilidad

- **VM1:** Ubuntu, Nginx y React compilado; presenta la interfaz al usuario.
- **VM2:** Ubuntu, Node.js, Express y PM2; valida, autentica y ejecuta reglas.
- **VM3:** Ubuntu y MySQL; persiste datos y aplica restricciones relacionales.
- **REST/JSON:** mecanismo y formato mediante los que se comunican navegador y API.
- **Nginx:** servidor web y proxy inverso para que el navegador use el mismo origen `/api`.

Separar las máquinas reduce el acoplamiento y permite restringir puertos. Si VM1 falla, API y DB pueden seguir activas; si VM2 falla, se muestran errores de API sin inventar datos; si VM3 falla, las operaciones persistentes no pueden completarse. Los datos se respaldan fuera de VM3.
