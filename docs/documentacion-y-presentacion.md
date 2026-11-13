# Documentación y presentación de LaundryManager

> Material base para una exposición académica. Completa los campos entre corchetes y confirma con tu docente el formato, la extensión y el estilo bibliográfico requeridos. La arquitectura de tres máquinas se describe como diseño previsto; no debe presentarse como producción instalada.

## 1. Documento del proyecto

### Portada

**[Nombre de la institución]**  
**[Carrera o programa]**  
**[Materia o asignatura]**

**Proyecto:** LaundryManager — Sistema web de gestión para una lavandería

- **Docente:** [Nombre del docente]
- **Estudiante:** [Nombre completo]
- **Curso o paralelo:** [Curso]
- **Lugar:** [Ciudad]
- **Fecha:** [Día, mes y año]

### Resumen

LaundryManager es una aplicación web en español para apoyar la administración diaria de una lavandería. Reúne en una sola interfaz la gestión de clientes, tipos de prendas, servicios, pedidos, pagos, entregas, usuarios, reportes y preferencias de apariencia. Su arquitectura separa una interfaz React, una API desarrollada con Node.js y Express, y una base de datos MySQL. El sistema aplica roles de administrador y personal; el backend calcula los importes de los pedidos a partir de los precios almacenados y conserva información histórica de los detalles y cambios de estado. La aplicación puede ejecutarse localmente. También se preparó una guía para desplegarla en tres máquinas Ubuntu, pero ese despliegue no debe considerarse realizado hasta completar y registrar las pruebas de las máquinas virtuales.

**Palabras clave:** lavandería, aplicación web, pedidos, API REST, MySQL, gestión.

### 1. Introducción

Una lavandería recibe prendas, presta servicios con distintos criterios de cobro, registra pagos y debe controlar cuándo cada pedido está listo y quién lo recibe. Si esa información se administra en registros separados, puede ser más difícil consultar el historial o conocer el saldo de un pedido.

LaundryManager propone centralizar esas operaciones en una aplicación web. La persona usuaria puede trabajar con clientes y pedidos desde una interfaz común, mientras que la API aplica reglas de negocio y MySQL conserva la información relacionada.

### 2. Planteamiento del problema

La gestión de una lavandería requiere relacionar clientes, prendas, servicios, precios, fechas, estados, pagos y entregas. Cuando estos datos no están vinculados, se dificulta hacer seguimiento de un pedido, comprobar su saldo y consultar las operaciones anteriores.

**Problema que aborda el proyecto:** la necesidad de organizar y consultar de forma centralizada el flujo de atención de pedidos de una lavandería.

> Ajusta este planteamiento con información real de la lavandería o institución donde se presenta el proyecto. No atribuyas entrevistas, encuestas ni mediciones que no se hayan realizado.

### 3. Justificación

El proyecto permite demostrar cómo una aplicación web puede integrar procesos relacionados en un solo flujo. Mantener clientes, pedidos, detalles, pagos e historial en una base relacional ayuda a consultar la información desde distintos módulos. Además, separar la interfaz, la API y la base de datos facilita explicar las responsabilidades de cada componente y deja una base para futuras mejoras.

### 4. Objetivos

#### Objetivo general

Desarrollar una aplicación web que centralice la gestión de las principales operaciones de una lavandería: clientes, pedidos, servicios, pagos, entregas y consultas.

#### Objetivos específicos

1. Implementar una interfaz para acceder a las funciones de gestión de lavandería.
2. Desarrollar una API que valide solicitudes y aplique reglas de negocio en el servidor.
3. Diseñar una base de datos relacional para conservar clientes, pedidos, servicios, pagos e historial.
4. Incorporar autenticación y permisos diferenciados para administrador y personal.
5. Proporcionar consultas de resumen y reportes para revisar la actividad registrada.
6. Documentar la ejecución local y el diseño de despliegue previsto.

### 5. Alcance y limitaciones

#### Alcance implementado

- Inicio de sesión y configuración inicial de la cuenta administradora.
- Roles `ADMIN` y `STAFF`, con operaciones restringidas al administrador cuando corresponde.
- Gestión de clientes y consulta de su historial.
- Gestión de tipos de prendas y servicios con precios.
- Registro, consulta, edición y cambio de estado de pedidos.
- Registro de pagos y anulación administrativa de pagos.
- Registro de entregas y de la persona que recibe.
- Panel de resumen, reportes de pedidos e ingresos.
- Personalización global de color, tipografía y fondo blanco o casi negro.
- Persistencia de los datos en MySQL.

#### Limitaciones y trabajo no verificado

- El despliegue completo en tres máquinas Ubuntu no está verificado; la instalación de Ubuntu en las máquinas virtuales quedó pendiente.
- No se afirma que la aplicación esté desplegada en producción.
- Las pruebas unitarias del backend no sustituyen pruebas completas de integración, seguridad, carga o aceptación de usuarios.
- Los datos y precios de `database/seeds/development.sql` son de ejemplo y no deben utilizarse como catálogo real de producción.
- Funciones no descritas en el código o en la documentación vigente se consideran fuera del alcance confirmado.

### 6. Requisitos del sistema

#### Requisitos funcionales

| Código | Requisito |
|---|---|
| RF-01 | El sistema permite configurar la primera cuenta administradora e iniciar y cerrar sesión. |
| RF-02 | El usuario autenticado puede consultar el resumen de operaciones. |
| RF-03 | El personal autorizado puede registrar, consultar y actualizar clientes, y revisar su historial. |
| RF-04 | El administrador puede gestionar tipos de prendas y servicios/precios. |
| RF-05 | El usuario autenticado puede crear, consultar y actualizar pedidos. |
| RF-06 | El sistema conserva los cambios de estado de los pedidos. |
| RF-07 | El usuario puede registrar pagos asociados a un pedido; el administrador puede anularlos. |
| RF-08 | El usuario puede confirmar la entrega y registrar quién recibe el pedido. |
| RF-09 | El sistema presenta reportes de pedidos e ingresos a partir de los datos registrados. |
| RF-10 | El administrador puede gestionar usuarios y preferencias globales de apariencia. |

#### Requisitos no funcionales

- **Interfaz:** aplicación web en español accesible desde un navegador moderno.
- **Separación de responsabilidades:** interfaz, API y persistencia se implementan como componentes diferenciados.
- **Persistencia relacional:** MySQL almacena las entidades y relaciones definidas en el esquema.
- **Validación y reglas:** las operaciones y cálculos principales se procesan en el backend.
- **Control de acceso:** las operaciones administrativas requieren el rol correspondiente.
- **Configuración segura:** las credenciales se proporcionan mediante variables de entorno; no se deben publicar archivos `.env`.
- **Mantenibilidad:** el frontend y el backend usan TypeScript y disponen de comandos de compilación.

### 7. Tecnologías utilizadas

| Tecnología | Uso en el proyecto |
|---|---|
| React 18 | Construcción de la interfaz web. |
| TypeScript | Tipado del frontend y del backend. |
| Vite | Servidor de desarrollo y compilación del frontend. |
| Node.js y Express | Ejecución de la API HTTP. |
| MySQL 8 y mysql2 | Base relacional y acceso desde la API. |
| Zod | Validación de datos en la API. |
| bcryptjs | Hash y verificación de contraseñas. |
| JSON Web Token | Token de sesión firmado por el backend. |
| Nginx | Servidor web y proxy inverso en el diseño de despliegue. |
| Ubuntu Server | Sistema operativo propuesto para las máquinas virtuales. |

### 8. Arquitectura y flujo de datos

#### Arquitectura de la aplicación

```text
Navegador
   │
   ├── Interfaz React + TypeScript
   │
   └── Solicitudes HTTP / JSON a /api
              │
              ▼
       API Node.js + Express
       validación, permisos y reglas
              │
              ▼
          MySQL 8
```

En ejecución local, Vite sirve el frontend y su proxy de desarrollo reenvía `/api` a la API local. En el diseño de despliegue de tres máquinas, Nginx y el frontend compilado se ubican en VM1, Express en VM2 y MySQL en VM3. Esta segunda topología está documentada, pero no se debe describir como despliegue terminado.

#### Flujo de registro de un pedido

1. El usuario autenticado completa el pedido en el frontend.
2. React envía a la API los identificadores de cliente, prendas y servicios, las cantidades y los demás datos requeridos.
3. Express valida la solicitud, verifica permisos y obtiene de MySQL los precios correspondientes.
4. El backend calcula los importes; no confía en un total calculado únicamente por el navegador.
5. La API persiste el pedido y sus detalles en MySQL y devuelve una respuesta JSON.
6. El frontend muestra el resultado y permite continuar con estados, pagos y entrega según el flujo.

### 9. Diseño de la base de datos

El esquema está definido en `database/schema.sql`. Las tablas principales son:

| Tabla | Propósito |
|---|---|
| `users` | Usuarios, correo, hash de contraseña, rol y estado activo. |
| `customers` | Datos de clientes y estado activo. |
| `garment_types` | Catálogo de tipos de prendas. |
| `services` | Catálogo de servicios, unidad de cobro y precio base. |
| `orders` | Cabecera del pedido, cliente, creador, fechas, estado e importes. |
| `order_items` | Prendas/servicios, cantidad, peso, precio unitario e importe histórico. |
| `payments` | Pagos, método, usuario que registra y datos de anulación. |
| `deliveries` | Entrega del pedido y nombre de quien lo recibe. |
| `order_status_history` | Cambios de estado, usuario y fecha. |
| `app_settings` | Preferencias globales de apariencia. |

#### Relaciones principales

- Un cliente puede tener muchos pedidos; cada pedido corresponde a un cliente.
- Un usuario puede crear muchos pedidos.
- Un pedido puede tener varios detalles, pagos y registros de historial.
- Cada detalle se relaciona con un tipo de prenda y un servicio.
- Los detalles almacenan el precio unitario utilizado para conservar el valor histórico del pedido.
- Un pedido puede tener un registro de entrega; `deliveries.order_id` es único.
- Los pagos guardan el usuario que los registró y, si fueron anulados, el usuario que realizó la anulación.
- `app_settings` usa una clave para guardar las preferencias de apariencia compartidas.

### 10. Módulos del sistema

| Módulo | Función principal |
|---|---|
| Inicio | Resumen, pedidos recientes e indicadores. |
| Clientes | Registro, consulta, actualización e historial de clientes. |
| Pedidos | Creación y consulta de pedidos, detalle, fechas, notas y estado. |
| Prendas | Catálogo de tipos de prendas. |
| Servicios | Catálogo de servicios y precios. |
| Pagos | Consulta y registro de pagos; anulación restringida al administrador. |
| Entregas | Consulta y confirmación de entrega con receptor. |
| Reportes | Consultas de pedidos e ingresos. |
| Usuarios | Administración de cuentas de usuario, según permisos. |
| Configuración | Preferencias de color, tipografía y fondo; diagnóstico de conexión. |

### 11. Seguridad y credenciales

- Las contraseñas se guardan como hash usando bcryptjs; la aplicación no las muestra después de su creación.
- La autenticación utiliza JWT con vencimiento configurado en el backend.
- Las rutas administrativas verifican el rol `ADMIN`.
- La aplicación incorpora Helmet y limita intentos en las rutas de configuración inicial e inicio de sesión.
- El acceso a base de datos se configura mediante variables de entorno.
- El archivo `.env` y los secretos no se deben subir a GitHub. `backend/.env.example` contiene valores de ejemplo que deben reemplazarse en cada instalación.
- En producción se debe configurar HTTPS, secretos propios y reglas de firewall restringidas; estas medidas requieren validación en el entorno de despliegue.
- No incluir contraseñas, tokens, datos reales de clientes ni capturas con información sensible en la exposición.

### 12. Instalación y ejecución local

La guía completa está en `README.md`. En Windows PowerShell, desde la raíz del proyecto:

1. Tener Node.js LTS y MySQL 8 instalados.
2. Ejecutar el asistente de base de datos y configuración:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\database\scripts\setup-windows.ps1
   ```

3. Iniciar la API en una terminal:

   ```powershell
   Set-Location backend
   npm.cmd install
   npm.cmd run build
   npm.cmd run dev
   ```

4. Iniciar el frontend en otra terminal:

   ```powershell
   Set-Location frontend
   npm.cmd install
   npm.cmd run dev
   ```

5. Abrir la dirección local indicada por Vite e iniciar la configuración inicial de la cuenta administradora si la base de datos aún no tiene usuarios.

La contraseña de MySQL se introduce cuando el asistente la solicita; no debe escribirse dentro del comando, en el código ni en un archivo que se suba al repositorio.

### 13. Pruebas y resultados

#### Resultados locales registrados

Durante la verificación local del proyecto se registró lo siguiente:

- Compilación de producción del backend completada.
- Pruebas del backend: 5 de 5 aprobadas.
- Compilación de producción del frontend completada.
- Se probó manualmente el flujo de clientes, pedidos, pagos, cambios de estado, entrega, reportes y persistencia con datos de prueba.
- Se comprobó guardar los modos de fondo claro y oscuro y conservar la selección al recargar la aplicación.

Estos resultados corresponden a pruebas locales y no equivalen a una certificación de seguridad, carga o disponibilidad.

#### Pruebas pendientes

- Completar la instalación de Ubuntu y configurar las tres máquinas virtuales.
- Ejecutar y registrar la conectividad entre Nginx, API y MySQL en la topología de despliegue.
- Probar restauración de copias de seguridad y procedimientos operativos.
- Ejecutar pruebas de aceptación con usuarios y documentar sus resultados, si el curso lo requiere.
- Repetir las pruebas de producción en el entorno real antes de afirmar que el sistema está desplegado.

Para repetir las comprobaciones automatizadas del backend:

```powershell
Set-Location backend
npm.cmd test
npm.cmd run build
```

Para compilar el frontend:

```powershell
Set-Location frontend
npm.cmd run build
```

### 14. Guía breve de uso

1. Iniciar sesión con una cuenta autorizada.
2. Registrar o buscar un cliente.
3. Crear un pedido y agregar los tipos de prendas y servicios requeridos.
4. Revisar el total calculado y registrar, si corresponde, un pago.
5. Actualizar el estado del pedido conforme avanza el trabajo.
6. Buscar el pedido en Entregas y confirmar quién lo recibe.
7. Consultar el historial, el resumen y los reportes.
8. El administrador puede mantener los catálogos, usuarios y preferencias globales.

### 15. Casos de prueba sugeridos

| Caso | Acción | Resultado esperado |
|---|---|---|
| CP-01 Inicio de sesión | Ingresar credenciales válidas de una cuenta de prueba. | Se abre la aplicación con el usuario autenticado. |
| CP-02 Permisos | Intentar usar una función exclusiva de administrador con un usuario STAFF. | La API rechaza la operación administrativa. |
| CP-03 Pedido | Crear un pedido con cliente, prendas y servicios del catálogo. | Se muestra el pedido y el importe calculado por el backend. |
| CP-04 Pago parcial | Registrar un pago menor o igual al saldo pendiente. | El pago queda asociado al pedido y se actualiza el saldo. |
| CP-05 Anulación | Solicitar la anulación de un pago con un usuario administrador. | El pago queda marcado como anulado y no se suma a lo cobrado. |
| CP-06 Estado | Avanzar un pedido por los estados habilitados. | Se conserva el estado actual y el historial de cambios. |
| CP-07 Entrega | Confirmar la entrega e indicar quién recibe. | Queda registrado el receptor y la entrega del pedido. |
| CP-08 Apariencia | Cambiar el fondo y guardar; recargar la aplicación. | La preferencia guardada continúa aplicada. |

Ejecuta estos casos con una base de datos de desarrollo y registros ficticios. Confirma los resultados observados y anota cualquier diferencia.

### 16. Conclusiones

LaundryManager integra en una sola aplicación las operaciones centrales de una lavandería y separa la interfaz, las reglas de negocio y la persistencia. El servidor mantiene la responsabilidad de validar solicitudes y calcular importes, mientras que MySQL conserva las relaciones y el historial. Las pruebas locales permiten demostrar el flujo implementado; completar la validación del despliegue en tres máquinas y documentar pruebas adicionales son pasos pendientes antes de considerar una instalación de producción.

### 17. Recomendaciones y trabajo futuro

- Completar la instalación y documentación de las máquinas virtuales Ubuntu.
- Ejecutar pruebas de integración y aceptación en un entorno reproducible.
- Validar backups y restauraciones periódicamente.
- Configurar HTTPS, rotación y protección de secretos antes de cualquier uso de producción.
- Preparar un catálogo de precios real y respaldos de datos antes de migrar una lavandería.
- Recoger observaciones de usuarios y priorizar mejoras a partir de necesidades verificadas.

### 18. Glosario

- **API:** interfaz HTTP que permite al frontend solicitar operaciones al backend.
- **Backend:** componente que valida las solicitudes, aplica reglas y accede a los datos.
- **Frontend:** interfaz con la que interactúa el usuario desde el navegador.
- **JWT:** token firmado que representa una sesión autenticada.
- **MySQL:** sistema de gestión de bases de datos relacionales utilizado por el proyecto.
- **Nginx:** servidor web que puede servir el frontend y reenviar solicitudes a la API.
- **REST:** estilo de diseño de recursos accesibles mediante HTTP.
- **VM:** máquina virtual que ejecuta un sistema operativo invitado.

### 19. Referencias

- Repositorio del proyecto: <https://github.com/jhovymanceravillca-jpg/LaundryManager>
- Instrucciones de instalación: `README.md`.
- Arquitectura: `docs/architecture.md`.
- Diseño de base de datos: `docs/database.md` y `database/schema.sql`.
- Pruebas: `docs/testing.md`.
- Despliegue previsto: `docs/deployment.md` y `docs/network.md`.

## 2. Presentación de 9 diapositivas

| N.º | Título | Contenido breve | Sugerencia visual |
|---|---|---|---|
| 1 | LaundryManager | Nombre del proyecto, estudiante, materia e institución. | Captura limpia de la pantalla de inicio, sin datos personales. |
| 2 | Problema y propuesta | Necesidad de relacionar clientes, pedidos, pagos y entregas; propuesta de centralizar el flujo. | Diagrama “registros separados → sistema centralizado”. |
| 3 | Objetivos y alcance | Objetivo general y módulos incluidos; aclarar alcance local. | Íconos de clientes, pedido, pago y entrega. |
| 4 | Funcionalidades | Clientes, catálogo, pedidos, estados, pagos, entregas y reportes. | Flujo de trabajo de un pedido. |
| 5 | Arquitectura | React/Vite, API Express y MySQL; Nginx/3 VMs como despliegue previsto. | Diagrama de cajas y flechas. |
| 6 | Base de datos | Entidades y relaciones principales; precios históricos e historial de estados. | Diagrama ER simplificado. |
| 7 | Seguridad y apariencia | Roles, bcrypt, JWT, variables de entorno y personalización visual. | Captura de preferencias sin información sensible. |
| 8 | Pruebas y estado del proyecto | Builds y pruebas locales; 5/5 pruebas backend registradas; despliegue de VMs pendiente. | Lista visual “verificado localmente / pendiente”. |
| 9 | Conclusiones y mejoras | Valor del sistema y próximos pasos. | Resumen del flujo y lista breve de trabajo futuro. |

## 3. Guion oral aproximado de 5 a 7 minutos

### Diapositiva 1 — Presentación

Buenos días. Mi nombre es **[nombre]** y voy a presentar LaundryManager, un sistema web para organizar las operaciones principales de una lavandería. La aplicación reúne clientes, pedidos, pagos, entregas y reportes en una misma interfaz. En esta exposición explicaré el problema que aborda, cómo está construida, qué se pudo verificar y qué queda pendiente.

### Diapositiva 2 — Problema y propuesta

Una lavandería debe relacionar cada pedido con un cliente, los servicios realizados, el precio, los pagos y la fecha de entrega. Si esta información queda dispersa, puede costar seguir el pedido y revisar el saldo o el historial. LaundryManager propone centralizar esa información y permitir consultar el avance desde diferentes módulos. El proyecto implementa una solución de software; no afirmo que se haya medido una mejora económica o de productividad en una empresa real.

### Diapositiva 3 — Objetivos y alcance

El objetivo general fue desarrollar una aplicación web para gestionar las operaciones principales de una lavandería. Para ello se implementaron módulos de clientes, pedidos, catálogo de prendas y servicios, pagos, entregas, usuarios, reportes y configuración de apariencia. La aplicación fue ejecutada localmente. El despliegue en tres máquinas Ubuntu está documentado como una arquitectura prevista, pero su instalación y validación todavía están pendientes.

### Diapositiva 4 — Funcionalidades

El flujo comienza con el registro o búsqueda de un cliente. Después se crea un pedido con prendas y servicios del catálogo. La aplicación registra los estados del trabajo y permite asociar pagos. Cuando se termina, se confirma la entrega y se registra quién lo recibe. También se pueden consultar resúmenes y reportes. Los permisos distinguen las operaciones generales de las que requieren administración.

### Diapositiva 5 — Arquitectura

La interfaz está desarrollada con React y TypeScript. Se comunica mediante solicitudes HTTP y JSON con una API construida con Node.js y Express. El backend valida los datos, aplica permisos y reglas del negocio, y consulta MySQL. En el desarrollo local, Vite sirve la interfaz y reenvía las solicitudes de API. Para un despliegue posterior se diseñaron tres máquinas: Nginx y frontend, API y base de datos, cada una en una VM distinta. Esa topología todavía debe instalarse y probarse.

### Diapositiva 6 — Base de datos

La base de datos contiene tablas para usuarios, clientes, tipos de prendas, servicios, pedidos, detalles, pagos, entregas, historial de estados y preferencias de apariencia. Las relaciones permiten consultar los detalles y pagos asociados a un pedido. El detalle conserva el precio aplicado en el momento de la operación, y el historial permite revisar cambios de estado. Las restricciones y relaciones están definidas en el esquema SQL del proyecto.

### Diapositiva 7 — Seguridad y apariencia

Las contraseñas se almacenan como hashes, no como texto legible. La API usa autenticación con JWT y restringe las funciones administrativas mediante roles. Las credenciales de base de datos se configuran mediante variables de entorno y no deben publicarse. El sistema también permite que el administrador seleccione un color, una tipografía y un fondo claro u oscuro para la aplicación.

### Diapositiva 8 — Pruebas y estado

En el entorno local se registró la compilación del backend y del frontend, y las cinco pruebas automatizadas del backend aprobaron. También se probó manualmente el flujo de clientes, pedidos, pagos, estados, entregas y reportes usando datos de prueba. Se verificó guardar los dos modos de fondo y conservarlos al recargar. No presento estas comprobaciones como despliegue productivo: falta instalar y validar las tres máquinas virtuales.

### Diapositiva 9 — Conclusiones

Como conclusión, LaundryManager integra operaciones relacionadas de una lavandería y mantiene separadas la interfaz, la lógica de negocio y la base de datos. El backend calcula los importes y controla las operaciones según el rol. Como próximos pasos, se debe completar la instalación de Ubuntu, ejecutar pruebas de conectividad entre componentes, validar copias de seguridad y recoger comentarios de usuarios. Muchas gracias; quedo atenta a sus preguntas.

## 4. Demostración práctica de 3 a 5 minutos

Antes de comenzar, inicia la aplicación local y comprueba que la API y MySQL estén disponibles. Usa una cuenta y registros ficticios. No muestres contraseñas, correos personales ni datos reales.

1. **Inicio — 30 segundos:** muestra el panel y explica que presenta el resumen de las operaciones registradas.
2. **Clientes — 40 segundos:** abre Clientes y muestra cómo se consulta un cliente ficticio o registra uno con datos de prueba.
3. **Pedido — 60 segundos:** crea un pedido de demostración con un servicio y tipo de prenda del catálogo. Explica que el backend calcula el importe.
4. **Pago y estado — 45 segundos:** registra un pago de prueba si la base está preparada para ello y muestra el estado/historial del pedido.
5. **Entrega y consulta — 45 segundos:** abre Entregas o el detalle del pedido, y muestra el registro de receptor o los reportes disponibles.
6. **Apariencia — 30 segundos:** en Configuración cambia el fondo o color, guarda y muestra que permanece al recargar.
7. **Cierre — 20 segundos:** resume que el flujo se verificó localmente y que el despliegue de VMs sigue pendiente.

**Plan alternativo:** prepara capturas sanitizadas si falla Internet, MySQL o la aplicación. No inventes un resultado; explica la incidencia y presenta la captura solo si corresponde a una prueba real.

## 5. Preguntas posibles del docente

### 1. ¿Qué problema resuelve el proyecto?

Centraliza la gestión de clientes, pedidos, catálogo, pagos, estados, entregas y reportes para que la información de una operación esté relacionada en un mismo sistema.

### 2. ¿Por qué se eligió una arquitectura separada?

La interfaz, el backend y la base de datos tienen responsabilidades distintas. Esta separación hace más claro dónde se presenta la información, dónde se validan las operaciones y dónde se persisten los datos.

### 3. ¿Por qué el backend calcula los importes?

Para que las reglas y precios aplicados no dependan únicamente de valores enviados por el navegador. El servidor valida la solicitud y consulta los precios almacenados.

### 4. ¿Cómo se guardan las contraseñas?

Se guarda un hash calculado con bcryptjs. La aplicación verifica la contraseña comparándola con ese hash; no necesita mostrar la contraseña guardada.

### 5. ¿Qué diferencia hay entre administrador y personal?

La API comprueba el rol. Algunas funciones, como gestionar usuarios o modificar ciertas configuraciones y catálogos, requieren permisos administrativos.

### 6. ¿Qué pasa si cambia el precio de un servicio?

Los detalles del pedido conservan el precio unitario que se utilizó en esa operación, de modo que se mantiene el valor histórico del pedido.

### 7. ¿Qué pruebas se realizaron?

Se registró que compilaron frontend y backend, aprobaron 5 de 5 pruebas automatizadas del backend y se recorrió manualmente el flujo local con datos de prueba. No se debe confundir esto con pruebas en producción o entre VMs.

### 8. ¿Está desplegado en producción?

No. El proyecto se ejecutó y probó localmente. La guía de tres VMs Ubuntu existe, pero falta completar su instalación y documentar sus pruebas de red y persistencia.

### 9. ¿Cómo se evita publicar las credenciales?

Los archivos `.env` se excluyen del control de versiones; se usa un archivo de ejemplo con valores que deben reemplazarse. Los secretos se configuran localmente y no se incluyen en la documentación pública.

### 10. ¿Qué mejoras futuras considera?

Completar el despliegue de las VMs, realizar pruebas de integración y aceptación, validar backups y restauración, y priorizar nuevas mejoras con observaciones reales de usuarios.

## Datos por completar antes de presentar

- [ ] Institución, carrera, materia, docente, estudiante, curso y fecha.
- [ ] Confirmar si el docente exige normas o formato específicos, por ejemplo APA.
- [ ] Añadir capturas propias sin nombres, correos, credenciales ni datos reales.
- [ ] Ejecutar nuevamente los comandos de pruebas y registrar la fecha y el resultado actual.
- [ ] Confirmar qué pasos de la demostración funcionarán en el equipo y preparar un plan alternativo.
- [ ] No declarar instalado el despliegue en VMs ni producción hasta verificarlo.
