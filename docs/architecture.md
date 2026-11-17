# Arquitectura

```text
Usuario → Host-only/NAT de VirtualBox → Nginx VM1 (192.168.56.10)
        → Express VM2 (192.168.56.20:3000)
        → MySQL VM3 (192.168.56.30:3306) → Express → React → Usuario
```

VM1 sirve los recursos estáticos compilados de React y proxya `/api/` a VM2. VM2 valida solicitudes, aplica reglas de negocio y realiza consultas parametrizadas con un pool mysql2. VM3 conserva los datos y sólo acepta conexiones del backend.

Las VMs son computadores virtuales independientes. La IP identifica cada máquina dentro de la red privada; los puertos distinguen servicios. REST describe los recursos HTTP y JSON es el formato de intercambio.

La aplicación tiene módulos para configuración, middleware, rutas y servicios. Las transacciones SQL se usan al crear pedidos, registrar pagos, cambiar el estado y confirmar entregas.
